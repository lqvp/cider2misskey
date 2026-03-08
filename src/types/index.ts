export type Visibility = "public" | "home" | "followers" | "direct";
export type TriggerMode = "instant" | "seconds" | "percent" | "manual";
export type RepeatBehavior = "skip" | "allow";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface NowPlayingConfig {
  instanceUrl: string;
  token: string;
  visibility: Visibility;
  localOnly: boolean;
  template: string;
  cwEnabled: boolean;
  cwTemplate: string;
  autopost: boolean;
  triggerMode: TriggerMode;
  triggerSeconds: number;
  triggerPercent: number;
  dedupeCooldownSec: number;
  repeatBehavior: RepeatBehavior;
  retries: number;
  retryBackoffSec: number;
  rpcBaseUrl: string;
  rpcAuthToken?: string;
  useRPC: boolean;
  pollIntervalMs: number;
  logLevel: LogLevel;
  enableManualMenu: boolean;
}

export interface NowPlayingInfo {
  id?: string;
  name?: string;
  artistName?: string;
  albumName?: string;
  durationInMillis?: number;
  currentPlaybackTime?: number;
  remainingTime?: number;
  url?: string;
  artwork?: { url?: string };
  trackNumber?: number;
  discNumber?: number;
  genreNames?: string[];
  releaseDate?: string | Date | number;
  isrc?: string;
  audioTraits?: string[];
  repeatMode?: string | number;
  shuffleMode?: string | number;
  hasLyrics?: boolean;
  hasTimeSyncedLyrics?: boolean;
  playParams?: {
    id?: string;
    kind?: string;
    catalogId?: string;
  };
  playerState?: string;
  isPlaying?: boolean;
}
