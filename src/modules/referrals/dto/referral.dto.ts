import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplyReferralCodeDto {
  @ApiProperty() @IsString() @IsNotEmpty() code!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deviceFingerprint?: string;
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
