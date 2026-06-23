# PLAN-CAZA Shiny

Prototipo de plataforma interactiva para planificación y optimización de cupos de caza de especies migratorias, alineada con el PT3 de la memoria técnica de PLAN-CAZA.

## Requisitos

Instala R y estos paquetes:

```r
install.packages(c("shiny", "bslib", "bsicons", "dplyr", "tidyr", "ggplot2", "DT", "leaflet"))
```

También puedes instalarlos en una librería local del proyecto:

```r
dir.create(".Rlib", showWarnings = FALSE)
install.packages(c("shiny", "bslib", "bsicons", "dplyr", "tidyr", "ggplot2", "DT", "leaflet"), lib = ".Rlib")
```

## Ejecutar

```r
shiny::runApp()
```

## Estructura

- `app.R`: interfaz y servidor Shiny.
- `R/plan_caza_data.R`: carga de datos, series temporales y mapas.
- `R/plan_caza_scenarios.R`: escenarios nacionales y regionales.
- `data/plan_caza_sample.csv`: datos sintéticos reemplazables por la base armonizada del PT1.
- `data/ccaa_boundaries.geojson`: límites ADM1 reales de España para el mapa de inicio.
- `data/catalonia_municipalities.geojson`: límites municipales de Cataluña para el escenario regional piloto.
- `www/styles.css`: ajustes visuales.

## Próximos acoples

- Sustituir `data/plan_caza_sample.csv` por la base espacial armonizada del PT1.
- Si se dispone de un GeoPackage o shapefile oficial interno, sustituir `data/ccaa_boundaries.geojson` manteniendo el campo de comunidad autónoma.
- Reemplazar las funciones heurísticas de `R/plan_caza_scenarios.R` por el solver MIP en R con COIN-OR CBC.
- Añadir informes técnicos en formato parametrizado cuando el contenido final de E8 esté cerrado.
