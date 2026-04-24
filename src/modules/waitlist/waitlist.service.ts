import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WaitlistEntry, WaitlistEntryDocument } from './schemas/waitlist-entry.schema';
import { CreateWaitlistEntryDto } from './dto/waitlist.dto';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectModel(WaitlistEntry.name)
    private readonly waitlistModel: Model<WaitlistEntryDocument>,
  ) {}

  async register(dto: CreateWaitlistEntryDto): Promise<{ message: string }> {
    const exists = await this.waitlistModel.findOne({ email: dto.email.toLowerCase() }).lean();
    if (exists) {
      return { message: 'already_registered' };
    }

    await this.waitlistModel.create(dto);
    return { message: 'registered' };
  }
}
