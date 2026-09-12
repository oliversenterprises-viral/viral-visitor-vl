import type { BoardState, Kingmaker, Rung, UnlockMoment } from '../functions/_lib/engine';

export type { BoardState, Kingmaker, Rung, UnlockMoment };

export interface PublicPlayer {
  code: string;
  siteHost: string;
  siteUrl: string;
  createdAt: number;
  referredBy: string | null;
  credits: number;
  weeklyCredits: number;
  heat: number;
  streakDays: number;
}

export interface PublicSite {
  host: string;
  url: string;
  label: string;
  ownerCode: string;
  createdAt: number;
  credits: number;
  weeklyCredits: number;
  heat: number;
}

export interface JoinOk {
  ok: true;
  demoMode: boolean;
  player: PublicPlayer;
  site: PublicSite;
  shareUrl: string;
  sharePath: string;
  rung: Rung;
  credited: boolean;
  alreadyCredited: boolean;
  selfJoin: boolean;
  referrerCode: string | null;
  teIgnored?: boolean;
  unlock: UnlockMoment | null;
  kingmaker: Kingmaker | null;
  board: BoardState;
  simulated?: boolean;
  persisted?: boolean;
  degraded?: boolean;
}

export interface MeOk {
  ok: true;
  demoMode: boolean;
  player: PublicPlayer | null;
  site: PublicSite | null;
  shareUrl: string | null;
  rung: Rung | null;
  board: BoardState;
}

export interface HealthOk {
  ok: true;
  kv: boolean;
  demoMode: boolean;
  note: string;
  scale?: {
    target: string;
    assumedPlan: string;
    freeTierWarning: string;
    writes: string;
    reads: string;
    degrade: string;
  };
}
