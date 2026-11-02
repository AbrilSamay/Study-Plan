import { readVisibleTracks } from '../inputs/page-reader.js';
import { cleanTrack, mergeTracks, identity } from '../domain/tracks.js';
import { readState, writeState, emptyState } from '../storage/repository.js';

// Una cola dentro del worker serializa las escrituras de popup y panel.
let queue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  // Un panel abierto en pestaña también tiene sender.tab. Verificamos su origen
  // de extensión en lugar de confundirlo con un content script de una web.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('interface/'))) return false;
  const task = queue.then(() => dispatch(message));
  queue = task.catch(() => {});
  task.then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message }));
  return true; // Conserva abierto el canal mientras termina la tarea asíncrona.
});

async function dispatch(message) {
  const state = await readState();
  switch (message.type) {
    case 'read': return state;
    case 'capture': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!/^https:\/\/(open\.spotify\.com|music\.youtube\.com)\//.test(tab?.url || '')) {
        throw new Error('Abre una lista de canciones en Spotify o YouTube Music y pulsa el icono de Unísono allí.');
      }
      const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readVisibleTracks });
      const capture = result?.result;
      if (!capture?.tracks?.length) throw new Error('No se encontraron filas de canciones. Abre una lista, espera a que cargue y vuelve a intentarlo.');
      const before = state.tracks.length;
      state.tracks = mergeTracks(state.tracks, capture.tracks);
      state.lastCapture = { ...capture, tracks: undefined, count: capture.tracks.length };
      await writeState(state);
      return { read: capture.tracks.length, added: state.tracks.length - before, liked: capture.likedCollection };
    }
    case 'import':
      if (!Array.isArray(message.tracks) || message.tracks.length > 50000) throw new Error('Importación demasiado grande. Usa hasta 50 000 canciones únicas.');
      state.tracks = mergeTracks(state.tracks, message.tracks.map(cleanTrack).filter(Boolean));
      break;
    case 'library':
      if (!Array.isArray(message.library) || message.library.length > 50000) throw new Error('Selecciona hasta 50 000 archivos de audio.');
      state.library = message.library;
      state.folder = String(message.folder || 'Mi música').slice(0, 200);
      state.scannedAt = new Date().toISOString();
      // Si desapareció el archivo confirmado, la canción vuelve a compararse.
      state.decisions = Object.fromEntries(Object.entries(state.decisions).filter(([, value]) =>
        value.missing || state.library.some(file => file.id === value.fileId)));
      break;
    case 'decision':
      if (!state.tracks.some(track => identity(track) === message.key)) throw new Error('La canción ya no existe.');
      if (message.fileId && !state.library.some(file => file.id === message.fileId)) throw new Error('Vuelve a revisar tu carpeta.');
      if (message.reset) delete state.decisions[message.key];
      else state.decisions[message.key] = message.fileId ? { fileId: message.fileId } : { missing: true };
      break;
    case 'clear': await writeState(emptyState()); return emptyState();
    default: throw new Error('Operación desconocida.');
  }
  await writeState(state);
  return state;
}
