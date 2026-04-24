import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let mockService: { registerToken: jest.Mock; unregisterToken: jest.Mock };

  const mockUser = { _id: new Types.ObjectId(), email: 'test@test.com' };

  beforeEach(async () => {
    mockService = { registerToken: jest.fn(), unregisterToken: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockService }],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('registerToken - should register push token', async () => {
    const mockToken = { token: 'fcm-token', platform: 'ios' };
    mockService.registerToken.mockResolvedValue(mockToken);
    const result = await controller.registerToken(mockUser as never, { token: 'fcm-token', platform: 'ios' });
    expect(result.token).toBe('fcm-token');
  });

  it('unregisterToken - should unregister token', async () => {
    mockService.unregisterToken.mockResolvedValue(undefined);
    await expect(controller.unregisterToken(mockUser as never, { token: 'fcm-token' })).resolves.not.toThrow();
  });

  it('updatePreferences - should return ok', async () => {
    const result = await controller.updatePreferences(mockUser as never, { outfitOfTheDay: true });
    expect(result).toEqual({ ok: true });
  });
});
