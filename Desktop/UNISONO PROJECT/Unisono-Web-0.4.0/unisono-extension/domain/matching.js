import { identity, normalize } from './tracks.js';

function tokensSimilar(a, b) {
  const left = new Set(a.split(' ').filter(Boolean));
  const right = new Set(b.split(' ').filter(Boolean));
  const shared = [...left].filter(token => right.has(token)).length;
  return left.size + right.size ? (2 * shared) / (left.size + right.size) : 0;
}

/** Índices reutilizables: una coincidencia exacta no recorre toda la biblioteca. */
export function createLibraryIndex(library) {
  const exact = new Map();
  const words = new Map();
  const files = new Map();
  for (const file of library) {
    files.set(file.id, file);
    const key = identity(file);
    const entries = exact.get(key) || [];
    entries.push(file);
    exact.set(key, entries);
    for (const word of new Set(normalize(file.title).split(' '))) {
      if (!word) continue;
      const entries = words.get(word) || new Set();
      entries.add(file);
      words.set(word, entries);
    }
  }
  return { exact, words, files };
}

/** Solo etiquetas fiables o una decisión humana eliminan una sugerencia. */
export function matchTrack(track, index, decisions = {}) {
  const decision = decisions[identity(track)];
  if (decision?.fileId && index.files.has(decision.fileId)) {
    return { status: 'owned', file: index.files.get(decision.fileId), reason: 'Confirmada por ti' };
  }
  if (decision?.missing) return { status: 'missing', reason: 'Marcada como pendiente por ti' };
  const exact = index.exact.get(identity(track)) || [];
  const tagged = exact.find(file => file.metadata === 'tags' && normalize(file.artist));
  if (tagged && normalize(track.artist)) {
    return { status: 'owned', file: tagged, reason: 'Título y artista coinciden en las etiquetas' };
  }
  const candidates = new Set(exact);
  for (const word of normalize(track.title).split(' ')) {
    for (const file of index.words.get(word) || []) candidates.add(file);
  }
  const possible = [...candidates].map(file => {
    const title = tokensSimilar(normalize(track.title), normalize(file.title));
    const artist = tokensSimilar(normalize(track.artist), normalize(file.artist));
    // Un artista diferente no se da por bueno solo por compartir el título.
    const compatible = !track.artist || !file.artist || artist >= 0.65;
    return { file, score: title * 0.8 + artist * 0.2, compatible, title };
  }).filter(item => item.compatible && item.title >= 0.65)
    .sort((a, b) => b.score - a.score).slice(0, 5);
  return possible.length
    ? { status: 'review', candidates: possible, reason: 'Comprueba el archivo y la versión' }
    : { status: 'missing', reason: 'Sin coincidencia en la última revisión local' };
}

export function recommendations(state) {
  const index = createLibraryIndex(state.library);
  return state.tracks.map(track => ({ ...track, key: identity(track), ...matchTrack(track, index, state.decisions) }))
    .sort((a, b) => Number(b.liked) - Number(a.liked) || b.plays - a.plays || a.title.localeCompare(b.title));
}
