import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WardrobeItem, WardrobeItemDocument } from '../wardrobe/schemas/wardrobe-item.schema';
import { StyleProfileDocument } from '../style-profile/schemas/style-profile.schema';
import { AIService } from '../ai/ai.service';
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

type OccasionRule = {
  description: string;
  rulesBlock: string;
  includeOccasions: string[];
  includeStyles: string[];
  includeCategories: string[];
  excludeOccasions: string[];
  excludeStyles: string[];
};

export const OCCASION_RULES: Record<string, OccasionRule> = {
  gym: {
    description: 'actividad física intensa o moderada — ropa funcional para movimiento',
    rulesBlock: `- PRIORIZAR: prendas sport/athletic, materiales transpirables (polyester, dry-fit, spandex, cotton)
- EXCLUIR: prendas formales, de seda, lana de vestir, calzado de vestir
- OBLIGATORIO: si hay footwear, debe ser sneakers/zapatillas deportivas. Si no hay, omitir footwear.
- COLORES: libre, incluyendo neon y vibrantes.`,
    includeOccasions: ['sport', 'gym', 'athletic', 'casual'],
    includeStyles: ['sport', 'athletic', 'casual'],
    includeCategories: ['top', 'bottom', 'footwear'],
    excludeOccasions: ['formal', 'party', 'gala', 'work'],
    excludeStyles: ['formal', 'elegant', 'dressy'],
  },
  work: {
    description: 'entorno laboral — smart business casual',
    rulesBlock: `- PRIORIZAR: smart-casual o business casual. Pantalones de tela, camisas, polos, blazers.
- EXCLUIR: ropa sport, remeras estampadas muy casual, shorts, ropa de playa.
- COLORES: máximo 3 colores, al menos 1 neutro (negro/blanco/gris/navy/beige). 1 color de acento máximo.
- FIT: preferir regular o slim sobre oversized.`,
    includeOccasions: ['work', 'business', 'smart-casual', 'office'],
    includeStyles: ['formal', 'smart-casual', 'business', 'classic'],
    includeCategories: ['top', 'bottom', 'outerwear', 'footwear'],
    excludeOccasions: ['gym', 'sport', 'beach', 'party'],
    excludeStyles: ['athletic', 'beach', 'party', 'grunge'],
  },
  casual: {
    description: 'día a día — armonía visual y comodidad',
    rulesBlock: `- PRIORIZAR: armonía visual y comodidad. Cualquier combinación coherente.
- EXCLUIR: ropa exclusivamente sport, formal extremo, playa.
- COLORES: máximo 4 colores. Si hay una prenda llamativa, equilibrar con neutros.`,
    includeOccasions: ['casual', 'everyday', 'street', 'weekend'],
    includeStyles: ['casual', 'street', 'contemporary', 'classic'],
    includeCategories: ['top', 'bottom', 'outerwear', 'footwear', 'accessory', 'headwear'],
    excludeOccasions: ['gala', 'formal-event', 'sport'],
    excludeStyles: ['athletic', 'beach'],
  },
  'night-out': {
    description: 'salida nocturna — verse bien, mostrar personalidad',
    rulesBlock: `- PRIORIZAR: prendas trendy, de noche, llamativas o fashion. Evitar lo muy básico.
- EXCLUIR: sport, trabajo corporativo, playa.
- COLORES: paleta oscura (negro, borgoña, verde oscuro) o color vibrante como foco. Evitar looks apagados.
- FOOTWEAR: boots, sandalias de noche, heels, sneakers fashion.`,
    includeOccasions: ['night-out', 'party', 'going-out', 'bar', 'club'],
    includeStyles: ['party', 'trendy', 'bold', 'fashion-forward', 'street'],
    includeCategories: ['top', 'bottom', 'outerwear', 'footwear', 'accessory'],
    excludeOccasions: ['work', 'gym', 'beach'],
    excludeStyles: ['casual-basic', 'sport'],
  },
  dinner: {
    description: 'cena — smart-casual elegante',
    rulesBlock: `- PRIORIZAR: smart-casual elegante. Una prenda "destacada" (vestido, camisa fina, pantalón bien cortado).
- EXCLUIR: sport, gym, playa.
- COLORES: paleta cohesiva de máximo 3 colores. Coordinación cuidada.
- FOOTWEAR: semi-formal (mocasines, botines, zapatos).`,
    includeOccasions: ['dinner', 'date', 'restaurant', 'smart-casual'],
    includeStyles: ['smart-casual', 'elegant-casual', 'classic', 'chic'],
    includeCategories: ['top', 'bottom', 'dress', 'outerwear', 'footwear'],
    excludeOccasions: ['gym', 'beach', 'sport'],
    excludeStyles: ['athletic', 'grunge', 'beach'],
  },
  event: {
    description: 'evento formal o gala — vestuario formal',
    rulesBlock: `- PRIORIZAR: vestidos, trajes, blazers, ropa formal. Una pieza principal elegante.
- EXCLUIR: casual extremo, sport, jeans básicos (a menos que sean el único bottom disponible).
- COLORES: paleta elegante: negro, blanco, navy, borgoña, verde esmeralda, dorado.
- FOOTWEAR: formal obligatorio si hay opciones.`,
    includeOccasions: ['formal', 'gala', 'wedding', 'event', 'party'],
    includeStyles: ['formal', 'elegant', 'classic', 'dressy'],
    includeCategories: ['top', 'bottom', 'dress', 'outerwear', 'footwear', 'accessory'],
    excludeOccasions: ['gym', 'beach', 'everyday', 'sport'],
    excludeStyles: ['casual', 'street', 'athletic'],
  },
  beach: {
    description: 'playa o vacaciones — ambiente relajado de verano',
    rulesBlock: `- PRIORIZAR: prendas livianas, de lino o algodón, estampados tropicales o pasteles.
- EXCLUIR: formal, trabajo, ropa de abrigo pesada.
- FOOTWEAR: sandalias, ojotas, espadrilles.`,
    includeOccasions: ['beach', 'summer', 'vacation', 'resort'],
    includeStyles: ['beach', 'casual', 'resort', 'boho'],
    includeCategories: ['top', 'bottom', 'dress', 'footwear', 'accessory'],
    excludeOccasions: ['formal', 'work', 'gym'],
    excludeStyles: [],
  },
};

export const COLD_WEATHER_OVERRIDE = (temp: number): string => `

IMPORTANTE — CLIMA FRÍO (${temp}°C):
- OBLIGATORIO incluir outerwear (campera, abrigo, tapado) si hay en el guardarropa.
- PRIORIZAR materiales de abrigo: lana, fleece, denim grueso.
- EXCLUIR prendas de verano (lino fino, tops sin mangas de verano).`;

type GarmentLike = {
  _id: unknown;
  occasions?: string[];
  style?: string | null;
  category?: string;
  imageProcessedUrl?: string;
  imageUrl?: string;
  type?: string;
  color?: string;
  materials?: string[];
  fit?: string | null;
  seasons?: string[];
  name?: string;
};

export function preFilterWardrobe(garments: GarmentLike[], occasion: string): GarmentLike[] {
  if (!garments.length) return [];

  const rules = OCCASION_RULES[occasion] ?? OCCASION_RULES['casual'];

  const filtered = garments.filter((g) => {
    if (rules.excludeOccasions.some((o) => g.occasions?.includes(o))) return false;
    if (g.style && rules.excludeStyles.includes(g.style as string)) return false;

    const hasOccasionMatch = rules.includeOccasions.some((o) => g.occasions?.includes(o));
    const hasStyleMatch = g.style ? rules.includeStyles.includes(g.style as string) : false;
    const hasCategoryMatch = g.category ? rules.includeCategories.includes(g.category) : false;

    return hasOccasionMatch || hasStyleMatch || hasCategoryMatch;
  });

  // Fallback: less than 4 garments after filtering — use only category
  if (filtered.length < 4) {
    return garments.filter(
      (g) =>
        (g.category ? rules.includeCategories.includes(g.category) : false) &&
        !rules.excludeOccasions.some((o) => g.occasions?.includes(o)),
    );
  }

  // Heuristic for users with few fine attributes: pass full wardrobe to the prompt
  const withFineAttributes = garments.filter(
    (g) => (g.occasions?.length ?? 0) > 0 || g.style,
  );
  if (withFineAttributes.length < 5) {
    return garments;
  }

  return filtered;
}

export function buildOutfitPrompt(input: {
  occasion: string;
  weatherDescription: string;
  tempCelsius: number;
  tempFeelsLike: number;
  timeOfDay: string;
  dayOfWeek: string;
  calendarEvent?: string;
  filteredWardrobe: GarmentLike[];
}): string {
  const rule = OCCASION_RULES[input.occasion] ?? OCCASION_RULES['casual'];
  let rulesBlock = rule.rulesBlock;
  if (input.tempCelsius < 10) {
    rulesBlock += COLD_WEATHER_OVERRIDE(input.tempCelsius);
  }

  const calendarLine = input.calendarEvent ? `- Evento de hoy: ${input.calendarEvent}` : '';

  return `Sos un estilista personal experto con conocimiento profundo de moda y tendencias.
Tu única tarea es seleccionar una combinación de prendas del guardarropa del usuario para una ocasión específica.

━━━ OCASIÓN ━━━
${input.occasion} — ${rule.description}

━━━ REGLAS PARA ESTA OCASIÓN ━━━
${rulesBlock}

━━━ CONTEXTO ADICIONAL ━━━
- Clima actual: ${input.weatherDescription} (${input.tempCelsius}°C, ${input.tempFeelsLike}°C sensación)
- Momento del día: ${input.timeOfDay}
- Día de la semana: ${input.dayOfWeek}
${calendarLine}

━━━ GUARDARROPA DISPONIBLE ━━━
(Pre-filtrado para la ocasión. Estos son los únicos ítems que podés usar.)

${JSON.stringify(
  input.filteredWardrobe.map((g) => ({
    id: String(g._id),
    category: g.category,
    type: g.type,
    name: g.name,
    color: g.color,
    style: g.style,
    occasions: g.occasions,
    materials: g.materials,
    fit: g.fit,
    seasons: g.seasons,
  })),
  null,
  2,
)}

━━━ INSTRUCCIONES ESTRICTAS ━━━
1. Seleccioná exactamente UNA prenda por categoría relevante.
   - Top (remera, camisa, buzo): SIEMPRE incluir si hay opciones.
   - Bottom (pantalón, falda, short): SIEMPRE incluir si hay opciones. EXCEPCIÓN: si incluís un vestido, no incluyas bottom.
   - Outerwear (campera, abrigo): incluir SOLO si la temperatura es < 18°C o la ocasión lo requiere.
   - Footwear: incluir si hay opciones apropiadas para la ocasión (ver reglas arriba).
   - Headwear/Accessories: incluir si complementan el look, máximo 1-2 ítems.

2. Coordinación de colores:
   - Máximo 3 colores en el outfit.
   - Al menos 1 color neutro (negro, blanco, gris, navy, beige, camel) en el outfit, excepto para Gym.
   - Si una prenda tiene estampado o print llamativo, el resto debe ser en colores sólidos neutros.

3. Coherencia de temporada:
   - No mezclar prendas de verano con invierno salvo que el layering lo justifique.

4. Si no hay prendas suficientes en el guardarropa filtrado para alguna categoría obligatoria (top o bottom), incluí la mejor opción disponible aunque no sea ideal para la ocasión e indicalo en el reasoning.

5. NO inventes prendas que no están en el guardarropa. Solo podés usar los IDs de las prendas listadas arriba.

━━━ FORMATO DE RESPUESTA ━━━
Responde ÚNICAMENTE con JSON válido. Sin texto adicional fuera del JSON.

{
  "items": ["garmentId1", "garmentId2", "garmentId3"],
  "reasoning": "Explicación breve de por qué elegiste estas prendas (máximo 2 oraciones, en español)"
}`;
}

const SLOTS = ['top', 'bottom', 'shoes', 'outerwear'];

@Injectable()
export class OutfitsGenerator {
  private readonly logger = new Logger(OutfitsGenerator.name);

  constructor(
    @InjectModel(WardrobeItem.name) private readonly itemModel: Model<WardrobeItemDocument>,
    private readonly aiService: AIService,
  ) {}

  async compose(
    userId: string,
    occasion: string | undefined,
    _mood: string | undefined,
    _weatherLegacy: unknown,
    _styleProfile: StyleProfileDocument | null,
    excludeIds?: string[],
    context?: GenerateOutfitDto,
  ): Promise<OutfitComposition> {
    const items = await this.itemModel
      .find({
        userId: new Types.ObjectId(userId),
        status: 'ready',
        archived: false,
        condition: { $nin: ['para_donar', 'donate'] },
      })
      .lean();

    const filtered = preFilterWardrobe(items, occasion ?? 'casual');
    const available = filtered.filter((i) => !excludeIds?.includes(String(i._id)));

    const contextFactors = this.detectContextFactors(context);
    let composition: { wardrobeItemId: Types.ObjectId; slot: string }[] = [];
    let aiModel = 'rule-based-v2';
    let justification = this.buildJustification(context, contextFactors);

    try {
      const now = new Date();
      const hour = now.getHours();
      const timeOfDay = hour < 12 ? 'mañana' : hour < 18 ? 'tarde' : 'noche';
      const dayOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][now.getDay()];

      const weatherCtx = context?.weatherContext;
      const prompt = buildOutfitPrompt({
        occasion: occasion ?? 'casual',
        weatherDescription: weatherCtx?.condition ?? 'desconocido',
        tempCelsius: weatherCtx?.temperature ?? 20,
        tempFeelsLike: weatherCtx?.feelsLike ?? 20,
        timeOfDay,
        dayOfWeek,
        calendarEvent: context?.calendarEvents?.[0]?.title,
        filteredWardrobe: available,
      });

      const raw = await this.aiService.generateTextContent(prompt, userId);
      const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(jsonText) as { items: string[]; reasoning: string };

      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        composition = parsed.items
          .map((id) => {
            const found = items.find((i) => String(i._id) === id);
            if (!found) return null;
            return { wardrobeItemId: found._id as Types.ObjectId, slot: found.type ?? 'unknown' };
          })
          .filter((x): x is { wardrobeItemId: Types.ObjectId; slot: string } => x !== null);

        justification = parsed.reasoning ?? justification;
        aiModel = 'gemini-2.5-flash-outfit-v2';
      }
    } catch (err) {
      this.logger.warn(`AI outfit generation failed, falling back to random: ${(err as Error).message}`);
    }

    // Fallback: random selection per slot
    if (!composition.length) {
      for (const slot of SLOTS) {
        const candidates = available.filter((i) => i.type === slot);
        if (candidates.length > 0) {
          const picked = candidates[Math.floor(Math.random() * candidates.length)];
          composition.push({ wardrobeItemId: picked._id as Types.ObjectId, slot });
        }
      }
      aiModel = 'rule-based-v2-fallback';
    }

    const garments = this.buildGarments(composition, items);
    return { items: composition, garments, aiModel, justification, contextFactors };
  }

  buildOutfitPrompt(
    wardrobe: GarmentLike[],
    _styleProfile: StyleProfileDocument | null,
    _recentOutfitIds: string[][],
    context: GenerateOutfitDto,
  ): string {
    const now = new Date();
    const hour = now.getHours();
    const timeOfDay = hour < 12 ? 'mañana' : hour < 18 ? 'tarde' : 'noche';
    const dayOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][now.getDay()];
    const weatherCtx = context.weatherContext;
    const filtered = preFilterWardrobe(wardrobe, context.occasion ?? 'casual');

    return buildOutfitPrompt({
      occasion: context.occasion ?? 'casual',
      weatherDescription: weatherCtx?.condition ?? 'desconocido',
      tempCelsius: weatherCtx?.temperature ?? 20,
      tempFeelsLike: weatherCtx?.feelsLike ?? 20,
      timeOfDay,
      dayOfWeek,
      calendarEvent: context.calendarEvents?.[0]?.title,
      filteredWardrobe: filtered,
    });
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
    items: GarmentLike[],
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
