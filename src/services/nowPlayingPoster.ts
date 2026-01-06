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

class UrlResolver {
  private cache = new Map<string, string>();

  async resolve(mk: any, item: any): Promise<string | null> {
    const attrs = item.attributes ?? item;

    // 1. Try to extract from existing props (fastest)
    const candidates = [item.url, attrs.url, item.href, attrs.href];
    for (const c of candidates) {
      if (typeof c === "string" && c) return c;
    }

    // 2. Try API lookup via catalogId
    const playParams = item.playParams ?? attrs.playParams;
    const catalogId = playParams?.catalogId;

    if (catalogId) {
      if (this.cache.has(catalogId)) {
        return this.cache.get(catalogId)!;
      }

      try {
        if (mk && mk.api && mk.api.song) {
          const song = await mk.api.song(catalogId);
          const url = song?.attributes?.url;
          if (url && typeof url === "string") {
            this.cache.set(catalogId, url);
            return url;
          }
        }
      } catch (err) {
        // Silent fail, fallback to other methods
        console.warn("[UrlResolver] API lookup failed", err);
      }
    }

    return null;
  }
}

const urlResolver = new UrlResolver();

function extractUrlString(value: any) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const candidates = [
    value.appleMusic,
    value.canonical,
    value.url,
    value.href,
    value.web,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string") return candidate;
  }
  return null;
}

function toSongUrlFromHref(href: string) {
  const match = href.match(/\/catalog\/([^/]+)\/songs\/([^/?#]+)/);
  if (!match) return null;
  const [, storefront, id] = match;
  if (!storefront || !id) return null;
  return `https://music.apple.com/${storefront}/song/${id}`;
}

function extractNumericId(value: string) {
  const matches = value.match(/\d+/g);
  return matches?.[matches.length - 1] ?? null;
}

const songUrlCache = new Map<string, string>();

async function fetchSongUrlFromMusicKit(catalogId: string) {
  const cached = songUrlCache.get(catalogId);
  if (cached) return cached;
  const mk = (window as any)?.MusicKit?.getInstance?.();
  const songApi = mk?.api?.song;
  if (typeof songApi !== "function") return null;
  const res = await songApi(catalogId);
  const url =
    res?.attributes?.url ??
    res?.data?.[0]?.attributes?.url ??
    res?.data?.attributes?.url ??
    null;
  if (typeof url === "string" && url) {
    songUrlCache.set(catalogId, url);
    return url;
  }
  return null;
}

function getStorefront(item: any, attrs: any) {
  const storefront =
    item?.storefrontId ??
    attrs?.storefrontId ??
    item?.storefront?.id ??
    attrs?.storefront?.id ??
    item?.storefront ??
    attrs?.storefront;
  return typeof storefront === "string" && storefront ? storefront : "jp";
}

function constructSongUrl(item: any) {
  const attrs = item?.attributes ?? item ?? {};
  const urlValue = item?.url ?? attrs?.url;
  const directUrl = extractUrlString(urlValue);
  if (directUrl) return directUrl;

  const hrefValue = extractUrlString(item?.href ?? attrs?.href);
  if (hrefValue) {
    const hrefUrl = toSongUrlFromHref(hrefValue);
    if (hrefUrl) return hrefUrl;
  }

  const playParams = {
    ...(item?.playParams ?? {}),
    ...(attrs?.playParams ?? {}),
  };
  const storefront = getStorefront(item, attrs);
  if (playParams) {
    if (playParams.catalogId && /^\d+$/.test(playParams.catalogId)) {
      return `https://music.apple.com/${storefront}/song/${playParams.catalogId}`;
    }
    const rawId =
      typeof playParams.id === "string"
        ? playParams.id
        : String(playParams.id ?? "");
    const songId = rawId.split("/").pop();
    const numericId = songId ? extractNumericId(songId) : null;
    if (numericId) {
      return `https://music.apple.com/${storefront}/song/${numericId}`;
    }
  }
  const songId = attrs?.id ?? item?.id;
  if (songId && /^\d+$/.test(String(songId))) {
    return `https://music.apple.com/${getStorefront(
      item,
      attrs
    )}/song/${songId}`;
  }
  const isrc = attrs?.isrc ?? item?.isrc;
  if (isrc) {
    return `https://music.apple.com/search?isrc=${isrc}`;
  }
  const name = attrs?.name ?? item?.name;
  const artistName = attrs?.artistName ?? item?.artistName;
  if (name) {
    const encodedQuery = encodeURIComponent(
      artistName ? `${name} ${artistName}` : name
    );
    return `https://music.apple.com/search?term=${encodedQuery}`;
  }
  return null;
}

function shouldLog(cfg: NowPlayingConfig, level: LogLevel) {
  return levelWeight[level] >= levelWeight[cfg.logLevel];
}

function toSeconds(ms?: number) {
  if (!ms && ms !== 0) return 0;
  return Math.round(ms / 1000);
}

function normalizeReleaseDate(value: any) {
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

function buildTrackId(info?: NowPlayingInfo) {
  return (
    info?.playParams?.id ||
    info?.id ||
    [info?.name, info?.artistName, info?.albumName].filter(Boolean).join("::")
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

const PLACEHOLDER_META: PlaceholderMeta[] = [
  { key: "title", group: "Track", description: "曲名" },
  { key: "artist", group: "Track", description: "アーティスト名" },
  { key: "album", group: "Album", description: "アルバム名" },
  { key: "track_no", group: "Album", description: "トラック番号" },
  { key: "disc_no", group: "Album", description: "ディスク番号" },
  { key: "genres", group: "Metadata", description: "ジャンル（カンマ区切り）" },
  { key: "release_date", group: "Metadata", description: "リリース日" },
  { key: "isrc", group: "IDs", description: "ISRC" },
  {
    key: "play_params_id",
    group: "IDs",
    description: "playParams.id（曲IDのことが多い）",
  },
  {
    key: "play_params_kind",
    group: "IDs",
    description: "playParams.kind（songなど）",
  },
  { key: "url", group: "Links", description: "Apple Music URL（ある場合）" },
  {
    key: "artwork",
    group: "Links",
    description: "アートワークURL（テキストのみ）",
  },
  { key: "duration_ms", group: "Playback", description: "曲長（ms）" },
  { key: "duration_s", group: "Playback", description: "曲長（秒）" },
  { key: "elapsed_s", group: "Playback", description: "再生経過（秒）" },
  { key: "remaining_s", group: "Playback", description: "残り（秒）" },
  { key: "repeat_mode", group: "Playback", description: "リピート状態" },
  { key: "shuffle_mode", group: "Playback", description: "シャッフル状態" },
  {
    key: "audio_traits",
    group: "Playback",
    description: "音質/機能（lossless/atmosなど）",
  },
  {
    key: "has_lyrics",
    group: "Lyrics",
    description: "歌詞があるか（true/false）",
  },
  {
    key: "has_time_synced_lyrics",
    group: "Lyrics",
    description: "同期歌詞があるか（true/false）",
  },
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
  cw: string | null,
  log: (level: LogLevel, msg: string, detail?: unknown) => void
) {
  const endpoint = `${cfg.instanceUrl.replace(/\/+$/, "")}/api/notes/create`;
  const body = {
    i: cfg.token,
    visibility: cfg.visibility,
    localOnly: cfg.localOnly,
    text,
    ...(cw ? { cw } : {}),
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
  log("info", "Posted to Misskey", {
    noteId: data?.createdNote?.id ?? data?.id,
  });
  return data;
}

async function fetchViaMusicKit(mkArg?: any): Promise<NowPlayingInfo | null> {
  // Prefer local MusicKit state (no RPC / token needed).
  const mk = mkArg ?? (window as any)?.MusicKit?.getInstance?.();
  if (!mk) return null;
  const player = mk.player ?? mk._player;
  const item = mk.nowPlayingItem ?? player?.nowPlayingItem;
  if (!item) return null;

  const resolvedUrl = await urlResolver.resolve(mk, item);

  const attrs = item.attributes ?? item; // attributes on native MusicKit, flat on Cider's wrapped object
  const durationSeconds =
    player?.currentPlaybackDuration ??
    (attrs.durationInMillis != null
      ? attrs.durationInMillis / 1000
      : undefined) ??
    (item.durationInMillis != null
      ? item.durationInMillis / 1000
      : undefined) ??
    0;
  const currentPlaybackTime =
    player?.currentPlaybackTime ?? mk.currentPlaybackTime ?? 0;
  const remainingTime = Math.max(durationSeconds - currentPlaybackTime, 0);

  return {
    ...attrs,
    url: resolvedUrl || attrs.url || item.url,
    playParams: item.playParams ?? attrs.playParams,
    currentPlaybackTime,
    durationInMillis: (durationSeconds || 0) * 1000,
    remainingTime,
    repeatMode: player?.repeatMode ?? mk?.player?.repeatMode,
    shuffleMode: player?.shuffleMode ?? mk?.player?.shuffleMode,
  };
}

async function fetchViaRPC(cfg: NowPlayingConfig) {
  const endpoint = `${cfg.rpcBaseUrl.replace(
    /\/+$/,
    ""
  )}/api/v1/playback/now-playing`;
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
  const mkInfo = await fetchViaMusicKit();
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

  async onMediaItemChange(mkArg?: any) {
    const info = await fetchViaMusicKit(mkArg);
    if (!info) return;
    this.recordTrack(info);
    if (this.#cfgRef.value.autopost) {
      await this.maybePost(info);
    }
  }

  async manualPost(force = true) {
    if (!this.state.lastTrack) {
      const info = await fetchViaMusicKit();
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
    await this.enrichInfoWithUrl(info);
    const text = renderTemplate(cfg.template, info).trim();
    const cwText = cfg.cwEnabled
      ? renderTemplate(cfg.cwTemplate ?? "", info).trim()
      : "";
    if (cfg.cwEnabled && !cwText) {
      this.log("error", "Rendered CW template is empty; skip post");
      return;
    }
    if (!text) {
      this.log("error", "Rendered template is empty; skip post");
      return;
    }
    this.state.lastPostAttemptTrackId = trackId;
    this.state.lastPostAttemptAt = now;
    await this.postWithRetry(text, cwText || null, cfg.retries ?? 0);
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
    void this.enrichInfoWithUrl(info);
  }

  private async postWithRetry(
    text: string,
    cw: string | null,
    retries: number
  ) {
    const cfg = this.#cfgRef.value;
    let attempt = 0;
    const backoff = Math.max(cfg.retryBackoffSec, 1) * 1000;
    while (true) {
      try {
        this.state.isPosting = true;
        const res = await postToMisskey(cfg, text, cw, (l, m, d) =>
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

  private async enrichInfoWithUrl(info: NowPlayingInfo) {
    if (!info) return;
    if (typeof info.url === "string" && info.url) return;
    const playParams = info?.playParams ?? {};
    const catalogId =
      playParams.catalogId ??
      (typeof playParams.id === "string"
        ? extractNumericId(playParams.id)
        : null);
    if (!catalogId) return;
    try {
      const url = await fetchSongUrlFromMusicKit(String(catalogId));
      if (!url) return;
      info.url = url;
      if (this.state.lastTrack === info) {
        this.state.lastTrack = { ...info, url };
      }
    } catch (err) {
      this.log("debug", "Failed to resolve song URL from MusicKit", err);
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
