import { cleanTrack, identity, mergeTracks } from '../domain/tracks.js';

/** CSV con comillas, comas y saltos de línea dentro de una celda. Sin dependencias. */
export function parseCSV(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (character === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (character === ',' || character === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (character === '\n') { rows.push(row); row = []; }
    } else cell += character;
  }
  if (quoted) throw new Error('El CSV contiene comillas sin cerrar.');
  row.push(cell.replace(/\r$/, ''));
  if (row.some(Boolean)) rows.push(row);
  const headers = (rows.shift() || []).map(value => value.trim().toLowerCase().replace(/^\uFEFF/, ''));
  if (!headers.includes('title')) throw new Error('El CSV necesita la columna title. Consulta el ejemplo de importación.');
  return rows.filter(row => row.some(Boolean)).map(values => Object.fromEntries(headers.map((key, i) => [key, values[i] || ''])));
}

/**
 * Selecciona todos los archivos del historial en una sola importación.
 * Se descartan escuchas menores de 30 s y eventos idénticos entre archivos.
 * Una nueva importación conserva el mayor conteo conocido por canción (snapshot).
 */
export function parseImports(documents) {
  const events = new Set(); const history = new Map(); let tracks = []; let skipped = 0;
  for (const { name, text } of documents) {
    const parsed = /\.csv$/i.test(name) ? parseCSV(text) : JSON.parse(text.replace(/^\uFEFF/, ''));
    const rows = Array.isArray(parsed) ? parsed : parsed.tracks;
    if (!Array.isArray(rows)) throw new Error(`${name}: se esperaba una lista JSON o un objeto con tracks.`);
    for (const row of rows) {
      if (!row || typeof row !== 'object') { skipped++; continue; }
      const isHistory = 'master_metadata_track_name' in row || ('trackName' in row && 'msPlayed' in row);
      const raw = isHistory ? {
        title: row.master_metadata_track_name || row.trackName,
        artist: row.master_metadata_album_artist_name || row.artistName,
        album: row.master_metadata_album_album_name || '', source: 'spotify',
        url: row.spotify_track_uri ? `https://open.spotify.com/track/${row.spotify_track_uri.split(':').pop()}` : '',
      } : { ...row, liked: row.liked === true || /^(true|1|sí|si)$/i.test(String(row.liked)) };
      const track = cleanTrack(raw);
      if (!track) { skipped++; continue; }
      if (isHistory) {
        if (Number(row.ms_played ?? row.msPlayed) < 30000 || !Number.isFinite(Number(row.ms_played ?? row.msPlayed))) { skipped++; continue; }
        const time = row.ts || row.endTime;
        if (!time) { skipped++; continue; }
        const event = `${time}|${identity(track)}|${row.ms_played ?? row.msPlayed}`;
        if (events.has(event)) continue;
        events.add(event);
        const previous = history.get(identity(track));
        history.set(identity(track), { ...track, plays: (previous?.plays || 0) + 1 });
      } else tracks.push(track);
    }
  }
  tracks = mergeTracks(mergeTracks([], tracks), [...history.values()]);
  if (!tracks.length) throw new Error('No se encontraron canciones válidas. Para historial, las escuchas deben durar al menos 30 segundos.');
  return { tracks, skipped };
}
