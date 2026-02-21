import { Injectable } from '@nestjs/common';
import { Repository, Between, LessThan } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { PaymentReconciliation, ReconciliationStatus, DiscrepancyType } from '../entities/payment-reconciliation.entity';

export interface ReconciliationDiscrepancy {
  type: DiscrepancyType;
  paymentId: string;
  message: string;
  details: Record<string, any>;
}

@Injectable()
export class ReconciliationService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentReconciliation)
    private reconciliationRepository: Repository<PaymentReconciliation>,
  ) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-04-10',
    });
  }

  /**
   * Run reconciliation daily for Stripe
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async reconcileStripeDaily(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const tomorrow = new Date(yesterday);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await this.reconcileStripe(yesterday, tomorrow);
  }

  /**
   * Run reconciliation for crypto payments daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async reconcileCryptoDaily(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const tomorrow = new Date(yesterday);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await this.reconcileCrypto(yesterday, tomorrow);
  }

  /**
   * Reconcile Stripe payments
   */
  async reconcileStripe(dateFrom: Date, dateTo: Date): Promise<PaymentReconciliation> {
    const reconciliation = this.reconciliationRepository.create({
      date: new Date(),
      provider: 'stripe',
      status: ReconciliationStatus.IN_PROGRESS,
      startedAt: new Date(),
    });

    await this.reconciliationRepository.save(reconciliation);

    try {
      const discrepancies: ReconciliationDiscrepancy[] = [];

      // Get all local payments for the period
      const localPayments = await this.paymentRepository.find({
        where: {
          method: 'stripe',
          createdAt: Between(dateFrom, dateTo),
        },
      });

      // Get all charges from Stripe for the period
      const stripeCharges = await this.getStripeCharges(dateFrom, dateTo);

      // Check for missing payments (in Stripe but not in our DB)
      for (const charge of stripeCharges) {
        const localPayment = localPayments.find((p) => p.stripeChargeId === charge.id);

        if (!localPayment) {
          discrepancies.push({
            type: DiscrepancyType.MISSING_PAYMENT,
            paymentId: 'unknown',
            message: `Charge ${charge.id} found in Stripe but not in local database`,
            details: {
              chargeId: charge.id,
              amount: charge.amount,
              currency: charge.currency,
              status: charge.status,
            },
          });
        } else {
          // Check amount match
          if (localPayment.amount !== BigInt(charge.amount)) {
            discrepancies.push({
              type: DiscrepancyType.AMOUNT_MISMATCH,
              paymentId: localPayment.id,
              message: `Amount mismatch for charge ${charge.id}`,
              details: {
                chargeId: charge.id,
                localAmount: localPayment.amount.toString(),
                stripeAmount: charge.amount.toString(),
              },
            });
          }

          // Check status match
          const stripeStatus = this.mapStripeStatus(charge.status);
          if (localPayment.status !== stripeStatus && localPayment.status !== PaymentStatus.SUCCEEDED) {
            discrepancies.push({
              type: DiscrepancyType.STATUS_MISMATCH,
              paymentId: localPayment.id,
              message: `Status mismatch for charge ${charge.id}`,
              details: {
                chargeId: charge.id,
                localStatus: localPayment.status,
                stripeStatus,
              },
            });
          }
        }
      }

      // Check for extra payments (in our DB but not in Stripe)
      for (const payment of localPayments) {
        if (payment.stripeChargeId) {
          const stripeCharge = stripeCharges.find((c) => c.id === payment.stripeChargeId);

          if (!stripeCharge && payment.status === PaymentStatus.SUCCEEDED) {
            discrepancies.push({
              type: DiscrepancyType.EXTRA_PAYMENT,
              paymentId: payment.id,
              message: `Payment ${payment.id} marked as succeeded but not found in Stripe`,
              details: {
                paymentId: payment.id,
                amount: payment.amountDisplayValue,
              },
            });
          }
        }
      }

      // Update reconciliation record
      reconciliation.status =
        discrepancies.length === 0 ? ReconciliationStatus.COMPLETED : ReconciliationStatus.PARTIAL;
      reconciliation.completedAt = new Date();
      reconciliation.totalPaymentsProcessed = localPayments.length;
      reconciliation.totalAmountProcessed = localPayments.reduce((sum, p) => sum + p.amountDisplayValue, 0);
      reconciliation.discrepancyCount = discrepancies.length;
      reconciliation.discrepancies = discrepancies.map((d) => ({
        type: d.type,
        paymentId: d.paymentId,
        details: d.details,
      }));

      return await this.reconciliationRepository.save(reconciliation);
    } catch (error) {
      reconciliation.status = ReconciliationStatus.FAILED;
      reconciliation.errorMessage = error.message;
      reconciliation.completedAt = new Date();

      return await this.reconciliationRepository.save(reconciliation);
    }
  }

  /**
   * Reconcile crypto payments (simplified - actual implementation depends on blockchain monitoring)
   */
  async reconcileCrypto(dateFrom: Date, dateTo: Date): Promise<PaymentReconciliation> {
    const reconciliation = this.reconciliationRepository.create({
      date: new Date(),
      provider: 'blockchain',
      status: ReconciliationStatus.IN_PROGRESS,
      startedAt: new Date(),
    });

    await this.reconciliationRepository.save(reconciliation);

    try {
      const discrepancies: ReconciliationDiscrepancy[] = [];

      // Get all local crypto payments for the period
      const cryptoPayments = await this.paymentRepository.find({
        where: {
          method: 'ethereum',
          createdAt: Between(dateFrom, dateTo),
        },
      });

      // Check for transactions that should be confirmed but aren't
      for (const payment of cryptoPayments) {
        if (payment.transactionHash && payment.status !== PaymentStatus.SUCCEEDED) {
          // In production, check blockchain for actual transaction status
          // For now, flag as potential discrepancy
          if (payment.blockConfirmations === undefined && payment.status === PaymentStatus.PROCESSING) {
            discrepancies.push({
              type: DiscrepancyType.STATUS_MISMATCH,
              paymentId: payment.id,
              message: `Crypto payment pending confirmation for extended period`,
              details: {
                paymentId: payment.id,
                transactionHash: payment.transactionHash,
                createdAt: payment.createdAt,
              },
            });
          }
        }
      }

      // Update reconciliation record
      reconciliation.status =
        discrepancies.length === 0 ? ReconciliationStatus.COMPLETED : ReconciliationStatus.PARTIAL;
      reconciliation.completedAt = new Date();
      reconciliation.totalPaymentsProcessed = cryptoPayments.length;
      reconciliation.totalAmountProcessed = cryptoPayments.reduce((sum, p) => sum + p.amountDisplayValue, 0);
      reconciliation.discrepancyCount = discrepancies.length;
      reconciliation.discrepancies = discrepancies.map((d) => ({
        type: d.type,
        paymentId: d.paymentId,
        details: d.details,
      }));

      return await this.reconciliationRepository.save(reconciliation);
    } catch (error) {
      reconciliation.status = ReconciliationStatus.FAILED;
      reconciliation.errorMessage = error.message;
      reconciliation.completedAt = new Date();

      return await this.reconciliationRepository.save(reconciliation);
    }
  }

  /**
   * Get reconciliation reports
   */
  async getReconciliationReports(limit: number = 30): Promise<PaymentReconciliation[]> {
    return this.reconciliationRepository.find({
      order: { date: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get latest reconciliation for a provider
   */
  async getLatestReconciliation(provider: string): Promise<PaymentReconciliation | null> {
    return this.reconciliationRepository.findOne({
      where: { provider },
      order: { date: 'DESC' },
    });
  }

  /**
   * Get Stripe charges for a date range
   */
  private async getStripeCharges(dateFrom: Date, dateTo: Date): Promise<Stripe.Charge[]> {
    const charges: Stripe.Charge[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const chargeList = await this.stripe.charges.list({
        created: {
          gte: Math.floor(dateFrom.getTime() / 1000),
          lte: Math.floor(dateTo.getTime() / 1000),
        },
        limit: 100,
        starting_after: startingAfter,
      });

      charges.push(...chargeList.data);
      hasMore = chargeList.has_more;

      if (chargeList.data.length > 0) {
        startingAfter = chargeList.data[chargeList.data.length - 1].id;
      }
    }

    return charges;
  }

  /**
   * Map Stripe status to our payment status
   */
  private mapStripeStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case 'succeeded':
        return PaymentStatus.SUCCEEDED;
      case 'failed':
        return PaymentStatus.FAILED;
      case 'pending':
        return PaymentStatus.PROCESSING;
      default:
        return PaymentStatus.PENDING;
    }
  }
}
