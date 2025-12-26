import { Ref, reactive } from "vue";
import { useLogStore } from "../stores/logs";

type Visibility = "public" | "home" | "followers" | "direct";
type TriggerMode = "instant" | "seconds" | "percent" | "manual";
type RepeatBehavior = "skip" | "allow";
type LogLevel = "debug" | "info" | "error";
type HttpStatusError = Error & { status?: number };

export type NowPlayingConfig = {
  instanceUrl: string;
  token: string;
  visibility: Visibility;
  localOnly: boolean;
  template: string;
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
};

type NowPlayingInfo = Record<string, any>;
type PlaceholderMeta = {
  key: string;
  group: string;
  description: string;
};

type PosterState = {
  lastTrackId: string;
  lastTrack?: NowPlayingInfo;
  lastTrackSeenId: string;
  lastTrackSeenAt: number;
  lastPostedTrackId: string;
  lastPostAt: number;
  lastPostAttemptTrackId: string;
  lastPostAttemptAt: number;
  lastPostResult?: string;
  lastError?: string;
  isPosting: boolean;
  noteId?: string;
};

type LevelWeight = Record<LogLevel, number>;

const levelWeight: LevelWeight = {
  debug: 10,
  info: 20,
  error: 30,
};

const INSTANT_GUARD_MS = 500;

function shouldLog(cfg: NowPlayingConfig, level: LogLevel) {
  return levelWeight[level] >= levelWeight[cfg.logLevel];
}

function toSeconds(ms?: number) {
  if (!ms && ms !== 0) return 0;
  return Math.round(ms / 1000);
}

function buildTrackId(info?: NowPlayingInfo) {
  return (
    info?.playParams?.id ||
    info?.id ||
    [info?.name, info?.artistName, info?.albumName]
      .filter(Boolean)
      .join("::")
  );
}

function isPlaying(info?: NowPlayingInfo) {
  // Fallback heuristics; Cider RPC may expose playBackState flags.
  if (!info) return false;
  if (info.playerState === "playing") return true;
  if (info.isPlaying === true) return true;
  if (typeof info.currentPlaybackTime === "number") {
    // If playback is progressing, treat as playing.
    return info.remainingTime !== 0 || info.currentPlaybackTime > 0;
  }
  return true;
}

const PLACEHOLDERS: Record<string, (info: NowPlayingInfo) => string> = {
  title: (i) => i?.name ?? "",
  artist: (i) => i?.artistName ?? "",
  album: (i) => i?.albumName ?? "",
  url: (i) => i?.url ?? "",
  artwork: (i) => i?.artwork?.url ?? "",
  duration_ms: (i) => String(i?.durationInMillis ?? ""),
  duration_s: (i) => String(toSeconds(i?.durationInMillis)),
  elapsed_s: (i) => String(Math.round(i?.currentPlaybackTime ?? 0)),
  remaining_s: (i) => String(Math.round(i?.remainingTime ?? 0)),
  track_no: (i) => String(i?.trackNumber ?? ""),
  disc_no: (i) => String(i?.discNumber ?? ""),
  genres: (i) => (Array.isArray(i?.genreNames) ? i.genreNames.join(", ") : ""),
  release_date: (i) => i?.releaseDate ?? "",
  isrc: (i) => i?.isrc ?? "",
  audio_traits: (i) =>
    Array.isArray(i?.audioTraits) ? i.audioTraits.join(", ") : "",
  repeat_mode: (i) => String(i?.repeatMode ?? ""),
  shuffle_mode: (i) => String(i?.shuffleMode ?? ""),
  has_lyrics: (i) => String(i?.hasLyrics ?? ""),
  has_time_synced_lyrics: (i) => String(i?.hasTimeSyncedLyrics ?? ""),
  preview_url: (i) => i?.previews?.[0]?.url ?? "",
  play_params_id: (i) => i?.playParams?.id ?? "",
  play_params_kind: (i) => i?.playParams?.kind ?? "",
};

const PLACEHOLDER_META: PlaceholderMeta[] = [
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
  { key: "preview_url", group: "Links", description: "プレビューURL（ある場合）" },
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

function renderTemplate(tpl: string, info: NowPlayingInfo) {
  return tpl.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const val = PLACEHOLDERS[key]?.(info);
    return val ?? "";
  });
}

async function postToMisskey(
  cfg: NowPlayingConfig,
  text: string,
  log: (level: LogLevel, msg: string, detail?: unknown) => void
) {
  const endpoint = `${cfg.instanceUrl.replace(/\/+$/, "")}/api/notes/create`;
  const body = {
    i: cfg.token,
    visibility: cfg.visibility,
    localOnly: cfg.localOnly,
    text,
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Misskey API error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  log("info", "Posted to Misskey", { noteId: data?.createdNote?.id ?? data?.id });
  return data;
}

function fetchViaMusicKit(mkArg?: any): NowPlayingInfo | null {
  // Prefer local MusicKit state (no RPC / token needed).
  const mk = mkArg ?? (window as any)?.MusicKit?.getInstance?.();
  if (!mk) return null;
  const player = mk.player ?? mk._player;
  const item = mk.nowPlayingItem ?? player?.nowPlayingItem;
  if (!item) return null;

  const attrs = item.attributes ?? item; // attributes on native MusicKit, flat on Cider's wrapped object
  const durationSeconds =
    player?.currentPlaybackDuration ??
    (attrs.durationInMillis != null
      ? attrs.durationInMillis / 1000
      : undefined) ??
    (item.durationInMillis != null ? item.durationInMillis / 1000 : undefined) ??
    0;
  const currentPlaybackTime =
    player?.currentPlaybackTime ?? mk.currentPlaybackTime ?? 0;
  const remainingTime = Math.max(durationSeconds - currentPlaybackTime, 0);

  return {
    ...attrs,
    playParams: item.playParams ?? attrs.playParams,
    currentPlaybackTime,
    durationInMillis: (durationSeconds || 0) * 1000,
    remainingTime,
    repeatMode: player?.repeatMode ?? mk?.player?.repeatMode,
    shuffleMode: player?.shuffleMode ?? mk?.player?.shuffleMode,
  };
}

async function fetchViaRPC(cfg: NowPlayingConfig) {
  const endpoint = `${cfg.rpcBaseUrl.replace(/\/+$/, "")}/api/v1/playback/now-playing`;
  const headers: Record<string, string> = {};
  if (cfg.rpcAuthToken) {
    headers["apitoken"] = cfg.rpcAuthToken;
  }
  const res = await fetch(endpoint, { headers });
  if (!res.ok) {
    const err = await res.text();
    const e = new Error(`RPC error ${res.status}: ${err}`) as HttpStatusError;
    e.status = res.status;
    throw e;
  }
  const json = await res.json();
  return json?.info ?? json;
}

async function fetchNowPlaying(cfg: NowPlayingConfig) {
  const mkInfo = fetchViaMusicKit();
  if (mkInfo) return mkInfo;
  if (!cfg.useRPC) return null;
  return fetchViaRPC(cfg);
}

class NowPlayingPoster {
  #timer: number | null = null;
  #cfgRef: Ref<NowPlayingConfig>;
  state: PosterState;
  logStore = useLogStore();

  constructor(cfgRef: Ref<NowPlayingConfig>) {
    this.#cfgRef = cfgRef;
    this.state = reactive<PosterState>({
      lastTrackId: "",
      lastTrack: undefined,
      lastTrackSeenId: "",
      lastTrackSeenAt: 0,
      lastPostedTrackId: "",
      lastPostAt: 0,
      lastPostAttemptTrackId: "",
      lastPostAttemptAt: 0,
      lastPostResult: "",
      lastError: "",
      isPosting: false,
      noteId: undefined,
    });
  }

  private log(level: LogLevel, message: string, detail?: unknown) {
    if (shouldLog(this.#cfgRef.value, level)) {
      this.logStore.log(level, message, detail);
    }
    if (level === "error") {
      this.state.lastError = typeof detail === "string" ? detail : message;
    }
  }

  start() {
    this.stop();
    this.poll(); // immediate
    const ms = this.#cfgRef.value.pollIntervalMs || 5000;
    this.#timer = window.setInterval(() => this.poll(), ms);
  }

  stop() {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  async poll() {
    try {
      const info = await fetchNowPlaying(this.#cfgRef.value);
      if (!info) return;
      this.recordTrack(info);
      if (this.#cfgRef.value.autopost) {
        await this.maybePost(info);
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403) {
        this.#cfgRef.value.useRPC = false;
        this.log("error", "RPC unauthorized; disabled RPC fallback", err);
        return;
      }
      this.log("error", "Failed to fetch now playing", err);
    }
  }

  onMediaItemChange(mkArg?: any) {
    const info = fetchViaMusicKit(mkArg);
    if (!info) return;
    this.recordTrack(info);
    if (this.#cfgRef.value.autopost) {
      this.maybePost(info);
    }
  }

  async manualPost(force = true) {
    if (!this.state.lastTrack) {
      const info = fetchViaMusicKit();
      if (info) {
        this.recordTrack(info);
      } else {
        await this.poll();
      }
    }
    if (this.state.lastTrack) {
      await this.maybePost(this.state.lastTrack, force);
    } else {
      this.log("error", "No track info available for manual post");
    }
  }

  private meetsTrigger(info: NowPlayingInfo) {
    const cfg = this.#cfgRef.value;
    if (cfg.triggerMode === "manual") return false;
    if (cfg.triggerMode === "instant") return true;
    const elapsed = info?.currentPlaybackTime ?? 0;
    if (cfg.triggerMode === "seconds") {
      return elapsed >= cfg.triggerSeconds;
    }
    if (cfg.triggerMode === "percent") {
      const duration = (info?.durationInMillis ?? 0) / 1000;
      if (!duration) return false;
      return (elapsed / duration) * 100 >= cfg.triggerPercent;
    }
    return false;
  }

  private isDuplicate(trackId: string) {
    const cfg = this.#cfgRef.value;
    if (!trackId) return false;
    if (
      cfg.repeatBehavior === "skip" &&
      trackId === this.state.lastPostedTrackId
    ) {
      const diffSec = (Date.now() - this.state.lastPostAt) / 1000;
      return diffSec < cfg.dedupeCooldownSec;
    }
    return false;
  }

  private async maybePost(info: NowPlayingInfo, force = false) {
    const cfg = this.#cfgRef.value;
    const trackId = buildTrackId(info);
    const now = Date.now();
    if (!cfg.instanceUrl || !cfg.token) {
      this.log("debug", "Instance URL or token not set; skip post");
      return;
    }
    if (!force) {
      if (!isPlaying(info)) return;
      if (trackId && trackId === this.state.lastPostAttemptTrackId) {
        if (this.state.isPosting) return;
        if (
          cfg.triggerMode === "instant" &&
          now - this.state.lastPostAttemptAt < INSTANT_GUARD_MS
        ) {
          return;
        }
      }
      if (cfg.triggerMode === "instant") {
        if (
          trackId &&
          trackId === this.state.lastTrackSeenId &&
          now - this.state.lastTrackSeenAt < INSTANT_GUARD_MS
        ) {
          return;
        }
      }
      if (!this.meetsTrigger(info)) return;
      if (this.isDuplicate(trackId)) return;
    }
    const text = renderTemplate(cfg.template, info).trim();
    if (!text) {
      this.log("error", "Rendered template is empty; skip post");
      return;
    }
    this.state.lastPostAttemptTrackId = trackId;
    this.state.lastPostAttemptAt = now;
    await this.postWithRetry(text, cfg.retries ?? 0);
    this.state.lastPostedTrackId = trackId;
    this.state.lastPostAt = Date.now();
  }

  private recordTrack(info: NowPlayingInfo) {
    const trackId = buildTrackId(info);
    this.state.lastTrack = info;
    this.state.lastTrackId = trackId;
    if (trackId && trackId !== this.state.lastTrackSeenId) {
      this.state.lastTrackSeenId = trackId;
      this.state.lastTrackSeenAt = Date.now();
    }
  }

  private async postWithRetry(text: string, retries: number) {
    const cfg = this.#cfgRef.value;
    let attempt = 0;
    const backoff = Math.max(cfg.retryBackoffSec, 1) * 1000;
    while (true) {
      try {
        this.state.isPosting = true;
        const res = await postToMisskey(cfg, text, (l, m, d) =>
          this.log(l, m, d)
        );
        this.state.lastPostResult = "ok";
        this.state.noteId = res?.createdNote?.id ?? res?.id;
        return;
      } catch (err) {
        attempt += 1;
        this.log("error", "Failed to post to Misskey", err);
        if (attempt > retries) throw err;
        await new Promise((r) => setTimeout(r, backoff * attempt));
      } finally {
        this.state.isPosting = false;
      }
    }
  }
}

let singleton: NowPlayingPoster | null = null;

export function initNowPlayingPoster(cfgRef: Ref<NowPlayingConfig>) {
  singleton = new NowPlayingPoster(cfgRef);
  singleton.start();
  return singleton;
}

export function useNowPlayingPoster() {
  return singleton;
}

export function getPlaceholderKeys() {
  return PLACEHOLDER_META.map((p) => p.key);
}

export function renderTemplatePreview(tpl: string, info: NowPlayingInfo) {
  return renderTemplate(tpl, info);
}

export function getPlaceholders() {
  return PLACEHOLDER_META;
}
