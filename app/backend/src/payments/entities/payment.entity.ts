import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PaymentRefund } from './payment-refund.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum PaymentMethod {
  STRIPE = 'stripe',
  ETHEREUM = 'ethereum',
  BITCOIN = 'bitcoin',
  USDC = 'usdc',
  MATIC = 'matic',
}

export enum PaymentCurrency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  ETH = 'ETH',
  BTC = 'BTC',
  USDC = 'USDC',
  MATIC = 'MATIC',
}

export enum PaymentType {
  TICKET_PURCHASE = 'ticket_purchase',
  EVENT_LISTING = 'event_listing',
  SUBSCRIPTION = 'subscription',
  BOOKING = 'booking',
  OTHER = 'other',
}

@Entity('payments')
@Index(['userId', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['stripePaymentIntentId'], { unique: true, where: 'stripePaymentIntentId IS NOT NULL' })
@Index(['transactionHash'], { unique: true, where: 'transactionHash IS NOT NULL' })
@Index(['idempotencyKey'], { unique: true })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  userId: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  method: PaymentMethod;

  @Column({
    type: 'enum',
    enum: PaymentCurrency,
  })
  currency: PaymentCurrency;

  @Column({
    type: 'enum',
    enum: PaymentType,
  })
  type: PaymentType;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  // Amount in the smallest unit (cents for fiat, wei for crypto)
  @Column('bigint')
  amount: bigint; // Use bigint for precise decimal handling

  // Amount in human-readable format
  @Column('decimal', { precision: 19, scale: 8 })
  amountDisplayValue: number;

  // Refunded amount
  @Column('decimal', { precision: 19, scale: 8, default: 0 })
  refundedAmount: number;

  // Related entity information
  @Column('uuid', { nullable: true })
  @Index()
  ticketId?: string;

  @Column('uuid', { nullable: true })
  eventId?: string;

  // Stripe fields
  @Column({ nullable: true, unique: true })
  stripePaymentIntentId?: string;

  @Column({ nullable: true })
  stripeCustomerId?: string;

  @Column({ nullable: true })
  stripeChargeId?: string;

  @Column({ nullable: true })
  stripeCurrency?: string;

  // Crypto fields
  @Column({ nullable: true, unique: true })
  transactionHash?: string;

  @Column({ nullable: true })
  fromAddress?: string;

  @Column({ nullable: true })
  toAddress?: string;

  @Column({ nullable: true })
  contractAddress?: string;

  @Column({ nullable: true })
  gasPrice?: string;

  @Column({ nullable: true })
  gasUsed?: string;

  @Column({ nullable: true })
  blockNumber?: number;

  @Column({ nullable: true })
  blockConfirmations?: number;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    description?: string;
    orderId?: string;
    invoiceNumber?: string;
    customData?: Record<string, any>;
  };

  // Idempotency key for request deduplication
  @Column({ nullable: true, unique: true })
  idempotencyKey?: string;

  // Fraud detection
  @Column({ type: 'jsonb', nullable: true })
  fraudAnalysis?: {
    score: number;
    riskLevel: 'low' | 'medium' | 'high';
    reasons: string[];
    geoLocation?: string;
    velocity?: number;
  };

  // Payment provider response
  @Column({ type: 'jsonb', nullable: true })
  providerResponse?: Record<string, any>;

  // Error information
  @Column({ nullable: true })
  errorCode?: string;

  @Column({ nullable: true })
  errorMessage?: string;

  // Retry information
  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  lastRetryAt?: Date;

  @Column({ nullable: true })
  nextRetryAt?: Date;

  // Webhook tracking
  @Column({ default: false })
  webhookProcessed: boolean;

  @Column({ nullable: true })
  webhookProcessedAt?: Date;

  // Reconciliation
  @Column({ default: false })
  reconciled: boolean;

  @Column({ nullable: true })
  reconciledAt?: Date;

  // Refunds
  @OneToMany(() => PaymentRefund, (refund) => refund.payment, {
    eager: false,
    cascade: false,
  })
  refunds: PaymentRefund[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
