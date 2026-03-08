import type { NowPlayingInfo } from "../types";

export function toSeconds(ms?: number): number {
  if (!ms && ms !== 0) return 0;
  return Math.round(ms / 1000);
}

export function normalizeReleaseDate(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    if (value.includes("T")) return value.split("T")[0] ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString().split("T")[0] ?? "";
    }
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString().split("T")[0] ?? "";
  }
  if (typeof value === "number") {
    return new Date(value).toISOString().split("T")[0] ?? "";
  }
  return String(value);
}

export function buildTrackId(info?: NowPlayingInfo): string {
  return (
    info?.playParams?.id ||
    info?.id ||
    [info?.name, info?.artistName, info?.albumName].filter(Boolean).join("::")
  );
}

export function isPlaying(info?: NowPlayingInfo): boolean {
  if (!info) return false;
  if (info.playerState === "playing") return true;
  if (info.isPlaying === true) return true;
  if (typeof info.currentPlaybackTime === "number") {
    return info.remainingTime !== 0 || info.currentPlaybackTime > 0;
  }
  return true;
}
