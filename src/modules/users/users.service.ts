import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { UpdateUserDto } from './dto/update-user.dto';
import { StyleProfileService } from '../style-profile/style-profile.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly styleProfileService: StyleProfileService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async findById(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new NotFoundException({ error: 'NOT_FOUND' });
    return user as UserDocument;
  }

  async update(userId: string, dto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: dto }, { new: true })
      .lean();
    if (!user) throw new NotFoundException({ error: 'NOT_FOUND' });
    return user as UserDocument;
  }

  async getStyleProfile(userId: string) {
    try {
      return await this.styleProfileService.findByUser(userId);
    } catch {
      return null;
    }
  }

  async getTryonStats(userId: string) {
    return this.subscriptionsService.getTryonStats(userId);
  }

  async softDelete(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { $set: { deletedAt: new Date() } });
  }
}
