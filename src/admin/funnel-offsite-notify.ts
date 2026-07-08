/**
 * Read-only status for server-side funnel alerts (Telegram or webhook in Supabase secrets).
 */

import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type FunnelOffsiteNotifyChannel = 'telegram' | 'webhook' | null;

export interface FunnelOffsiteNotifyStatus {
  enabled: boolean;
  importantOnly: boolean;
  channel: FunnelOffsiteNotifyChannel;
}

export async function fetchFunnelOffsiteNotifyStatus(): Promise<FunnelOffsiteNotifyStatus | null> {
  if (!isSupabaseConfigured || import.meta.env.MODE === 'test') return null;
  const adminSecret = import.meta.env.VITE_ADMIN_ACTION_SECRET || '';
  if (!adminSecret) return null;

  try {
    const { data, error } = await supabase.functions.invoke('admin-action', {
      body: { action: 'get_funnel_notify_status' },
      headers: { 'x-admin-secret': adminSecret },
    });
    if (error || !data?.success || !data?.data) return null;
    const channel = data.data.channel;
    return {
      enabled: Boolean(data.data.enabled),
      importantOnly: Boolean(data.data.importantOnly),
      channel: channel === 'telegram' || channel === 'webhook' ? channel : null,
    };
  } catch {
    return null;
  }
}

export function funnelOffsiteNotifyStatusLabel(status: FunnelOffsiteNotifyStatus | null): string {
  if (!status?.enabled) {
    return 'Off-site alerts off — set FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN + CHAT_ID in Supabase secrets';
  }
  const via = status.channel === 'telegram' ? 'Telegram' : 'webhook';
  const scope = status.importantOnly ? 'conversion steps only' : 'all funnel steps';
  return `Off-site alerts on via ${via} (${scope})`;
}