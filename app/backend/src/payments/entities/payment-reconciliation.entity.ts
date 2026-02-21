import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ReconciliationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

export enum DiscrepancyType {
  AMOUNT_MISMATCH = 'amount_mismatch',
  STATUS_MISMATCH = 'status_mismatch',
  MISSING_PAYMENT = 'missing_payment',
  EXTRA_PAYMENT = 'extra_payment',
  TIMESTAMP_MISMATCH = 'timestamp_mismatch',
  CURRENCY_MISMATCH = 'currency_mismatch',
}

@Entity('payment_reconciliation')
@Index(['date', 'provider'], { unique: true })
@Index(['status', 'date'])
@Index(['date'])
export class PaymentReconciliation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('date')
  date: Date;

  @Column()
  provider: string; // 'stripe', 'blockchain', 'coinbase', etc.

  @Column({
    type: 'enum',
    enum: ReconciliationStatus,
    default: ReconciliationStatus.PENDING,
  })
  status: ReconciliationStatus;

  // Metrics
  @Column({ default: 0 })
  totalPaymentsProcessed: number;

  @Column({ default: 0 })
  totalAmountProcessed: number;

  @Column({ default: 0 })
  totalRefunds: number;

  @Column({ default: 0 })
  totalRefundAmount: number;

  // Discrepancies
  @Column({ default: 0 })
  discrepancyCount: number;

  @Column({ type: 'simple-array', default: '' })
  discrepancyTypes: string[];

  @Column({ type: 'jsonb', nullable: true })
  discrepancies?: {
    type: DiscrepancyType;
    paymentId: string;
    details: Record<string, any>;
  }[];

  // System fields
  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  @Column({ nullable: true })
  errorMessage?: string;

  @Column({ type: 'jsonb', nullable: true })
  report?: {
    summary: string;
    details: Record<string, any>;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
