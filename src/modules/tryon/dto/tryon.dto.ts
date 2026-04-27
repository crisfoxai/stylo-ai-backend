import { IsOptional, IsString, IsNotEmpty, IsArray, ValidateNested, IsIn, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
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

export class TryonOutfitGarmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  garmentId!: string;

  @ApiProperty({ enum: ['top', 'bottom', 'outerwear', 'dress'] })
  @IsString()
  @IsIn(['top', 'bottom', 'outerwear', 'dress'])
  category!: string;
}

export class TryonOutfitDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userPhotoUrl!: string;

  @ApiProperty({ type: [TryonOutfitGarmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => TryonOutfitGarmentDto)
  garments!: TryonOutfitGarmentDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outfitId?: string;
}
