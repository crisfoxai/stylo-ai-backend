import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StyleProfile } from './schemas/style-profile.schema';
import { UpdateStyleProfileDto } from './dto/update-style-profile.dto';

@Injectable()
export class StyleProfileService {
  constructor(
    @InjectModel(StyleProfile.name) private readonly model: Model<StyleProfile>,
  ) {}

  async create(userId: string, dto: UpdateStyleProfileDto) {
    const existing = await this.model.findOne({ userId: new Types.ObjectId(userId) });
    if (existing) throw new ConflictException('Style profile already exists');
    return this.model.create({ userId: new Types.ObjectId(userId), ...dto, quizCompleted: true });
  }

  async findByUser(userId: string) {
    const profile = await this.model.findOne({ userId: new Types.ObjectId(userId) });
    if (!profile) throw new NotFoundException('Style profile not found');
    return profile;
  }

  async update(userId: string, dto: UpdateStyleProfileDto) {
    const profile = await this.model.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: dto },
      { new: true },
    );
    if (!profile) throw new NotFoundException('Style profile not found');
    return profile;
  }
}
