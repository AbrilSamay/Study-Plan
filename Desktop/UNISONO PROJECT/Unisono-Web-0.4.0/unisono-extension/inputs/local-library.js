const AUDIO = /\.(mp3|flac|m4a|aac|ogg|opus|wav|aiff|alac|wma)$/i;
const decode = (bytes, encoding = 'utf-8') => new TextDecoder(encoding).decode(bytes).replace(/\0/g, '').trim();
const syncSafe = bytes => bytes.reduce((size, byte) => size * 128 + (byte & 127), 0);
const bigEndian = bytes => bytes.reduce((size, byte) => size * 256 + byte, 0);

function id3Text(bytes) {
  const encoding = bytes[0];
  const payload = bytes.subarray(1);
  if (encoding === 0) return decode(payload, 'windows-1252');
  if (encoding === 3) return decode(payload);
  if (encoding === 2) return decode(payload, 'utf-16be');
  return decode(payload, payload[0] === 254 ? 'utf-16be' : 'utf-16le').replace(/^\uFEFF/, '');
}

/** Lectura acotada: nunca cargamos la canción completa en memoria. */
export async function readTags(file) {
  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 2 * 1024 * 1024)).arrayBuffer());
  const tags = {};
  if (decode(bytes.subarray(0, 3)) === 'ID3' && [3, 4].includes(bytes[3])) {
    // Cabeceras extendidas, etiquetas comprimidas y unsynchronisation requieren
    // un parser más amplio: ante ellas usamos el nombre y pedimos revisión humana.
    if (bytes[5] & 0xC0) return tags;
    const end = Math.min(10 + syncSafe(bytes.subarray(6, 10)), bytes.length);
    for (let offset = 10; offset + 10 <= end;) {
      const id = decode(bytes.subarray(offset, offset + 4));
      const size = (bytes[3] === 4 ? syncSafe : bigEndian)(bytes.subarray(offset + 4, offset + 8));
      if (!/^[A-Z0-9]{4}$/.test(id) || !size || offset + 10 + size > end) break;
      const key = { TIT2: 'title', TPE1: 'artist', TALB: 'album' }[id];
      if (key && bytes[offset + 9] === 0) tags[key] = id3Text(bytes.subarray(offset + 10, offset + 10 + size));
      offset += 10 + size;
    }
  } else if (decode(bytes.subarray(0, 4)) === 'fLaC') {
    for (let offset = 4; offset + 4 <= bytes.length;) {
      const header = bytes[offset];
      const size = bigEndian(bytes.subarray(offset + 1, offset + 4));
      const end = offset + 4 + size;
      if (end > bytes.length) break;
      if ((header & 127) === 4) {
        const view = new DataView(bytes.buffer);
        let cursor = offset + 4;
        const number = () => {
          if (cursor + 4 > end) throw new Error('Etiqueta FLAC incompleta');
          const value = view.getUint32(cursor, true); cursor += 4; return value;
        };
        const vendorLength = number(); cursor += vendorLength;
        const count = number();
        for (let i = 0; i < count; i++) {
          const length = number();
          if (cursor + length > end) throw new Error('Comentario FLAC incompleto');
          const comment = decode(bytes.subarray(cursor, cursor + length)); cursor += length;
          const split = comment.indexOf('=');
          const key = { TITLE: 'title', ARTIST: 'artist', ALBUM: 'album' }[comment.slice(0, split).toUpperCase()];
          if (key) tags[key] = tags[key] ? `${tags[key]}, ${comment.slice(split + 1)}` : comment.slice(split + 1);
        }
      }
      offset = end;
      if (header & 128) break;
    }
  }
  if (!tags.title && /\.mp3$/i.test(file.name) && file.size >= 128) {
    const tail = new Uint8Array(await file.slice(-128).arrayBuffer());
    if (decode(tail.subarray(0, 3)) === 'TAG') {
      tags.title = decode(tail.subarray(3, 33), 'windows-1252');
      tags.artist = decode(tail.subarray(33, 63), 'windows-1252');
      tags.album = decode(tail.subarray(63, 93), 'windows-1252');
    }
  }
  return tags;
}

export function fromFilename(filename) {
  const base = filename.replace(AUDIO, '').replace(/^\d+[. _-]+/, '').trim();
  const separator = base.indexOf(' - ');
  return separator > 0
    ? { artist: base.slice(0, separator).trim(), title: base.slice(separator + 3).trim() }
    : { artist: '', title: base };
}

export async function scanLibrary(fileList, onProgress = () => {}) {
  const files = [...fileList].filter(file => AUDIO.test(file.name));
  if (!files.length) throw new Error('La carpeta no contiene archivos de audio compatibles. Tu biblioteca anterior se conserva.');
  if (files.length > 50000) throw new Error('Elige una carpeta con hasta 50 000 archivos de audio.');
  const library = [];
  // Secuencial a propósito: memoria estable incluso con bibliotecas grandes.
  for (const [position, file] of files.entries()) {
    let tags = {};
    try { tags = await readTags(file); } catch { /* Una etiqueta rota no impide revisar el resto de la carpeta. */ }
    const fallback = fromFilename(file.name);
    const path = file.webkitRelativePath || file.name;
    const fingerprint = `${path}|${file.size}|${file.lastModified}`;
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
    library.push({
      id: [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join(''),
      title: (tags.title || fallback.title).slice(0, 300),
      artist: (tags.artist || fallback.artist).slice(0, 300), album: (tags.album || '').slice(0, 300),
      name: file.name, path, size: file.size,
      metadata: tags.title && tags.artist ? 'tags' : 'filename',
    });
    if (position % 25 === 0 || position === files.length - 1) onProgress(position + 1, files.length);
  }
  return { library, folder: files[0].webkitRelativePath?.split('/')[0] || 'Mi música' };
}
