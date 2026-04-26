import { IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TryonDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  garmentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outfitId?: string;
}
