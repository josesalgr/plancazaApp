# Demo de PLAN-CAZA en Render

Crear un Web Service Docker, región Frankfurt y plan Free, o utilizar `render.yaml` como Blueprint.
Configurar `PLANCAZA_PASSWORD` como secreto antes del despliegue. El usuario HTTP es `plancaza`.
Render proporciona el puerto mediante `PORT`; la imagen escucha en todas las interfaces.
La comprobación de salud es `/api/health` y no requiere autenticación. El resto de la app y su API sí.

La imagen incluye únicamente datos de ejemplo y límites administrativos. Las capas y escenarios locales existentes no se publican.
El almacenamiento del plan Free es temporal: las capas subidas y escenarios creados se pierden en reinicios, suspensiones o nuevos despliegues.
Esto también afecta a las series, intervalos y revisiones de datos nacionales de la versión 0.0.2. Para conservarlos en un servidor con almacenamiento persistente, configurar `PLANCAZA_DATA_DIR` en ese volumen y respaldar su contenido desde la administración del servidor.
La contraseña compartida limita el acceso a la demo; el selector Admin/MAPA/CCA no representa permisos individuales.

El plan Free dispone de memoria limitada. Verificar mapas e importaciones antes de distribuir el enlace.
No se ha incorporado arranque automático en el servidor CTFC ni modificado su instalación.
