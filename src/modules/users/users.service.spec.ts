import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';
import { StyleProfileService } from '../style-profile/style-profile.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserModel: { findById: jest.Mock; findByIdAndUpdate: jest.Mock };
  let mockStyleProfileService: { findByUser: jest.Mock };
  let mockSubscriptionsService: { getTryonStats: jest.Mock };

  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    mockUserModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };
    mockStyleProfileService = {
      findByUser: jest.fn(),
    };
    mockSubscriptionsService = {
      getTryonStats: jest.fn().mockResolvedValue({ tryonsUsedThisMonth: 0, tryonsLimitThisMonth: 5, tryonsResetAt: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: StyleProfileService, useValue: mockStyleProfileService },
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockUser = { _id: userId, email: 'test@test.com' };
      mockUserModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockUser) });
      const result = await service.findById(userId);
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when not found', async () => {
      mockUserModel.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      await expect(service.findById(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return user', async () => {
      const mockUser = { _id: userId, displayName: 'New Name' };
      mockUserModel.findByIdAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockUser) });
      const result = await service.update(userId, { displayName: 'New Name' });
      expect(result.displayName).toBe('New Name');
    });

    it('should throw NotFoundException when not found', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      await expect(service.update(userId, { displayName: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStyleProfile', () => {
    it('should return style profile', async () => {
      const mockProfile = { userId, styles: ['casual'] };
      mockStyleProfileService.findByUser.mockResolvedValue(mockProfile);
      const result = await service.getStyleProfile(userId);
      expect(result).toEqual(mockProfile);
    });

    it('should return null if no profile', async () => {
      mockStyleProfileService.findByUser.mockRejectedValue(new Error('not found'));
      const result = await service.getStyleProfile(userId);
      expect(result).toBeNull();
    });
  });

  describe('softDelete', () => {
    it('should soft delete user', async () => {
      mockUserModel.findByIdAndUpdate.mockResolvedValue({ _id: userId, deletedAt: new Date() });
      await expect(service.softDelete(userId)).resolves.not.toThrow();
    });
  });
});
