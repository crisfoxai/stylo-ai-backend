import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subscription, SubscriptionDocument } from './schemas/subscription.schema';
import { VerifyReceiptDto } from './dto/subscription.dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectModel(Subscription.name) private readonly subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  async getByUserId(userId: string): Promise<SubscriptionDocument> {
    const sub = await this.subscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
    }).lean();

    if (!sub) {
      return this.subscriptionModel.create({
        userId: new Types.ObjectId(userId),
        plan: 'free',
        status: 'free',
        platform: 'none',
      });
    }

    return sub as SubscriptionDocument;
  }

  async verifyReceipt(userId: string, dto: VerifyReceiptDto): Promise<SubscriptionDocument> {
    // Stub: In production, call Apple/Google APIs to verify
    this.logger.log(`Verifying ${dto.platform} receipt for user ${userId}`);

    const isValid = dto.receipt.length > 0; // Placeholder
    const plan = isValid ? 'premium' : 'free';
    const status = isValid ? 'active' : 'free';
    const expiresAt = isValid ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined;

    const sub = await this.subscriptionModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          plan,
          status,
          platform: dto.platform,
          originalTransactionId: `txn_${Date.now()}`,
          expiresAt,
        },
      },
      { upsert: true, new: true },
    );

    return sub as SubscriptionDocument;
  }

  async handleAppleWebhook(payload: Record<string, unknown>): Promise<void> {
    this.logger.log('Apple webhook received', payload);
    // TODO: verify JWS signature + update subscription state
  }

  async handleGoogleWebhook(payload: Record<string, unknown>): Promise<void> {
    this.logger.log('Google webhook received', payload);
    // TODO: verify Pub/Sub JWT + update subscription state
  }
}
