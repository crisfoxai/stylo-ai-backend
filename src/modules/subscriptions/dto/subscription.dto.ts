import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyReceiptDto {
  @ApiProperty({ enum: ['apple', 'google'] })
  @IsString()
  @IsIn(['apple', 'google'])
  platform!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  receipt!: string;
}
