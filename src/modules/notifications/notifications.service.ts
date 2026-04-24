import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { PushToken, PushTokenDocument } from './schemas/push-token.schema';
import { RegisterTokenDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(PushToken.name) private readonly pushTokenModel: Model<PushTokenDocument>,
  ) {}

  async registerToken(userId: string, dto: RegisterTokenDto): Promise<PushTokenDocument> {
    return this.pushTokenModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), token: dto.token },
      {
        $set: {
          userId: new Types.ObjectId(userId),
          token: dto.token,
          platform: dto.platform,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    ) as unknown as PushTokenDocument;
  }

  async unregisterToken(userId: string, token: string): Promise<void> {
    await this.pushTokenModel.deleteOne({ userId: new Types.ObjectId(userId), token });
  }

  @Cron('0 8 * * *') // Every day at 8am UTC
  async sendDailyOutfitNotification(): Promise<void> {
    this.logger.log('Sending daily outfit-of-the-day notifications');
    const tokens = await this.pushTokenModel.find().limit(1000).lean();
    this.logger.log(`Found ${tokens.length} push tokens to notify`);
    // TODO: Call Firebase Admin FCM.sendEachForMulticast
  }
}
