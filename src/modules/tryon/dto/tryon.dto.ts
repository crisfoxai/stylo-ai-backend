import { IsOptional, IsString, IsNotEmpty, IsIn } from 'class-validator';
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

  @ApiProperty({ description: 'Garment category (top, bottom, outerwear, dress, or common aliases like pants, shirt, etc.)' })
  @IsString()
  @IsIn(['top', 'bottom', 'outerwear', 'dress', 'pants', 'jeans', 'trousers', 'shorts', 'skirt', 'shirt', 'tshirt', 'blouse', 'sweater', 'hoodie', 'jacket', 'coat'])
  category!: string;
}

/** Swagger schema for the multipart/form-data outfit try-on endpoint */
export class TryonOutfitFormDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'New base photo (JPEG/PNG, max 10 MB). Provide this or basePhotoId, not both.' })
  basePhotoFile?: Express.Multer.File;

  @ApiPropertyOptional({ type: 'string', description: 'ID of existing base photo. Provide this or basePhotoFile, not both.' })
  basePhotoId?: string;

  @ApiProperty({
    type: 'string',
    description: 'JSON array of TryonOutfitGarmentDto objects',
    example: '[{"garmentId":"abc123","category":"top"},{"garmentId":"def456","category":"pants"}]',
  })
  garments!: string;

  @ApiPropertyOptional({ type: 'string' })
  outfitId?: string;
}
