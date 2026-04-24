import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { WaitlistService } from './waitlist.service';
import { WaitlistEntry } from './schemas/waitlist-entry.schema';

describe('WaitlistService', () => {
  let service: WaitlistService;
  let mockModel: { findOne: jest.Mock; create: jest.Mock };

  beforeEach(async () => {
    mockModel = { findOne: jest.fn(), create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        { provide: getModelToken(WaitlistEntry.name), useValue: mockModel },
      ],
    }).compile();

    service = module.get<WaitlistService>(WaitlistService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register new email', async () => {
    mockModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    mockModel.create.mockResolvedValue({ email: 'test@test.com' });

    const result = await service.register({ email: 'test@test.com' });
    expect(result.message).toBe('registered');
  });

  it('should return already_registered for duplicate email', async () => {
    mockModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ email: 'test@test.com' }) });

    const result = await service.register({ email: 'test@test.com' });
    expect(result.message).toBe('already_registered');
    expect(mockModel.create).not.toHaveBeenCalled();
  });
});
