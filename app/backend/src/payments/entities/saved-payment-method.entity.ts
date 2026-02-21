import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum SavedPaymentMethodType {
  CARD = 'card',
  BANK_ACCOUNT = 'bank_account',
  CRYPTO_WALLET = 'crypto_wallet',
  APPLE_PAY = 'apple_pay',
  GOOGLE_PAY = 'google_pay',
}

@Entity('saved_payment_methods')
@Index(['userId', 'createdAt'])
@Index(['userId', 'isDefault'])
@Index(['stripePaymentMethodId'], { unique: true, where: 'stripePaymentMethodId IS NOT NULL' })
export class SavedPaymentMethod {
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
    enum: SavedPaymentMethodType,
  })
  type: SavedPaymentMethodType;

  @Column()
  nickname: string;

  // Display information
  @Column({ nullable: true })
  last4?: string;

  @Column({ nullable: true })
  brand?: string; // visa, mastercard, amex, etc.

  @Column({ nullable: true })
  expiryMonth?: number;

  @Column({ nullable: true })
  expiryYear?: number;

  @Column({ nullable: true })
  bankName?: string;

  @Column({ nullable: true })
  walletAddress?: string;

  @Column({ nullable: true })
  walletChain?: string; // ethereum, bitcoin, polygon, etc.

  // Stripe integration
  @Column({ nullable: true, unique: true })
  stripePaymentMethodId?: string;

  // Flags
  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: true })
  isActive: boolean;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ nullable: true })
  failedAttempts?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
