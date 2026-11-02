/** Datos ficticios, solo en memoria. Nunca se mezclan con el almacenamiento real. */
export function demoState() {
  const tracks = [
    { title: 'Luz de noviembre', artist: 'La Casa Azul del Sur', liked: true, plays: 42, source: 'spotify' },
    { title: 'Todo lo que queda', artist: 'Isla Interior', liked: true, plays: 31, source: 'youtube' },
    { title: 'Cerca del mar', artist: 'Los Días Lentos', liked: true, plays: 24, source: 'spotify' },
    { title: 'Satélites', artist: 'Marea Lunar', liked: true, plays: 18, source: 'youtube' },
    { title: 'La última estación', artist: 'Norte Suave', liked: false, plays: 16, source: 'spotify' },
    { title: 'En otra vida', artist: 'Club del Bosque', liked: false, plays: 12, source: 'import' },
    { title: 'Cerca del mar (En vivo)', artist: 'Los Días Lentos', liked: true, plays: 7, source: 'spotify' },
    { title: 'Amanecer', artist: 'Isla Interior', liked: true, plays: 9, source: 'youtube' },
  ].map(track => ({ ...track, url: '', album: '', sources: [track.source] }));
  return { version: 1, tracks, decisions: {}, folder: 'Mi música de ejemplo', scannedAt: new Date().toISOString(), lastCapture: null,
    library: [
      { id: 'demo-one', title: 'Amanecer', artist: 'Isla Interior', metadata: 'tags', path: 'Mi música/Isla Interior/Amanecer.flac', name: 'Amanecer.flac' },
      { id: 'demo-two', title: 'Cerca del mar', artist: 'Los Días Lentos', metadata: 'filename', path: 'Mi música/Los Días Lentos - Cerca del mar.mp3', name: 'Los Días Lentos - Cerca del mar.mp3' },
    ] };
}
