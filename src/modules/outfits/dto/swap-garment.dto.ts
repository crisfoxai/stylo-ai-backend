import { IsIn, IsOptional, IsArray, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const GARMENT_SLOTS = ['headwear', 'outerwear', 'top', 'bottom', 'footwear', 'accessory'] as const;
export type GarmentSlot = (typeof GARMENT_SLOTS)[number];

export class SwapGarmentDto {
  @ApiProperty({ enum: GARMENT_SLOTS })
  @IsIn(GARMENT_SLOTS)
  garmentSlot!: GarmentSlot;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  excludeIds?: string[];
}
