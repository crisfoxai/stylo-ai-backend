import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WardrobeItem, WardrobeItemDocument } from '../wardrobe/schemas/wardrobe-item.schema';
import { StyleProfileDocument } from '../style-profile/schemas/style-profile.schema';
import { WeatherData } from '../weather/weather.service';

export interface OutfitGarment {
  garmentId: string;
  thumbnailUrl: string;
  type: string;
  color: string;
  style: string;
}

export interface OutfitComposition {
  items: { wardrobeItemId: Types.ObjectId; slot: string }[];
  garments: OutfitGarment[];
  aiModel: string;
}

const SLOTS = ['top', 'bottom', 'shoes', 'outerwear'];

@Injectable()
export class OutfitsGenerator {
  constructor(
    @InjectModel(WardrobeItem.name) private readonly itemModel: Model<WardrobeItemDocument>,
  ) {}

  async compose(
    userId: string,
    _occasion: string,
    _mood: string | undefined,
    _weather: WeatherData | undefined,
    _styleProfile: StyleProfileDocument | null,
    excludeIds?: string[],
  ): Promise<OutfitComposition> {
    const items = await this.itemModel
      .find({ userId: new Types.ObjectId(userId), status: 'ready', archived: false })
      .lean();

    const composition: { wardrobeItemId: Types.ObjectId; slot: string }[] = [];

    for (const slot of SLOTS) {
      const candidates = items
        .filter((i) => i.type === slot)
        .filter((i) => !excludeIds?.includes(String(i._id)));
      if (candidates.length > 0) {
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        composition.push({ wardrobeItemId: picked._id as Types.ObjectId, slot });
      }
    }

    const garments = this.buildGarments(composition, items);

    return { items: composition, garments, aiModel: 'rule-based-v1' };
  }

  async populateGarments(
    compositionItems: { wardrobeItemId: Types.ObjectId; slot: string }[],
  ): Promise<OutfitGarment[]> {
    if (!compositionItems?.length) return [];

    const ids = compositionItems.map((e) => e.wardrobeItemId);
    const items = await this.itemModel.find({ _id: { $in: ids } }).lean();
    return this.buildGarments(compositionItems, items);
  }

  private buildGarments(
    compositionItems: { wardrobeItemId: Types.ObjectId; slot: string }[],
    items: { _id: unknown; imageProcessedUrl?: string; imageUrl?: string; type?: string; color?: string }[],
  ): OutfitGarment[] {
    return compositionItems.map((entry) => {
      const garment = items.find(
        (i) => String(i._id) === String(entry.wardrobeItemId),
      );
      return {
        garmentId: String(entry.wardrobeItemId),
        thumbnailUrl: garment?.imageProcessedUrl || garment?.imageUrl || '',
        type: garment?.type || '',
        color: garment?.color || '',
        style: entry.slot,
      };
    });
  }
}
