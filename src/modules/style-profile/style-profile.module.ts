import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { StyleProfileController } from './style-profile.controller';
import { StyleProfileService } from './style-profile.service';
import { StyleProfile, StyleProfileSchema } from './schemas/style-profile.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: StyleProfile.name, schema: StyleProfileSchema }]), AuthModule],
  controllers: [StyleProfileController],
  providers: [StyleProfileService],
  exports: [StyleProfileService],
})
export class StyleProfileModule {}
