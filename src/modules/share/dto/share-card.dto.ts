import { ApiProperty } from '@nestjs/swagger';

export class ShareCardResponseDto {
  @ApiProperty() url!: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty() outfitId!: string;
}
