import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';
import { StyleProfile } from './schemas/style-profile.schema';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserModel: { findById: jest.Mock; findByIdAndUpdate: jest.Mock };
  let mockStyleProfileModel: { findOne: jest.Mock; findOneAndUpdate: jest.Mock };

  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    mockUserModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };
    mockStyleProfileModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(StyleProfile.name), useValue: mockStyleProfileModel },
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
      const mockProfile = { userId, preferredStyles: ['casual'] };
      mockStyleProfileModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockProfile) });
      const result = await service.getStyleProfile(userId);
      expect(result).toEqual(mockProfile);
    });

    it('should return null if no profile', async () => {
      mockStyleProfileModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      const result = await service.getStyleProfile(userId);
      expect(result).toBeNull();
    });
  });

  describe('upsertStyleProfile', () => {
    it('should create/update style profile', async () => {
      const mockProfile = { userId, preferredStyles: ['casual'], preferredColors: ['blue'] };
      mockStyleProfileModel.findOneAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockProfile) });
      const result = await service.upsertStyleProfile(userId, { preferredStyles: ['casual'] });
      expect(result).toEqual(mockProfile);
    });
  });

  describe('softDelete', () => {
    it('should soft delete user', async () => {
      mockUserModel.findByIdAndUpdate.mockResolvedValue({ _id: userId, deletedAt: new Date() });
      await expect(service.softDelete(userId)).resolves.not.toThrow();
    });
  });
});
