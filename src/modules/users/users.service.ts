import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { StyleProfile, StyleProfileDocument } from './schemas/style-profile.schema';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateStyleProfileDto } from './dto/style-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(StyleProfile.name) private readonly styleProfileModel: Model<StyleProfileDocument>,
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

  async getStyleProfile(userId: string): Promise<StyleProfileDocument | null> {
    return this.styleProfileModel.findOne({ userId: new Types.ObjectId(userId) }).lean() as Promise<StyleProfileDocument | null>;
  }

  async upsertStyleProfile(
    userId: string,
    dto: UpdateStyleProfileDto,
  ): Promise<StyleProfileDocument> {
    const profile = await this.styleProfileModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: { ...dto, updatedAt: new Date() } },
        { upsert: true, new: true },
      )
      .lean();
    return profile as StyleProfileDocument;
  }

  async softDelete(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { $set: { deletedAt: new Date() } });
  }
}
