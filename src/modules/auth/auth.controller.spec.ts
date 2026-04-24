import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let mockService: { createSession: jest.Mock };

  const mockUser = { _id: new Types.ObjectId(), firebaseUid: 'fb123', email: 'test@test.com' };

  beforeEach(async () => {
    mockService = { createSession: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockService }],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createSession', () => {
    it('should create session', async () => {
      const expiresAt = new Date(Date.now() + 3600000);
      mockService.createSession.mockResolvedValue({ user: mockUser, expiresAt });
      const result = await controller.createSession({ idToken: 'valid-token' });
      expect(result.user).toEqual(mockUser);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('logout', () => {
    it('should return ok', async () => {
      const result = await controller.logout(mockUser as never);
      expect(result).toEqual({ ok: true });
    });
  });
});
