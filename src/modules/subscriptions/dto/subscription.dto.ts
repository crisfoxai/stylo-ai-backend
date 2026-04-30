import { IsString, IsNotEmpty, IsIn, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyReceiptDto {
  @ApiProperty({ enum: ['apple', 'google'] })
  @IsString()
  @IsIn(['apple', 'google'])
  platform!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  receipt!: string;
}

export class DevUpgradeDto {
  @ApiProperty({ enum: ['stylist', 'pro', 'pro_unlimited'] })
  @IsString()
  @IsIn(['stylist', 'pro', 'pro_unlimited'])
  plan!: string;
}
