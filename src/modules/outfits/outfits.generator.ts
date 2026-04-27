import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WardrobeItem, WardrobeItemDocument } from '../wardrobe/schemas/wardrobe-item.schema';
import { StyleProfileDocument } from '../style-profile/schemas/style-profile.schema';
import { GenerateOutfitDto } from './dto/outfit.dto';

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
  justification: string;
  contextFactors: string[];
}

const SLOTS = ['top', 'bottom', 'shoes', 'outerwear'];

@Injectable()
export class OutfitsGenerator {
  constructor(
    @InjectModel(WardrobeItem.name) private readonly itemModel: Model<WardrobeItemDocument>,
  ) {}

  async compose(
    userId: string,
    _occasion: string | undefined,
    _mood: string | undefined,
    _weatherLegacy: unknown,
    _styleProfile: StyleProfileDocument | null,
    excludeIds?: string[],
    context?: GenerateOutfitDto,
  ): Promise<OutfitComposition> {
    const items = await this.itemModel
      .find({ userId: new Types.ObjectId(userId), status: 'ready', archived: false, condition: { $ne: 'para_donar' } })
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
    const contextFactors = this.detectContextFactors(context);
    const justification = this.buildJustification(context, contextFactors);

    return { items: composition, garments, aiModel: 'rule-based-v1', justification, contextFactors };
  }

  buildOutfitPrompt(
    wardrobe: { name?: string; type?: string; color?: string; category?: string; materials?: string[]; fit?: string | null; seasons?: string[]; occasions?: string[]; condition?: string | null }[],
    styleProfile: StyleProfileDocument | null,
    recentOutfitIds: string[][],
    context: GenerateOutfitDto,
  ): string {
    const now = new Date();
    const dayOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][now.getDay()];
    const hour = now.getHours();
    const timeOfDay = hour < 12 ? 'mañana' : hour < 18 ? 'tarde' : 'noche';

    const sections: string[] = [];

    sections.push(`Sos un estilista personal AI para Stylo AI.

GUARDARROPA (${wardrobe.length} prendas):
${JSON.stringify(wardrobe
  .filter((i) => i.condition !== 'para_donar')
  .map((i) => ({
    name: i.name, type: i.type, color: i.color, category: i.category,
    ...(i.materials?.length && { materials: i.materials }),
    ...(i.fit && { fit: i.fit }),
    ...(i.seasons?.length && { seasons: i.seasons }),
    ...(i.occasions?.length && { occasions: i.occasions }),
  })))}

PERFIL DE ESTILO:
${styleProfile ? JSON.stringify(styleProfile) : 'Sin configurar'}

CONTEXTO TEMPORAL:
- Hoy es ${dayOfWeek} a la ${timeOfDay}

OUTFITS RECIENTES (no repetir estas combinaciones):
${recentOutfitIds.slice(0, 30).map((ids) => ids.join(',')).join('\n')}`);

    if (context.weatherContext) {
      const w = context.weatherContext;
      sections.push(`CLIMA ACTUAL (${w.city}):
- Temperatura: ${w.temperature}°C (sensación: ${w.feelsLike}°C)
- Condición: ${w.condition}
${w.willRainLater ? '- IMPORTANTE: se espera lluvia más tarde — sugerí llevar abrigo o prenda resistente al agua' : ''}`);
    }

    if (context.calendarEvents?.length) {
      sections.push(`EVENTOS DE HOY:
${context.calendarEvents.map((e) => `- ${e.title} a las ${new Date(e.startTime).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`).join('\n')}
Considerá el tipo de evento al elegir el look.`);
    }

    if (context.mood) {
      sections.push(`MOOD DEL USUARIO: ${context.mood}`);
    }

    if (context.occasion) {
      sections.push(`OCASIÓN: ${context.occasion}`);
    }

    sections.push(`Generá 3 combinaciones de outfits distintas usando prendas del guardarropa.
Para cada outfit incluí:
1. IDs de las prendas seleccionadas
2. Nombre del outfit (ej: "Casual chic para el trabajo")
3. Justificación breve (máx 30 palabras) que mencione el contexto usado
4. Factores considerados: clima/evento/mood/ocasión según corresponda

Respondé SOLO en JSON:
[{ "garmentIds": ["id1","id2"], "name": "...", "justification": "...", "contextUsed": ["weather","calendar"] }]`);

    return sections.join('\n\n');
  }

  async populateGarments(
    compositionItems: { wardrobeItemId: Types.ObjectId; slot: string }[],
  ): Promise<OutfitGarment[]> {
    if (!compositionItems?.length) return [];
    const ids = compositionItems.map((e) => e.wardrobeItemId);
    const items = await this.itemModel.find({ _id: { $in: ids } }).lean();
    return this.buildGarments(compositionItems, items);
  }

  private detectContextFactors(context?: GenerateOutfitDto): string[] {
    const factors: string[] = [];
    if (context?.weatherContext) factors.push('weather');
    if (context?.calendarEvents?.length) factors.push('calendar');
    if (context?.mood) factors.push('mood');
    if (context?.occasion) factors.push('occasion');
    return factors;
  }

  private buildJustification(context?: GenerateOutfitDto, factors?: string[]): string {
    if (!factors?.length) return 'Outfit seleccionado de tu guardarropa.';
    const parts: string[] = [];
    if (context?.weatherContext) parts.push(`clima ${context.weatherContext.temperature}°C en ${context.weatherContext.city}`);
    if (context?.calendarEvents?.length) parts.push(`eventos del día`);
    if (context?.mood) parts.push(`mood ${context.mood}`);
    if (context?.occasion) parts.push(`ocasión ${context.occasion}`);
    return `Outfit sugerido considerando: ${parts.join(', ')}.`;
  }

  private buildGarments(
    compositionItems: { wardrobeItemId: Types.ObjectId; slot: string }[],
    items: { _id: unknown; imageProcessedUrl?: string; imageUrl?: string; type?: string; color?: string }[],
  ): OutfitGarment[] {
    return compositionItems.map((entry) => {
      const garment = items.find((i) => String(i._id) === String(entry.wardrobeItemId));
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
