# Arquitectura: sigue el viaje de una canción

## Del origen a la pantalla

```text
Popup + gesto del usuario
   → application/client.js → application/worker.js
   → inputs/page-reader.js (pestaña elegida)
   → domain/tracks.js (limpieza, identidad y unión)
   → storage/repository.js
   → interface/app.js → domain/matching.js → resultados

Archivo JSON / CSV → inputs/imports.js → worker → mismo recorrido
Carpeta elegida → inputs/local-library.js → worker → mismo recorrido
Resultados pendientes → outputs/export.js → lista CSV
```

El orden conceptual sustituye a carpetas numeradas. Hay diez etapas para orientarse: selección del origen, lectura, interpretación, normalización, combinación, almacenamiento, comparación, revisión humana, presentación y exportación. Cada módulo tiene una responsabilidad, aunque una etapa pueda compartir carpeta con otra.

## Contratos

`Track`: `{ title, artist, album, source, url, liked, plays, sources }`. `cleanTrack` limita tamaños, normaliza tipos y permite únicamente URLs HTTPS de canciones de Spotify o YouTube Music. `identity` combina artista y título normalizados, conservando versiones. Una misma canción encontrada en ambas plataformas comparte señales y fuentes.

`LocalFile`: `{ id, title, artist, album, name, path, size, metadata }`. `id` es SHA-256 de ruta relativa, tamaño y fecha de modificación; identifica una entrada del índice, **no es un hash del audio**. `metadata` distingue etiquetas completas de pistas por nombre.

`State`: versión, canciones, índice local, decisiones, fecha/carpeta de revisión y última captura. No contiene objetos File ni referencias de acceso permanente al sistema de archivos.

`Match`: `owned`, `review` o `missing`, con razón y archivo o candidatos. La decisión humana prevalece mientras el archivo exista en el índice. Los índices de identidad y palabras reducen las búsquedas frente a comparar todos los pares.

## Responsabilidades y extensiones

- `inputs/page-reader.js`: función autocontenida que Chrome serializa. No importes helpers externos dentro de ella; no estarán en el contexto de la pestaña. Si cambia un proveedor, ajusta sus selectores aquí y añade un fixture.
- `inputs/local-library.js`: lectura acotada, sin decodificar audio. Para ampliar formatos, añade lectores aquí conservando la marca de confianza. Una etiqueta rota no interrumpe el recorrido completo.
- `inputs/imports.js`: convierte formatos explícitos. Rechaza documentos incompatibles. Un nuevo proveedor de historial debe producir el contrato Track y explicar sus reglas de conteo.
- `domain/`: funciones independientes de Chrome y del DOM. Mantén aquí las reglas y sus pruebas, no en los botones.
- `application/worker.js`: único escritor del almacenamiento; serializa mensajes. Acepta mensajes únicamente de las páginas propias de `interface/`. Devuelve éxito solo después de persistir.
- `storage/repository.js`: clave y esquema versionados. Una nueva versión de datos debe migrarse explícitamente.
- `interface/app.js`: coordina vistas y acciones. Usa delegación de eventos para filas paginadas; escapa metadatos al generar HTML. Los ejemplos no se guardan ni se mezclan con datos reales.
- `outputs/export.js`: exporta todos los pendientes, no solo la página visible. Protege las celdas contra fórmulas inyectadas en hojas de cálculo.

## Elecciones deliberadas

Sin React, empaquetador ni servidor: la extensión es pequeña y la lógica no requiere un framework. Los módulos nativos separan responsabilidades y Chrome aplica CSP sin scripts remotos ni inline. El CSS comparte tokens visuales para cambiar colores o tamaños sin reescribir componentes.

`activeTab` evita permisos permanentes y requiere invocar el popup en la pestaña musical. El panel no intenta leer silenciosamente otras pestañas. La captura no consulta endpoints privados, intercepta sesiones ni extrae medios.

El worker no mantiene tareas largas tras cerrar Chrome. La lectura de archivos ocurre en el panel: mantenlo abierto hasta terminar. Una escritura fallida conserva el estado anterior y se comunica a la persona.

## Relación con Android 0.3.17

Se revisaron el README, las notas de refactorización, la identidad/comparación del dominio y la paleta Midnight Glass dentro del ZIP. Son contexto técnico, no instrucciones que sustituyan esta migración.

Se conserva la intención de biblioteca local y revisión de coincidencias, junto con la estética oscura/lavanda. No se trasladan WebView, Java, MediaStore, MediaSession, reproducción, motores de descarga, claves ni APK. El nuevo worker reemplaza la coordinación nativa; la carpeta seleccionada reemplaza MediaStore. No se extrajo ni distribuyó la clave de desarrollo Android.
