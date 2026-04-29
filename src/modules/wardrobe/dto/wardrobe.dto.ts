import { IsString, IsOptional, IsArray, IsNumber, Min, Max, IsIn, ValidateNested, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ListWardrobeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() color?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() colorSecondary?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() brand?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) materials?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() fit?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) seasons?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) occasions?: string[];
  @ApiPropertyOptional({ enum: ['top', 'bottom', 'shoes', 'accessory', 'outerwear', 'dress', 'other'] })
  @IsOptional() @IsString() @IsIn(['top', 'bottom', 'shoes', 'accessory', 'outerwear', 'dress', 'other'])
  category?: string;
  @ApiPropertyOptional({ enum: ['new', 'good', 'used', 'donate'] })
  @IsOptional() @IsString() condition?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() purchasePrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() purchaseDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class ConfirmedGarmentDto {
  @ApiProperty() @IsString() tipo!: string;
  @ApiProperty() @IsString() color!: string;
  @ApiProperty() @IsString() descripcion!: string;
  @ApiProperty() @IsString() categoria!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() material?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) materials?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() style?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fit?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) seasons?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) occasions?: string[];
}

export class ConfirmDetectionDto {
  @ApiProperty() @IsString() photoKey!: string;
  @ApiProperty({ type: [ConfirmedGarmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmedGarmentDto)
  garments!: ConfirmedGarmentDto[];
}
