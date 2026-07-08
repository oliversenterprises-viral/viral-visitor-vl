import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getGrowthPostTelegramChatId,
  isTelegramMarketingConfigured,
} from '../../supabase/functions/_shared/telegram-marketing.ts';

describe('telegram-marketing', () => {
  const prevChannel = process.env.GROWTH_POST_TELEGRAM_CHAT_ID;
  const prevToken = process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN;

  afterEach(() => {
    if (prevChannel === undefined) delete process.env.GROWTH_POST_TELEGRAM_CHAT_ID;
    else process.env.GROWTH_POST_TELEGRAM_CHAT_ID = prevChannel;
    if (prevToken === undefined) delete process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN;
    else process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN = prevToken;
  });

  it('defaults channel to @viralrefer', () => {
    delete process.env.GROWTH_POST_TELEGRAM_CHAT_ID;
    expect(getGrowthPostTelegramChatId()).toBe('@viralrefer');
  });

  it('respects GROWTH_POST_TELEGRAM_CHAT_ID override', () => {
    process.env.GROWTH_POST_TELEGRAM_CHAT_ID = '@custom';
    expect(getGrowthPostTelegramChatId()).toBe('@custom');
  });

  it('isTelegramMarketingConfigured when bot token set', () => {
    process.env.FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN = '123:abc';
    expect(isTelegramMarketingConfigured()).toBe(true);
  });
});