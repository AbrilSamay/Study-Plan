# Unísono Web · 0.4.0

Una extensión de Chrome para convertir tus gustos musicales en una lista de canciones que aún no están en tu biblioteca local. Solo analiza metadatos: no extrae audio, no descarga canciones y no controla la reproducción.

## Instalar sin compilar

1. Descomprime el ZIP de esta entrega, si estás usando el paquete.
2. Escribe `chrome://extensions` en Chrome y activa **Modo de desarrollador**.
3. Pulsa **Cargar descomprimida** y selecciona la carpeta `unisono-extension` que contiene `manifest.json`.
4. Fija Unísono desde el menú de extensiones. Pulsa su icono y **Abrir mi colección**.

No necesitas Node, npm, Android Studio, una cuenta de desarrollador ni un servidor para utilizarla. No se ha publicado en Chrome Web Store. El APK anterior es una aplicación distinta; no instala esta extensión.

## Tu primer recorrido

1. Abre **Me gusta** en Spotify o YouTube Music, con tu sesión habitual.
2. Pulsa el icono de Unísono en esa pestaña y **Capturar canciones visibles**. Los Me gusta se reconocen en las listas oficiales `/collection/tracks` y `/playlist?list=LM`.
3. Desplázate por la lista y repite. Solo se leen filas cargadas en el DOM; una lista virtualizada requiere varias capturas. Repetir no duplica las canciones.
4. Abre **Mi colección** y elige la carpeta raíz donde guardas toda tu música. Se incluyen sus subcarpetas.
5. Consulta **Me faltan** y **Por revisar**. Confirma el archivo solo si corresponde a la misma canción y versión.
6. **Buscar en Bandcamp** abre una búsqueda para que puedas explorar la disponibilidad del artista. No garantiza que una canción esté allí ni realiza compras o descargas.

Si quieres priorizar las más escuchadas, importa tu historial desde **Mis fuentes**. Selecciona juntos todos los JSON de Spotify. El historial básico y el extendido se admiten; escucha válida significa un evento de al menos 30 segundos. También puedes importar CSV y JSON genéricos con `title`, `artist`, `album`, `source`, `liked`, `plays`, `url`. Hay archivos ficticios de ejemplo en `examples/`.

La importación de historial se trata como una instantánea: se deduplican eventos dentro del conjunto seleccionado y, respecto de importaciones previas, se conserva el mayor conteo por canción. Para sumar periodos separados, selecciona sus archivos juntos. Capturar una playlist nunca incrementa las escuchas ni implica que todas sus canciones tengan Me gusta.

## Qué se compara

- Título y artista iguales, normalizados, con etiquetas locales legibles: **Ya las tengo**.
- Coincidencia aproximada, versión distinta, artista desconocido o nombre de archivo: **Por revisar**.
- Sin coincidencia o marcada expresamente por ti: **Me faltan**.
- Antes de revisar una carpeta, no se afirma que las canciones te falten.

MP3: etiquetas ID3v1 y frames de texto sencillos ID3v2.3 / ID3v2.4. FLAC: comentarios Vorbis. Lectura máxima de 2 MiB al inicio y, en MP3, 128 bytes finales. No se leen portadas ni se carga el audio completo. Otras etiquetas y formatos usan el nombre `Artista - Canción.ext` como pista que necesita confirmación. Se reconocen extensiones MP3, FLAC, M4A, AAC, OGG, OPUS, WAV, AIFF, ALAC y WMA; esto no significa que se decodifiquen sus etiquetas o su audio.

La comparación es textual, no una huella acústica: dos grabaciones diferentes con las mismas etiquetas podrían coincidir. Se conservan palabras como Live, Remix y Remaster. No se verifica la integridad ni la licencia de un archivo. La revisión de carpeta reemplaza el índice completo, por lo que debes elegir siempre la raíz de toda tu biblioteca.

## Privacidad y permisos

Todo se almacena en `chrome.storage.local`, en este perfil. Se guardan títulos, artistas, álbumes, enlaces de canción, conteos importados, rutas relativas y decisiones. No se guardan bytes de audio ni contraseñas. No hay telemetría, API remota, CDN, fuentes externas ni solicitudes automáticas de red.

- `activeTab`: permiso temporal al invocar la extensión en una pestaña.
- `scripting`: ejecutar el lector de filas de la página elegida en un mundo aislado.
- `storage`: guardar tu índice y tus decisiones.

No se solicita acceso permanente a sitios, historial del navegador, cookies, descargas ni todas las páginas. Abrir un enlace de Spotify, YouTube Music o Bandcamp navega a ese sitio normalmente. **Exportar pendientes** descarga exclusivamente un CSV de texto con los metadatos pendientes, no música. **Borrar mis datos** elimina el estado de Unísono, nunca tus archivos.

## Tecnologías y organización

HTML semántico, CSS adaptable, JavaScript con módulos ES y Manifest V3. **Cero dependencias de ejecución y cero paso de compilación**. Los iconos son propios y se generan opcionalmente con Python estándar. Las pruebas de navegador usan Playwright como herramienta externa, sin incluirlo en el producto.

El código se organiza por responsabilidades en el recorrido de información; los nombres no llevan números:

```text
inputs/          Páginas, historial y carpeta local → datos de entrada
domain/          Contratos, identidad, combinación y coincidencias
application/     Casos de uso, mensajería y coordinación del worker
storage/         Persistencia local versionada
interface/       Panel, popup, estilos, iconos y ejemplo aislado
outputs/         Exportación de pendientes
examples/        Archivos de muestra, sin datos personales
tests/           Pruebas de comportamiento y navegador
scripts/         Herramientas opcionales de mantenimiento
docs/            Arquitectura, límites y evidencia de validación
```

Empieza por [la arquitectura](docs/ARCHITECTURE.md) y consulta [la validación](docs/VALIDATION.md). Los comentarios explican límites, decisiones y contratos en español.

## Desarrollo y pruebas

Con Node 20 o superior instalado:

```sh
npm test
```

No hace falta `npm install` para las pruebas de dominio. Para la auditoría opcional, proporciona una instalación externa de Playwright en `PLAYWRIGHT_MODULE` y la ruta de Chrome en `CHROME_EXECUTABLE`; ejecuta `node tests/browser.cjs`. El ensayo usa un perfil separado en `artifacts/` y necesita Chrome con soporte CDP `Extensions.loadUnpacked` (verificado con Chrome 156). No modifica el perfil habitual. `artifacts/` queda fuera del ZIP.

Después de editar, pulsa **Recargar** en `chrome://extensions` y recarga el panel. Para explorar la interfaz sin datos, usa **Preferencias → Ver ejemplo**. Los datos ficticios viven solo en memoria.

## Límites de esta entrega

- Spotify y YouTube Music: adaptadores DOM probados con fixtures, pendientes de comprobar con sesiones reales. Sus páginas pueden cambiar; los selectores están concentrados en `inputs/page-reader.js`.
- No hay sincronización automática de Me gusta, monitor de reproducción ni OAuth. Las capturas son acumulativas: quitar un Me gusta en la plataforma no lo retira del índice de esta versión.
- No se interpreta Google Takeout ni se conoce todo tu historial por abrir una página. Las frecuencias disponibles son las que tú importas.
- La carpeta es una instantánea: si sus archivos cambian, vuelve a seleccionarla. Las confirmaciones que referencian archivos desaparecidos se eliminan al revisar.
- Máximo de 50 000 archivos por revisión, 50 000 canciones por importación y 100 MB de metadatos de entrada. También aplica la cuota de `chrome.storage.local`; si se agota, se muestra un error y se conserva el último estado guardado.
- El lector no cubre todas las variantes ID3, las etiquetas M4A/OGG/WAV ni bibliotecas incompletas o repartidas en varias raíces.
- Los datos Android no se migran automáticamente. Los archivos originales del usuario permanecen intactos.

## Referencias técnicas consultadas

- [Chrome: activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab).
- [Chrome: scripting y mundo aislado](https://developer.chrome.com/docs/extensions/reference/api/scripting).
- [Spotify: cambios del modo de desarrollo en febrero de 2026](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide). Esta entrega no necesita acceder a esa API.
