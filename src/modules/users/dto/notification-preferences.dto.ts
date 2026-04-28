import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() global?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() outfitsDaily?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() outfitsOccasion?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() outfitsWeekly?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() tryOn?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() referrals?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() subscription?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() wardrobeInsights?: boolean;
}
