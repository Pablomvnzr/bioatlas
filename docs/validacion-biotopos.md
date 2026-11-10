# Mapa de detalle y validación de biotopos

En la aplicación: **Zonas → Parque Urbano El Bosque → Explorar biotopos · Mapa de detalle**. La misma vista está disponible para las otras zonas. Muestra el contorno de referencia y sus avistamientos. Los sectores interiores aparecerán cuando se carguen sus polígonos documentados; no se han inventado subdivisiones.

## Cómo validar el primer sector

1. Conseguir un plano del parque o una delimitación revisada por su administración. Contrastar el contorno de iNaturalist con esa fuente: una zona de observaciones no garantiza un límite ecológico.
2. Identificar un sector concreto y describir su hábitat, por ejemplo bosque o humedal, sin deducir sus límites únicamente de las especies registradas. Registrar fecha, método y persona responsable de la revisión.
3. Preparar el polígono con coordenadas en WGS84, mediante un levantamiento en terreno o cartografía respaldada. El equipo puede prepararlo en QGIS y exportarlo como GeoJSON MultiPolygon. Cada sector necesita identificador, nombre, color, fuente, enlace y el identificador de su zona padre. Para El Bosque, el padre es `inat-199913`.
4. Importarlo con el mecanismo de zonas del proyecto, como `kind: biotope` y `parentId` correspondiente. No sustituir ni renombrar una macrozona como si fuera un biotopo. No se incorporó un editor de polígonos en el teléfono en esta etapa.
5. Un administrador abre **Ficha de validación**, registra el hábitat, el enlace a la evidencia, la persona revisora y las observaciones. Guarda la propuesta y después la envía a revisión.
6. Tras contrastar límites, revisar el hábitat y documentar la comprobación en terreno, marca las tres comprobaciones y confirma la validación. El sistema exige que el biotopo esté dentro de su área padre. Si el límite real cruza esa área, hay que revisar la referencia; no recortar la realidad solo para aprobar el formulario.

La validación es interna del proyecto, no una certificación oficial. Las casillas registran la declaración del administrador; la aplicación no sustituye la evaluación de una persona competente. Cada decisión conserva su usuario, fecha y contenido. Si cambia la geometría o su fuente, la ficha vuelve a propuesta y requiere nueva revisión; también se reinician las revisiones de los sectores hijos si cambia su referencia.

## Fuentes para iniciar la revisión

- Administración del [Parque Urbano El Bosque](https://parqueurbano.cl/): solicitar plano y revisión de los sectores.
- [Repositorio documental de la Municipalidad de Valdivia](https://munivaldivia.cl/repositorio-documental/): consultar el catastro de humedales y contrastar fecha, escala y alcance antes de usar sus límites.
- iNaturalist: usar los avistamientos como evidencia de presencia, conservando coordenadas, precisión y fuente. La ausencia de registros no demuestra ausencia de especies.

Queda pendiente obtener y revisar los polígonos interiores reales. Hasta entonces, la aplicación muestra explícitamente que el contorno es un área de referencia.
