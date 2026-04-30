import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplyReferralCodeDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(20) code!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) deviceFingerprint?: string;
}

export class ReferralStatsResponseDto {
  @ApiProperty() referralCode!: string;
  @ApiProperty() totalReferred!: number;
  @ApiProperty() validated!: number;
  @ApiProperty() bonusDaysActive!: boolean;
  @ApiPropertyOptional() premiumAccessUntil?: string | null;
  @ApiProperty() referralLink!: string;
  @ApiProperty() alreadyReferred!: boolean;
}
