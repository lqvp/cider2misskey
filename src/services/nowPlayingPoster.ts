import type { Ref } from "vue";
import { reactive } from "vue";
import type { NowPlayingConfig, NowPlayingInfo, LogLevel } from "../types";
import { useLogStore } from "../stores/logs";
import { buildTrackId, isPlaying } from "../utils/music";
import {
  extractNumericId,
  fetchSongUrlFromMusicKit,
  urlResolver,
} from "../utils/urlResolver";
import {
  renderTemplate,
  getPlaceholderKeys,
  getPlaceholders,
  renderTemplatePreview,
} from "../utils/template";

type HttpStatusError = Error & { status?: number };

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
  warn: 25,
  error: 30,
};

const INSTANT_GUARD_MS = 500;

function shouldLog(cfg: NowPlayingConfig, level: LogLevel): boolean {
  return levelWeight[level] >= levelWeight[cfg.logLevel];
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

async function fetchViaMusicKit(mkArg?: unknown): Promise<NowPlayingInfo | null> {
  const mk =
    mkArg ??
    (
      window as unknown as {
        MusicKit?: { getInstance?: () => unknown };
      }
    )?.MusicKit?.getInstance?.();
  if (!mk) return null;
  const player = (mk as { player?: unknown; _player?: unknown }).player ??
    (mk as { _player?: unknown })._player;
  const item =
    (mk as { nowPlayingItem?: unknown }).nowPlayingItem ??
    (player as { nowPlayingItem?: unknown } | undefined)?.nowPlayingItem;
  if (!item) return null;

  const resolvedUrl = await urlResolver.resolve(mk, item);

  const attrs =
    (item as { attributes?: NowPlayingInfo }).attributes ??
    (item as NowPlayingInfo);
  const durationSeconds =
    (player as { currentPlaybackDuration?: number } | undefined)
      ?.currentPlaybackDuration ??
    (attrs.durationInMillis != null ? attrs.durationInMillis / 1000 : undefined) ??
    ((item as { durationInMillis?: number }).durationInMillis != null
      ? (item as { durationInMillis?: number }).durationInMillis! / 1000
      : undefined) ??
    0;
  const currentPlaybackTime =
    (player as { currentPlaybackTime?: number } | undefined)
      ?.currentPlaybackTime ??
    (mk as { currentPlaybackTime?: number }).currentPlaybackTime ??
    0;
  const remainingTime = Math.max(durationSeconds - currentPlaybackTime, 0);

  return {
    ...attrs,
    url: resolvedUrl || attrs.url || (item as { url?: string }).url,
    playParams:
      (item as { playParams?: unknown }).playParams ?? attrs.playParams,
    currentPlaybackTime,
    durationInMillis: (durationSeconds || 0) * 1000,
    remainingTime,
    repeatMode:
      ((player as { repeatMode?: string | number } | undefined)?.repeatMode) ??
      ((mk as { player?: { repeatMode?: string | number } }).player?.repeatMode),
    shuffleMode:
      ((player as { shuffleMode?: string | number } | undefined)?.shuffleMode) ??
      ((mk as { player?: { shuffleMode?: string | number } }).player?.shuffleMode),
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
  return (json as { info?: unknown }).info ?? json;
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
    } catch (err: unknown) {
      const statusErr = err as { status?: number };
      if (statusErr?.status === 401 || statusErr?.status === 403) {
        this.#cfgRef.value.useRPC = false;
        this.log("error", "RPC unauthorized; disabled RPC fallback", err);
        return;
      }
      this.log("error", "Failed to fetch now playing", err);
    }
  }

  async onMediaItemChange(mkArg?: unknown) {
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
        this.state.noteId =
          (res as { createdNote?: { id?: string } }).createdNote?.id ??
          (res as { id?: string }).id;
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

export { getPlaceholderKeys, renderTemplatePreview, getPlaceholders };
