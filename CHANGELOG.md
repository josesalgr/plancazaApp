# Cambios

## 0.0.2 - Datos nacionales

- Gestor de series de abundancias, tendencias e histórico de caza, independiente de las capas cartográficas.
- Especie fijada en tórtola europea y catálogo de las 16 comunidades autónomas del ámbito de planificación (códigos INE originales, sin Canarias).
- Crear, editar y eliminar series, definir intervalos por fechas e introducir datos por comunidad. Los selectores muestran el año o el rango de fechas.
- Una serie con intervalos permite corregir nombre y fuente. Cambiar su definición, escala o tipo de intervalo requiere una serie nueva para conservar la comparabilidad.
- Plantillas Excel con hojas Datos, Instrucciones y Comunidades; categorías de tendencia con desplegable.
- Importación Excel y CSV UTF-8, vista previa de cambios, validación en servidor y edición manual.
- Vacíos no borran valores. Retirada explícita, motivo obligatorio, revisiones inmutables y detección de ediciones concurrentes.
- Resúmenes de cobertura, media no ponderada, mediana, cuartiles, desviación típica muestral, distribución numérica y frecuencias categóricas. La suma solo se ofrece para capturas.
- Matriz de cobertura y valores entre intervalos, filtro por comunidad e historia individual.
- Exportación Excel de datos. Se retiran los botones Respaldo, Actualizar y Ver cartografía del gestor nacional.
- Mapa interactivo MapLibre como vista principal, con series e intervalos en el lateral, detalle de comunidad a la derecha y panel inferior de Tabla, Gráficos, Comparar y Revisiones. Seleccionar una comunidad sincroniza su tabla e historia y la destaca en la distribución nacional. Accesos de encuadre a Península y Baleares; datos ausentes con trama diferenciada del cero.
- Comparación de dos intervalos de la misma serie mediante mapas interactivos sincronizados con escala común, diferencias B − A para valores numéricos y transiciones de categorías para tendencias.
- Selección de comunidad en mapa o lista, detalle de fuente y observaciones, navegación por teclado e interfaz adaptable a pantallas pequeñas.
- Actualización automática al entrar en Datos, recuperar el foco y cada 30 segundos mientras esté visible. Una revisión externa nunca reemplaza una edición o un diálogo abierto; se informa de su disponibilidad.

- Canarias queda fuera de las capas base de planificación, de las vistas de series y de las plantillas.

### Planificación nacional

- Cupo editable, pesos de abundancia, tendencia y capturas, y fuentes elegidas por escenario. Los escenarios guardan la revisión de los datos y los intervalos utilizados.
- Capturas usa un año o la media de varios años consecutivos de una misma serie anual. La ficha muestra la cobertura y los años que faltan por comunidad. Abundancia y tendencia usan un intervalo de su serie.
- El modelo calcula el reparto de referencia, lo ajusta por tendencia y asigna cupos enteros con multiscape y CBC, conservando el cupo nacional.
- La prueba de pesos permite introducir combinaciones en tabla o importarlas por CSV. Los mapas permiten comparar variantes y escenarios guardados. El panel inferior se puede plegar y ajustar en altura.

El nuevo módulo está en castellano. El selector de perfiles y la contraseña compartida existentes no proporcionan identidad ni permisos individuales.

### Almacenamiento y ejecución

El catálogo se guarda por defecto en `data/national/revision-0000000001.json`, etc. Cada revisión es un estado completo y se publica mediante renombrado del archivo temporal. `PLANCAZA_DATA_DIR` permite situarlo en un directorio persistente. No se incluye en Git ni en la imagen Docker.

El diseño presupone una sola instancia del servidor R; para múltiples réplicas debe usarse una base de datos transaccional compartida. En Render Free el disco es efímero: la nueva persistencia local no evita la pérdida de archivos al reiniciar o desplegar ese servicio. El respaldo completo del directorio configurado corresponde a la administración del servidor; no se presenta como una tarea del usuario.

Se añade la dependencia R `openxlsx`; Docker la instala. Ejecutar desde la raíz del repositorio: `Rscript backend/server.R`. En Windows, si la configuración regional heredada de R no es válida, definir `LANG=en_US.UTF-8` y `LC_ALL=en_US.UTF-8`.

### Validación

- `Rscript tests/contracts.R`: almacenamiento aislado; validaciones de los tres contratos, fechas, duplicados, revisiones, concurrencia, vacíos y ceros, lectura/escritura Excel, CSV y rechazo de fórmulas.
- `node tests/contracts-core.cjs`: cálculos descriptivos y comparación de cambios.
- `Rscript tests/national-planning.R`: cálculo de cupos, redondeo con CBC, media de capturas anuales, cobertura y escenarios guardados.
- `node tests/planning-weights.cjs`: validación de pesos e importación de variantes en CSV.
- `node tests/contracts-browser.cjs`: requiere Playwright y Chrome. Usar un servidor de pruebas en `TEST_URL` (por defecto puerto 8081) con `PLANCAZA_DATA_DIR` separado del real y definir `QA_DIR` para capturas. Genera exclusivamente datos ficticios en ese catálogo.
- `node tests/contracts-maps-browser.cjs`: mismo entorno aislado; verifica geometría sin datos sintéticos, 16 comunidades, escalas comunes, selección, diferencias y transiciones, intercambio A/B, móvil y actualización protegida durante la edición.

Referencias de implementación: [códigos INE](https://www.ine.es/daco/daco42/codmun/cod_ccaa.htm) y [documentación de openxlsx](https://ycphs.github.io/openxlsx/reference/index.html).
