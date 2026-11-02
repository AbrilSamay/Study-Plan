/** Identidad conservadora: no borramos 'live', 'remix' ni nombres de versiones. */
export function normalize(value = '') {
  return String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/\b(official music video|official video|official audio|video oficial|audio oficial|lyric video)\b/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

export const identity = track => `${normalize(track.artist)}|${normalize(track.title)}`;

/** Todas las entradas pasan por este contrato, incluidas las páginas externas. */
export function cleanTrack(raw) {
  const title = String(raw.title || '').trim().slice(0, 300);
  if (!title) return null;
  return {
    title, artist: String(raw.artist || '').trim().slice(0, 300),
    album: String(raw.album || '').trim().slice(0, 300),
    source: ['spotify', 'youtube'].includes(raw.source) ? raw.source : 'import',
    url: safeTrackUrl(raw.url), liked: raw.liked === true,
    plays: Math.max(0, Math.min(1000000, Math.floor(Number(raw.plays) || 0))),
  };
}

export function safeTrackUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    if (url.hostname === 'open.spotify.com' && /^\/track\/[a-zA-Z0-9]+$/.test(url.pathname)) {
      return `${url.origin}${url.pathname}`;
    }
    if (url.hostname === 'music.youtube.com' && url.pathname === '/watch' && /^[\w-]+$/.test(url.searchParams.get('v') || '')) {
      return `${url.origin}/watch?v=${url.searchParams.get('v')}`;
    }
  } catch { /* Un enlace incorrecto nunca se convierte en una acción de la interfaz. */ }
  return '';
}

/** Repetir una captura une señales; jamás inventa reproducciones. */
export function mergeTracks(current, incoming) {
  const tracks = new Map(current.map(track => [identity(track), track]));
  for (const raw of incoming) {
    const track = cleanTrack(raw);
    if (!track) continue;
    const key = identity(track);
    const previous = tracks.get(key);
    tracks.set(key, previous ? {
      ...previous,
      artist: previous.artist || track.artist,
      album: previous.album || track.album,
      url: previous.url || track.url,
      liked: previous.liked || track.liked,
      plays: Math.max(previous.plays, track.plays),
      sources: [...new Set([...(previous.sources || [previous.source]), track.source])],
    } : { ...track, sources: [track.source] });
  }
  return [...tracks.values()];
}
