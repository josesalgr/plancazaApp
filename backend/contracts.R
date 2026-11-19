# National data contracts. Immutable snapshots and optimistic concurrency.
nc_root <- Sys.getenv("PLANCAZA_DATA_DIR", file.path(getwd(), "data", "national"))
nc_names <- c("Andalucía", "Aragón", "Asturias", "Illes Balears", "Cantabria", "Castilla y León", "Castilla-La Mancha", "Cataluña", "Comunitat Valenciana", "Extremadura", "Galicia", "Comunidad de Madrid", "Región de Murcia", "Comunidad Foral de Navarra", "País Vasco", "La Rioja")
nc_codes <- sprintf("%02d", setdiff(1:17, 5))
nc_fields <- c(abundancias = "indice_abundancia", tendencias = "tendencia", historico_caza = "capturas")
nc_trend_schemes <- list(
  tres_categorias = c(en_alza = "En alza", decrecimiento = "Decrecimiento", constante = "Constante"),
  seis_categorias = c(
    aumento_fuerte = "Aumento fuerte", aumento_moderado = "Aumento moderado",
    estable = "Estable", incierta = "Incierta", descenso_moderado = "Descenso moderado",
    descenso_pronunciado = "Descenso pronunciado"
  )
)
nc_trend_scheme <- function(series) series$trend_scheme %||% "tres_categorias"
nc_trend_rules <- c(
  "Aumento fuerte. Pendiente anual > 1,05 y límite inferior > 1,05.",
  "Aumento moderado. Pendiente anual > 1,00 y ≤ 1,05. Límite inferior entre 1,00 y 1,05.",
  "Estable. El intervalo de confianza incluye 1,00. Límite inferior > 0,95 y límite superior < 1,05.",
  "Incierta. El intervalo de confianza incluye 1,00. Límite inferior < 0,95, límite superior > 1,05 o ambas condiciones.",
  "Descenso moderado. Pendiente anual ≥ 0,95 y < 1,00. Límite superior entre 0,95 y 1,00.",
  "Descenso pronunciado. Pendiente anual < 0,95 y límite superior < 0,95."
)
nc_time <- function() format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
nc_fail <- function(message, status = 400L) stop(structure(list(message = message, call = NULL, status = status), class = c("nc_error", "error", "condition")))
nc_text <- function(x, label, required = TRUE, max = 1500) {
  if (is.null(x)) x <- ""
  if (!is.character(x) || length(x) != 1L || is.na(x)) nc_fail(paste(label, "debe ser texto."))
  x <- trimws(x)
  if ((required && !nzchar(x)) || nchar(x) > max) nc_fail(paste(label, "es obligatorio y debe respetar la longitud máxima de", max, "caracteres."))
  x
}
nc_files <- function() sort(list.files(nc_root, pattern = "^revision-[0-9]{10}\\.json$", full.names = TRUE))
nc_read <- function(revision = NULL) {
  files <- nc_files()
  if (!length(files) && is.null(revision)) return(list(revision = 0L, series = list(), intervals = list()))
  path <- if (is.null(revision)) tail(files, 1) else file.path(nc_root, sprintf("revision-%010d.json", as.integer(revision)))
  if (!length(path) || !file.exists(path)) nc_fail("Revisión no encontrada.", 404L)
  jsonlite::fromJSON(path, simplifyVector = FALSE)
}
nc_index <- function(items, id) {
  idx <- match(id, vapply(items, function(x) x$id, character(1)))
  if (is.na(idx)) nc_fail("No se encuentra la serie o el intervalo seleccionado.", 404L)
  idx
}
nc_id <- function(prefix) paste0(prefix, "-", paste(sample(c(letters, 0:9), 18, TRUE), collapse = ""))
nc_commit <- function(db, payload, kind, target) {
  db$revision <- db$revision + 1L
  db$event <- list(kind = kind, target = target, at = nc_time(), reason = nc_text(payload$reason, "Motivo", max = 500), origin = if (identical(payload$origin, "import")) "import" else "edit")
  dir.create(nc_root, showWarnings = FALSE, recursive = TRUE)
  dest <- file.path(nc_root, sprintf("revision-%010d.json", db$revision))
  if (file.exists(dest)) nc_fail("Los datos han cambiado. Recarga antes de guardar.", 409L)
  tmp <- tempfile("revision-", tmpdir = nc_root)
  on.exit(if (file.exists(tmp)) unlink(tmp), add = TRUE)
  writeBin(charToRaw(jsonlite::toJSON(db, auto_unbox = TRUE, null = "null", digits = NA, pretty = TRUE)), tmp)
  if (!file.rename(tmp, dest)) nc_fail("No se pudo guardar la revisión.", 500L)
  db
}
nc_date <- function(x) {
  x <- nc_text(x, "Fecha", max = 10)
  parsed <- tryCatch(as.Date(x, format = "%Y-%m-%d"), error = function(e) NA)
  if (!grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", x) || is.na(parsed) || format(parsed, "%Y-%m-%d") != x) nc_fail("Fecha inválida: utiliza AAAA-MM-DD.")
  x
}
nc_number <- function(x, label, optional = FALSE) {
  if (is.null(x) || identical(x, "")) { if (optional) return(NULL); nc_fail(paste(label, "debe ser un número.")) }
  if (length(x) != 1L || is.logical(x) || is.list(x)) nc_fail(paste(label, "debe ser un número."))
  if (is.character(x) && !grepl("^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$", trimws(x))) nc_fail(paste(label, "debe ser numérico (decimal con punto)."))
  n <- suppressWarnings(as.numeric(x))
  if (!is.finite(n) || abs(n) > 1e15) nc_fail(paste(label, "debe ser un número finito de magnitud menor o igual a 10^15."))
  n
}
nc_validate_rows <- function(rows, series) {
  if (!is.list(rows) || length(rows) > length(nc_codes)) nc_fail("La tabla admite una fila por cada una de las 16 comunidades del ámbito de planificación autónomas.")
  scheme <- nc_trend_scheme(series)
  trend_options <- nc_trend_schemes[[scheme]]
  seen <- character()
  lapply(rows, function(row) {
    code <- nc_text(row$ccaa_codigo, "Código de comunidad", max = 2)
    if (!code %in% nc_codes) nc_fail(paste("Código no válido:", code, ". Consulta la hoja Comunidades."))
    if (code %in% seen) nc_fail(paste("Código duplicado:", code))
    seen <<- c(seen, code)
    val <- row$value
    if (is.character(val) && length(val) == 1 && !nzchar(trimws(val))) val <- NULL
    if (!is.null(val)) {
      if (series$component == "tendencias") {
        options <- if (scheme == "seis_categorias") unname(trend_options) else names(trend_options)
        if (!is.character(val) || length(val) != 1L) nc_fail(paste0(code, ": introduce una categoría de tendencia."))
        if (scheme == "seis_categorias") {
          val <- trimws(val)
          label_index <- match(val, trend_options)
          if (!is.na(label_index)) val <- names(trend_options)[label_index]
        }
        if (!val %in% names(trend_options)) nc_fail(paste0(code, ": tendencia debe ser una de estas categorías: ", paste(options, collapse = ", "), "."))
      } else {
        val <- nc_number(val, paste("Valor de", code))
        if (series$component == "historico_caza" && (val < 0 || val != floor(val))) nc_fail(paste(code, ": capturas debe ser un entero no negativo."))
        if (series$component == "abundancias" && ((!is.null(series$minimum) && val < series$minimum) || (!is.null(series$maximum) && val > series$maximum))) nc_fail(paste(code, ": índice fuera de la escala de la serie."))
      }
    }
    list(ccaa_codigo = code, value = val, observations = nc_text(row$observations, "Observaciones", FALSE))
  })
}
nc_merge_rows <- function(current, incoming, clear = character()) {
  merged <- setNames(current, vapply(current, function(x) x$ccaa_codigo, character(1)))
  for (r in incoming) {
    old <- merged[[r$ccaa_codigo]]
    # An imported/edited empty value never deletes an existing observation implicitly.
    if (is.null(r$value) && !r$ccaa_codigo %in% clear && !is.null(old)) r$value <- old$value
    merged[[r$ccaa_codigo]] <- r
  }
  for (code in clear) {
    if (is.null(merged[[code]])) merged[[code]] <- list(ccaa_codigo = code, observations = "")
    merged[[code]]["value"] <- list(NULL)
  }
  unname(merged[order(names(merged))])
}
nc_mutate <- function(db, p) {
  if (is.null(p$revision) || !identical(as.numeric(p$revision), as.numeric(db$revision))) nc_fail("Otra sesión ha actualizado los datos. Recarga y revisa tus cambios antes de guardar.", 409L)
  action <- p$action
  if (identical(action, "series")) {
    s <- p$series
    component <- nc_text(s$component, "Componente")
    if (!component %in% names(nc_fields)) nc_fail("Componente no válido.")
    old <- if (!is.null(s$id)) db$series[[nc_index(db$series, s$id)]] else NULL
    item <- list(id = if (is.null(old)) nc_id("serie") else old$id, component = component, species = "Streptopelia turtur", name = nc_text(s$name, "Nombre", max = 120), definition = nc_text(s$definition, "Definición del indicador"), source = nc_text(s$source, "Fuente", max = 300), interval_type = nc_text(s$interval_type, "Tipo de intervalo", max = 120), unit = nc_text(s$unit, "Unidad / criterio", max = 500), minimum = nc_number(s$minimum, "Mínimo", TRUE), maximum = nc_number(s$maximum, "Máximo", TRUE), created_at = if (is.null(old)) nc_time() else old$created_at, updated_at = nc_time())
    if (component == "tendencias") {
      item$trend_scheme <- nc_text(s$trend_scheme %||% nc_trend_scheme(old), "Clasificación de tendencias", max = 32)
      if (!item$trend_scheme %in% names(nc_trend_schemes)) nc_fail("Clasificación de tendencias no válida.")
    }
    if (!is.null(item$minimum) && !is.null(item$maximum) && item$minimum > item$maximum) nc_fail("El mínimo no puede superar al máximo.")
    if (any(vapply(db$series, function(x) x$id != item$id && x$component == component && tolower(x$name) == tolower(item$name), logical(1)))) nc_fail("Ya existe una serie con ese nombre en el componente.")
    used <- Filter(function(x) x$series_id == item$id, db$intervals)
    if (!is.null(old) && length(used)) {
      if (nc_trend_scheme(item) != nc_trend_scheme(old)) nc_fail("Esta serie ya tiene intervalos. Crea otra serie para cambiar su clasificación.")
      for (key in c("component", "definition", "interval_type", "unit", "minimum", "maximum")) if (!isTRUE(all.equal(item[[key]], old[[key]]))) nc_fail("Esta serie ya tiene intervalos. Para cambiar el significado, la escala o el tipo de intervalo crea otra serie; puedes editar su nombre y fuente.")
    }
    if (is.null(old)) db$series <- c(db$series, list(item)) else db$series[[nc_index(db$series, old$id)]] <- item
    return(nc_commit(db, p, "series", item$id))
  }
  if (identical(action, "delete-series")) {
    id <- nc_text(p$series_id, "Identificador de serie", max = 100)
    index <- nc_index(db$series, id)
    db$series <- db$series[-index]
    db$intervals <- Filter(function(x) x$series_id != id, db$intervals)
    return(nc_commit(db, p, "delete-series", id))
  }
  if (identical(action, "interval")) {
    v <- p$interval
    nc_index(db$series, v$series_id)
    old <- if (!is.null(v$id)) db$intervals[[nc_index(db$intervals, v$id)]] else NULL
    if (!is.null(old) && old$series_id != v$series_id) nc_fail("No se puede trasladar un intervalo a otra serie.")
    item <- list(id = if (is.null(old)) nc_id("intervalo") else old$id, series_id = v$series_id, name = nc_text(v$name, "Nombre del intervalo", max = 120), start = nc_date(v$start), end = nc_date(v$end), rows = if (is.null(old)) list() else old$rows, updated_at = nc_time())
    if (item$start > item$end) nc_fail("La fecha de inicio no puede ser posterior a la fecha de fin.")
    if (any(vapply(db$intervals, function(x) x$id != item$id && x$series_id == item$series_id && (tolower(x$name) == tolower(item$name) || (x$start == item$start && x$end == item$end)), logical(1)))) nc_fail("Ya existe ese nombre o intervalo de fechas en la serie.")
    if (is.null(old)) db$intervals <- c(db$intervals, list(item)) else db$intervals[[nc_index(db$intervals, old$id)]] <- item
    return(nc_commit(db, p, "interval", item$id))
  }
  if (identical(action, "records")) {
    i <- nc_index(db$intervals, p$interval_id)
    interval <- db$intervals[[i]]
    s <- db$series[[nc_index(db$series, interval$series_id)]]
    rows <- nc_validate_rows(p$rows, s)
    clear <- unlist(p$clear %||% list(), use.names = FALSE)
    if (length(clear) && !all(clear %in% nc_codes)) nc_fail("Código de retirada no válido.")
    interval$rows <- nc_merge_rows(interval$rows, rows, clear)
    interval$updated_at <- nc_time()
    db$intervals[[i]] <- interval
    return(nc_commit(db, p, "records", interval$id))
  }
  nc_fail("Operación no reconocida.")
}

nc_workbook <- function(component, series = NULL, interval = NULL, export = FALSE) {
  if (!component %in% names(nc_fields)) nc_fail("Componente no válido.")
  scheme <- nc_trend_scheme(series)
  six_trends <- component == "tendencias" && scheme == "seis_categorias"
  trend_options <- nc_trend_schemes[[scheme]]
  wb <- openxlsx::createWorkbook()
  for (name in c("Datos", "Instrucciones", "Comunidades")) openxlsx::addWorksheet(wb, name)
  values <- if (component == "tendencias") rep(NA_character_, length(nc_codes)) else rep(NA_real_, length(nc_codes))
  notes <- rep("", length(nc_codes))
  if (export && !is.null(interval)) for (r in interval$rows) {
    i <- match(r$ccaa_codigo, nc_codes)
    if (is.na(i)) next
    if (!is.null(r$value)) values[i] <- if (six_trends) unname(trend_options[r$value]) else r$value
    notes[i] <- r$observations %||% ""
  }
  df <- data.frame(ccaa_codigo = nc_codes, value = values, observaciones = notes, stringsAsFactors = FALSE)
  names(df)[2] <- nc_fields[[component]]
  openxlsx::writeData(wb, "Datos", df)
  openxlsx::addStyle(wb, "Datos", openxlsx::createStyle(numFmt = "@"), rows = seq_along(nc_codes) + 1L, cols = 1)
  if (component == "tendencias") {
    options <- if (six_trends) unname(trend_options) else names(trend_options)
    validation <- paste0('"', paste(options, collapse = ","), '"')
    openxlsx::dataValidation(wb, "Datos", cols = 2, rows = seq_along(nc_codes) + 1L, type = "list", value = validation, allowBlank = TRUE)
  }
  if (component == "historico_caza") openxlsx::dataValidation(wb, "Datos", cols = 2, rows = seq_along(nc_codes) + 1L, type = "whole", operator = "greaterThanOrEqual", value = 0, allowBlank = TRUE)
  data_rule <- switch(component,
    abundancias = "Índice numérico, dentro de la escala declarada. No se presupone 0-100.",
    tendencias = if (six_trends) "Elige la categoría en el desplegable de Excel. La pendiente y el intervalo de confianza sirven para asignarla." else "Solo en_alza, decrecimiento o constante. No introducir porcentajes.",
    historico_caza = if (identical(series$interval_type, "Promedio plurianual")) "Promedio anual de capturas para el intervalo de referencia, redondeado a un entero no negativo." else "Capturas realizadas: entero no negativo. No introducir cupos autorizados."
  )
  missing_rule <- if (six_trends) "Vacío = Sin datos. Incierta es una evaluación con incertidumbre." else "Vacío = Sin datos. Un cero válido es un resultado. Constante no significa ausencia de evaluación."
  instructions <- c("PLAN-CAZA 0.0.2 | Contrato nacional | Tórtola europea", paste("Componente:", component), paste("Serie:", if (is.null(series)) "seleccionar en la aplicación" else series$name), paste("Intervalo:", if (is.null(interval)) "seleccionar en la aplicación" else paste(interval$name, interval$start, interval$end)), "Completar únicamente la hoja Datos. Una fila por comunidad; no renombrar las columnas.", "Los códigos son texto de dos caracteres. La hoja Comunidades contiene el catálogo INE de las 16 CCAA del ámbito de planificación (sin Canarias).", missing_rule, "Los vacíos y filas omitidas no eliminan datos guardados. Retirar un valor requiere una acción explícita en la app.", "No introducir fórmulas. Pegar valores. Los datos se validan y previsualizan antes de guardar.", "Cada carga corresponde a la serie y al intervalo seleccionados en la app.", data_rule, if (!is.null(series)) paste("Definición:", series$definition, "| Unidad/criterio:", series$unit) else "", if (six_trends) nc_trend_rules, "Fuente de códigos: https://www.ine.es/daco/daco42/codmun/cod_ccaa.htm")
  openxlsx::writeData(wb, "Instrucciones", data.frame(Instrucciones = instructions))
  openxlsx::writeData(wb, "Comunidades", data.frame(ccaa_codigo = nc_codes, comunidad = nc_names))
  for (sheet in c("Datos", "Comunidades")) {
    openxlsx::freezePane(wb, sheet, firstRow = TRUE)
    openxlsx::setColWidths(wb, sheet, cols = 1:3, widths = c(18, 35, 55))
  }
  openxlsx::setColWidths(wb, "Instrucciones", cols = 1, widths = 115)
  openxlsx::addStyle(wb, "Instrucciones", openxlsx::createStyle(wrapText = TRUE), rows = seq_len(length(instructions) + 1L), cols = 1, gridExpand = TRUE)
  f <- tempfile(fileext = ".xlsx")
  on.exit(unlink(f), add = TRUE)
  openxlsx::saveWorkbook(wb, f, overwrite = TRUE)
  readBin(f, "raw", file.info(f)$size)
}
nc_import <- function(p, db) {
  interval <- db$intervals[[nc_index(db$intervals, p$interval_id)]]
  s <- db$series[[nc_index(db$series, interval$series_id)]]
  b64 <- nc_text(p$content, "Archivo", max = 3e6)
  bytes <- tryCatch(base64enc::base64decode(b64), error = function(e) nc_fail("Archivo no válido."))
  ext <- tolower(tools::file_ext(nc_text(p$filename, "Nombre de archivo")))
  f <- tempfile(fileext = paste0(".", ext)); on.exit(unlink(f), add = TRUE); writeBin(bytes, f)
  if (ext == "xlsx") {
    entries <- utils::unzip(f, list = TRUE)
    if (!nrow(entries) || sum(entries$Length) > 5e6 || any(grepl("(^/|\\.\\.)", entries$Name))) nc_fail("El Excel supera el tamaño permitido o no es válido.")
    # Only worksheet cells are checked. Excel also uses formula elements for dropdown validation.
    for (entry in entries$Name[grepl("^xl/worksheets/.*xml$", entries$Name)]) {
      con <- unz(f, entry, open = "rb"); xml <- rawToChar(readBin(con, "raw", n = 5e6)); close(con)
      sheet_data <- regmatches(xml, regexpr("(?s)<(?:[\\w.-]+:)?sheetData(?:\\s[^>]*)?>.*?</(?:[\\w.-]+:)?sheetData\\s*>", xml, perl = TRUE))
      if (any(grepl("<(?:[\\w.-]+:)?f(?=[\\s/>])", sheet_data, perl = TRUE))) nc_fail("El archivo contiene fórmulas. Pega sus resultados como valores antes de importar.")
    }
    df <- openxlsx::read.xlsx(f, sheet = "Datos", colNames = TRUE, skipEmptyRows = TRUE, skipEmptyCols = FALSE, check.names = FALSE, na.strings = character())
  } else if (ext == "csv") {
    lines <- readLines(f, warn = FALSE, encoding = "UTF-8")
    if (!length(lines)) nc_fail("Archivo vacío.")
    sep <- if (grepl(";", lines[[1]], fixed = TRUE)) ";" else ","
    df <- read.table(f, header = TRUE, sep = sep, quote = '"', comment.char = "", colClasses = "character", check.names = FALSE, fileEncoding = "UTF-8-BOM", na.strings = "", fill = FALSE)
  } else nc_fail("Selecciona una plantilla .xlsx o un archivo .csv UTF-8.")
  required <- c("ccaa_codigo", nc_fields[[s$component]])
  if (!all(required %in% names(df)) || any(!names(df) %in% c(required, "observaciones")) || anyDuplicated(names(df))) nc_fail(paste("Columnas admitidas:", paste(c(required, "observaciones"), collapse = ", ")))
  rows <- lapply(seq_len(nrow(df)), function(i) {
    code <- as.character(df$ccaa_codigo[i]); if (grepl("^[0-9]$", code)) code <- paste0("0", code)
    v <- df[[required[2]]][i]; if (is.na(v)) v <- NULL
    obs <- if ("observaciones" %in% names(df)) df$observaciones[i] else ""
    if (is.na(obs)) obs <- ""
    list(ccaa_codigo = code, value = v, observations = as.character(obs))
  })
  rows <- nc_validate_rows(rows, s)
  list(ok = TRUE, rows = rows, revision = db$revision)
}
# Geometry only: never use the synthetic abundance values in the legacy base layer.
nc_geometry <- local({
  cached <- NULL
  function() {
    if (!is.null(cached)) return(cached)
    canonical <- c("Andalucía", "Aragón", "Asturias", "Islas Baleares", "Cantabria", "Castilla y León", "Castilla-La Mancha", "Cataluña", "Comunidad Valenciana", "Extremadura", "Galicia", "Madrid", "Murcia", "Navarra", "País Vasco", "La Rioja")
    shapes <- plan_shapes[plan_shapes$autonomous_community != "Canarias", ]
    indices <- match(shapes$autonomous_community, canonical)
    if (nrow(shapes) != length(nc_codes) || anyNA(indices) || anyDuplicated(indices)) nc_fail("No se pudieron identificar los límites de las 16 comunidades del ámbito de planificación.", 500L)
    shapes$ccaa_codigo <- nc_codes[indices]
    shapes$comunidad <- nc_names[indices]
    shapes <- shapes[, c("ccaa_codigo", "comunidad", "geometry")]
    shapes <- sf::st_transform(sf::st_simplify(sf::st_transform(shapes, 3857), dTolerance = 800, preserveTopology = TRUE), 4326)
    f <- tempfile(fileext = ".geojson"); on.exit(unlink(f), add = TRUE)
    sf::st_write(shapes, f, quiet = TRUE)
    cached <<- paste(readLines(f, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
    cached
  }
})
nc_route <- function(req, path, method) {
  tryCatch({
    if (method == "GET" && path == "/api/national-data/geometry") return(text_response(nc_geometry(), "application/geo+json; charset=utf-8"))
    db <- nc_read()
    params <- query_params(req)
    if (method == "GET" && path == "/api/national-data") return(json_response(list(ok = TRUE, catalog = db, communities = lapply(seq_along(nc_codes), function(i) list(code = nc_codes[i], name = nc_names[i])))))
    if (method == "GET" && path == "/api/national-data/history") {
      history <- lapply(rev(nc_files()), function(f) { d <- jsonlite::fromJSON(f, simplifyVector = FALSE); list(revision = d$revision, event = d$event) })
      return(json_response(list(ok = TRUE, history = history)))
    }
    if (method == "GET" && path == "/api/national-data/snapshot") {
      rev <- nc_number(params$revision, "Revisión")
      if (rev < 1 || rev != floor(rev) || rev > db$revision) nc_fail("Revisión no válida.")
      return(json_response(list(ok = TRUE, catalog = nc_read(rev))))
    }
    if (method == "GET" && path %in% c("/api/national-data/template", "/api/national-data/export")) {
      s <- if (!is.null(params$series)) db$series[[nc_index(db$series, params$series)]] else NULL
      v <- if (!is.null(params$interval)) db$intervals[[nc_index(db$intervals, params$interval)]] else NULL
      if (!is.null(v) && (is.null(s) || v$series_id != s$id)) nc_fail("El intervalo no pertenece a la serie.")
      component <- if (is.null(s)) params$component else s$component
      res <- list(status = 200L, headers = list("Content-Type" = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Cache-Control" = "no-store", "Content-Disposition" = paste0('attachment; filename="', if (endsWith(path, "export")) "datos_" else "plantilla_", component, '.xlsx"')), body = nc_workbook(component, s, v, endsWith(path, "export")))
      return(res)
    }
    if (method == "POST") {
      body <- read_body(req)
      if (nchar(body, type = "bytes") > 4e6) nc_fail("Archivo demasiado grande. Máximo 2 MB.", 413L)
      p <- jsonlite::fromJSON(body, simplifyVector = FALSE)
      if (path == "/api/national-data/inspect") return(json_response(nc_import(p, db)))
      if (path == "/api/national-data") return(json_response(list(ok = TRUE, catalog = nc_mutate(db, p))))
    }
    nc_fail("Ruta no encontrada.", 404L)
  }, error = function(e) json_response(list(ok = FALSE, message = conditionMessage(e)), if (inherits(e, "nc_error")) e$status else 400L))
}
