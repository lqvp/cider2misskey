

const songUrlCache = new Map<string, string>();

export function extractNumericId(value: string): string | null {
  const matches = value.match(/\d+/g);
  return matches?.[matches.length - 1] ?? null;
}

export function getStorefront(item: unknown, attrs: unknown): string {
  const storefront =
    (item as Record<string, unknown>)?.storefrontId ??
    (attrs as Record<string, unknown>)?.storefrontId ??
    (item as Record<string, unknown>)?.storefront ??
    (attrs as Record<string, unknown>)?.storefront;
  return typeof storefront === "string" && storefront ? storefront : "jp";
}

export function toSongUrlFromHref(href: string): string | null {
  const match = href.match(/\/catalog\/([^/]+)\/songs\/([^/?#]+)/);
  if (!match) return null;
  const [, storefront, id] = match;
  if (!storefront || !id) return null;
  return `https://music.apple.com/${storefront}/song/${id}`;
}

export function extractUrlString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const candidates = [
    (value as Record<string, unknown>).appleMusic,
    (value as Record<string, unknown>).canonical,
    (value as Record<string, unknown>).url,
    (value as Record<string, unknown>).href,
    (value as Record<string, unknown>).web,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string") return candidate;
  }
  return null;
}

export function constructSongUrl(item: unknown): string | null {
  const attrs = (item as Record<string, unknown>)?.attributes ?? item ?? {};
  const urlValue = (item as Record<string, unknown>)?.url ?? (attrs as Record<string, unknown>)?.url;
  const directUrl = extractUrlString(urlValue);
  if (directUrl) return directUrl;

  const hrefValue = extractUrlString(
    (item as Record<string, unknown>)?.href ?? (attrs as Record<string, unknown>)?.href
  );
  if (hrefValue) {
    const hrefUrl = toSongUrlFromHref(hrefValue);
    if (hrefUrl) return hrefUrl;
  }

  const playParams: Record<string, unknown> = {
    ...((item as Record<string, unknown>)?.playParams as Record<string, unknown> | undefined ?? {}),
    ...((attrs as Record<string, unknown>)?.playParams as Record<string, unknown> | undefined ?? {}),
  };
  const storefront = getStorefront(item, attrs);
  if (playParams) {
    const catalogId = playParams.catalogId;
    if (catalogId && /^\d+$/.test(String(catalogId))) {
      return `https://music.apple.com/${storefront}/song/${String(catalogId)}`;
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
  const songId = (attrs as Record<string, unknown>)?.id ?? (item as Record<string, unknown>)?.id;
  if (songId && /^\d+$/.test(String(songId))) {
    return `https://music.apple.com/${storefront}/song/${String(songId)}`;
  }
  const isrc = (attrs as Record<string, unknown>)?.isrc ?? (item as Record<string, unknown>)?.isrc;
  if (isrc) {
    return `https://music.apple.com/search?isrc=${isrc}`;
  }
  const name = (attrs as Record<string, unknown>)?.name ?? (item as Record<string, unknown>)?.name;
  const artistName = (attrs as Record<string, unknown>)?.artistName ?? (item as Record<string, unknown>)?.artistName;
  if (name) {
    const artistStr = typeof artistName === "string" ? artistName : "";
    const nameStr = String(name);
    const encodedQuery = encodeURIComponent(
      artistStr ? `${nameStr} ${artistStr}` : nameStr
    );
    return `https://music.apple.com/search?term=${encodedQuery}`;
  }
  return null;
}

export async function fetchSongUrlFromMusicKit(catalogId: string): Promise<string | null> {
  const cached = songUrlCache.get(catalogId);
  if (cached) return cached;
  const mk = (window as unknown as { MusicKit?: { getInstance?: () => { api?: { song?: (id: string) => Promise<unknown> } } } })?.MusicKit?.getInstance?.();
  const songApi = mk?.api?.song;
  if (typeof songApi !== "function") return null;
  try {
    const res = await songApi(catalogId);
    const resRecord = res as Record<string, unknown>;
    const data = resRecord?.data;
    const url =
      (resRecord?.attributes as { url?: string } | undefined)?.url ??
      (Array.isArray(data) ? (data[0] as { attributes?: { url?: string } })?.attributes?.url : undefined) ??
      (data as { attributes?: { url?: string } } | undefined)?.attributes?.url ??
      null;
    if (typeof url === "string" && url) {
      songUrlCache.set(catalogId, url);
      return url;
    }
  } catch {
    // Silent fail
  }
  return null;
}

export class UrlResolver {
  private cache = new Map<string, string>();

  async resolve(mk: unknown, item: unknown): Promise<string | null> {
    const attrs = (item as Record<string, unknown>)?.attributes ?? item;

    const candidates = [
      (item as Record<string, unknown>)?.url,
      (attrs as Record<string, unknown>)?.url,
      (item as Record<string, unknown>)?.href,
      (attrs as Record<string, unknown>)?.href,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c) return c;
    }

    const playParams = (item as Record<string, unknown>)?.playParams ?? (attrs as Record<string, unknown>)?.playParams;
    const catalogId = typeof playParams === "object" && playParams ? (playParams as Record<string, unknown>).catalogId as string | undefined : undefined;

    if (catalogId) {
      if (this.cache.has(catalogId)) {
        return this.cache.get(catalogId)!;
      }

      try {
        const mkApi = (mk as { api?: { song?: (id: string) => Promise<unknown> } })?.api;
        if (mkApi?.song) {
          const song = await mkApi.song(catalogId);
          const url = ((song as Record<string, unknown>)?.attributes as { url?: string } | undefined)?.url;
          if (url && typeof url === "string") {
            this.cache.set(catalogId, url);
            return url;
          }
        }
      } catch {
        // Silent fail
      }
    }

    return null;
  }
}

export const urlResolver = new UrlResolver();
