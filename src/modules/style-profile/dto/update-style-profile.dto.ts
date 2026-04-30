import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsArray,
  IsEnum,
  IsString,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { StyleTag, Occasion } from '../schemas/style-profile.schema';

export class UpdateStyleProfileDto {
  @ApiPropertyOptional({ enum: StyleTag, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(StyleTag, { each: true })
  styles?: StyleTag[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  colors?: string[];

  @ApiPropertyOptional({ enum: Occasion, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(Occasion, { each: true })
  occasions?: Occasion[];

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  adventureLevel?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  priorities?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  quizCompleted?: boolean;
}
