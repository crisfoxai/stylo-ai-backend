import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { ChatService } from './chat.service';
import { ChatMessage } from './schemas/chat-message.schema';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { WardrobeService } from '../wardrobe/wardrobe.service';
import { StyleProfileService } from '../style-profile/style-profile.service';

const mockSendMessage = jest.fn().mockResolvedValue({
  response: { text: () => 'Test reply from AI stylist' },
});
const mockStartChat = jest.fn().mockReturnValue({ sendMessage: mockSendMessage });
const mockGetGenerativeModel = jest.fn().mockReturnValue({ startChat: mockStartChat });

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

describe('ChatService', () => {
  let service: ChatService;
  let mockChatModel: { find: jest.Mock; insertMany: jest.Mock };
  let mockSubscriptionsService: { getByUserId: jest.Mock; checkAndIncrementUsage: jest.Mock };
  let mockWardrobeService: { list: jest.Mock };
  let mockStyleProfileService: { findByUser: jest.Mock };

  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSendMessage.mockResolvedValue({ response: { text: () => 'Test reply from AI stylist' } });
    mockStartChat.mockReturnValue({ sendMessage: mockSendMessage });
    mockGetGenerativeModel.mockReturnValue({ startChat: mockStartChat });

    const chainMock = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
    mockChatModel = {
      find: jest.fn().mockReturnValue(chainMock),
      insertMany: jest.fn().mockResolvedValue([]),
    };
    mockSubscriptionsService = {
      getByUserId: jest.fn().mockResolvedValue({ plan: 'pro', chatMessagesUsedThisMonth: 0 }),
      checkAndIncrementUsage: jest.fn().mockResolvedValue(undefined),
    };
    mockWardrobeService = {
      list: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1 }),
    };
    mockStyleProfileService = {
      findByUser: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getModelToken(ChatMessage.name), useValue: mockChatModel },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-key'),
            getOrThrow: jest.fn().mockReturnValue('test-gemini-key'),
          },
        },
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
        { provide: WardrobeService, useValue: mockWardrobeService },
        { provide: StyleProfileService, useValue: mockStyleProfileService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMessage', () => {
    it('should return reply using Gemini Flash for pro plan', async () => {
      const result = await service.sendMessage(userId, { message: 'What should I wear?' });
      expect(result.reply).toBe('Test reply from AI stylist');
      expect(result.sessionId).toBeDefined();
      expect(result.model).toBe('gemini-2.5-flash');
      expect(mockChatModel.insertMany).toHaveBeenCalled();
    });

    it('should use Gemini Flash for stylist plan and check rate limit', async () => {
      mockSubscriptionsService.getByUserId.mockResolvedValue({ plan: 'stylist', chatMessagesUsedThisMonth: 5 });
      const result = await service.sendMessage(userId, { message: 'What to wear?' });
      expect(result.model).toBe('gemini-2.5-flash');
      expect(mockSubscriptionsService.checkAndIncrementUsage).toHaveBeenCalledWith(userId, 'chat');
    });

    it('should throw ForbiddenException for free plan', async () => {
      mockSubscriptionsService.getByUserId.mockResolvedValue({ plan: 'free', chatMessagesUsedThisMonth: 0 });
      await expect(service.sendMessage(userId, { message: 'Hello' })).rejects.toThrow(ForbiddenException);
    });

    it('should reuse sessionId when provided', async () => {
      const result = await service.sendMessage(userId, { message: 'Hi', sessionId: 'existing-session' });
      expect(result.sessionId).toBe('existing-session');
    });

    it('should pass history to Gemini startChat with model role', async () => {
      // Mock returns descending (most recent first), service calls .reverse() to get chronological
      const historyMessages = [
        { role: 'assistant', content: 'Hi!', sessionId: 'test', userId },
        { role: 'user', content: 'Hello', sessionId: 'test', userId },
      ];
      const chainMock = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(historyMessages) };
      mockChatModel.find.mockReturnValue(chainMock);

      await service.sendMessage(userId, { message: 'Follow-up', sessionId: 'test' });
      expect(mockStartChat).toHaveBeenCalledWith({
        history: [
          { role: 'user', parts: [{ text: 'Hello' }] },
          { role: 'model', parts: [{ text: 'Hi!' }] },
        ],
      });
    });
  });

  describe('getHistory', () => {
    it('should return history for session', async () => {
      const mockMessages = [
        { role: 'user', content: 'Hello', sessionId: 'test-session' },
        { role: 'assistant', content: 'Hi there!', sessionId: 'test-session' },
      ];
      const chainMock = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(mockMessages) };
      mockChatModel.find.mockReturnValue(chainMock);

      const result = await service.getHistory(userId, 'test-session');
      expect(result).toHaveLength(2);
    });
  });
});
