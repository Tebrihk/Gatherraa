import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum WebhookProvider {
  STRIPE = 'stripe',
  BLOCKCHAIN = 'blockchain',
  COINBASE = 'coinbase',
}

export enum WebhookStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('payment_webhooks')
@Index(['provider', 'externalId'], { unique: true })
@Index(['status', 'createdAt'])
@Index(['paymentId', 'provider'])
export class PaymentWebhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: WebhookProvider,
  })
  provider: WebhookProvider;

  @Column()
  externalId: string; // Provider's webhook ID

  @Column('uuid', { nullable: true })
  @Index()
  paymentId?: string;

  @Column({
    type: 'enum',
    enum: WebhookStatus,
    default: WebhookStatus.PENDING,
  })
  status: WebhookStatus;

  @Column()
  eventType: string; // e.g., 'charge.succeeded', 'transaction.confirmed'

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  processedPayload?: Record<string, any>;

  // Signature verification
  @Column()
  signature: string;

  @Column({ default: true })
  signatureVerified: boolean;

  // Processing
  @Column({ nullable: true })
  processedAt?: Date;

  @Column({ nullable: true })
  errorMessage?: string;

  // Retry tracking
  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  nextRetryAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
