import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Favorite } from './schemas/favorite.schema';
import { PaginationDto } from '../../common/dto/pagination.dto';

function assertObjectId(value: string, field = 'id'): void {
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestException({ error: 'INVALID_ID', field });
  }
}

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name) private readonly model: Model<Favorite>,
  ) {}

  async add(userId: string, outfitId: string) {
    assertObjectId(userId, 'userId');
    assertObjectId(outfitId, 'outfitId');
    const existing = await this.model.findOne({
      userId: new Types.ObjectId(userId),
      outfitId: new Types.ObjectId(outfitId),
    });
    if (existing) throw new ConflictException('Outfit already in favorites');

    const favorite = await this.model.create({
      userId: new Types.ObjectId(userId),
      outfitId: new Types.ObjectId(outfitId),
    });
    return {
      id: (favorite._id as Types.ObjectId).toString(),
      outfitId,
      savedAt: (favorite as unknown as { createdAt: Date }).createdAt,
    };
  }

  async remove(userId: string, outfitId: string) {
    assertObjectId(userId, 'userId');
    assertObjectId(outfitId, 'outfitId');
    const result = await this.model.findOneAndDelete({
      userId: new Types.ObjectId(userId),
      outfitId: new Types.ObjectId(outfitId),
    });
    if (!result) throw new NotFoundException('Outfit not found in favorites');
    return { message: 'Removed from favorites.' };
  }

  async toggle(userId: string, outfitId: string) {
    assertObjectId(userId, 'userId');
    assertObjectId(outfitId, 'outfitId');
    const existing = await this.model.findOne({
      userId: new Types.ObjectId(userId),
      outfitId: new Types.ObjectId(outfitId),
    });
    if (existing) {
      await existing.deleteOne();
      return { favorited: false };
    }
    await this.model.create({
      userId: new Types.ObjectId(userId),
      outfitId: new Types.ObjectId(outfitId),
    });
    return { favorited: true };
  }

  async findAll(userId: string, pagination: PaginationDto) {
    assertObjectId(userId, 'userId');
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;
    const filter = { userId: new Types.ObjectId(userId) };
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('outfitId').lean(),
      this.model.countDocuments(filter),
    ]);
    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
