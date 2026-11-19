.libPaths(c(file.path(getwd(), ".Rlib"), .libPaths()))
library(jsonlite)
`%||%` <- function(x,y) if (is.null(x)) y else x
Sys.setenv(PLANCAZA_DATA_DIR = tempfile("plancaza-contract-test-"))
source("backend/contracts.R", encoding = "UTF-8")
checks <- 0
check <- function(x) { stopifnot(isTRUE(x)); checks <<- checks + 1L }
bad <- function(expr, pattern) { e <- tryCatch({force(expr); NULL}, error = identity); if (!inherits(e,"error") || !grepl(pattern, conditionMessage(e))) stop(paste("Expected:",pattern,"Actual:",if(is.null(e)) "NO ERROR" else conditionMessage(e))); check(TRUE) }
db <- nc_read()
mutate <- function(action, ...) { db <<- nc_mutate(db, c(list(action=action, revision=db$revision, reason="Prueba"),list(...))); db <<- nc_read(); db }
s <- list(component="abundancias",name="Índice",definition="Índice comparable",source="Prueba",interval_type="Anual",unit="Índice relativo",minimum=0,maximum=100)
mutate("series",series=s)
sid <- db$series[[1]]$id
mutate("interval",interval=list(series_id=sid,name="2025",start="2025-01-01",end="2025-12-31"))
vid <- db$intervals[[1]]$id
mutate("records",interval_id=vid,rows=list(list(ccaa_codigo="01",value=0,observations="Cero"),list(ccaa_codigo="02",value=25)))
original_revision <- db$revision
check(db$intervals[[1]]$rows[[1]]$value==0)
mutate("records",interval_id=vid,rows=list(list(ccaa_codigo="02",value=NULL,observations="Vacío no borra")))
check(db$intervals[[1]]$rows[[2]]$value==25)
mutate("records",interval_id=vid,rows=list(),clear=list("02"))
check(is.null(db$intervals[[1]]$rows[[2]]$value))
check(nc_read(original_revision)$intervals[[1]]$rows[[2]]$value==25)
bad(nc_mutate(db,list(action="series",revision=0,series=s,reason="stale")),"Otra sesión")
bad(nc_validate_rows(list(list(ccaa_codigo="99",value=2)),db$series[[1]]),"Código no válido")
bad(nc_validate_rows(list(list(ccaa_codigo="01",value=2),list(ccaa_codigo="01",value=3)),db$series[[1]]),"duplicado")
bad(nc_validate_rows(list(list(ccaa_codigo="01",value=101)),db$series[[1]]),"escala")
bad(nc_validate_rows(list(list(ccaa_codigo="01",value="NaN")),db$series[[1]]),"numérico")
bad(nc_date("2025-02-30"),"Fecha inválida")
bad(nc_mutate(db,list(action="interval",revision=db$revision,reason="x",interval=list(series_id=sid,name="otro",start="2025-01-01",end="2025-12-31"))),"Ya existe")
edited <- db$series[[1]]; edited$name <- "Índice corregido"
mutate("series",series=edited)
check(db$series[[1]]$name=="Índice corregido")
edited$maximum <- 200
bad(nc_mutate(db,list(action="series",revision=db$revision,reason="x",series=edited)),"otra serie")
trend <- list(component="tendencias")
for (category in c("en_alza","decrecimiento","constante")) check(nc_validate_rows(list(list(ccaa_codigo="01",value=category)),trend)[[1]]$value==category)
bad(nc_validate_rows(list(list(ccaa_codigo="01",value="estable")),trend),"tendencia")
check(is.null(nc_validate_rows(list(list(ccaa_codigo="01",value=NULL)),trend)[[1]]$value))
six_trends <- list(component="tendencias",name="Seis categorías",definition="Pendiente anual e IC",
                   source="Prueba",interval_type="Evaluación",unit="Categoría",trend_scheme="seis_categorias")
mutate("series",series=six_trends)
trend_series <- tail(db$series,1)[[1]]
mutate("interval",interval=list(series_id=trend_series$id,name="2024",start="2024-01-01",end="2024-12-31"))
trend_interval <- tail(db$intervals,1)[[1]]
labels <- unname(nc_trend_schemes$seis_categorias)
trend_rows <- lapply(seq_along(labels),function(i) list(ccaa_codigo=nc_codes[i],value=labels[i]))
mutate("records",interval_id=trend_interval$id,rows=trend_rows)
trend_interval <- tail(db$intervals,1)[[1]]
check(identical(vapply(trend_interval$rows,function(row) row$value,character(1)),names(nc_trend_schemes$seis_categorias)))
bad(nc_validate_rows(list(list(ccaa_codigo="01",value="en_alza")),trend_series),"tendencia")
bad(nc_validate_rows(list(list(ccaa_codigo="01",value=1.05)),trend_series),"categoría de tendencia")
trend_export <- tempfile(fileext=".xlsx")
writeBin(nc_workbook("tendencias",trend_series,trend_interval,TRUE),trend_export)
check(identical(openxlsx::read.xlsx(trend_export,sheet="Datos")$tendencia[seq_along(labels)],labels))
roundtrip <- nc_import(list(interval_id=trend_interval$id,filename="tendencias.xlsx",content=base64enc::base64encode(trend_export)),db)
check(identical(roundtrip$rows[seq_along(labels)],trend_interval$rows))
trend_series$trend_scheme <- "tres_categorias"
bad(nc_mutate(db,list(action="series",revision=db$revision,series=trend_series,reason="x")),"cambiar su clasificación")
hunting <- list(component="historico_caza")
bad(nc_validate_rows(list(list(ccaa_codigo="01",value=-1)),hunting),"entero")
bad(nc_validate_rows(list(list(ccaa_codigo="01",value=2.4)),hunting),"entero")
check(nc_validate_rows(list(list(ccaa_codigo="01",value=0)),hunting)[[1]]$value==0)
for (component in names(nc_fields)) {
  file <- tempfile(fileext=".xlsx")
  writeBin(nc_workbook(component),file)
  df <- openxlsx::read.xlsx(file,sheet="Datos",skipEmptyCols=FALSE)
  check(nrow(df)==16 && identical(names(df),c("ccaa_codigo",nc_fields[[component]],"observaciones")))
  check(as.character(df$ccaa_codigo[1])=="01")
}
f <- tempfile(fileext=".xlsx")
writeBin(nc_workbook("abundancias",db$series[[1]],db$intervals[[1]],TRUE),f)
imported <- nc_import(list(interval_id=vid,filename="datos.xlsx",content=base64enc::base64encode(f)),db)
check(length(imported$rows)==16 && imported$rows[[1]]$value==0 && is.null(imported$rows[[2]]$value))
wb <- openxlsx::loadWorkbook(f); openxlsx::writeFormula(wb,"Datos",x="SUM(1,2)",startCol=2,startRow=2); openxlsx::saveWorkbook(wb,f,overwrite=TRUE)
bad(nc_import(list(interval_id=vid,filename="formula.xlsx",content=base64enc::base64encode(f)),db),"fórmulas")
csv <- tempfile(fileext=".csv");writeLines(c("ccaa_codigo,indice_abundancia,observaciones",'01,0,"nota, con coma"','02,,sin dato'),csv,useBytes=TRUE)
imported <- nc_import(list(interval_id=vid,filename="datos.csv",content=base64enc::base64encode(csv)),db)
check(imported$rows[[1]]$value==0 && imported$rows[[1]]$observations=="nota, con coma" && is.null(imported$rows[[2]]$value))
cat(sprintf("\n%d contract checks passed. Isolated storage: %s\n",checks,nc_root))
