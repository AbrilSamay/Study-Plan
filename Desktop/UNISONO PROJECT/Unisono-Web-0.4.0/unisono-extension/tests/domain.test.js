import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, mergeTracks, safeTrackUrl } from '../domain/tracks.js';
import { createLibraryIndex, matchTrack } from '../domain/matching.js';
import { parseImports, parseCSV } from '../inputs/imports.js';
import { fromFilename, readTags, scanLibrary } from '../inputs/local-library.js';

const song = { title: 'Corazón', artist: 'María', source: 'spotify', liked: true, plays: 5 };
const file = { id: 'local', title: 'Corazon', artist: 'Maria', metadata: 'tags' };

test('normalización Unicode sin borrar versiones', () => {
  assert.equal(normalize('  CORAZÓN (Official Audio) '), 'corazon');
  assert.equal(normalize('東京 (Live)'), '東京 live');
  assert.notEqual(normalize('Corazón'), normalize('Corazón (Remix)'));
});
test('capturar y reimportar no duplica canciones ni infla reproducciones', () => {
  let result = mergeTracks([], [song, song]);
  result = mergeTracks(result, [{ ...song, source: 'youtube', plays: 0, liked: false }]);
  assert.equal(result.length, 1); assert.equal(result[0].plays, 5);
  assert.equal(result[0].liked, true); assert.deepEqual(result[0].sources, ['spotify', 'youtube']);
});
test('coincidencia segura exige título y artista en etiquetas', () => {
  assert.equal(matchTrack(song, createLibraryIndex([file])).status, 'owned');
  assert.equal(matchTrack(song, createLibraryIndex([{ ...file, metadata: 'filename' }])).status, 'review');
  assert.equal(matchTrack(song, createLibraryIndex([{ ...file, artist: '' }])).status, 'review');
});
test('artistas distintos no se ocultan y versiones live requieren revisión', () => {
  assert.equal(matchTrack(song, createLibraryIndex([{ ...file, artist: 'Otra persona' }])).status, 'missing');
  assert.equal(matchTrack({ ...song, title: 'Corazón (Live)' }, createLibraryIndex([file])).status, 'review');
});
test('confirmaciones quedan invalidadas al desaparecer el archivo', () => {
  const decisions = { 'maria|corazon': { fileId: 'local' } };
  assert.equal(matchTrack(song, createLibraryIndex([file]), decisions).status, 'owned');
  assert.equal(matchTrack(song, createLibraryIndex([]), decisions).status, 'missing');
  assert.equal(matchTrack(song, createLibraryIndex([file]), { 'maria|corazon': { missing: true } }).status, 'missing');
});
test('enlaces solo a canciones de proveedores permitidos', () => {
  for (const value of ['javascript:alert(1)', 'https://open.spotify.com.evil.test/track/abc', 'https://user:pass@open.spotify.com/track/abc', 'https://evil.test/']) assert.equal(safeTrackUrl(value), '');
  assert.equal(safeTrackUrl('https://open.spotify.com/track/abc?si=secret'), 'https://open.spotify.com/track/abc');
  assert.equal(safeTrackUrl('https://music.youtube.com/watch?v=abc-123&list=LM'), 'https://music.youtube.com/watch?v=abc-123');
});
test('CSV soporta comas, comillas, Unicode y saltos de línea', () => {
  const rows = parseCSV('\uFEFFtitle,artist,liked\r\n"Hola, \"\"mundo\"\"\nOtra línea",María,true\r\n');
  assert.equal(rows[0].title, 'Hola, "mundo"\nOtra línea');
  assert.throws(() => parseCSV('title\n"roto'), /comillas/);
  assert.throws(() => parseCSV('wrong\nvalue'), /title/);
});
test('historial cuenta eventos únicos y omite escuchas cortas, nulos y podcasts', () => {
  const event = { master_metadata_track_name: 'Corazón', master_metadata_album_artist_name: 'María', ts: '2026-01-01', ms_played: 50000 };
  const text = JSON.stringify([event, event, { ...event, ts: '2026-01-02' }, { ...event, ts: '2026-01-03', ms_played: 1000 }, { ...event, master_metadata_track_name: null }, null]);
  const result = parseImports([{ name: 'history.json', text }, { name: 'overlap.json', text }]);
  assert.equal(result.tracks.length, 1); assert.equal(result.tracks[0].plays, 2);
});
test('historial básico y listas genéricas se unen sin perder Me gusta', () => {
  const result = parseImports([
    { name: 'basic.json', text: JSON.stringify([{ trackName: 'Corazón', artistName: 'María', msPlayed: 90000, endTime: '2026-01-01 12:00' }]) },
    { name: 'likes.csv', text: 'title,artist,liked\nCorazón,María,true' },
  ]);
  assert.equal(result.tracks.length, 1); assert.equal(result.tracks[0].plays, 1); assert.equal(result.tracks[0].liked, true);
});
test('duplicados de una lista genérica conservan todas las señales', () => {
  const result = parseImports([{ name: 'list.json', text: JSON.stringify([song, { ...song, liked: false, plays: 0 }]) }]);
  assert.equal(result.tracks.length, 1);
  assert.equal(result.tracks[0].liked, true);
  assert.equal(result.tracks[0].plays, 5);
});
test('nombres de archivo no se presentan como etiquetas', async () => {
  assert.deepEqual(fromFilename('01 - María - Corazón.mp3'), { artist: 'María', title: 'Corazón' });
  const local = new File(['not really audio'], 'María - Corazón.m4a', { lastModified: 1 });
  const result = await scanLibrary([local]);
  assert.equal(result.library[0].metadata, 'filename');
  assert.equal(result.library[0].artist, 'María');
  assert.equal(result.library[0].id.length, 64);
});
test('etiquetas ID3v2.3 UTF-8 e ID3v1 se leen sin cargar audio', async () => {
  const frame = (id, value) => {
    const payload = Buffer.concat([Buffer.from([3]), Buffer.from(value)]);
    const header = Buffer.alloc(10); header.write(id); header.writeUInt32BE(payload.length, 4);
    return Buffer.concat([header, payload]);
  };
  const body = Buffer.concat([frame('TIT2', 'Corazón'), frame('TPE1', 'María')]);
  const header = Buffer.from([73, 68, 51, 3, 0, 0, 0, 0, 0, body.length]);
  const result = await readTags(new File([header, body], 'test.mp3'));
  assert.deepEqual(result, { title: 'Corazón', artist: 'María' });
  const tail = Buffer.alloc(128); tail.write('TAG'); tail.write('Title', 3); tail.write('Artist', 33);
  assert.equal((await readTags(new File([tail], 'legacy.mp3'))).artist, 'Artist');
});
test('comentarios FLAC y archivo truncado', async () => {
  const little = number => { const buffer = Buffer.alloc(4); buffer.writeUInt32LE(number); return buffer; };
  const comments = ['TITLE=Corazón', 'ARTIST=María'].map(text => { const bytes = Buffer.from(text); return Buffer.concat([little(bytes.length), bytes]); });
  const body = Buffer.concat([little(0), little(2), ...comments]);
  const header = Buffer.from([132, 0, 0, body.length]);
  assert.equal((await readTags(new File(['fLaC', header, body], 'test.flac'))).title, 'Corazón');
  assert.deepEqual(await readTags(new File(['ID3'], 'broken.mp3')), {});
});
