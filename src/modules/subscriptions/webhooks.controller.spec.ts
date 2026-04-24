import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { SubscriptionsService } from './subscriptions.service';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let mockService: { handleAppleWebhook: jest.Mock; handleGoogleWebhook: jest.Mock };

  beforeEach(async () => {
    mockService = { handleAppleWebhook: jest.fn(), handleGoogleWebhook: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [{ provide: SubscriptionsService, useValue: mockService }],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('appleWebhook - should handle apple notification', async () => {
    mockService.handleAppleWebhook.mockResolvedValue(undefined);
    const result = await controller.appleWebhook({ signedPayload: 'abc' });
    expect(result).toEqual({ ok: true });
  });

  it('googleWebhook - should handle google notification', async () => {
    mockService.handleGoogleWebhook.mockResolvedValue(undefined);
    const result = await controller.googleWebhook({ message: { data: 'abc' } });
    expect(result).toEqual({ ok: true });
  });
});
