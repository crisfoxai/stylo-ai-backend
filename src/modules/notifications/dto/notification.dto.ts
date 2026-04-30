import { IsString, IsNotEmpty, IsIn, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;

  @ApiProperty({ enum: ['ios', 'android'] })
  @IsString()
  @IsIn(['ios', 'android'])
  platform!: string;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  outfitOfTheDay?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  promotions?: boolean;
}
