import { Injectable, Logger, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { Subscription, SubscriptionDocument } from './schemas/subscription.schema';
import { VerifyReceiptDto, DevUpgradeDto } from './dto/subscription.dto';
import { PLAN_LIMITS, PRODUCT_TIER_MAP, PlanTier } from './subscription.limits';
import { ReferralsService } from '../referrals/referrals.service';
import { User, UserDocument } from '../users/schemas/user.schema';

function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectModel(Subscription.name) private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @Inject(forwardRef(() => ReferralsService)) private readonly referralsService: ReferralsService,
  ) {}

  async getByUserId(userId: string): Promise<SubscriptionDocument> {
    const sub = await this.subscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
    }).lean();

    if (!sub) {
      const created = await this.subscriptionModel.create({
        userId: new Types.ObjectId(userId),
        plan: 'free',
        status: 'free',
        platform: 'none',
      });
      return created as unknown as SubscriptionDocument;
    }

    return sub as SubscriptionDocument;
  }

  async checkAndIncrementUsage(userId: string, type: 'tryon' | 'chat'): Promise<void> {
    const existing = await this.subscriptionModel.findOne({ userId: new Types.ObjectId(userId) }).lean();
    const sub: {
      plan: string; tryonUsedThisMonth: number; chatMessagesUsedThisMonth: number; periodStart?: Date;
    } = existing ?? await this.subscriptionModel.create({
      userId: new Types.ObjectId(userId), plan: 'free', status: 'free', platform: 'none',
    });

    const now = new Date();
    const monthStart = startOfMonth(now);

    if (!sub.periodStart || sub.periodStart < monthStart) {
      await this.subscriptionModel.updateOne(
        { userId: new Types.ObjectId(userId) },
        { $set: { tryonUsedThisMonth: 0, chatMessagesUsedThisMonth: 0, periodStart: monthStart } },
      );
      sub.tryonUsedThisMonth = 0;
      sub.chatMessagesUsedThisMonth = 0;
    }

    const userDoc = await this.userModel.findById(userId).lean();
    const hasPremiumBonus = !!(userDoc?.premiumAccessUntil && userDoc.premiumAccessUntil > now);
    const effectivePlan = hasPremiumBonus ? 'pro' : (sub.plan in PLAN_LIMITS ? (sub.plan as PlanTier) : 'free');
    const limits = PLAN_LIMITS[effectivePlan];
    const field = type === 'tryon' ? 'tryonUsedThisMonth' : 'chatMessagesUsedThisMonth';
    const limit = type === 'tryon' ? limits.tryon : limits.chatMessages;
    const used = sub[field] ?? 0;

    if (limit !== -1 && used >= limit) {
      throw new ForbiddenException({ error: 'PLAN_LIMIT', limit, used, feature: type });
    }

    await this.subscriptionModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $inc: { [field]: 1 } },
    );
  }

  async verifyReceipt(userId: string, dto: VerifyReceiptDto): Promise<SubscriptionDocument> {
    this.logger.log(`Verifying ${dto.platform} receipt for user ${userId}`);

    if (dto.platform === 'apple') {
      return this.verifyAppleReceipt(userId, dto.receipt, dto.platform);
    } else if (dto.platform === 'google') {
      return this.verifyGoogleReceipt(userId, dto.receipt, dto.platform);
    }

    throw new BadRequestException({ error: 'UNSUPPORTED_PLATFORM' });
  }

  private async verifyAppleReceipt(userId: string, receipt: string, platform: string): Promise<SubscriptionDocument> {
    const appleEnv = process.env.APPLE_ENVIRONMENT ?? 'sandbox';
    const endpoint = appleEnv === 'production'
      ? 'https://buy.itunes.apple.com/verifyReceipt'
      : 'https://sandbox.itunes.apple.com/verifyReceipt';

    const sharedSecret = process.env.APPLE_SHARED_SECRET ?? '';

    let appleResponse: { data: { status: number; latest_receipt_info?: { product_id: string; expires_date_ms: string; original_transaction_id: string }[] } };
    try {
      appleResponse = await axios.post(endpoint, {
        'receipt-data': receipt,
        password: sharedSecret,
        'exclude-old-transactions': true,
      });
    } catch {
      throw new BadRequestException({ error: 'RECEIPT_INVALID' });
    }

    if (appleResponse.data.status !== 0) {
      throw new BadRequestException({ error: 'RECEIPT_INVALID' });
    }

    const latestReceipt = appleResponse.data.latest_receipt_info?.[0];
    if (!latestReceipt) throw new BadRequestException({ error: 'RECEIPT_INVALID' });

    const tier = PRODUCT_TIER_MAP[latestReceipt.product_id] ?? 'free';
    const expiresAt = new Date(parseInt(latestReceipt.expires_date_ms));

    return this.upsertSubscription(userId, tier, 'active', platform, latestReceipt.product_id, latestReceipt.original_transaction_id, expiresAt);
  }

  private async verifyGoogleReceipt(userId: string, purchaseToken: string, platform: string): Promise<SubscriptionDocument> {
    const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME ?? '';
    const saJson = process.env.GOOGLE_PLAY_SA_JSON ?? '{}';

    let credentials: { client_email: string; private_key: string };
    try {
      credentials = JSON.parse(saJson);
    } catch {
      throw new BadRequestException({ error: 'RECEIPT_INVALID' });
    }

    // Dynamic import to avoid loading googleapis unless needed
    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    const androidpublisher = google.androidpublisher({ version: 'v3', auth });

    let subData: { data: { lineItems?: { productId?: string | null; expiryTime?: string | null }[]; subscriptionState?: string | null } };
    try {
      subData = await androidpublisher.purchases.subscriptionsv2.get({
        packageName,
        token: purchaseToken,
      });
    } catch {
      throw new BadRequestException({ error: 'RECEIPT_INVALID' });
    }

    const lineItem = subData.data.lineItems?.[0];
    if (!lineItem?.productId) throw new BadRequestException({ error: 'RECEIPT_INVALID' });

    const tier = PRODUCT_TIER_MAP[lineItem.productId] ?? 'free';
    const expiresAt = lineItem.expiryTime ? new Date(lineItem.expiryTime) : new Date();
    const isActive = subData.data.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE';

    return this.upsertSubscription(userId, tier, isActive ? 'active' : 'expired', platform, lineItem.productId, purchaseToken, expiresAt);
  }

  private async upsertSubscription(
    userId: string,
    plan: string,
    status: string,
    platform: string,
    productId: string,
    originalTransactionId: string,
    expiresAt: Date,
  ): Promise<SubscriptionDocument> {
    const sub = await this.subscriptionModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          plan,
          status,
          platform,
          productId,
          originalTransactionId,
          expiresAt,
          periodStart: startOfMonth(),
        },
      },
      { upsert: true, new: true },
    );

    if (status === 'active') {
      await this.referralsService.onPurchaseValidated(userId).catch((err: Error) =>
        this.logger.warn(`Referral onPurchaseValidated failed: ${err.message}`),
      );
    }

    return sub as SubscriptionDocument;
  }

  async getTryonStats(userId: string): Promise<{
    tryonsUsedThisMonth: number;
    tryonsLimitThisMonth: number | null;
    tryonsResetAt: string | null;
  }> {
    const sub = await this.subscriptionModel.findOne({ userId: new Types.ObjectId(userId) }).lean();

    const now = new Date();
    const monthStart = startOfMonth(now);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const resetNeeded = !sub?.periodStart || (sub.periodStart as Date) < monthStart;
    const used = resetNeeded ? 0 : (sub?.tryonUsedThisMonth ?? 0);

    const userDoc = await this.userModel.findById(userId).lean();
    const hasPremiumBonus = !!(userDoc?.premiumAccessUntil && userDoc.premiumAccessUntil > now);
    const plan = hasPremiumBonus ? 'pro' : ((sub?.plan ?? 'free') as PlanTier);
    const effectivePlan = plan in PLAN_LIMITS ? plan : 'free';
    const limit = PLAN_LIMITS[effectivePlan].tryon as number;

    return {
      tryonsUsedThisMonth: used,
      tryonsLimitThisMonth: limit === -1 ? null : limit,
      tryonsResetAt: nextMonth.toISOString(),
    };
  }

  async decrementTryonCredit(userId: string): Promise<void> {
    await this.subscriptionModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $inc: { tryonUsedThisMonth: 1 } },
    );
  }

  async devUpgrade(userId: string, dto: DevUpgradeDto): Promise<SubscriptionDocument> {
    const sub = await this.subscriptionModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          plan: dto.plan,
          status: 'active',
          expiresAt: new Date('2027-12-31'),
          tryonUsedThisMonth: 0,
          chatMessagesUsedThisMonth: 0,
          platform: 'none',
          periodStart: startOfMonth(),
        },
      },
      { upsert: true, new: true },
    );
    return sub as SubscriptionDocument;
  }

  async handleAppleWebhook(signedPayload: string): Promise<void> {
    let decodeJwt: ((token: string) => Record<string, unknown>) | undefined;
    try {
      const jose = await import('jose');
      decodeJwt = jose.decodeJwt as (token: string) => Record<string, unknown>;
    } catch {
      this.logger.warn('Apple webhook: jose not available, skipping JWS decode');
      return;
    }

    let payload: { notificationType?: string; subtype?: string; data?: { signedTransactionInfo?: string; appAppleId?: number; bundleId?: string; productId?: string } };
    try {
      payload = decodeJwt(signedPayload) as typeof payload;
    } catch {
      this.logger.warn('Apple webhook: failed to decode JWS payload');
      return;
    }

    const { notificationType, data } = payload;
    this.logger.log(`Apple webhook: ${notificationType}`);

    if (!notificationType) return;

    // Decode the inner transaction info if present
    let productId: string | undefined;
    let expiresAt: Date | undefined;
    if (data?.signedTransactionInfo) {
      try {
        const txInfo = decodeJwt(data.signedTransactionInfo) as { productId?: string; expiresDate?: number };
        productId = txInfo.productId;
        expiresAt = txInfo.expiresDate ? new Date(txInfo.expiresDate) : undefined;
      } catch {
        // non-fatal
      }
    }

    // Find subscription by originalTransactionId or productId — we need bundleId context
    // For webhooks we match by productId in the payload data
    const bundleId = data?.bundleId ?? process.env.APPLE_BUNDLE_ID;
    if (!bundleId) return;

    switch (notificationType) {
      case 'SUBSCRIBED':
      case 'DID_RENEW': {
        if (productId && expiresAt) {
          const tier = PRODUCT_TIER_MAP[productId];
          if (tier) {
            await this.subscriptionModel.updateMany(
              { productId, platform: 'apple' },
              { $set: { plan: tier, status: 'active', expiresAt } },
            );
          }
        }
        break;
      }
      case 'EXPIRED': {
        await this.subscriptionModel.updateMany(
          { productId, platform: 'apple' },
          { $set: { status: 'expired' } },
        );
        break;
      }
      case 'REFUND': {
        await this.subscriptionModel.updateMany(
          { productId, platform: 'apple' },
          { $set: { status: 'cancelled', plan: 'free' } },
        );
        break;
      }
      default:
        this.logger.log(`Apple webhook: unhandled notificationType ${notificationType}`);
    }
  }

  async handleGoogleWebhook(payload: Record<string, unknown>): Promise<void> {
    this.logger.log('Google webhook received');

    // Decode Pub/Sub message
    const message = payload['message'] as { data?: string } | undefined;
    if (!message?.data) return;

    let notification: { subscriptionNotification?: { notificationType: number; purchaseToken: string; subscriptionId: string } };
    try {
      const decoded = Buffer.from(message.data, 'base64').toString('utf-8');
      notification = JSON.parse(decoded);
    } catch {
      this.logger.warn('Google webhook: failed to decode Pub/Sub message');
      return;
    }

    const subNotif = notification.subscriptionNotification;
    if (!subNotif) return;

    const { notificationType, purchaseToken } = subNotif;
    this.logger.log(`Google webhook: notificationType=${notificationType}`);

    switch (notificationType) {
      case 1: // RECOVERED
        await this.subscriptionModel.updateOne(
          { originalTransactionId: purchaseToken, platform: 'google' },
          { $set: { status: 'active' } },
        );
        break;
      case 2: // RENEWED
        await this.subscriptionModel.updateOne(
          { originalTransactionId: purchaseToken, platform: 'google' },
          { $set: { status: 'active' } },
        );
        break;
      case 3: // CANCELED
        await this.subscriptionModel.updateOne(
          { originalTransactionId: purchaseToken, platform: 'google' },
          { $set: { status: 'cancelled', plan: 'free' } },
        );
        break;
      case 5: // ON_HOLD
        await this.subscriptionModel.updateOne(
          { originalTransactionId: purchaseToken, platform: 'google' },
          { $set: { status: 'grace' } },
        );
        break;
      case 13: // EXPIRED
        await this.subscriptionModel.updateOne(
          { originalTransactionId: purchaseToken, platform: 'google' },
          { $set: { status: 'expired', plan: 'free' } },
        );
        break;
      default:
        this.logger.log(`Google webhook: unhandled notificationType ${notificationType}`);
    }
  }
}
