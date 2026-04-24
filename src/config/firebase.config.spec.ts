import { ConfigService } from '@nestjs/config';

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn().mockReturnValue({ auth: jest.fn() }),
  credential: { cert: jest.fn().mockReturnValue({}) },
}));

describe('getFirebaseApp', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should initialize firebase app', async () => {
    const { getFirebaseApp } = await import('./firebase.config');
    const mockConfigService = {
      get: jest.fn().mockReturnValue(JSON.stringify({ type: 'service_account', project_id: 'test' })),
    } as unknown as ConfigService;

    const app = getFirebaseApp(mockConfigService);
    expect(app).toBeDefined();
  });

  it('should return same instance on second call', async () => {
    const { getFirebaseApp } = await import('./firebase.config');
    const mockConfigService = {
      get: jest.fn().mockReturnValue(JSON.stringify({ type: 'service_account', project_id: 'test' })),
    } as unknown as ConfigService;

    const app1 = getFirebaseApp(mockConfigService);
    const app2 = getFirebaseApp(mockConfigService);
    expect(app1).toBe(app2);
  });
});
