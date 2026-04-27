import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { Referral, ReferralDocument } from './schemas/referral.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ApplyReferralCodeDto, ReferralStatsResponseDto } from './dto/referral.dto';

const BONUS_DAYS = 30;
const CAP_DAYS = 180;
const CAP_MONTHLY = 20;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    @InjectModel(Referral.name) private readonly referralModel: Model<ReferralDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async applyCode(userId: string, dto: ApplyReferralCodeDto): Promise<{ applied: boolean; referrerName: string }> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new BadRequestException({ error: 'INVALID_CODE' });

    if (user.referredBy) {
      throw new BadRequestException({ error: 'ALREADY_REFERRED' });
    }

    const referrer = await this.userModel.findOne({ referralCode: dto.code.toUpperCase() }).lean();
    if (!referrer) throw new BadRequestException({ error: 'INVALID_CODE' });

    if (String(referrer._id) === userId) {
      throw new BadRequestException({ error: 'SELF_REFERRAL' });
    }

    // Device fingerprint abuse check
    if (dto.deviceFingerprint) {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const deviceAbuse = await this.referralModel.findOne({
        deviceFingerprint: dto.deviceFingerprint,
        status: { $in: ['credited', 'validated'] },
        createdAt: { $gte: since },
      });
      if (deviceAbuse) throw new BadRequestException({ error: 'CODE_ABUSE' });
    }

    // Monthly cap for referrer
    const monthStart = new Date(Date.now() - WINDOW_MS);
    const monthlyCount = await this.referralModel.countDocuments({
      referrerId: String(referrer._id),
      status: { $in: ['validated', 'credited'] },
      createdAt: { $gte: monthStart },
    });
    if (monthlyCount >= CAP_MONTHLY) {
      throw new BadRequestException({ error: 'CODE_ABUSE' });
    }

    await this.referralModel.create({
      referrerId: String(referrer._id),
      referredUserId: userId,
      referralCode: dto.code.toUpperCase(),
      status: 'pending',
      deviceFingerprint: dto.deviceFingerprint ?? null,
    });

    await this.userModel.findByIdAndUpdate(userId, {
      $set: { referredBy: String(referrer._id), referredByCode: dto.code.toUpperCase() },
    });

    return { applied: true, referrerName: referrer.displayName || 'Tu amigo/a' };
  }

  async getStats(userId: string): Promise<ReferralStatsResponseDto> {
    let user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException({ error: 'NOT_FOUND' });

    if (!user.referralCode) {
      user.referralCode = Math.random().toString(36).slice(2, 8).toUpperCase();
      await user.save();
    }

    const referralCode = user.referralCode;

    const [totalReferred, validated] = await Promise.all([
      this.referralModel.countDocuments({ referrerId: userId }),
      this.referralModel.countDocuments({ referrerId: userId, status: { $in: ['credited', 'validated'] } }),
    ]);

    const now = new Date();
    const bonusDaysActive = !!(user.premiumAccessUntil && user.premiumAccessUntil > now);

    return {
      referralCode,
      totalReferred,
      validated,
      bonusDaysActive,
      premiumAccessUntil: user.premiumAccessUntil?.toISOString() ?? null,
      referralLink: `https://stylo.ai/join/${referralCode}`,
    };
  }

  async onPurchaseValidated(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId).lean();
    if (!user?.referredBy) return;

    const referral = await this.referralModel.findOne({
      referredUserId: userId,
      status: 'pending',
    });
    if (!referral) return;

    // Must purchase within 30 days of registration and at least 1h after applying code
    const now = new Date();
    const registeredAt = user.createdAt ?? new Date(0);
    const daysSinceReg = (now.getTime() - registeredAt.getTime()) / 86400000;
    const hoursSinceCreated = (now.getTime() - (referral.createdAt as unknown as Date).getTime()) / 3600000;

    if (daysSinceReg > 30 || hoursSinceCreated < 1) {
      await this.referralModel.updateOne({ _id: referral._id }, {
        status: 'rejected',
        rejectedReason: daysSinceReg > 30 ? 'no_purchase_30d' : 'cooldown',
      });
      return;
    }

    // Idempotency: only credit once
    await this.applyBonus(userId, BONUS_DAYS);
    await this.applyBonus(user.referredBy, BONUS_DAYS);

    await this.referralModel.updateOne({ _id: referral._id }, {
      status: 'credited',
      purchaseValidatedAt: now,
      creditedAt: now,
    });

    this.logger.log(`Referral credited: referrer=${user.referredBy} referred=${userId}`);
  }

  private async applyBonus(userId: string, days: number): Promise<void> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) return;

    const now = new Date();
    const base = user.premiumAccessUntil && user.premiumAccessUntil > now
      ? user.premiumAccessUntil
      : now;

    // Enforce cap
    const maxUntil = new Date(now.getTime() + CAP_DAYS * 86400000);
    const candidate = new Date(base.getTime() + days * 86400000);
    const newUntil = candidate > maxUntil ? maxUntil : candidate;

    await this.userModel.findByIdAndUpdate(userId, { $set: { premiumAccessUntil: newUntil } });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredReferrals(): Promise<void> {
    const cutoff = new Date(Date.now() - WINDOW_MS);
    const result = await this.referralModel.updateMany(
      { status: 'pending', createdAt: { $lt: cutoff } },
      { status: 'rejected', rejectedReason: 'no_purchase_30d' },
    );
    this.logger.log(`Referral cleanup: rejected ${result.modifiedCount} expired referrals`);
  }
}
