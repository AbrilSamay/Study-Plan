/** Exportamos una lista de texto; no solicitamos ni descargamos contenido musical. */
export function exportCSV(tracks) {
  const cell = value => {
    let text = String(value ?? '');
    // Evita que un título se ejecute como fórmula al abrirlo en una hoja de cálculo.
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const columns = ['title', 'artist', 'album', 'source', 'liked', 'plays', 'url'];
  const csv = '\uFEFF' + [columns.join(','), ...tracks.map(track => columns.map(key => cell(track[key])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'unisono-pendientes.csv'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
