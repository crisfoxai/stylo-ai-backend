import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import * as Joi from 'joi';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WardrobeModule } from './modules/wardrobe/wardrobe.module';
import { OutfitsModule } from './modules/outfits/outfits.module';
import { TryonModule } from './modules/tryon/tryon.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';
import { AIModule } from './modules/ai/ai.module';
import { WeatherModule } from './modules/weather/weather.module';
import { StorageModule } from './modules/storage/storage.module';
import { HealthModule } from './modules/health/health.module';
import { StyleProfileModule } from './modules/style-profile/style-profile.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { ChatModule } from './modules/chat/chat.module';
import { ShareModule } from './modules/share/share.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { RedisModule } from './modules/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),
        MONGODB_URI: Joi.string().required(),
        FIREBASE_PROJECT_ID: Joi.string().required(),
        FIREBASE_ADMIN_SA_JSON: Joi.string().required(),
        R2_ACCOUNT_ID: Joi.string().required(),
        R2_ACCESS_KEY_ID: Joi.string().required(),
        R2_SECRET_ACCESS_KEY: Joi.string().required(),
        R2_PUBLIC_BASE_URL: Joi.string().optional(),
        R2_BUCKET_WARDROBE: Joi.string().required(),
        R2_BUCKET_TRYON: Joi.string().required(),
        R2_BUCKET_AVATARS: Joi.string().required(),
        AI_PROVIDER: Joi.string().valid('gemini', 'claude', 'openai', 'custom').default('gemini'),
        GEMINI_API_KEY: Joi.string().when('AI_PROVIDER', { is: 'gemini', then: Joi.required(), otherwise: Joi.optional() }),
        AI_SERVICE_URL: Joi.string().optional(),
        AI_SERVICE_INTERNAL_KEY: Joi.string().optional(),
        OPENWEATHER_API_KEY: Joi.string().required(),
        APPLE_SHARED_SECRET: Joi.string().optional(),
        APPLE_BUNDLE_ID: Joi.string().optional(),
        APPLE_ENVIRONMENT: Joi.string().valid('sandbox', 'production').default('sandbox'),
        GOOGLE_PLAY_SA_JSON: Joi.string().optional(),
        GOOGLE_PLAY_PACKAGE_NAME: Joi.string().optional(),
        ANTHROPIC_API_KEY: Joi.string().optional(),
        REPLICATE_API_TOKEN: Joi.string().optional(),
        SENTRY_DSN_BACKEND: Joi.string().optional(),
        REDIS_URL: Joi.string().optional(),
      }),
    }),
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    ScheduleModule.forRoot(),
    RedisModule,
    AuthModule,
    UsersModule,
    WardrobeModule,
    OutfitsModule,
    TryonModule,
    SubscriptionsModule,
    NotificationsModule,
    WaitlistModule,
    AIModule,
    WeatherModule,
    StorageModule,
    HealthModule,
    StyleProfileModule,
    FavoritesModule,
    FeedbackModule,
    ChatModule,
    ShareModule,
    ReferralsModule,
  ],
})
export class AppModule implements NestModule {
  configure(_consumer: MiddlewareConsumer): void {
    // Middleware configured via NestFactory in main.ts
  }
}
