import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
  IsJSON,
  IsBoolean,
  Min,
  Max,
  Length,
  IsEmail,
} from 'class-validator';
import { PaymentMethod, PaymentType, PaymentCurrency } from '../entities/payment.entity';

export class CreatePaymentDto {
  @IsUUID()
  userId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsEnum(PaymentCurrency)
  currency: PaymentCurrency;

  @IsEnum(PaymentType)
  type: PaymentType;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsJSON()
  metadata?: {
    description?: string;
    orderId?: string;
    invoiceNumber?: string;
    customData?: Record<string, any>;
  };

  @IsOptional()
  @IsBoolean()
  savePaymentMethod?: boolean;

  @IsOptional()
  @IsString()
  savedPaymentMethodId?: string;

  @IsOptional()
  @IsString()
  @IsEmail()
  receiptEmail?: string;
}

export class InitiateStripePaymentDto {
  @IsUUID()
  userId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentCurrency)
  currency: PaymentCurrency;

  @IsEnum(PaymentType)
  type: PaymentType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  statementDescriptor?: string;

  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsJSON()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  savePaymentMethod?: boolean;

  @IsOptional()
  @IsString()
  savedPaymentMethodId?: string;
}

export class ConfirmStripePaymentDto {
  @IsString()
  paymentIntentId: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsString()
  clientSecret?: string;
}

export class InitiateCryptoPaymentDto {
  @IsUUID()
  userId: string;

  @IsNumber()
  @Min(0.0001)
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod; // ETHEREUM, BITCOIN, USDC, MATIC

  @IsEnum(PaymentType)
  type: PaymentType;

  @IsString()
  fromAddress: string; // User's wallet address

  @IsOptional()
  @IsString()
  toAddress?: string; // Override default contract address

  @IsOptional()
  @IsJSON()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsBoolean()
  saveWallet?: boolean;
}

export class VerifyCryptoPaymentDto {
  @IsUUID()
  paymentId: string;

  @IsString()
  transactionHash: string;

  @IsOptional()
  @IsNumber()
  blockConfirmations?: number;

  @IsOptional()
  @IsString()
  fromAddress?: string;

  @IsOptional()
  @IsString()
  toAddress?: string;
}

export class CreateRefundDto {
  @IsUUID()
  paymentId: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number; // If not specified, full refund

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class PaymentResponseDto {
  id: string;
  userId: string;
  method: PaymentMethod;
  currency: PaymentCurrency;
  type: PaymentType;
  amount: number;
  refundedAmount: number;
  status: string;
  stripePaymentIntentId?: string;
  transactionHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PaymentListDto {
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  status?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  limit: number = 20;

  @IsOptional()
  offset: number = 0;
}

export class SavePaymentMethodDto {
  @IsEnum(['card', 'bank_account', 'crypto_wallet'])
  type: string;

  @IsString()
  nickname: string;

  @IsOptional()
  @IsBoolean()
  setAsDefault?: boolean;

  // For cards (via Stripe)
  @IsOptional()
  @IsString()
  stripePaymentMethodId?: string;

  // For crypto
  @IsOptional()
  @IsString()
  walletAddress?: string;

  @IsOptional()
  @IsString()
  walletChain?: string;
}

export class UpdatePaymentMethodDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReconciliationReportDto {
  date: Date;
  provider: string;
  status: string;
  totalPaymentsProcessed: number;
  totalAmountProcessed: number;
  totalRefunds: number;
  discrepancyCount: number;
  discrepancies?: Record<string, any>[];
}
