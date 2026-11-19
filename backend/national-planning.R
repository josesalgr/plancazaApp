# National quota allocation based on an immutable revision of the data catalog.
np_components <- c(abundancias = "Abundancia", tendencias = "Tendencia", historico_caza = "Capturas")
np_model <- "reparto-nacional-v2"
np_trend_direction <- c(
  en_alza = 1, decrecimiento = -1, constante = 0,
  aumento_fuerte = 1, aumento_moderado = 1, estable = 0, incierta = 0,
  descenso_moderado = -1, descenso_pronunciado = -1
)

np_interval_values <- function(interval, key) {
  values <- rep(NA_real_, length(nc_codes))
  for (row in interval$rows) {
    if (is.null(row$value) || !row$ccaa_codigo %in% nc_codes) next
    i <- match(row$ccaa_codigo, nc_codes)
    values[i] <- if (key == "tendencias") unname(np_trend_direction[row$value]) else row$value
  }
  values
}

np_example <- function(interval, series) {
  grepl("fictici|demostraci", paste(interval$name, series$name, series$source), ignore.case = TRUE)
}

np_annual_year <- function(interval) {
  year <- as.integer(substr(interval$start, 1L, 4L))
  end_year <- as.integer(substr(interval$end, 1L, 4L))
  if (end_year == year || (end_year == year + 1L && substring(interval$end, 6L) < substring(interval$start, 6L))) {
    return(year)
  }
  NA_integer_
}

np_capture_mean <- function(request, catalog) {
  id <- nc_text(request$series_id, "Serie de capturas", max = 100)
  series <- catalog$series[[nc_index(catalog$series, id)]]
  if (series$component != "historico_caza" || identical(series$interval_type, "Promedio plurianual")) {
    nc_fail("Selecciona una serie de capturas anuales para calcular el promedio.")
  }
  first <- nc_number(request$start_year, "Año inicial")
  last <- nc_number(request$end_year, "Año final")
  if (first < 1L || last > 9999L || first >= last || first != floor(first) || last != floor(last)) {
    nc_fail("Indica un rango de al menos dos años para el promedio de capturas.")
  }
  years <- seq.int(as.integer(first), as.integer(last))
  intervals <- Filter(function(v) identical(v$series_id, id), catalog$intervals)
  by_year <- split(intervals, vapply(intervals, np_annual_year, integer(1)))
  selected <- by_year[as.character(years)]
  counts <- lengths(selected)
  if (any(counts != 1L)) {
    nc_fail(paste("Hace falta un intervalo anual por año. Revisa:", paste(years[counts != 1L], collapse = ", ")))
  }
  selected <- lapply(selected, `[[`, 1L)
  starts <- vapply(selected, function(v) v$start, character(1))
  ends <- vapply(selected, function(v) v$end, character(1))
  if (any(head(ends, -1L) >= tail(starts, -1L))) nc_fail("Los intervalos anuales de capturas se solapan.")

  annual <- vapply(selected, np_interval_values, numeric(length(nc_codes)), key = "historico_caza")
  values <- rowMeans(annual)
  list(values = values, source = list(
    mode = "annual_mean", years = as.list(years), interval_ids = lapply(selected, function(v) v$id) |> unname(),
    interval = paste0(first, "–", last), start = starts[[1L]], end = tail(ends, 1L)[[1L]],
    series_id = id, series = series$name, source = series$source, unit = "Capturas/año",
    coverage = sum(is.finite(values)),
    demonstration = any(vapply(selected, np_example, logical(1), series = series))
  ))
}

np_context <- function(payload) {
  quota <- nc_number(payload$quota, "Cupo nacional")
  if (quota < 1 || quota != floor(quota)) nc_fail("El cupo nacional debe ser un entero mayor que cero.")
  revision <- nc_number(payload$revision, "Revisión de los datos")
  if (revision < 0 || revision != floor(revision) || revision > .Machine$integer.max) nc_fail("Revisión de datos no válida.")
  catalog <- if (revision == 0) {
    list(revision = 0L, series = list(), intervals = list())
  } else nc_read(revision)
  if (!is.list(payload$sources)) nc_fail("Selecciona las fuentes del escenario.")
  values <- setNames(vector("list", length(np_components)), names(np_components))
  sources <- values
  for (key in names(np_components)) {
    selection <- payload$sources[[key]]
    values[[key]] <- rep(NA_real_, length(nc_codes))
    if (is.null(selection) || identical(selection, "")) next
    if (key == "historico_caza" && is.list(selection)) {
      aggregate <- np_capture_mean(selection, catalog)
      sources[[key]] <- aggregate$source
      values[[key]] <- aggregate$values
      next
    }
    id <- nc_text(selection, "Intervalo", max = 100)
    interval <- catalog$intervals[[nc_index(catalog$intervals, id)]]
    series <- catalog$series[[nc_index(catalog$series, interval$series_id)]]
    if (!identical(series$component, key)) nc_fail(paste("El intervalo seleccionado no corresponde a", np_components[[key]], "."))
    sources[[key]] <- list(
      interval_id = id, interval = interval$name, start = interval$start, end = interval$end,
      series_id = series$id, series = series$name, source = series$source, unit = series$unit,
      coverage = sum(vapply(interval$rows, function(row) !is.null(row$value), logical(1))),
      demonstration = np_example(interval, series)
    )
    values[[key]] <- np_interval_values(interval, key)
  }
  list(quota = quota, revision = catalog$revision, sources = sources, values = values)
}

np_weights <- function(input) {
  if (!is.list(input) || !setequal(names(input), names(np_components)) || anyDuplicated(names(input))) nc_fail("Indica un peso para cada criterio.")
  weights <- vapply(names(np_components), function(key) nc_number(input[[key]], np_components[[key]]), numeric(1))
  names(weights) <- names(np_components)
  if (any(weights < 0 | weights > 100) || abs(sum(weights) - 100) > 1e-8) nc_fail("Los tres pesos deben estar entre 0 y 100 y sumar 100 %.")
  if (weights[["abundancias"]] + weights[["historico_caza"]] <= 0) nc_fail("Da algún peso a Abundancia o Capturas para obtener el reparto de referencia.")
  weights
}

np_round_cbc <- function(target, quota) {
  if (!requireNamespace("multiscape", quietly = TRUE) || !requireNamespace("rcbc", quietly = TRUE) ||
      !"decision_type" %in% names(formals(multiscape::add_actions))) {
    nc_fail("El reparto requiere la versión de multiscape con decisiones enteras y el solver CBC (rcbc).", 503L)
  }
  nearest <- round(target)
  near_integer <- abs(target - nearest) < 1e-8
  target[near_integer] <- nearest[near_integer]
  lower <- floor(target)
  upper <- ceiling(target)
  pending <- quota - sum(lower)
  candidates <- which(upper > lower)
  if (pending < 0 || pending > length(candidates)) nc_fail("El cupo total queda fuera de los límites del reparto entero.", 500L)
  if (pending == 0) return(lower)

  # Optimise the units above the fixed floor to keep CBC bounds at 0 or 1.
  # This shift keeps the objective and the exact total of the original Shiny model.
  ids <- seq_along(candidates)
  remainder <- target[candidates] - lower[candidates]
  pu <- data.frame(id = ids, cost = 0)
  features <- data.frame(id = 1L, name = "resto")
  distribution <- data.frame(pu = ids, feature = 1L, amount = 1)
  effects <- data.frame(pu = ids, action = "cupo", feature = 1L, delta = remainder)

  problem <- multiscape::create_problem(pu, features, distribution, cost = "cost") |>
    multiscape::add_actions(data.frame(id = "cupo"), cost = 1, decision_type = "integer", lower = 0, upper = 1) |>
    multiscape::add_effects(effects, effect_type = "delta") |>
    multiscape::add_constraint_budget(
      budget = pending, sense = "equal", include_pu_cost = FALSE, include_action_cost = TRUE
    ) |>
    multiscape::add_objective_max_benefit(features = "resto", alias = "redondeo") |>
    multiscape::set_solver_cbc(gap_limit = 0, verbose = FALSE)

  solution <- multiscape::solve(problem)
  runs <- multiscape::get_runs(solution)
  if (nrow(runs) != 1L || is.na(runs$solution_id[1L]) || !identical(tolower(runs$status[1L]), "optimal")) {
    nc_fail("CBC no devolvió una solución óptima para el reparto.", 500L)
  }
  actions <- multiscape::get_actions(solution, solution = runs$solution_id[1L])
  quantity <- actions$quantity[match(ids, actions$pu)]
  if (length(quantity) != length(ids) || any(!is.finite(quantity)) || any(abs(quantity - round(quantity)) > 1e-8)) {
    nc_fail("CBC devolvió cantidades de cupo que no son enteras.", 500L)
  }
  extra <- round(quantity)
  assigned <- lower
  assigned[candidates] <- assigned[candidates] + extra
  expected <- sum(sort(remainder, decreasing = TRUE)[seq_len(pending)])
  if (sum(assigned) != quota || any(assigned < lower | assigned > upper) ||
      abs(sum(remainder * extra) - expected) > 1e-7) {
    nc_fail("El reparto de CBC no coincide con el cupo, las cotas o el objetivo de mayores restos.", 500L)
  }
  assigned
}

np_calculate <- function(context, input) {
  weights <- np_weights(input)
  active <- names(weights)[weights > 0]
  required <- active[vapply(context$sources[active], is.null, logical(1))]
  if (length(required)) nc_fail(paste("Selecciona un intervalo para", paste(np_components[required], collapse = ", "), "."))
  available <- Reduce(`&`, lapply(context$values[active], is.finite))
  if (!any(available)) nc_fail("No hay comunidades con datos de todos los criterios con peso positivo.")

  base <- numeric(sum(available))
  baseline_keys <- intersect(c("abundancias", "historico_caza"), active)
  for (key in baseline_keys) {
    values <- context$values[[key]][available]
    total <- sum(values)
    if (any(values < 0) || total <= 0) nc_fail(paste(np_components[[key]], "requiere valores no negativos y una suma mayor que cero en las comunidades con datos."))
    base <- base + weights[[key]] * (values / total)
  }
  base <- context$quota * (base / sum(base))
  target <- base
  if ("tendencias" %in% active) {
    direction <- context$values$tendencias[available]
    declines <- direction < 0
    increases <- direction > 0
    down <- sum(base[declines])
    up <- sum(base[increases])
    if (down > 0 && up > 0) {
      moved <- weights[["tendencias"]] / 100 * min(down, up)
      target[declines] <- base[declines] - moved * (base[declines] / down)
      target[increases] <- base[increases] + moved * (base[increases] / up)
    }
  }

  assigned <- np_round_cbc(target, context$quota)
  values <- rep(NA_real_, length(nc_codes))
  values[available] <- assigned
  rows <- lapply(seq_along(nc_codes), function(i) {
    list(ccaa_codigo = nc_codes[i], value = if (available[i]) values[i] else NULL)
  })
  list(model = np_model, engine = "multiscape", solver = "CBC",
       revision = context$revision, quota = context$quota, weights = as.list(weights),
       sources = context$sources, covered = sum(available), total_communities = length(nc_codes),
       demonstration = any(vapply(context$sources[active], function(source) isTRUE(source$demonstration), logical(1))),
       rows = rows)
}

np_scenarios <- function(role) {
  files <- list.files(file.path(nc_root, "planning"), pattern = "^escenario-[a-z0-9]+\\.json$", full.names = TRUE)
  scenarios <- Filter(function(item) identical(item$role, role), lapply(files, jsonlite::fromJSON, simplifyVector = FALSE))
  if (length(scenarios)) scenarios <- scenarios[order(vapply(scenarios, function(item) item$created_at, character(1)), decreasing = TRUE)]
  scenarios
}

np_store <- function(role, payload, result) {
  name <- nc_text(payload$name, "Nombre del escenario", max = 100)
  note <- nc_text(payload$note, "Nota", FALSE, max = 500)
  if (any(vapply(np_scenarios(role), function(item) tolower(item$name) == tolower(name), logical(1)))) {
    nc_fail("Ya existe un escenario con ese nombre.", 409L)
  }
  item <- list(id = nc_id("escenario"), name = name, note = note, role = role, created_at = nc_time(), result = result)
  directory <- file.path(nc_root, "planning")
  dir.create(directory, recursive = TRUE, showWarnings = FALSE)
  temp <- tempfile("escenario-", tmpdir = directory)
  on.exit(unlink(temp), add = TRUE)
  writeBin(charToRaw(jsonlite::toJSON(item, auto_unbox = TRUE, digits = NA, null = "null", pretty = TRUE)), temp)
  if (!file.rename(temp, file.path(directory, paste0(item$id, ".json")))) nc_fail("No se pudo guardar el escenario.", 500L)
  item
}

np_route <- function(req, path, method) {
  tryCatch({
    role <- normalize_role(query_params(req)$role)
    if (!role %in% c("admin", "mapa")) nc_fail("La planificación nacional está disponible para MAPA y Admin.", 403L)
    base <- "/api/national-planning"
    if (path == base && method == "GET") {
      return(json_response(list(ok = TRUE, scenarios = np_scenarios(role),
        legacy_count = length(scenarios_for_role(read_scenarios(), role, "national"))), digits = NA))
    }
    if (method == "POST" && path %in% paste0(base, c("/calculate", "/scenarios"))) {
      body <- read_body(req)
      if (nchar(body, type = "bytes") > 4e6) nc_fail("La solicitud supera el tamaño permitido.", 413L)
      payload <- jsonlite::fromJSON(body, simplifyVector = FALSE)
      context <- np_context(payload)
      if (endsWith(path, "/scenarios")) {
        result <- np_calculate(context, payload$weights)
        return(json_response(list(ok = TRUE, scenario = np_store(role, payload, result)), 201L, digits = NA))
      }
      if (!is.list(payload$variants) || !length(payload$variants)) nc_fail("Añade al menos una combinación de pesos.")
      results <- lapply(payload$variants, function(weights) {
        tryCatch(list(ok = TRUE, result = np_calculate(context, weights)),
          nc_error = function(e) list(ok = FALSE, message = conditionMessage(e)))
      })
      return(json_response(list(ok = TRUE, results = results), digits = NA))
    }
    nc_fail("Ruta no encontrada.", 404L)
  }, nc_error = function(e) json_response(list(ok = FALSE, message = conditionMessage(e)), e$status),
  error = function(e) json_response(list(ok = FALSE, message = conditionMessage(e)), 500L))
}
