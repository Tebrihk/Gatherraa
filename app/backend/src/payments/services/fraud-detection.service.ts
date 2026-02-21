import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Payment } from '../entities/payment.entity';

export interface FraudAnalysisResult {
  score: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
  geoLocation?: string;
  velocity?: number;
}

@Injectable()
export class FraudDetectionService {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  /**
   * Analyze payment for fraud risk
   */
  async analyzePayment(
    userId: string,
    amount: number,
    currency: string,
    method: string,
    ipAddress?: string,
  ): Promise<FraudAnalysisResult> {
    const reasons: string[] = [];
    let score = 0;

    // Rule 1: Amount velocity check
    const velocityScore = await this.checkVelocity(userId, amount);
    score += velocityScore.score;
    if (velocityScore.score > 0) {
      reasons.push(`High transaction velocity: ${velocityScore.count} transactions in last hour`);
    }

    // Rule 2: Geographic velocity check
    if (ipAddress) {
      const geoScore = await this.checkGeographicVelocity(userId, ipAddress);
      score += geoScore.score;
      if (geoScore.score > 0) {
        reasons.push(`Geographic anomaly detected: ${geoScore.location}`);
      }
    }

    // Rule 3: Unusual amount for user
    const amountScore = await this.checkUnusualAmount(userId, amount);
    score += amountScore.score;
    if (amountScore.score > 0) {
      reasons.push(`Unusual amount: ${amountScore.times}x average for this user`);
    }

    // Rule 4: New payment method
    const methodScore = await this.checkNewPaymentMethod(userId, method);
    score += methodScore.score;
    if (methodScore.score > 0) {
      reasons.push('First transaction with this payment method');
    }

    // Rule 5: High-risk country/region
    if (ipAddress) {
      const countryScore = await this.checkHighRiskCountry(ipAddress);
      score += countryScore.score;
      if (countryScore.score > 0) {
        reasons.push(`High-risk region: ${countryScore.country}`);
      }
    }

    // Rule 6: Currency mismatch
    const currencyScore = await this.checkCurrencyMismatch(userId, currency);
    score += currencyScore.score;
    if (currencyScore.score > 0) {
      reasons.push('Currency change from usual pattern');
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (score < 20) {
      riskLevel = 'low';
    } else if (score < 50) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }

    return {
      score: Math.min(score, 100),
      riskLevel,
      reasons,
      geoLocation: ipAddress ? await this.getLocation(ipAddress) : undefined,
      velocity: await this.getTransactionVelocity(userId),
    };
  }

  /**
   * Check transaction velocity for a user
   */
  private async checkVelocity(userId: string, currentAmount: number): Promise<{ score: number; count: number }> {
    const cacheKey = `velocity:${userId}`;
    const velocityData = (await this.cacheManager.get<{ count: number; totalAmount: number; firstTimestamp: number }>(
      cacheKey,
    )) || { count: 0, totalAmount: 0, firstTimestamp: Date.now() };

    const hourAgo = Date.now() - 3600000;

    // If first timestamp is older than 1 hour, reset
    if (velocityData.firstTimestamp < hourAgo) {
      velocityData.count = 1;
      velocityData.totalAmount = currentAmount;
      velocityData.firstTimestamp = Date.now();
    } else {
      velocityData.count += 1;
      velocityData.totalAmount += currentAmount;
    }

    await this.cacheManager.set(cacheKey, velocityData, 3600000); // 1 hour TTL

    let score = 0;
    if (velocityData.count > 10) score += 30;
    else if (velocityData.count > 5) score += 15;

    if (velocityData.totalAmount > 10000) score += 20;
    else if (velocityData.totalAmount > 5000) score += 10;

    return { score, count: velocityData.count };
  }

  /**
   * Check for geographic velocity (multiple transactions from different locations)
   */
  private async checkGeographicVelocity(
    userId: string,
    currentIp: string,
  ): Promise<{ score: number; location: string }> {
    const cacheKey = `geo:${userId}`;
    const locations = ((await this.cacheManager.get(cacheKey)) as string[]) || [];

    const currentLocation = await this.getLocation(currentIp);
    locations.push(currentLocation);

    // Keep only last 10 locations
    if (locations.length > 10) {
      locations.shift();
    }

    await this.cacheManager.set(cacheKey, locations, 86400000); // 24 hour TTL

    // Check if multiple locations in short time
    const uniqueLocations = new Set(locations);
    let score = 0;

    if (uniqueLocations.size > 3) {
      score += 25;
    } else if (uniqueLocations.size > 1) {
      score += 10;
    }

    return { score, location: currentLocation };
  }

  /**
   * Check if amount is unusual for the user
   */
  private async checkUnusualAmount(userId: string, amount: number): Promise<{ score: number; times: number }> {
    const payments = await this.paymentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    if (payments.length === 0) {
      return { score: 5, times: 1 }; // First payment is slightly suspicious
    }

    const averageAmount = payments.reduce((sum, p) => sum + p.amountDisplayValue, 0) / payments.length;
    const maxAmount = Math.max(...payments.map((p) => p.amountDisplayValue));

    const times = amount / averageAmount;

    let score = 0;
    if (times > 10) {
      score += 35;
    } else if (times > 5) {
      score += 20;
    } else if (times > 3) {
      score += 10;
    }

    return { score, times: Math.round(times) };
  }

  /**
   * Check if payment method is new for user
   */
  private async checkNewPaymentMethod(userId: string, method: string): Promise<{ score: number }> {
    const hasPaymentWithMethod = await this.paymentRepository.findOne({
      where: { userId, method: method as any },
    });

    return { score: hasPaymentWithMethod ? 0 : 15 };
  }

  /**
   * Check if country is high-risk
   */
  private async checkHighRiskCountry(ipAddress: string): Promise<{ score: number; country: string }> {
    const location = await this.getLocation(ipAddress);
    const highRiskCountries = ['KP', 'IR', 'SY', 'CU']; // Example - update as needed

    // In real scenario, would use MaxMind or similar
    const isHighRisk = highRiskCountries.some((country) => location.includes(country));

    return { score: isHighRisk ? 40 : 0, country: location };
  }

  /**
   * Check for currency mismatch
   */
  private async checkCurrencyMismatch(userId: string, currency: string): Promise<{ score: number }> {
    const lastPayment = await this.paymentRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    if (!lastPayment) {
      return { score: 0 };
    }

    const isCurrencyChange = lastPayment.currency !== currency;
    return { score: isCurrencyChange ? 8 : 0 };
  }

  /**
   * Get transaction velocity for user
   */
  private async getTransactionVelocity(userId: string): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 86400000);

    const transactions = await this.paymentRepository.count({
      where: {
        userId,
        createdAt: {
          gte: oneDayAgo,
        },
      },
    });

    return transactions;
  }

  /**
   * Get location from IP address
   * In production, would use MaxMind or similar service
   */
  private async getLocation(ipAddress: string): Promise<string> {
    // This is a placeholder - in production use actual geolocation service
    // const city = await this.maxMindService.getCity(ipAddress);
    // return `${city.city},${city.country}`;

    return 'Unknown';
  }
}
