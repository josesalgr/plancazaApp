.libPaths(c(file.path(getwd(), ".Rlib"), .libPaths()))
`%||%` <- function(x, y) if (is.null(x)) y else x
Sys.setenv(PLANCAZA_DATA_DIR = tempfile("plancaza-planning-test-"))
source("backend/contracts.R", encoding = "UTF-8")
source("backend/national-planning.R", encoding = "UTF-8")

weights <- function(a,t,h) list(abundancias=a,tendencias=t,historico_caza=h)
vec <- function(a,b) c(a,b,rep(NA_real_,length(nc_codes)-2L))
context <- list(
  quota=100, revision=7L,
  sources=list(abundancias=list(series="A"),tendencias=list(series="T",demonstration=TRUE),historico_caza=list(series="H")),
  values=list(abundancias=vec(40,60),tendencias=vec(-1,1),historico_caza=vec(80,20))
)
base <- np_calculate(context,weights(50,0,50))
adjusted <- np_calculate(context,weights(40,20,40))
stopifnot(base$rows[[1]]$value==60, base$rows[[2]]$value==40, !base$demonstration)
stopifnot(adjusted$rows[[1]]$value==52, adjusted$rows[[2]]$value==48, adjusted$demonstration)
stopifnot(adjusted$covered==2, is.null(adjusted$rows[[3]]$value))
context$values$tendencias <- vec(0,1)
neutral <- np_calculate(context,weights(40,20,40))
stopifnot(identical(neutral$rows,base$rows))
context$quota <- 3
context$values$abundancias <- vec(1,1)
tied <- np_calculate(context,weights(100,0,0))
stopifnot(identical(sort(vapply(tied$rows[1:2], function(row) row$value, numeric(1))), c(1,2)))
stopifnot(identical(np_round_cbc(c(3.6, 1.7, 1.7), 7), c(3,2,2)))
stopifnot(identical(np_round_cbc(c(1e14 + .25, 1e14 + .75), 2e14 + 1), c(1e14, 1e14 + 1)))
bad <- tryCatch(np_calculate(context,weights(0,100,0)),nc_error=identity)
stopifnot(inherits(bad,"nc_error"))
stored <- np_store("admin",list(name="Prueba de planificación",note="Fuentes fijadas"),adjusted)
loaded <- np_scenarios("admin")[[1]]
stopifnot(loaded$id==stored$id,loaded$result$revision==7,loaded$result$model==np_model,loaded$result$rows[[1]]$value==52)
stopifnot(loaded$result$engine=="multiscape", loaded$result$solver=="CBC")
stopifnot(length(np_scenarios("mapa"))==0L)
cat("National planning allocation, rounding and scenario persistence passed.\n")

capture_series <- list(id="annual", component="historico_caza", name="Capturas anuales", source="Registro",
                       interval_type="Anual", unit="Capturas")
annual_interval <- function(id, year, values, start=paste0(year,"-01-01"), end=paste0(year,"-12-31")) {
  list(id=id, series_id="annual", name=id, start=start, end=end,
       rows=lapply(seq_along(values), function(i) {
         list(ccaa_codigo=nc_codes[[i]], value=if (is.na(values[[i]])) NULL else values[[i]])
       }))
}
annual <- list(annual_interval("first", 2021, c(0,20,30,0)),
               annual_interval("second", 2022, c(21,40,NA,0)),
               annual_interval("fourth", 2024, c(100,100)))
catalog <- list(revision=0L, series=list(capture_series), intervals=annual)
catalog <- nc_commit(catalog, list(reason="Preparar prueba"), "interval", "first")
selection <- list(series_id="annual", start_year=2021, end_year=2022)
request <- list(quota=100, revision=catalog$revision, sources=list(historico_caza=selection))
ctx <- np_context(request)
source <- ctx$sources$historico_caza
stopifnot(identical(ctx$values$historico_caza[1:4], c(10.5,30,NA_real_,0)), source$coverage==3L)
stopifnot(identical(source$years, list(2021L,2022L)), identical(source$interval_ids, list("first","second")))
average <- np_calculate(ctx,weights(0,0,100))
stopifnot(average$covered==3L, identical(lapply(average$rows[1:4], `[[`, "value"), list(26,74,NULL,0)))
single <- np_context(modifyList(request, list(sources=list(historico_caza="first"))))
stopifnot(identical(single$values$historico_caza[1:4], c(0,20,30,0)))
gap <- tryCatch(np_capture_mean(modifyList(selection,list(end_year=2024)),catalog), nc_error=identity)
stopifnot(inherits(gap,"nc_error"),grepl("2023",conditionMessage(gap)))
duplicated <- catalog
duplicated$intervals <- c(annual,list(annual_interval("duplicate",2022,c(1),start="2022-09-01",end="2022-12-01")))
stopifnot(inherits(tryCatch(np_capture_mean(selection,duplicated),nc_error=identity),"nc_error"))
invisible(np_store("mapa",list(name="Media de capturas"),average))
saved_mean <- np_scenarios("mapa")[[1]]$result
stopifnot(saved_mean$revision==request$revision, identical(saved_mean$sources$historico_caza$interval_ids,list("first","second")))
cat("Annual capture averages, completeness and saved data references passed.\n")
