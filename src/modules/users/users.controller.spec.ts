import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let mockService: {
    findById: jest.Mock;
    update: jest.Mock;
    getStyleProfile: jest.Mock;
    upsertStyleProfile: jest.Mock;
    softDelete: jest.Mock;
  };

  const mockUser = { _id: new Types.ObjectId(), email: 'test@test.com', displayName: 'Test' };

  beforeEach(async () => {
    mockService = {
      findById: jest.fn(),
      update: jest.fn(),
      getStyleProfile: jest.fn().mockResolvedValue(null),
      upsertStyleProfile: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockService }],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getMe - should return user with style profile', async () => {
    const result = await controller.getMe(mockUser as never);
    expect(result.styleProfile).toBeNull();
  });

  it('updateMe - should update user', async () => {
    mockService.update.mockResolvedValue({ ...mockUser, displayName: 'New Name' });
    const result = await controller.updateMe(mockUser as never, { displayName: 'New Name' });
    expect(result.displayName).toBe('New Name');
  });

  it('updateStyleProfile - should upsert profile', async () => {
    const mockProfile = { preferredStyles: ['casual'] };
    mockService.upsertStyleProfile.mockResolvedValue(mockProfile);
    const result = await controller.updateStyleProfile(mockUser as never, { preferredStyles: ['casual'] });
    expect(result).toEqual(mockProfile);
  });

  it('deleteMe - should soft delete user', async () => {
    mockService.softDelete.mockResolvedValue(undefined);
    await expect(controller.deleteMe(mockUser as never)).resolves.not.toThrow();
  });
});
