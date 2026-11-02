# Validación · 0.4.0

## Verificado

- 13 pruebas automatizadas de dominio y entradas con Node 24: normalización Unicode, versiones, idempotencia, fuentes múltiples, etiquetas frente a nombres, confirmaciones obsoletas, enlaces, CSV, historial básico/extendido, IDs de archivos, ID3 y FLAC.
- Extensión Manifest V3 cargada realmente en Chrome 156 mediante CDP, en un perfil de prueba separado.
- Importación CSV, persistencia después de recargar, selección de carpeta, propuesta de coincidencia, confirmación y exclusión de la canción confirmada en el CSV exportado.
- Ejemplo en memoria y retorno a los datos reales, borrado confirmado y persistencia de ese borrado.
- Escape de títulos con HTML y rechazo de enlaces `javascript:`.
- Adaptadores Spotify/YouTube Music contra páginas HTML controladas, incluyendo distinción entre Me gusta y otra playlist.
- Las cuatro vistas a 390, 760, 1024 y 1440 píxeles: 16 comprobaciones de ancho sin desbordamiento horizontal.
- Capturas de escritorio y móvil inspeccionadas visualmente; cero errores JavaScript de página en el recorrido.

Las pruebas de navegador se encuentran en `tests/browser.cjs`. Las capturas de la ejecución local se guardan en `artifacts/desktop.png` y `artifacts/mobile.png`; los perfiles y archivos generados se excluyen de la distribución.

## No verificado / alcance real

No se ha iniciado sesión en las cuentas del usuario ni probado la captura desde el icono con listas reales de Spotify o YouTube Music. Las fixtures prueban la lógica de los selectores, no su compatibilidad actual con todas las variantes de las páginas. La importación real y el índice local sí se ejercitaron dentro de la extensión.

No se han probado bibliotecas de 50 000 archivos, todas las etiquetas existentes, el agotamiento real de cuota, lectores de pantalla ni el proceso de publicación en Chrome Web Store. No se realizaron descargas de música, compras ni cambios en cuentas externas.

## Prueba manual con tus cuentas

1. Carga la extensión descomprimida y abre la lista Me gusta del proveedor.
2. Captura desde el icono: revisa que título y artista correspondan a las filas cargadas.
3. Captura de nuevo sin desplazarte: no debe aumentar el total de canciones ni escuchas.
4. Desplázate y repite: solo deben añadirse canciones nuevas.
5. Elige una carpeta con una canción presente y otra ausente de tu selección. Verifica los grupos y confirma solo las coincidencias correctas.
6. Elimina o mueve un archivo de prueba fuera de la carpeta, vuelve a revisarla y comprueba que la confirmación ya no lo da por disponible.
7. Importa todos los archivos de historial juntos; repite la importación para comprobar que no se inflan los conteos.
