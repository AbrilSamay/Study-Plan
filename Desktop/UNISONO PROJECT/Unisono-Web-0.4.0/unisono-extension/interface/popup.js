import { request } from '../application/client.js';
const capture = document.querySelector('#capture');
const status = document.querySelector('#capture-status');
capture.addEventListener('click', async () => {
  capture.disabled = true; status.textContent = 'Leyendo canciones cargadas…';
  try {
    const result = await request('capture');
    status.textContent = `${result.read} canciones leídas · ${result.added} nuevas.${result.liked ? ' Guardadas como Me gusta.' : ''} Abre tu colección para compararlas.`;
  } catch (error) { status.textContent = error.message; }
  finally { capture.disabled = false; }
});
document.querySelector('#dashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('interface/index.html') });
});
