import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Repository, Between } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { StripeService } from './stripe.service';
import { CryptoPaymentService } from './crypto-payment.service';
import { FraudDetectionService } from './fraud-detection.service';
import { Payment, PaymentStatus, PaymentMethod, PaymentType } from '../entities/payment.entity';
import { PaymentRefund, RefundStatus } from '../entities/payment-refund.entity';
import { SavedPaymentMethod } from '../entities/saved-payment-method.entity';
import { CreatePaymentDto, VerifyCryptoPaymentDto, CreateRefundDto } from '../dto/payment.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentRefund)
    private refundRepository: Repository<PaymentRefund>,
    @InjectRepository(SavedPaymentMethod)
    private savedPaymentMethodRepository: Repository<SavedPaymentMethod>,
    private stripeService: StripeService,
    private cryptoPaymentService: CryptoPaymentService,
    private fraudDetectionService: FraudDetectionService,
  ) {}

  /**
   * Create a new payment
   */
  async createPayment(dto: CreatePaymentDto, ipAddress?: string): Promise<Payment> {
    // Validate idempotency key
    if (dto.idempotencyKey) {
      const existingPayment = await this.paymentRepository.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
      });

      if (existingPayment) {
        return existingPayment;
      }
    }

    // Perform fraud analysis
    const fraudAnalysis = await this.fraudDetectionService.analyzePayment(
      dto.userId,
      dto.amount,
      dto.currency,
      dto.method,
      ipAddress,
    );

    if (fraudAnalysis.riskLevel === 'high') {
      throw new BadRequestException('Payment rejected due to fraud risk');
    }

    let payment: Payment;

    if (dto.method === PaymentMethod.STRIPE) {
      // Handle Stripe payment
      const result = await this.stripeService.initiatePayment({
        userId: dto.userId,
        method: dto.method,
        amount: dto.amount,
        currency: dto.currency,
        type: dto.type,
        metadata: dto.metadata,
        idempotencyKey: dto.idempotencyKey || uuidv4(),
      });

      payment = await this.paymentRepository.findOne({
        where: { stripePaymentIntentId: result.paymentIntentId },
      });
    } else {
      // Handle crypto payment
      payment = this.paymentRepository.create({
        userId: dto.userId,
        method: dto.method,
        currency: dto.currency,
        type: dto.type,
        amount: BigInt(Math.round(dto.amount * 1e8)), // Convert to Wei/smallest unit
        amountDisplayValue: dto.amount,
        status: PaymentStatus.PENDING,
        idempotencyKey: dto.idempotencyKey,
        metadata: dto.metadata,
        fraudAnalysis,
      });

      payment = await this.paymentRepository.save(payment);
    }

    // Store fraud analysis
    payment.fraudAnalysis = fraudAnalysis;
    await this.paymentRepository.save(payment);

    return payment;
  }

  /**
   * Verify a crypto payment
   */
  async verifyCryptoPayment(dto: VerifyCryptoPaymentDto): Promise<Payment> {
    return this.cryptoPaymentService.verifyTransaction(dto);
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({ where: { id } });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  /**
   * Get payments for a user
   */
  async getUserPayments(userId: string, limit: number = 20, offset: number = 0): Promise<[Payment[], number]> {
    return this.paymentRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get payments by status
   */
  async getPaymentsByStatus(status: PaymentStatus, limit: number = 20, offset: number = 0): Promise<[Payment[], number]> {
    return this.paymentRepository.findAndCount({
      where: { status },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Refund a payment
   */
  async refundPayment(dto: CreateRefundDto): Promise<PaymentRefund> {
    const payment = await this.getPaymentById(dto.paymentId);

    if (payment.status !== PaymentStatus.SUCCEEDED && payment.status !== PaymentStatus.PARTIALLY_REFUNDED) {
      throw new BadRequestException('Payment cannot be refunded in its current status');
    }

    // Check for duplicate refund (idempotency)
    if (dto.idempotencyKey) {
      const existingRefund = await this.refundRepository.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
      });

      if (existingRefund) {
        return existingRefund;
      }
    }

    let refund: PaymentRefund;

    if (payment.method === PaymentMethod.STRIPE) {
      refund = await this.stripeService.refundPayment(dto.paymentId, dto.amount);
    } else {
      // For crypto, create refund record (actual execution depends on implementation)
      refund = this.refundRepository.create({
        paymentId: dto.paymentId,
        type: dto.amount ? 'partial' : 'full',
        amount: dto.amount || (Number(payment.amount) / 1e8),
        reason: dto.reason,
        notes: dto.notes,
        status: RefundStatus.PENDING,
        idempotencyKey: dto.idempotencyKey,
        requestedBy: payment.userId,
      });

      refund = await this.refundRepository.save(refund);
    }

    // Update payment refund tracking
    payment.refundedAmount += refund.amount;

    if (payment.refundedAmount >= payment.amountDisplayValue) {
      payment.status = PaymentStatus.REFUNDED;
    } else {
      payment.status = PaymentStatus.PARTIALLY_REFUNDED;
    }

    await this.paymentRepository.save(payment);

    return refund;
  }

  /**
   * Get refunds for a payment
   */
  async getPaymentRefunds(paymentId: string): Promise<PaymentRefund[]> {
    return this.refundRepository.find({
      where: { paymentId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Save a payment method for future use
   */
  async savePaymentMethod(
    userId: string,
    paymentMethodData: any,
    nickname: string,
    setAsDefault?: boolean,
  ): Promise<SavedPaymentMethod> {
    if (setAsDefault) {
      await this.savedPaymentMethodRepository.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }

    const savedMethod = await this.stripeService.savePaymentMethod(
      userId,
      paymentMethodData.stripePaymentMethodId,
      nickname,
      setAsDefault,
    );

    return savedMethod;
  }

  /**
   * Get saved payment methods for a user
   */
  async getSavedPaymentMethods(userId: string): Promise<SavedPaymentMethod[]> {
    return this.savedPaymentMethodRepository.find({
      where: { userId, isActive: true },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Delete a saved payment method
   */
  async deleteSavedPaymentMethod(userId: string, methodId: string): Promise<void> {
    const method = await this.savedPaymentMethodRepository.findOne({
      where: { id: methodId, userId },
    });

    if (!method) {
      throw new NotFoundException('Payment method not found');
    }

    if (method.stripePaymentMethodId) {
      await this.stripeService.deletePaymentMethod(method.stripePaymentMethodId);
    }

    await this.savedPaymentMethodRepository.delete(methodId);
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(userId: string, methodId: string): Promise<SavedPaymentMethod> {
    const method = await this.savedPaymentMethodRepository.findOne({
      where: { id: methodId, userId },
    });

    if (!method) {
      throw new NotFoundException('Payment method not found');
    }

    // Unset other defaults
    await this.savedPaymentMethodRepository.update(
      { userId, isDefault: true },
      { isDefault: false },
    );

    method.isDefault = true;
    return this.savedPaymentMethodRepository.save(method);
  }

  /**
   * Get payment analytics
   */
  async getPaymentAnalytics(dateFrom: Date, dateTo: Date): Promise<{
    totalRevenue: number;
    totalTransactions: number;
    successRate: number;
    averageTransactionValue: number;
    byPaymentMethod: Record<string, number>;
  }> {
    const payments = await this.paymentRepository.find({
      where: {
        createdAt: Between(dateFrom, dateTo),
      },
    });

    const succeededPayments = payments.filter((p) => p.status === PaymentStatus.SUCCEEDED);
    const totalRevenue = succeededPayments.reduce((sum, p) => sum + p.amountDisplayValue, 0);
    const averageTransactionValue = succeededPayments.length > 0 ? totalRevenue / succeededPayments.length : 0;
    const successRate = payments.length > 0 ? (succeededPayments.length / payments.length) * 100 : 0;

    const byPaymentMethod: Record<string, number> = {};
    succeededPayments.forEach((p) => {
      byPaymentMethod[p.method] = (byPaymentMethod[p.method] || 0) + p.amountDisplayValue;
    });

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalTransactions: payments.length,
      successRate: Math.round(successRate * 100) / 100,
      averageTransactionValue: Math.round(averageTransactionValue * 100) / 100,
      byPaymentMethod,
    };
  }

  /**
   * Retry failed payment
   */
  async retryPayment(paymentId: string): Promise<Payment> {
    const payment = await this.getPaymentById(paymentId);

    if (
      payment.status !== PaymentStatus.FAILED &&
      payment.status !== PaymentStatus.PENDING
    ) {
      throw new BadRequestException('Payment cannot be retried in its current status');
    }

    if (payment.retryCount >= 3) {
      throw new BadRequestException('Maximum retry attempts exceeded');
    }

    payment.retryCount += 1;
    payment.lastRetryAt = new Date();
    payment.nextRetryAt = new Date(Date.now() + Math.pow(2, payment.retryCount) * 60000); // Exponential backoff

    return this.paymentRepository.save(payment);
  }

  /**
   * Search payments with filters
   */
  async searchPayments(filters: {
    userId?: string;
    status?: PaymentStatus;
    method?: PaymentMethod;
    type?: PaymentType;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<[Payment[], number]> {
    const query = this.paymentRepository.createQueryBuilder('payment');

    if (filters.userId) {
      query.andWhere('payment.userId = :userId', { userId: filters.userId });
    }

    if (filters.status) {
      query.andWhere('payment.status = :status', { status: filters.status });
    }

    if (filters.method) {
      query.andWhere('payment.method = :method', { method: filters.method });
    }

    if (filters.type) {
      query.andWhere('payment.type = :type', { type: filters.type });
    }

    if (filters.dateFrom) {
      query.andWhere('payment.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    if (filters.dateTo) {
      query.andWhere('payment.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }

    query.orderBy('payment.createdAt', 'DESC')
      .take(filters.limit || 20)
      .skip(filters.offset || 0);

    return query.getManyAndCount();
  }
}
