import { IsString, IsOptional, IsArray, IsNumber, Min, Max, IsIn, ValidateNested, IsDateString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ListWardrobeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class UpdateWardrobeItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) color?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) colorSecondary?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) brand?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(50, { each: true }) tags?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(100, { each: true }) materials?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) fit?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(20, { each: true }) seasons?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(50, { each: true }) occasions?: string[];
  @ApiPropertyOptional({ enum: ['top', 'bottom', 'shoes', 'accessory', 'outerwear', 'dress', 'other'] })
  @IsOptional() @IsString() @IsIn(['top', 'bottom', 'shoes', 'accessory', 'outerwear', 'dress', 'other'])
  category?: string;
  @ApiPropertyOptional({ enum: ['new', 'good', 'used', 'donate'] })
  @IsOptional() @IsString() @IsIn(['new', 'good', 'used', 'donate']) condition?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() purchasePrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() purchaseDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class ConfirmedGarmentDto {
  @ApiProperty() @IsString() @MaxLength(50) tipo!: string;
  @ApiProperty() @IsString() @MaxLength(50) color!: string;
  @ApiProperty() @IsString() @MaxLength(500) descripcion!: string;
  @ApiProperty() @IsString() @MaxLength(50) categoria!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) material?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(100, { each: true }) materials?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) style?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) fit?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(20, { each: true }) seasons?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(50, { each: true }) occasions?: string[];
}

export class ConfirmDetectionDto {
  @ApiProperty() @IsString() @MaxLength(500) photoKey!: string;
  @ApiProperty({ type: [ConfirmedGarmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmedGarmentDto)
  garments!: ConfirmedGarmentDto[];
}
