import { request } from '../application/client.js';
import { recommendations } from '../domain/matching.js';
import { normalize } from '../domain/tracks.js';
import { scanLibrary } from '../inputs/local-library.js';
import { parseImports } from '../inputs/imports.js';
import { exportCSV } from '../outputs/export.js';
import { emptyState } from '../storage/repository.js';
import { demoState } from './demo.js';

const $ = selector => document.querySelector(selector);
// Los metadatos de páginas y archivos nunca se interpolan como HTML ejecutable.
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const names = { spotify: 'Spotify', youtube: 'YouTube Music', import: 'Importación' };
const PAGE_SIZE = 40;
let state = emptyState();
let items = [];
let statusFilter = 'missing';
let page = 0;
let libraryPage = 0;
let demo = false;
let reviewing = null;
let busy = false;

function notify(text, error = false) {
  $('#message').hidden = !text;
  $('#message').textContent = text;
  $('#message').classList.toggle('error', error);
}

async function run(task) {
  if (busy) return;
  busy = true;
  // No permitimos borrar datos ni iniciar otra importación durante una lectura.
  const controls = [...document.querySelectorAll('[data-action="folder"], [data-action="import"], #clear, #demo, #exit-demo')];
  controls.forEach(control => { control.disabled = true; });
  try { await task(); } catch (error) { notify(error.message, true); }
  finally { busy = false; controls.forEach(control => { control.disabled = false; }); }
}

function showView(view) {
  for (const section of document.querySelectorAll('.view')) section.hidden = section.id !== `view-${view}`;
  for (const button of document.querySelectorAll('[data-view]')) {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  }
  $('#breadcrumb').textContent = { discover: 'Por descubrir', library: 'Mi biblioteca', sources: 'Mis fuentes', settings: 'Preferencias' }[view];
}

async function refresh() {
  if (!demo) state = await request('read');
  render();
}

function render() {
  items = recommendations(state);
  $('#demo-banner').hidden = !demo;
  $('#stat-total').textContent = state.tracks.length;
  $('#stat-owned').textContent = items.filter(track => track.status === 'owned').length;
  const missing = items.filter(track => track.status === 'missing').length;
  const review = items.filter(track => track.status === 'review').length;
  $('#stat-missing').textContent = state.scannedAt ? missing : '—';
  $('#nav-count').textContent = state.scannedAt ? missing : '—';
  $('#review-count').textContent = state.scannedAt ? `${review} por revisar` : 'Elige tu carpeta';
  $('#scan-summary').textContent = state.scannedAt
    ? `Comparado con «${state.folder}» · ${new Date(state.scannedAt).toLocaleString('es')} · Revisa de nuevo si cambias tus archivos.`
    : 'Elige tu carpeta para saber qué canciones te faltan.';
  $('#export').disabled = !state.scannedAt || missing === 0;
  $('#library-summary').textContent = state.scannedAt
    ? `${state.library.length} archivos en «${state.folder}» · ${state.library.filter(file => file.metadata === 'tags').length} con título y artista en etiquetas · Última revisión: ${new Date(state.scannedAt).toLocaleString('es')}`
    : 'Todavía no has elegido una carpeta.';
  $('#capture-summary').textContent = state.lastCapture
    ? `Última captura: ${names[state.lastCapture.source]} · ${state.lastCapture.count} filas leídas · ${new Date(state.lastCapture.capturedAt).toLocaleString('es')}` : 'Aún no hay capturas de páginas en este dispositivo.';
  renderTracks(); renderLibrary();
}

function filteredTracks() {
  const query = normalize($('#search').value);
  const source = $('#source-filter').value;
  const signal = $('#signal-filter').value;
  return items.filter(track => (statusFilter === 'all' || track.status === statusFilter)
    && (source === 'all' || (track.sources || [track.source]).includes(source))
    && (signal !== 'liked' || track.liked) && (signal !== 'frequent' || track.plays > 0)
    && (!query || normalize(`${track.title} ${track.artist}`).includes(query)));
}

function emptyMarkup(title, description, actions = '') {
  return `<div class="empty"><div class="empty-symbol" aria-hidden="true">✧</div><h3>${escape(title)}</h3><p>${escape(description)}</p>${actions}</div>`;
}

function renderTracks() {
  const list = $('#track-list');
  const visible = filteredTracks();
  $('#result-count').textContent = visible.length;
  if (!state.tracks.length) {
    list.innerHTML = emptyMarkup('Una gran colección empieza con una canción.', 'Añade tus Me gusta desde Spotify o YouTube Music, o importa tu historial para descubrir tus favoritas.', '<button class="secondary" data-action="sources">Añadir mis canciones ↗</button><button class="text-button" data-action="demo">Explorar un ejemplo</button>');
    return;
  }
  if (!state.scannedAt && statusFilter !== 'all') {
    $('#result-count').textContent = '—';
    list.innerHTML = emptyMarkup('Primero, conozcamos tu biblioteca.', 'Tus canciones están guardadas. Elige tu carpeta de música antes de decidir cuáles te faltan.', '<button class="primary" data-action="folder">Elegir carpeta ↗</button>');
    return;
  }
  if (!visible.length) {
    list.innerHTML = emptyMarkup('Todo despejado por aquí.', 'No hay canciones con estos filtros. Prueba otra fuente, revisa las coincidencias o añade más canciones.');
    return;
  }
  page = Math.min(page, Math.max(0, Math.ceil(visible.length / PAGE_SIZE) - 1));
  list.innerHTML = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(track => {
    const index = items.indexOf(track);
    const hue = [...track.artist + track.title].reduce((value, character) => value + character.charCodeAt(0), 0) % 360;
    let action = '<span class="row-note">Falta revisar tu carpeta</span>';
    if (state.scannedAt) {
      if (track.status === 'review') action = `<button class="row-action" data-review="${index}">Revisar coincidencia</button>`;
      else if (track.status === 'owned') action = `<span class="owned-label" title="${escape(track.file.path)}">✓ En tu biblioteca</span>${state.decisions[track.key]?.fileId ? `<button class="text-button" data-reset="${index}">Desvincular</button>` : ''}`;
      else {
        // Abrimos una búsqueda en una tienda, nunca un conversor ni una descarga.
        const search = `https://bandcamp.com/search?q=${encodeURIComponent(`${track.artist} ${track.title}`)}`;
        action = `<a class="row-action" href="${escape(search)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(`Buscar ${track.title} en Bandcamp`)}">Buscar en Bandcamp ↗</a>`;
        if (state.decisions[track.key]?.missing) action += `<button class="text-button" data-reset="${index}">Reconsiderar</button>`;
      }
    }
    return `<article class="track-row"><div class="cover" style="--hue:${hue}" aria-hidden="true">♫</div><div><div class="track-title">${escape(track.title)}</div><div class="track-artist">${escape(track.artist || 'Artista sin identificar')}</div>${track.url ? `<a class="row-note" href="${escape(track.url)}" target="_blank" rel="noopener noreferrer">Ver en la fuente ↗</a>` : ''}</div><div class="track-source"><span class="service-dot ${escape(track.source)}"></span>${escape(names[track.source] || 'Importación')}</div><div class="signal">${track.liked ? '♡ Me gusta' : 'De tu selección'}<small>${track.plays ? `${track.plays} escuchas importadas` : 'Sin historial de escuchas'}</small></div><div>${action}</div></article>`;
  }).join('') + paginationMarkup(page, visible.length, 'tracks');
}

function paginationMarkup(current, total, target) {
  if (total <= PAGE_SIZE) return '';
  return `<div class="pagination"><button class="secondary" data-page="${target}" data-delta="-1" ${current === 0 ? 'disabled' : ''}>Anterior</button><span>${current + 1} / ${Math.ceil(total / PAGE_SIZE)}</span><button class="secondary" data-page="${target}" data-delta="1" ${(current + 1) * PAGE_SIZE >= total ? 'disabled' : ''}>Siguiente</button></div>`;
}

function renderLibrary() {
  libraryPage = Math.min(libraryPage, Math.max(0, Math.ceil(state.library.length / PAGE_SIZE) - 1));
  $('#library-list').innerHTML = state.library.length ? state.library.slice(libraryPage * PAGE_SIZE, (libraryPage + 1) * PAGE_SIZE).map(file =>
    `<article class="file-row"><div><strong>${escape(file.title)}</strong><p>${escape(file.artist || 'Artista sin identificar')} · ${escape(file.path)}</p></div><span>${file.metadata === 'tags' ? 'Etiquetas leídas' : 'Nombre de archivo · requiere revisión'}</span></article>`
  ).join('') + paginationMarkup(libraryPage, state.library.length, 'library') : emptyMarkup('Tu música se queda en casa.', 'Selecciona una carpeta para crear tu índice local. No se suben ni se modifican archivos.', '<button class="primary" data-action="folder">Elegir carpeta ↗</button>');
}

function enterDemo() {
  if (busy) return;
  demo = true; state = demoState(); page = 0; libraryPage = 0;
  notify(''); showView('discover'); render();
}

function chooseInput(kind) {
  if (busy) return;
  if (demo) { notify('Sal del ejemplo para añadir tus archivos reales.'); return; }
  $(kind === 'folder' ? '#folder-input' : '#import-input').click();
}

async function saveDecision(payload) {
  if (demo) {
    if (payload.reset) delete state.decisions[payload.key];
    else state.decisions[payload.key] = payload.fileId ? { fileId: payload.fileId } : { missing: true };
  } else state = await request('decision', payload);
  $('#review-dialog').close(); render();
}

function openReview(index) {
  reviewing = items[index];
  $('#review-title').textContent = `${reviewing.title} · ${reviewing.artist}`;
  $('#candidates').innerHTML = reviewing.candidates.map(({ file }, index) =>
    `<div class="candidate"><div><strong>${escape(file.title)} · ${escape(file.artist || 'Artista sin identificar')}</strong><p>${escape(file.path)}</p></div><button class="primary" data-confirm="${index}">Es esta</button></div>`
  ).join('');
  $('#review-dialog').showModal();
}

// Delegación de eventos: las filas pueden regenerarse sin duplicar listeners.
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.view) showView(button.dataset.view);
  if (button.dataset.action === 'sources') showView('sources');
  if (button.dataset.action === 'folder') chooseInput('folder');
  if (button.dataset.action === 'import') chooseInput('import');
  if (button.dataset.action === 'demo') enterDemo();
  if (button.dataset.status) {
    statusFilter = button.dataset.status; page = 0;
    document.querySelectorAll('[data-status]').forEach(tab => { tab.classList.toggle('active', tab === button); tab.setAttribute('aria-pressed', String(tab === button)); });
    renderTracks();
  }
  if ('review' in button.dataset) openReview(Number(button.dataset.review));
  if ('confirm' in button.dataset) run(() => saveDecision({ key: reviewing.key, fileId: reviewing.candidates[Number(button.dataset.confirm)].file.id }));
  if ('reset' in button.dataset) run(() => saveDecision({ key: items[Number(button.dataset.reset)].key, reset: true }));
  if (button.dataset.page) {
    if (button.dataset.page === 'tracks') { page += Number(button.dataset.delta); renderTracks(); }
    else { libraryPage += Number(button.dataset.delta); renderLibrary(); }
  }
});

$('#search').addEventListener('input', () => { page = 0; renderTracks(); });
for (const id of ['source-filter', 'signal-filter']) $(`#${id}`).addEventListener('change', () => { page = 0; renderTracks(); });
$('#close-review').addEventListener('click', () => $('#review-dialog').close());
$('#mark-missing').addEventListener('click', () => run(() => saveDecision({ key: reviewing.key })));
$('#demo').addEventListener('click', enterDemo);
$('#exit-demo').addEventListener('click', () => run(async () => { demo = false; await refresh(); notify('Has vuelto a tu colección real.'); }));
$('#export').addEventListener('click', () => {
  // Exporta todos los pendientes, sin depender de la pestaña o página visible.
  exportCSV(items.filter(track => track.status === 'missing'));
  notify('Lista CSV exportada. Contiene metadatos, no archivos de audio.');
});
$('#clear').addEventListener('click', () => {
  if (demo) { notify('Sal del ejemplo para gestionar tus datos reales.'); return; }
  $('#clear-dialog').showModal();
});
$('#cancel-clear').addEventListener('click', () => $('#clear-dialog').close());
$('#confirm-clear').addEventListener('click', () => run(async () => {
  state = await request('clear'); $('#clear-dialog').close(); render(); notify('Tus datos de Unísono se han borrado.');
}));

$('#folder-input').addEventListener('change', event => {
  const files = [...event.target.files]; event.target.value = '';
  if (!files.length) return;
  run(async () => {
    notify('Leyendo tu carpeta…');
    const result = await scanLibrary(files, (done, total) => notify(`Revisando etiquetas: ${done} de ${total} archivos…`));
    state = await request('library', result); page = 0; render();
    notify(`Biblioteca actualizada: ${result.library.length} archivos. Las coincidencias por nombre necesitan tu revisión.`);
  });
});

$('#import-input').addEventListener('change', event => {
  const files = [...event.target.files]; event.target.value = '';
  if (!files.length) return;
  run(async () => {
    if (files.reduce((total, file) => total + file.size, 0) > 100 * 1024 * 1024) throw new Error('Selecciona hasta 100 MB de metadatos por importación.');
    notify('Leyendo tu historial…');
    const documents = [];
    for (const file of files) documents.push({ name: file.name, text: await file.text() });
    const result = parseImports(documents);
    state = await request('import', { tracks: result.tracks }); page = 0; render(); showView('discover');
    notify(`${result.tracks.length} canciones procesadas. ${result.skipped} filas sin datos válidos o escuchas menores de 30 s omitidas.`);
  });
});

// Mantiene sincronizado el panel si se captura una lista desde otra pestaña.
if (globalThis.chrome?.storage) chrome.storage.onChanged.addListener(() => {
  if (!demo && !busy) refresh().catch(error => notify(error.message, true));
});
if (new URLSearchParams(location.search).get('demo') === '1') enterDemo();
else refresh().catch(error => { render(); notify(error.message, true); });
