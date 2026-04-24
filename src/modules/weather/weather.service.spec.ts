import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { WeatherService } from './weather.service';
import { AxiosResponse } from 'axios';

describe('WeatherService', () => {
  let service: WeatherService;
  let mockHttpService: { get: jest.Mock };

  beforeEach(async () => {
    mockHttpService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-api-key') },
        },
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<WeatherService>(WeatherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch weather and cache result', async () => {
    const mockResponse = {
      data: {
        main: { temp: 22.5 },
        weather: [{ description: 'clear sky' }],
      },
    } as AxiosResponse;

    mockHttpService.get.mockReturnValue(of(mockResponse));

    const result = await service.getByLocation(40.7, -74.0);
    expect(result.tempC).toBe(22.5);
    expect(result.condition).toBe('clear sky');

    // Second call should use cache
    await service.getByLocation(40.7, -74.0);
    expect(mockHttpService.get).toHaveBeenCalledTimes(1);
  });

  it('should return fallback data when API fails', async () => {
    mockHttpService.get.mockReturnValue(throwError(() => new Error('Network error')));

    const result = await service.getByLocation(0, 0);
    expect(result.tempC).toBe(20);
    expect(result.condition).toBe('unknown');
  });
});
