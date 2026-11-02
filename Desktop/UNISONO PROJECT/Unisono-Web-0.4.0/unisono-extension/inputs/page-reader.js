/**
 * Esta función se serializa y ejecuta en el mundo aislado de la pestaña activa.
 * No usa cookies, tokens, APIs privadas ni solicitudes de red. Lee filas ya cargadas.
 * Los selectores están concentrados aquí porque las plataformas pueden cambiarlos.
 */
export function readVisibleTracks() {
  const source = location.hostname === 'open.spotify.com' ? 'spotify'
    : location.hostname === 'music.youtube.com' ? 'youtube' : null;
  if (!source) throw new Error('Abre Spotify o YouTube Music para capturar canciones.');
  const text = element => element?.textContent?.trim() || '';
  const tracks = [];
  const likedCollection = source === 'spotify'
    ? location.pathname === '/collection/tracks'
    : location.pathname === '/playlist' && new URLSearchParams(location.search).get('list') === 'LM';
  const rows = document.querySelectorAll(source === 'spotify'
    ? '[data-testid="tracklist-row"]' : 'ytmusic-responsive-list-item-renderer');
  for (const row of rows) {
    if (!row.getClientRects().length) continue;
    const link = row.querySelector(source === 'spotify' ? 'a[href*="/track/"]' : 'a[href*="watch?v="]');
    if (!link) continue;
    const artistLinks = row.querySelectorAll(source === 'spotify'
      ? 'a[href*="/artist/"]' : '.secondary-flex-columns a[href*="/channel/"], .secondary-flex-columns a[href*="/browse/UC"]');
    let artist = [...artistLinks].map(text).filter(Boolean).join(', ');
    if (source === 'youtube' && !artist) {
      artist = text(row.querySelector('.secondary-flex-columns yt-formatted-string')).split(' • ')[0];
    }
    const title = text(link) || link.getAttribute('title') || '';
    if (!title) continue;
    tracks.push({ title, artist, source, url: link.href, liked: likedCollection, plays: 0 });
  }
  return { tracks, source, likedCollection, page: location.origin + location.pathname, capturedAt: new Date().toISOString() };
}
