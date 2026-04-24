import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from '../users/schemas/user.schema';

jest.mock('../../config/firebase.config', () => ({
  getFirebaseApp: jest.fn().mockReturnValue({
    auth: () => ({
      verifyIdToken: jest.fn(),
    }),
  }),
}));

describe('AuthService', () => {
  let service: AuthService;
  let mockUserModel: {
    findOneAndUpdate: jest.Mock;
  };
  let mockFirebaseAuth: { verifyIdToken: jest.Mock };

  beforeEach(async () => {
    mockFirebaseAuth = { verifyIdToken: jest.fn() };

    const { getFirebaseApp } = jest.requireMock('../../config/firebase.config') as {
      getFirebaseApp: jest.Mock;
    };
    getFirebaseApp.mockReturnValue({ auth: () => mockFirebaseAuth });

    mockUserModel = {
      findOneAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('mock-value'), getOrThrow: jest.fn().mockReturnValue('mock-value') },
        },
        { provide: getModelToken(User.name), useValue: mockUserModel },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyAndLoadUser', () => {
    it('should return user when token is valid', async () => {
      const mockUser = { _id: 'uid123', firebaseUid: 'firebase123', email: 'test@test.com' };
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({
        uid: 'firebase123',
        email: 'test@test.com',
        name: 'Test User',
        picture: '',
      });
      mockUserModel.findOneAndUpdate.mockResolvedValue(mockUser);

      const result = await service.verifyAndLoadUser('valid-token');
      expect(result).toEqual(mockUser);
      expect(mockFirebaseAuth.verifyIdToken).toHaveBeenCalledWith('valid-token');
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      mockFirebaseAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

      await expect(service.verifyAndLoadUser('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user not found after upsert', async () => {
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({
        uid: 'firebase123',
        email: 'test@test.com',
      });
      mockUserModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(service.verifyAndLoadUser('valid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('createSession', () => {
    it('should return user and expiresAt', async () => {
      const mockUser = { _id: 'uid123', firebaseUid: 'firebase123' };
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({ uid: 'firebase123', email: 'test@test.com' });
      mockUserModel.findOneAndUpdate.mockResolvedValue(mockUser);

      const result = await service.createSession('valid-token');
      expect(result.user).toEqual(mockUser);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
