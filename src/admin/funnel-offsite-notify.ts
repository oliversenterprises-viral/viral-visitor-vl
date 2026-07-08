/**
 * Read-only status for server-side funnel alerts (Telegram or webhook in Supabase secrets).
 */

import { isSupabaseConfigured } from '../lib/supabase';
import { invokeAdminAction } from '../lib/admin-action-client';

export type FunnelOffsiteNotifyChannel = 'telegram' | 'webhook' | null;

export interface FunnelOffsiteNotifyStatus {
  enabled: boolean;
  importantOnly: boolean;
  channel: FunnelOffsiteNotifyChannel;
}

export async function fetchFunnelOffsiteNotifyStatus(): Promise<FunnelOffsiteNotifyStatus | null> {
  if (!isSupabaseConfigured || import.meta.env.MODE === 'test') return null;

  const result = await invokeAdminAction<{
    enabled?: boolean;
    importantOnly?: boolean;
    channel?: string;
  }>('get_funnel_notify_status');
  if (!result.success || !result.data) return null;

  const channel = result.data.channel;
  return {
    enabled: Boolean(result.data.enabled),
    importantOnly: Boolean(result.data.importantOnly),
    channel: channel === 'telegram' || channel === 'webhook' ? channel : null,
  };
}

export function funnelOffsiteNotifyStatusLabel(status: FunnelOffsiteNotifyStatus | null): string {
  if (!status?.enabled) {
    return 'Off-site alerts off — set FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN + CHAT_ID in Supabase secrets';
  }
  const via = status.channel === 'telegram' ? 'Telegram' : 'webhook';
  const scope = status.importantOnly ? 'conversion steps only' : 'all funnel steps';
  return `Off-site alerts on via ${via} (${scope})`;
}