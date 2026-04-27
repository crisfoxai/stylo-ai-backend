import { IsString, IsOptional, IsNotEmpty, IsArray, IsBoolean, IsNumber, ValidateNested, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class WeatherContextDto {
  @ApiProperty() @IsNumber() temperature!: number;
  @ApiProperty() @IsNumber() feelsLike!: number;
  @ApiProperty() @IsString() condition!: string;
  @ApiProperty() @IsBoolean() willRainLater!: boolean;
  @ApiProperty() @IsString() city!: string;
}

export class CalendarEventDto {
  @ApiProperty() @IsString() title!: string;
  @ApiProperty() @IsString() startTime!: string;
  @ApiProperty() @IsBoolean() isAllDay!: boolean;
}

export class GenerateOutfitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  occasion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mood?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lon?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => WeatherContextDto)
  weatherContext?: WeatherContextDto;

  @ApiPropertyOptional({ type: [CalendarEventDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalendarEventDto)
  calendarEvents?: CalendarEventDto[];
}

export class OutfitHistoryDto {
  @ApiPropertyOptional({ example: '2026-04' })
  @IsOptional()
  @IsString()
  month?: string;
}

export class ListOutfitsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  occasion?: string;

  @ApiPropertyOptional({ enum: ['newest', 'oldest'], default: 'newest' })
  @IsOptional()
  @IsIn(['newest', 'oldest'])
  sort?: 'newest' | 'oldest' = 'newest';

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  favorites?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasLookPhoto?: boolean;
}
