import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface WeatherData {
  tempC: number;
  condition: string;
  lat: number;
  lon: number;
}

interface CacheEntry {
  data: WeatherData;
  expiresAt: number;
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 10 * 60 * 1000; // 10 min
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = configService.getOrThrow<string>('OPENWEATHER_API_KEY');
  }

  async getByLocation(lat: number, lon: number): Promise<WeatherData> {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const cached = this.cache.get(key);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          main: { temp: number };
          weather: { description: string }[];
        }>('https://api.openweathermap.org/data/2.5/weather', {
          params: { lat, lon, appid: this.apiKey, units: 'metric' },
          timeout: 5000,
        }),
      );

      const data: WeatherData = {
        tempC: response.data.main.temp,
        condition: response.data.weather[0]?.description ?? 'clear',
        lat,
        lon,
      };

      this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
      return data;
    } catch (error) {
      this.logger.warn(`Weather fetch failed for ${key}: ${(error as Error).message}`);
      return { tempC: 20, condition: 'unknown', lat, lon };
    }
  }
}
