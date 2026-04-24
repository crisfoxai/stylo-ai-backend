import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { TryonController } from './tryon.controller';
import { TryonService } from './tryon.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';

describe('TryonController', () => {
  let controller: TryonController;
  let mockService: { tryon: jest.Mock };

  const mockUser = { _id: new Types.ObjectId(), email: 'test@test.com' };

  beforeEach(async () => {
    mockService = { tryon: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TryonController],
      providers: [{ provide: TryonService, useValue: mockService }],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TryonController>(TryonController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('tryon - should call service and return result', async () => {
    const mockResult = { resultUrl: 'https://r2.example.com/result.jpg' };
    mockService.tryon.mockResolvedValue(mockResult);

    const file = { originalname: 'photo.jpg', buffer: Buffer.from(''), mimetype: 'image/jpeg' } as Express.Multer.File;
    const result = await controller.tryon(mockUser as never, file, { outfitId: 'outfit-id', itemIds: [] });
    expect(result.resultUrl).toBeDefined();
  });
});
