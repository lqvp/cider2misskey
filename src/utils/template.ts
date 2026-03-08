import type { NowPlayingInfo } from "../types";
import { toSeconds, normalizeReleaseDate } from "./music";
import { constructSongUrl } from "./urlResolver";

export interface PlaceholderMeta {
  key: string;
  group: string;
  description: string;
}

export const PLACEHOLDERS: Record<string, (info: NowPlayingInfo) => string> = {
  title: (i) => i?.name ?? "",
  artist: (i) => i?.artistName ?? "",
  album: (i) => i?.albumName ?? "",
  url: (i) => constructSongUrl(i) ?? "",
  artwork: (i) => i?.artwork?.url ?? "",
  duration_ms: (i) => String(i?.durationInMillis ?? ""),
  duration_s: (i) => String(toSeconds(i?.durationInMillis)),
  elapsed_s: (i) => String(Math.round(i?.currentPlaybackTime ?? 0)),
  remaining_s: (i) => String(Math.round(i?.remainingTime ?? 0)),
  track_no: (i) => String(i?.trackNumber ?? ""),
  disc_no: (i) => String(i?.discNumber ?? ""),
  genres: (i) => (Array.isArray(i?.genreNames) ? i.genreNames.join(", ") : ""),
  release_date: (i) => normalizeReleaseDate(i?.releaseDate),
  isrc: (i) => i?.isrc ?? "",
  audio_traits: (i) =>
    Array.isArray(i?.audioTraits) ? i.audioTraits.join(", ") : "",
  repeat_mode: (i) => String(i?.repeatMode ?? ""),
  shuffle_mode: (i) => String(i?.shuffleMode ?? ""),
  has_lyrics: (i) => String(i?.hasLyrics ?? ""),
  has_time_synced_lyrics: (i) => String(i?.hasTimeSyncedLyrics ?? ""),
  play_params_id: (i) => i?.playParams?.id ?? "",
  play_params_kind: (i) => i?.playParams?.kind ?? "",
};

export const PLACEHOLDER_META: PlaceholderMeta[] = [
  { key: "title", group: "Track", description: "曲名" },
  { key: "artist", group: "Track", description: "アーティスト名" },
  { key: "album", group: "Album", description: "アルバム名" },
  { key: "track_no", group: "Album", description: "トラック番号" },
  { key: "disc_no", group: "Album", description: "ディスク番号" },
  { key: "genres", group: "Metadata", description: "ジャンル（カンマ区切り）" },
  { key: "release_date", group: "Metadata", description: "リリース日" },
  { key: "isrc", group: "IDs", description: "ISRC" },
  { key: "play_params_id", group: "IDs", description: "playParams.id（曲IDのことが多い）" },
  { key: "play_params_kind", group: "IDs", description: "playParams.kind（songなど）" },
  { key: "url", group: "Links", description: "Apple Music URL（ある場合）" },
  { key: "artwork", group: "Links", description: "アートワークURL（テキストのみ）" },
  { key: "duration_ms", group: "Playback", description: "曲長（ms）" },
  { key: "duration_s", group: "Playback", description: "曲長（秒）" },
  { key: "elapsed_s", group: "Playback", description: "再生経過（秒）" },
  { key: "remaining_s", group: "Playback", description: "残り（秒）" },
  { key: "repeat_mode", group: "Playback", description: "リピート状態" },
  { key: "shuffle_mode", group: "Playback", description: "シャッフル状態" },
  { key: "audio_traits", group: "Playback", description: "音質/機能（lossless/atmosなど）" },
  { key: "has_lyrics", group: "Lyrics", description: "歌詞があるか（true/false）" },
  { key: "has_time_synced_lyrics", group: "Lyrics", description: "同期歌詞があるか（true/false）" },
];

export function renderTemplate(tpl: string, info: NowPlayingInfo): string {
  return tpl.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const val = PLACEHOLDERS[key]?.(info);
    return val ?? "";
  });
}

export function getPlaceholderKeys(): string[] {
  return PLACEHOLDER_META.map((p) => p.key);
}

export function getPlaceholders(): PlaceholderMeta[] {
  return PLACEHOLDER_META;
}

export function renderTemplatePreview(tpl: string, info: NowPlayingInfo): string {
  return renderTemplate(tpl, info);
}
