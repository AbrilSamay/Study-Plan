/** Un documento versionado. Solo el worker escribe, evitando carreras entre ventanas. */
export const emptyState = () => ({ version: 1, tracks: [], library: [], decisions: {}, scannedAt: null, folder: '', lastCapture: null });
const KEY = 'unisono.state.v1';

export async function readState() {
  return (await chrome.storage.local.get(KEY))[KEY] || emptyState();
}

export async function writeState(state) {
  // chrome.storage.local tiene cuota: el error se propaga y la UI no afirma éxito.
  await chrome.storage.local.set({ [KEY]: state });
}
