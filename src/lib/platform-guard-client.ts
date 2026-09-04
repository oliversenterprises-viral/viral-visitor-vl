import { isSupabaseConfigured, supabase } from './supabase';
import {
  emptyPlatformGuardSnapshot,
  parsePlatformGuardSnapshot,
  readCachedPublicPlatformGuard,
  rememberPublicPlatformGuard,
  type PlatformGuardSnapshot,
} from './platform-guard';

export async function loadPublicPlatformGuard(): Promise<PlatformGuardSnapshot> {
  const cached = readCachedPublicPlatformGuard();
  if (cached) return cached;
  if (!isSupabaseConfigured) {
    const empty = emptyPlatformGuardSnapshot();
    rememberPublicPlatformGuard(empty);
    return empty;
  }
  try {
    const { data, error } = await supabase.rpc('get_platform_guard_public');
    if (error) {
      const empty = emptyPlatformGuardSnapshot();
      rememberPublicPlatformGuard(empty);
      return empty;
    }
    const snap = parsePlatformGuardSnapshot(data);
    rememberPublicPlatformGuard(snap);
    return snap;
  } catch {
    const empty = emptyPlatformGuardSnapshot();
    rememberPublicPlatformGuard(empty);
    return empty;
  }
}
