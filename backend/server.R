.libPaths(c(file.path(getwd(), ".Rlib"), .libPaths()))

library(httpuv)
library(jsonlite)
library(sf)
library(dplyr)
library(terra)
library(png)
library(base64enc)

access_password <- Sys.getenv("PLANCAZA_PASSWORD", "")
if (identical(Sys.getenv("RENDER"), "true") && !nzchar(access_password)) {
  stop("Define PLANCAZA_PASSWORD antes de publicar en Render.")
}

`%||%` <- function(x, y) {
  if (is.null(x)) y else x
}

source("R/plan_caza_data.R", encoding = "UTF-8")

plan_data <- load_plan_caza_data()
plan_shapes <- load_ccaa_shapes()
clip_buffer_m <- 5000
display_raster_crs <- "EPSG:3857"
raster_tile_size <- 256
web_mercator_limit <- 20037508.342789244

build_peninsular_mask <- function(shapes, buffer_m = 5000) {
  mainland <- shapes |>
    filter(!grepl("baleares|canarias", tolower(autonomous_community)))

  mask <- mainland |>
    sf::st_make_valid() |>
    sf::st_transform(3857) |>
    sf::st_union() |>
    sf::st_as_sf()

  if (isTRUE(buffer_m > 0)) {
    mask <- sf::st_buffer(mask, buffer_m)
  }

  mask <- mask |>
    sf::st_make_valid() |>
    sf::st_transform(4326)

  mask
}

peninsular_mask <- build_peninsular_mask(plan_shapes, clip_buffer_m)
peninsular_raster_mask <- build_peninsular_mask(plan_shapes, 0)

frontend_dir <- file.path(getwd(), "frontend")
layer_root <- file.path(getwd(), "data", "layers")
scenario_root <- file.path(getwd(), "data", "scenarios")
legacy_layer_dir <- file.path(getwd(), "data", "frontend_layers")
manifest_path <- file.path(layer_root, "manifest.json")
scenario_manifest_path <- file.path(scenario_root, "manifest.json")

dir.create(layer_root, showWarnings = FALSE, recursive = TRUE)
dir.create(scenario_root, showWarnings = FALSE, recursive = TRUE)

json_response <- function(data, status = 200) {
  list(
    status = status,
    headers = list(
      "Content-Type" = "application/json; charset=utf-8",
      "Cache-Control" = "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma" = "no-cache",
      "Expires" = "0",
      "Access-Control-Allow-Origin" = "*",
      "Access-Control-Allow-Headers" = "Content-Type",
      "Access-Control-Allow-Methods" = "GET, POST, DELETE, OPTIONS"
    ),
    body = toJSON(data, auto_unbox = TRUE, null = "null", digits = 8)
  )
}

text_response <- function(text, content_type = "text/plain; charset=utf-8", status = 200) {
  list(
    status = status,
    headers = list(
      "Content-Type" = content_type,
      "Cache-Control" = "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma" = "no-cache",
      "Expires" = "0"
    ),
    body = text
  )
}

read_body <- function(req) {
  raw <- req$rook.input$read()
  rawToChar(raw)
}

query_params <- function(req) {
  query <- req$QUERY_STRING %||% ""
  if (length(query) > 1) query <- query[[1]]
  query <- as.character(query %||% "")
  if (!nzchar(query) && !is.null(req$REQUEST_URI)) {
    request_uri <- as.character(req$REQUEST_URI[[1]] %||% "")
    if (nzchar(request_uri) && grepl("\\?", request_uri, fixed = FALSE)) {
      query <- sub("^[^?]*\\?", "", request_uri)
    }
  }
  if (!nzchar(query)) return(list())
  parts <- strsplit(query, "&", fixed = TRUE)[[1]]
  values <- setNames(vector("list", length(parts)), character(length(parts)))
  for (part in parts) {
    item <- strsplit(part, "=", fixed = TRUE)[[1]]
    key <- URLdecode(item[[1]])
    value <- if (length(item) > 1) URLdecode(item[[2]]) else ""
    values[[key]] <- value
  }
  values
}

read_manifest <- function() {
  if (!file.exists(manifest_path)) {
    legacy_manifest <- file.path(legacy_layer_dir, "manifest.json")
    if (!file.exists(legacy_manifest)) {
      return(list())
    }
    legacy <- fromJSON(legacy_manifest, simplifyVector = FALSE)
    layers <- legacy$layers %||% list()
    for (i in seq_along(layers)) {
      old_file <- layers[[i]]$file
      layers[[i]] <- normalize_layer(layers[[i]], "admin")
      layers[[i]]$target <- "admin"
      layers[[i]]$file <- file.path("admin", "shared", old_file)
      source_path <- file.path(legacy_layer_dir, old_file)
      target_path <- file.path(layer_root, layers[[i]]$file)
      dir.create(dirname(target_path), showWarnings = FALSE, recursive = TRUE)
      if (file.exists(source_path) && !file.exists(target_path)) {
        file.copy(source_path, target_path, overwrite = FALSE)
      }
    }
    write_manifest(layers)
    return(layers)
  }
  data <- fromJSON(manifest_path, simplifyVector = FALSE)
  if (is.null(data$layers)) list() else data$layers
}

write_manifest <- function(layers) {
  text <- toJSON(list(layers = layers), auto_unbox = TRUE, pretty = TRUE, null = "null")
  writeBin(charToRaw(text), manifest_path)
}

exact_item <- function(x, name, default = NULL) {
  if (is.list(x) && name %in% names(x)) x[[name]] else default
}

normalize_scenario <- function(scenario, default_role = "admin") {
  role <- normalize_role(scenario$role %||% scenario$owner %||% default_role)
  scope <- tolower(scenario$scope %||% "national")
  config <- scenario$config %||% list()
  config$selected_layer_ids <- unique(as.character(unlist(config$selected_layer_ids %||% character())))
  config$descriptive <- exact_item(config, "descriptive", list())
  config$descriptive$layerId <- config$descriptive$layerId %||% NULL
  config$descriptive$field <- config$descriptive$field %||% NULL
  config$national <- exact_item(config, "national", list())
  config$national$aggregation <- exact_item(config$national, "aggregation", list())
  config$national$aggregation$layerId <- config$national$aggregation$layerId %||% NULL
  config$national$aggregation$field <- config$national$aggregation$field %||% NULL
  config$national$aggregation$method <- as.character(config$national$aggregation$method %||% "mean")
  config$national$weights <- exact_item(config$national, "weights", list(items = list()))
  config$national$weights$items <- exact_item(config$national$weights, "items", list())
  config$national$model <- exact_item(config$national, "model", list())
  config$national$model$runLabel <- as.character(config$national$model$runLabel %||% "")
  config$national$model$priority <- as.character(config$national$model$priority %||% "balanced")
  config$national$model$solver <- as.character(config$national$model$solver %||% "multiscale")
  config$national$model$notes <- as.character(config$national$model$notes %||% "")
  config$national_step <- as.character(config$national_step %||% "layers")
  list(
    id = as.character(scenario$id %||% safe_id(paste(scope, "scenario"))),
    name = as.character(scenario$name %||% "Escenario"),
    scope = scope,
    role = role,
    created_at = as.character(scenario$created_at %||% format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")),
    updated_at = as.character(scenario$updated_at %||% format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")),
    config = config
  )
}

read_scenarios <- function() {
  if (!file.exists(scenario_manifest_path)) {
    return(list())
  }
  data <- fromJSON(scenario_manifest_path, simplifyVector = FALSE)
  scenarios <- data$scenarios %||% list()
  lapply(scenarios, normalize_scenario)
}

write_scenarios <- function(scenarios) {
  text <- toJSON(list(scenarios = scenarios), auto_unbox = TRUE, pretty = TRUE, null = "null")
  writeBin(charToRaw(text), scenario_manifest_path)
}

scenarios_for_role <- function(scenarios, role, scope = "national") {
  role <- normalize_role(role)
  Filter(function(item) identical(item$scope %||% "national", scope) && identical(normalize_role(item$role), role), lapply(scenarios, normalize_scenario))
}

scenario_payload_from_state <- function(payload) {
  list(
    selected_layer_ids = unique(as.character(unlist(payload$selected_layer_ids %||% character()))),
    descriptive = list(
      layerId = payload$descriptive$layerId %||% NULL,
      field = payload$descriptive$field %||% NULL
    ),
    national = list(
      aggregation = list(
        layerId = payload$national$aggregation$layerId %||% NULL,
        field = payload$national$aggregation$field %||% NULL,
        method = as.character(payload$national$aggregation$method %||% "mean")
      ),
      weights = list(
        items = payload$national$weights$items %||% list()
      ),
      model = list(
        runLabel = as.character(payload$national$model$runLabel %||% ""),
        priority = as.character(payload$national$model$priority %||% "balanced"),
        solver = as.character(payload$national$model$solver %||% "multiscale"),
        notes = as.character(payload$national$model$notes %||% "")
      )
    ),
    national_step = as.character(payload$national_step %||% "layers")
  )
}

safe_id <- function(name) {
  cleaned <- iconv(name, to = "ASCII//TRANSLIT", sub = "")
  cleaned <- tolower(gsub("[^a-zA-Z0-9]+", "_", cleaned))
  cleaned <- gsub("^_+|_+$", "", cleaned)
  if (!nzchar(cleaned)) cleaned <- "layer"
  paste0(cleaned, "_", format(Sys.time(), "%Y%m%d%H%M%S"), "_", sample(1000:9999, 1))
}

normalize_role <- function(role) {
  role <- tolower(role %||% "admin")
  if (!role %in% c("admin", "mapa", "cca")) "admin" else role
}

normalize_target <- function(target, role) {
  target <- tolower(target %||% role)
  if (identical(target, "both")) target <- "admin"
  if (!target %in% c("admin", "mapa", "cca", "both")) role else target
}

normalize_layer <- function(layer, default_owner = "admin") {
  owner <- normalize_role(layer$owner %||% default_owner)
  audience <- layer$audience %||% owner
  if (!is.list(audience)) audience <- as.list(audience)
  audience <- unique(vapply(audience, normalize_role, character(1)))
  if (owner == "admin" && length(audience) == 1 && audience == "admin") {
    audience <- c("admin", "mapa", "cca")
  }
  layer$owner <- owner
  layer$scope <- layer$scope %||% if (owner == "admin") "shared" else "private"
  layer$audience <- as.list(audience)
  layer
}

visible_to_role <- function(layer, role) {
  role <- normalize_role(role)
  layer <- normalize_layer(layer)
  if (identical(role, "admin")) {
    return(TRUE)
  }
  audience <- vapply(layer$audience %||% list(), normalize_role, character(1))
  identical(layer$owner, role) || role %in% audience
}

filter_layers_for_role <- function(layers, role) {
  layers <- lapply(layers, normalize_layer)
  Filter(function(layer) visible_to_role(layer, role), layers)
}

can_edit_layer <- function(layer, role) {
  role <- normalize_role(role)
  layer <- normalize_layer(layer)
  identical(role, "admin") || identical(layer$owner, role)
}

layer_file_path <- function(layer) {
  file.path(layer_root, layer$file)
}

target_folder <- function(owner, target) {
  if (identical(owner, "admin")) {
    if (identical(target, "admin")) return(file.path("admin", "shared"))
    if (identical(target, "both")) return(file.path("admin", "mapa_cca"))
    return(file.path("admin", target))
  }
  file.path(owner, "uploads")
}

sf_to_geojson <- function(x) {
  path <- tempfile(fileext = ".geojson")
  sf::st_write(x, path, driver = "GeoJSON", quiet = TRUE, delete_dsn = TRUE)
  paste(readLines(path, warn = FALSE, encoding = "UTF-8"), collapse = "\n")
}

geojson_to_sf <- function(text) {
  path <- tempfile(fileext = ".geojson")
  writeBin(charToRaw(text), path)
  sf::st_read(path, quiet = TRUE)
}

clip_sf_to_peninsula <- function(x, mask = peninsular_mask) {
  if (nrow(x) == 0) {
    return(x)
  }

  if (is.na(sf::st_crs(x))) {
    sf::st_crs(x) <- sf::st_crs(mask)
  }

  x <- sf::st_make_valid(x)
  x <- sf::st_transform(x, sf::st_crs(mask))
  types <- unique(as.character(sf::st_geometry_type(x, by_geometry = TRUE)))

  clipped <- tryCatch({
    if (all(types %in% c("POINT", "MULTIPOINT"))) {
      hits <- lengths(sf::st_intersects(x, mask)) > 0
      x[hits, , drop = FALSE]
    } else {
      suppressWarnings(sf::st_intersection(x, mask))
    }
  }, error = function(e) {
    stop("No se pudo recortar la capa a la España peninsular: ", e$message, call. = FALSE)
  })

  if (nrow(clipped) == 0) {
    return(clipped)
  }

  clipped <- clipped[!sf::st_is_empty(clipped), , drop = FALSE]
  clipped
}

layer_metadata_from_sf <- function(x) {
  geometry_col <- attr(x, "sf_column")
  fields_df <- sf::st_drop_geometry(x)
  bbox <- sf::st_bbox(x)
  list(
    feature_count = nrow(x),
    geometry_type = unique(as.character(sf::st_geometry_type(x, by_geometry = TRUE))),
    fields = setdiff(names(x), geometry_col),
    field_info = field_descriptors(fields_df),
    bbox = stats::setNames(as.list(unname(bbox)), names(bbox))
  )
}

field_descriptors <- function(data) {
  if (is.null(data) || !ncol(data)) return(list())
  lapply(names(data), function(name) {
    list(
      name = name,
      type = paste(class(data[[name]]), collapse = ", ")
    )
  })
}

preview_rows <- function(data, limit = 5) {
  if (is.null(data) || !nrow(data)) return(list())
  preview <- utils::head(data, limit)
  preview[] <- lapply(preview, function(column) {
    values <- as.character(column)
    values[is.na(values)] <- ""
    values
  })
  jsonlite::fromJSON(jsonlite::toJSON(preview, dataframe = "rows", auto_unbox = TRUE), simplifyVector = FALSE)
}

normalize_character_vector <- function(x) {
  if (is.null(x)) return(character())
  values <- unlist(x, use.names = FALSE)
  values <- as.character(values)
  values[!is.na(values) & nzchar(values)]
}

select_sf_fields <- function(x, selected_fields = NULL, mandatory_fields = character()) {
  geometry_col <- attr(x, "sf_column")
  fields <- setdiff(names(x), geometry_col)
  selected_fields <- normalize_character_vector(selected_fields)
  mandatory_fields <- normalize_character_vector(mandatory_fields)
  if (is.null(selected_fields) || !length(selected_fields)) {
    return(x)
  }

  keep <- intersect(unique(c(mandatory_fields, selected_fields)), fields)
  x[, c(keep, geometry_col), drop = FALSE]
}

detect_csv_coordinates <- function(data) {
  lower_names <- tolower(names(data))
  lon_index <- match(TRUE, lower_names %in% c("lon", "lng", "long", "longitude", "x"))
  lat_index <- match(TRUE, lower_names %in% c("lat", "latitude", "y"))
  if (!is.na(lon_index) && !is.na(lat_index)) {
    return(list(
      mode = "xy",
      x = names(data)[lon_index],
      y = names(data)[lat_index]
    ))
  }

  mgrs_regex <- "^[0-9]{1,2}[C-HJ-NP-X][A-HJ-NP-Z][A-HJ-NP-V][0-9]{0,10}$"
  looks_like_mgrs <- function(values) {
    values <- toupper(trimws(as.character(values)))
    values <- values[nzchar(values)]
    if (!length(values)) return(FALSE)
    matches <- grepl(mgrs_regex, gsub("\\s+", "", values))
    mean(matches) >= 0.7
  }

  full_mgrs_idx <- which(vapply(data, looks_like_mgrs, logical(1)))
  if (length(full_mgrs_idx)) {
    return(list(
      mode = "mgrs",
      field = names(data)[full_mgrs_idx[[1]]]
    ))
  }

  zone_idx <- match(TRUE, lower_names %in% c("zone", "zona", "huso", "utm_zone", "mgrs_zone"))
  cell_idx <- match(TRUE, lower_names %in% c("cell", "celda", "grid", "mgrs", "utm_codigo", "utm_code"))
  if (!is.na(zone_idx) && !is.na(cell_idx)) {
    combined <- paste0(as.character(data[[zone_idx]]), as.character(data[[cell_idx]]))
    if (looks_like_mgrs(combined)) {
      return(list(
        mode = "mgrs",
        zone_field = names(data)[zone_idx],
        cell_field = names(data)[cell_idx]
      ))
    }
  }

  list(
    mode = NULL,
    x = NULL,
    y = NULL
  )
}

mgrs_band_min_lat <- function(band) {
  bands <- c("C","D","E","F","G","H","J","K","L","M","N","P","Q","R","S","T","U","V","W","X")
  mins <- c(-80,-72,-64,-56,-48,-40,-32,-24,-16,-8,0,8,16,24,32,40,48,56,64,72)
  idx <- match(toupper(band), bands)
  if (is.na(idx)) stop("Banda MGRS no vÃ¡lida.")
  mins[[idx]]
}

mgrs_epsg <- function(zone, band) {
  if (toupper(band) >= "N") 32600 + zone else 32700 + zone
}

mgrs_column_letters <- function(zone) {
  sets <- list(
    c("A", "B", "C", "D", "E", "F", "G", "H"),
    c("J", "K", "L", "M", "N", "P", "Q", "R"),
    c("S", "T", "U", "V", "W", "X", "Y", "Z")
  )
  sets[[((zone - 1) %% 3) + 1]]
}

mgrs_row_letters <- function(zone) {
  if ((zone %% 2) == 1) {
    c("A","B","C","D","E","F","G","H","J","K","L","M","N","P","Q","R","S","T","U","V")
  } else {
    c("F","G","H","J","K","L","M","N","P","Q","R","S","T","U","V","A","B","C","D","E")
  }
}

mgrs_parse_code <- function(code) {
  value <- toupper(gsub("\\s+", "", trimws(as.character(code %||% ""))))
  parts <- regexec("^([0-9]{1,2})([C-HJ-NP-X])([A-HJ-NP-Z])([A-HJ-NP-V])([0-9]{0,10})$", value)
  match <- regmatches(value, parts)[[1]]
  if (!length(match)) return(NULL)
  digits <- match[[6]]
  if ((nchar(digits) %% 2) == 1) return(NULL)
  precision <- nchar(digits) / 2
  easting_part <- if (precision) substr(digits, 1, precision) else ""
  northing_part <- if (precision) substr(digits, precision + 1, nchar(digits)) else ""
  list(
    code = value,
    zone = as.integer(match[[2]]),
    band = match[[3]],
    column = match[[4]],
    row = match[[5]],
    precision = precision,
    easting_part = easting_part,
    northing_part = northing_part
  )
}

mgrs_to_utm_bbox <- function(code) {
  parsed <- mgrs_parse_code(code)
  if (is.null(parsed)) return(NULL)

  col_idx <- match(parsed$column, mgrs_column_letters(parsed$zone))
  row_idx <- match(parsed$row, mgrs_row_letters(parsed$zone))
  if (is.na(col_idx) || is.na(row_idx)) return(NULL)

  resolution <- 10^(5 - parsed$precision)
  easting_offset <- if (parsed$precision) as.numeric(parsed$easting_part) * resolution else 0
  northing_offset <- if (parsed$precision) as.numeric(parsed$northing_part) * resolution else 0
  easting <- col_idx * 100000 + easting_offset
  northing <- (row_idx - 1) * 100000 + northing_offset

  central_lon <- (parsed$zone - 1) * 6 - 180 + 3
  min_lat <- mgrs_band_min_lat(parsed$band)
  epsg <- mgrs_epsg(parsed$zone, parsed$band)
  utm_crs <- sf::st_crs(epsg)
  min_point <- sf::st_sfc(sf::st_point(c(central_lon, min_lat + 0.01)), crs = 4326)
  min_northing <- sf::st_coordinates(sf::st_transform(min_point, utm_crs))[1, "Y"]
  while (northing < min_northing) northing <- northing + 2000000

  list(
    xmin = easting,
    ymin = northing,
    xmax = easting + resolution,
    ymax = northing + resolution,
    epsg = epsg
  )
}

mgrs_rows_to_sf <- function(data, coords) {
  codes <- if (!is.null(coords$field)) {
    data[[coords$field]]
  } else if (!is.null(coords$zone_field) && !is.null(coords$cell_field)) {
    paste0(as.character(data[[coords$zone_field]]), as.character(data[[coords$cell_field]]))
  } else {
    character()
  }

  boxes <- lapply(codes, mgrs_to_utm_bbox)
  valid <- vapply(boxes, function(item) !is.null(item), logical(1))
  if (!any(valid)) {
    stop("No se pudieron convertir los cÃ³digos UTM/MGRS del CSV.", call. = FALSE)
  }

  data <- data[valid, , drop = FALSE]
  boxes <- boxes[valid]
  geoms <- lapply(boxes, function(bbox) {
    matrix(c(
      bbox$xmin, bbox$ymin,
      bbox$xmax, bbox$ymin,
      bbox$xmax, bbox$ymax,
      bbox$xmin, bbox$ymax,
      bbox$xmin, bbox$ymin
    ), ncol = 2, byrow = TRUE)
  })

  epsg <- boxes[[1]]$epsg
  sfc <- sf::st_sfc(lapply(geoms, function(coords) sf::st_polygon(list(coords))), crs = sf::st_crs(epsg))
  sf::st_transform(sf::st_sf(data, geometry = sfc), 4326)
}

normalize_join_token <- function(values) {
  values <- as.character(values)
  values <- trimws(values)
  values <- values[nzchar(values)]
  values <- iconv(values, to = "ASCII//TRANSLIT", sub = "")
  values <- tolower(values)
  values <- gsub("[^a-z0-9]+", " ", values)
  values <- gsub("\\s+", " ", values)
  trimws(values)
}

detect_csv_join_candidates <- function(data) {
  if (is.null(data) || !nrow(data) || !ncol(data)) return(list())

  reference_sets <- list(
    list(
      target = "ccaa",
      target_field = "autonomous_community",
      values = unique(normalize_join_token(plan_shapes$autonomous_community))
    ),
    list(
      target = "provinces",
      target_field = "province",
      values = unique(normalize_join_token(unique(plan_data$province)))
    )
  )

  candidates <- list()
  for (field_name in names(data)) {
    field_values <- unique(normalize_join_token(data[[field_name]]))
    field_values <- field_values[nzchar(field_values)]
    if (!length(field_values)) next

    for (reference in reference_sets) {
      matches <- intersect(field_values, reference$values)
      score <- if (length(field_values)) length(matches) / length(field_values) else 0
      if (length(matches) == 0) next
      candidates[[length(candidates) + 1]] <- list(
        field = field_name,
        target = reference$target,
        target_field = reference$target_field,
        match_count = length(matches),
        sample_size = length(field_values),
        score = round(score, 4)
      )
    }
  }

  if (!length(candidates)) return(list())
  candidates[order(vapply(candidates, function(item) item$score, numeric(1)), decreasing = TRUE)]
}

decode_data_url <- function(value) {
  if (is.null(value) || !nzchar(value)) {
    stop("No se ha recibido el fichero raster.", call. = FALSE)
  }
  sub("^data:.*;base64,", "", value)
}

raster_resample_method <- function(raster) {
  values <- terra::values(raster, mat = TRUE)
  finite_values <- values[is.finite(values)]
  if (!length(finite_values)) {
    return("bilinear")
  }

  sample_values <- unique(utils::head(finite_values, 512))
  looks_integer <- all(abs(sample_values - round(sample_values)) < 1e-9)
  if (looks_integer && length(sample_values) <= 32) "near" else "bilinear"
}

raw_response <- function(body, content_type = "application/octet-stream", status = 200) {
  list(
    status = status,
    headers = list(
      "Content-Type" = content_type,
      "Cache-Control" = "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma" = "no-cache",
      "Expires" = "0"
    ),
    body = body
  )
}

download_response <- function(file_path, download_name, content_type = "application/octet-stream") {
  list(
    status = 200,
    headers = list(
      "Content-Type" = content_type,
      "Content-Disposition" = sprintf('attachment; filename="%s"', download_name),
      "Cache-Control" = "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma" = "no-cache",
      "Expires" = "0"
    ),
    body = readBin(file_path, "raw", n = file.info(file_path)$size)
  )
}

project_raster_for_display <- function(raster, target_crs = display_raster_crs, mask = peninsular_raster_mask) {
  if (is.na(terra::crs(raster)) || !nzchar(terra::crs(raster))) {
    stop("El GeoTIFF necesita un sistema de referencia espacial definido.", call. = FALSE)
  }

  projected <- if (isTRUE(terra::same.crs(raster, target_crs))) {
    raster
  } else {
    tryCatch({
      terra::project(raster, target_crs, method = raster_resample_method(raster))
    }, error = function(e) {
      stop("No se pudo reproyectar el raster al CRS de visualización: ", e$message, call. = FALSE)
    })
  }

  mask_vect <- terra::vect(sf::st_transform(mask, terra::crs(projected)))
  projected <- tryCatch({
    terra::mask(terra::crop(projected, mask_vect, snap = "out"), mask_vect)
  }, error = function(e) {
    stop("No se pudo ajustar el raster reproyectado a la España peninsular: ", e$message, call. = FALSE)
  })

  if (ncell(projected) == 0 || all(is.na(terra::values(projected)))) {
    stop("El raster reproyectado no tiene datos dentro de la España peninsular.", call. = FALSE)
  }

  projected
}

raster_metadata <- function(r) {
  ext <- terra::ext(r)
  values <- terra::values(r, mat = TRUE)
  finite_values <- values[is.finite(values)]
  wgs84_coords <- raster_wgs84_coordinates(r)
  lon_values <- vapply(wgs84_coords, `[[`, numeric(1), 1)
  lat_values <- vapply(wgs84_coords, `[[`, numeric(1), 2)
  list(
    width = terra::ncol(r),
    height = terra::nrow(r),
    bands = terra::nlyr(r),
    crs = terra::crs(r),
    min = if (length(finite_values)) min(finite_values, na.rm = TRUE) else NULL,
    max = if (length(finite_values)) max(finite_values, na.rm = TRUE) else NULL,
    bounds_wgs84 = list(
      xmin = min(lon_values),
      ymin = min(lat_values),
      xmax = max(lon_values),
      ymax = max(lat_values)
    ),
    bbox = list(
      xmin = ext$xmin,
      ymin = ext$ymin,
      xmax = ext$xmax,
      ymax = ext$ymax
    )
  )
}

raster_wgs84_coordinates <- function(raster) {
  ext <- terra::ext(raster)
  corners <- data.frame(
    x = c(ext$xmin, ext$xmax, ext$xmax, ext$xmin),
    y = c(ext$ymax, ext$ymax, ext$ymin, ext$ymin)
  )
  corners_sf <- sf::st_as_sf(corners, coords = c("x", "y"), crs = terra::crs(raster))
  corners_wgs84 <- sf::st_transform(corners_sf, 4326)
  coords <- sf::st_coordinates(corners_wgs84)
  unname(
    split(data.frame(lon = coords[, "X"], lat = coords[, "Y"]), seq_len(nrow(coords))) |>
      lapply(function(row) c(unname(row$lon), unname(row$lat)))
  )
}

clip_raster_to_peninsula <- function(input_path, output_path, mask = peninsular_raster_mask) {
  raster <- terra::rast(input_path)
  if (is.na(terra::crs(raster)) || !nzchar(terra::crs(raster))) {
    stop("El GeoTIFF necesita un sistema de referencia espacial definido.", call. = FALSE)
  }

  mask_vect <- terra::vect(sf::st_transform(mask, terra::crs(raster)))
  cropped <- tryCatch({
    terra::mask(terra::crop(raster, mask_vect, snap = "out"), mask_vect)
  }, error = function(e) {
    stop("No se pudo recortar el raster a la España peninsular: ", e$message, call. = FALSE)
  })

  if (ncell(cropped) == 0 || all(is.na(terra::values(cropped)))) {
    stop("El raster no tiene datos dentro de la España peninsular.", call. = FALSE)
  }

  projected <- project_raster_for_display(cropped, display_raster_crs, peninsular_raster_mask)
  terra::writeRaster(projected, output_path, overwrite = TRUE)
  projected
}

normalize_band <- function(values) {
  finite <- is.finite(values)
  if (!any(finite)) {
    return(rep(0, length(values)))
  }
  min_value <- min(values[finite], na.rm = TRUE)
  max_value <- max(values[finite], na.rm = TRUE)
  span <- if (max_value > min_value) max_value - min_value else 1
  out <- rep(0, length(values))
  out[finite] <- pmin(1, pmax(0, (values[finite] - min_value) / span))
  out
}

normalize_band_with_range <- function(values, min_value = NULL, max_value = NULL) {
  finite <- is.finite(values)
  if (!any(finite)) {
    return(rep(0, length(values)))
  }

  if (!is.finite(min_value)) min_value <- min(values[finite], na.rm = TRUE)
  if (!is.finite(max_value)) max_value <- max(values[finite], na.rm = TRUE)
  span <- if (max_value > min_value) max_value - min_value else 1
  out <- rep(0, length(values))
  out[finite] <- pmin(1, pmax(0, (values[finite] - min_value) / span))
  out
}

raster_png_data_url <- function(raster) {
  preview <- raster
  max_dim <- 1200
  fact <- max(1, ceiling(max(terra::ncol(preview), terra::nrow(preview)) / max_dim))
  if (fact > 1) {
    preview <- terra::aggregate(preview, fact = fact, fun = mean, na.rm = TRUE)
  }

  values <- terra::values(preview, mat = TRUE)
  rows <- terra::nrow(preview)
  cols <- terra::ncol(preview)

  if (terra::nlyr(preview) >= 3) {
    r <- matrix(normalize_band(values[, 1]), nrow = rows, ncol = cols, byrow = TRUE)
    g <- matrix(normalize_band(values[, 2]), nrow = rows, ncol = cols, byrow = TRUE)
    b <- matrix(normalize_band(values[, 3]), nrow = rows, ncol = cols, byrow = TRUE)
    a <- matrix(ifelse(is.finite(values[, 1]) & is.finite(values[, 2]) & is.finite(values[, 3]), 0.92, 0), nrow = rows, ncol = cols, byrow = TRUE)
  } else {
    band <- normalize_band(values[, 1])
    r <- matrix(band, nrow = rows, ncol = cols, byrow = TRUE)
    g <- matrix(pmin(1, 0.47 + band * 0.35), nrow = rows, ncol = cols, byrow = TRUE)
    b <- matrix(1 - band, nrow = rows, ncol = cols, byrow = TRUE)
    a <- matrix(ifelse(is.finite(values[, 1]), 0.88, 0), nrow = rows, ncol = cols, byrow = TRUE)
  }

  rgba <- array(0, dim = c(rows, cols, 4))
  rgba[, , 1] <- r
  rgba[, , 2] <- g
  rgba[, , 3] <- b
  rgba[, , 4] <- a

  png_path <- tempfile(fileext = ".png")
  png::writePNG(rgba, png_path)
  paste0("data:image/png;base64,", base64enc::base64encode(png_path))
}

raster_png_raw <- function(raster, min_value = NULL, max_value = NULL) {
  preview <- raster
  values <- terra::values(preview, mat = TRUE)
  rows <- terra::nrow(preview)
  cols <- terra::ncol(preview)

  if (!length(values) || ncell(preview) == 0 || all(is.na(values))) {
    rgba <- array(0, dim = c(rows, cols, 4))
  } else if (terra::nlyr(preview) >= 3) {
    r <- matrix(normalize_band_with_range(values[, 1], min_value, max_value), nrow = rows, ncol = cols, byrow = TRUE)
    g <- matrix(normalize_band_with_range(values[, 2], min_value, max_value), nrow = rows, ncol = cols, byrow = TRUE)
    b <- matrix(normalize_band_with_range(values[, 3], min_value, max_value), nrow = rows, ncol = cols, byrow = TRUE)
    a <- matrix(ifelse(is.finite(values[, 1]) & is.finite(values[, 2]) & is.finite(values[, 3]), 0.92, 0), nrow = rows, ncol = cols, byrow = TRUE)
    rgba <- array(0, dim = c(rows, cols, 4))
    rgba[, , 1] <- r
    rgba[, , 2] <- g
    rgba[, , 3] <- b
    rgba[, , 4] <- a
  } else {
    band <- normalize_band_with_range(values[, 1], min_value, max_value)
    r <- matrix(band, nrow = rows, ncol = cols, byrow = TRUE)
    g <- matrix(pmin(1, 0.47 + band * 0.35), nrow = rows, ncol = cols, byrow = TRUE)
    b <- matrix(1 - band, nrow = rows, ncol = cols, byrow = TRUE)
    a <- matrix(ifelse(is.finite(values[, 1]), 0.88, 0), nrow = rows, ncol = cols, byrow = TRUE)
    rgba <- array(0, dim = c(rows, cols, 4))
    rgba[, , 1] <- r
    rgba[, , 2] <- g
    rgba[, , 3] <- b
    rgba[, , 4] <- a
  }

  png_path <- tempfile(fileext = ".png")
  png::writePNG(rgba, png_path)
  readBin(png_path, "raw", n = file.info(png_path)$size)
}

valid_data_mask <- function(raster) {
  mask <- raster[[1]]
  mask_values <- terra::values(mask)
  mask_values[is.finite(mask_values)] <- 1
  mask_values[!is.finite(mask_values)] <- NA_real_
  terra::values(mask) <- mask_values
  mask
}

xyz_tile_extent <- function(z, x, y) {
  world_span <- web_mercator_limit * 2
  tiles_per_axis <- 2^z
  tile_span <- world_span / tiles_per_axis
  xmin <- -web_mercator_limit + x * tile_span
  xmax <- xmin + tile_span
  ymax <- web_mercator_limit - y * tile_span
  ymin <- ymax - tile_span
  terra::ext(xmin, xmax, ymin, ymax)
}

raster_tile_payload <- function(file_path, z, x, y) {
  raster <- terra::rast(file_path)
  if (!isTRUE(terra::same.crs(raster, display_raster_crs))) {
    raster <- project_raster_for_display(raster, display_raster_crs, peninsular_raster_mask)
  }
  metadata <- raster_metadata(raster)

  tile_ext <- xyz_tile_extent(z, x, y)
  raster_ext <- terra::ext(raster)
  intersects <- !(tile_ext$xmax <= raster_ext$xmin || tile_ext$xmin >= raster_ext$xmax || tile_ext$ymax <= raster_ext$ymin || tile_ext$ymin >= raster_ext$ymax)

  tile_template <- terra::rast(tile_ext, ncols = raster_tile_size, nrows = raster_tile_size, crs = display_raster_crs)

  if (!intersects) {
    return(raster_png_raw(tile_template, metadata$min, metadata$max))
  }

  resample_method <- "near"
  sampled <- tryCatch({
    terra::resample(raster, tile_template, method = resample_method)
  }, error = function(e) {
    terra::project(raster, tile_template, method = resample_method)
  })

  mask_tile <- terra::resample(valid_data_mask(raster), tile_template, method = "near")
  sampled <- terra::mask(sampled, mask_tile)

  raster_png_raw(sampled, metadata$min, metadata$max)
}

raster_preview_payload <- function(file_path) {
  raster <- terra::rast(file_path)
  if (!isTRUE(terra::same.crs(raster, display_raster_crs))) {
    raster <- project_raster_for_display(raster, display_raster_crs, peninsular_raster_mask)
  }
  list(
    image = raster_png_data_url(raster),
    coordinates = raster_wgs84_coordinates(raster),
    metadata = raster_metadata(raster)
  )
}

raster_point_payload <- function(file_path, lng, lat) {
  raster <- terra::rast(file_path)
  if (!isTRUE(terra::same.crs(raster, display_raster_crs))) {
    raster <- project_raster_for_display(raster, display_raster_crs, peninsular_raster_mask)
  }

  point_sf <- sf::st_as_sf(data.frame(lng = lng, lat = lat), coords = c("lng", "lat"), crs = 4326)
  point_projected <- sf::st_transform(point_sf, display_raster_crs)
  coords <- sf::st_coordinates(point_projected)
  values <- terra::extract(raster, matrix(c(coords[1, 1], coords[1, 2]), ncol = 2))
  if (is.null(values) || !nrow(values)) {
    return(list(ok = TRUE, values = list()))
  }

  band_values <- values[1, setdiff(names(values), "ID"), drop = FALSE]
  list(
    ok = TRUE,
    values = lapply(seq_along(band_values), function(i) {
      list(
        band = i,
        label = names(band_values)[[i]] %||% paste("Banda", i),
        value = if (is.na(band_values[[i]])) NULL else unname(band_values[[i]])
      )
    })
  )
}

base_geojson <- function(metric = "abundance_index") {
  if (!metric %in% names(plan_data)) {
    metric <- "abundance_index"
  }

  community_data <- plan_data |>
    group_by(autonomous_community) |>
    summarise(value = mean(.data[[metric]], na.rm = TRUE), .groups = "drop")

  data <- plan_shapes |>
    left_join(community_data, by = "autonomous_community") |>
    mutate(value = tidyr::replace_na(value, 0))

  sf_to_geojson(data)
}

province_geojson <- function(metric = "abundance_index") {
  if (!metric %in% names(plan_data)) {
    metric <- "abundance_index"
  }

  province_data <- plan_data |>
    group_by(province, autonomous_community, longitude, latitude) |>
    summarise(value = mean(.data[[metric]], na.rm = TRUE), .groups = "drop")

  points <- sf::st_as_sf(province_data, coords = c("longitude", "latitude"), crs = 4326, remove = FALSE)
  points_3857 <- sf::st_transform(points, 3857)
  outline <- sf::st_union(sf::st_transform(plan_shapes, 3857))

  polygons <- tryCatch({
    voronoi <- sf::st_voronoi(sf::st_union(sf::st_geometry(points_3857)), envelope = outline)
    cells <- sf::st_collection_extract(voronoi, "POLYGON")
    cells_sf <- sf::st_sf(geometry = cells, crs = sf::st_crs(points_3857))
    cells_sf <- cells_sf[seq_len(min(nrow(cells_sf), nrow(points_3857))), , drop = FALSE]
    cells_sf <- cbind(sf::st_drop_geometry(points_3857[seq_len(nrow(cells_sf)), ]), cells_sf)
    suppressWarnings(sf::st_intersection(cells_sf, sf::st_sf(geometry = outline)))
  }, error = function(e) {
    buffers <- sf::st_buffer(points_3857, dist = 45000)
    suppressWarnings(sf::st_intersection(buffers, sf::st_sf(geometry = outline)))
  })

  polygons <- sf::st_transform(polygons, 4326) |>
    select(province, autonomous_community, value, geometry)

  sf_to_geojson(polygons)
}

csv_to_sf <- function(rows) {
  data <- dplyr::bind_rows(rows)
  coords <- detect_csv_coordinates(data)
  if (identical(coords$mode, "mgrs")) {
    return(mgrs_rows_to_sf(data, coords))
  }
  if (!identical(coords$mode, "xy") || is.null(coords$x) || is.null(coords$y)) {
    stop("El CSV necesita columnas lon/lat, lng/lat, longitude/latitude o x/y, o bien celdas UTM/MGRS reconocibles.")
  }
  data[[coords$x]] <- as.numeric(data[[coords$x]])
  data[[coords$y]] <- as.numeric(data[[coords$y]])
  data <- data[!is.na(data[[coords$x]]) & !is.na(data[[coords$y]]), , drop = FALSE]
  sf::st_as_sf(data, coords = c(coords$x, coords$y), crs = 4326, remove = FALSE)
}

decode_base64_file <- function(data_url, file_name = "") {
  ext <- tools::file_ext(file_name %||% "")
  path <- tempfile(fileext = if (nzchar(ext)) paste0(".", ext) else "")
  writeBin(base64enc::base64decode(decode_data_url(data_url)), path)
  path
}

read_shapefile_zip <- function(archive) {
  if (is.null(archive$base64) || is.null(archive$file_name)) {
    stop("El shapefile ZIP necesita el archivo comprimido original.", call. = FALSE)
  }

  zip_path <- decode_base64_file(archive$base64, archive$file_name)
  unzip_dir <- tempfile(pattern = "plancaza_shp_")
  dir.create(unzip_dir, recursive = TRUE, showWarnings = FALSE)
  utils::unzip(zip_path, exdir = unzip_dir)
  shp_files <- list.files(unzip_dir, pattern = "\\.shp$", recursive = TRUE, full.names = TRUE, ignore.case = TRUE)

  if (length(shp_files) == 0) {
    stop("El ZIP no contiene ningÃºn archivo .shp.", call. = FALSE)
  }
  if (length(shp_files) > 1) {
    stop("El ZIP contiene varios shapefiles. Deja solo uno por subida.", call. = FALSE)
  }

  sf::st_read(shp_files[[1]], quiet = TRUE, options = "ENCODING=UTF-8")
}

province_base_sf <- function() {
  geojson_to_sf(province_geojson("abundance_index"))
}

csv_join_to_sf <- function(rows, join) {
  target <- tolower(join$target %||% "ccaa")
  csv_field <- join$csv_field %||% ""
  target_field <- join$target_field %||% if (identical(target, "provinces")) "province" else "autonomous_community"

  if (!nzchar(csv_field)) {
    stop("Falta el campo del CSV para la uniÃ³n.", call. = FALSE)
  }

  data <- dplyr::bind_rows(rows)
  if (!csv_field %in% names(data)) {
    stop("El campo seleccionado no existe en el CSV.", call. = FALSE)
  }

  base <- if (identical(target, "provinces")) province_base_sf() else plan_shapes
  if (!target_field %in% names(base)) {
    stop("La capa base no tiene el campo de uniÃ³n esperado.", call. = FALSE)
  }

  data[[csv_field]] <- trimws(as.character(data[[csv_field]]))
  data <- data[nzchar(data[[csv_field]]), , drop = FALSE]
  data <- data |> distinct(.data[[csv_field]], .keep_all = TRUE)
  names(data)[names(data) == csv_field] <- target_field
  data[[target_field]] <- trimws(as.character(data[[target_field]]))
  joined_columns <- setdiff(names(data), target_field)
  if (length(joined_columns) == 0) {
    stop("El CSV solo contiene el campo de uniÃ³n y ningÃºn atributo adicional.", call. = FALSE)
  }

  joined <- base |>
    left_join(data, by = target_field)

  joined <- joined[rowSums(!is.na(sf::st_drop_geometry(joined)[, joined_columns, drop = FALSE])) > 0, , drop = FALSE]
  if (nrow(joined) == 0) {
    stop("No hubo coincidencias entre el CSV y la capa base seleccionada.", call. = FALSE)
  }

  joined
}

inspect_sf_source <- function(x, source_format) {
  fields_df <- sf::st_drop_geometry(x)
  list(
    source_format = source_format,
    detected_type = "vector",
    geometry_type = unique(as.character(sf::st_geometry_type(x, by_geometry = TRUE))),
    feature_count = nrow(x),
    field_count = ncol(fields_df),
    fields = field_descriptors(fields_df),
    preview_rows = preview_rows(fields_df),
    crs = if (!is.na(sf::st_crs(x))) sf::st_crs(x)$input %||% sf::st_crs(x)$wkt else NULL
  )
}

inspect_csv_source <- function(rows, source_format) {
  data <- dplyr::bind_rows(rows)
  list(
    source_format = source_format,
    detected_type = "table",
    row_count = nrow(data),
    field_count = ncol(data),
    fields = field_descriptors(data),
    preview_rows = preview_rows(data),
    coordinate_candidates = detect_csv_coordinates(data),
    join_candidates = detect_csv_join_candidates(data)
  )
}

inspect_raster_source <- function(raster) {
  temp_input <- tempfile(fileext = paste0(".", tools::file_ext(raster$file_name %||% "tif")))
  writeBin(base64enc::base64decode(decode_data_url(raster$base64)), temp_input)
  rast <- terra::rast(temp_input)
  metadata <- raster_metadata(rast)
  resolution_x <- if (isTRUE(metadata$width > 0)) abs((metadata$bbox$xmax - metadata$bbox$xmin) / metadata$width) else NULL
  resolution_y <- if (isTRUE(metadata$height > 0)) abs((metadata$bbox$ymax - metadata$bbox$ymin) / metadata$height) else NULL
  list(
    source_format = "geotiff",
    detected_type = "raster",
    width = metadata$width,
    height = metadata$height,
    bands = metadata$bands,
    crs = metadata$crs,
    bbox = metadata$bbox,
    resolution_x = resolution_x,
    resolution_y = resolution_y
  )
}

inspect_frontend_layer <- function(payload) {
  layer_type <- payload$type %||% "geojson"
  source_format <- payload$source_format %||% if (identical(layer_type, "csv")) "csv_points" else layer_type

  inspection <- if (identical(layer_type, "raster")) {
    inspect_raster_source(payload$raster)
  } else if (identical(source_format, "shapefile_zip")) {
    inspect_sf_source(read_shapefile_zip(payload$archive), source_format)
  } else if (identical(source_format, "csv_join")) {
    inspect_csv_source(payload$rows, source_format)
  } else if (identical(layer_type, "csv")) {
    inspect_csv_source(payload$rows, source_format)
  } else {
    inspect_sf_source(geojson_to_sf(payload$geojson %||% ""), source_format)
  }

  list(ok = TRUE, inspection = inspection)
}

save_frontend_layer <- function(payload, role = "admin") {
  layers <- read_manifest()
  role <- normalize_role(role)
  name <- trimws(payload$name %||% "")
  if (!nzchar(name)) {
    stop("La capa necesita un nombre.")
  }

  target <- if (identical(role, "admin")) normalize_target(payload$target, "admin") else role
  owner <- if (identical(role, "admin")) "admin" else role
  audience <- switch(target,
    admin = c("admin", "mapa", "cca"),
    mapa = "mapa",
    cca = "cca",
    both = c("mapa", "cca"),
    role
  )
  scope <- if (identical(owner, "admin")) "shared" else "private"
  folder <- target_folder(owner, target)

  layers <- lapply(layers, normalize_layer)
  existing <- which(tolower(vapply(layers, function(layer) layer$name, character(1))) == tolower(name))
  overwrite <- isTRUE(payload$overwrite)
  if (length(existing) > 0 && !overwrite) {
    return(list(ok = FALSE, exists = TRUE, message = "Ya existe una capa con ese nombre."))
  }

  if (length(existing) > 0) {
    for (idx in rev(existing)) {
      old_path <- layer_file_path(layers[[idx]])
      if (file.exists(old_path)) unlink(old_path)
      layers <- layers[-idx]
    }
  }

  id <- safe_id(name)
  layer_type <- payload$type %||% "geojson"
  source_format <- payload$source_format %||% if (identical(layer_type, "csv")) "csv_points" else layer_type
  file_name <- paste0(id, if (identical(layer_type, "raster")) ".tif" else ".geojson")
  relative_file <- file.path(folder, file_name)
  absolute_file <- file.path(layer_root, relative_file)
  dir.create(dirname(absolute_file), showWarnings = FALSE, recursive = TRUE)
  geojson <- payload$geojson
  layer_metadata <- NULL
  clip_applied <- FALSE
  clip_profile <- NULL
  selected_fields <- payload$selected_fields %||% NULL
  display_field <- normalize_character_vector(payload$display_field %||% NULL)
  display_field <- if (length(display_field)) display_field[[1]] else NULL
  if (identical(layer_type, "csv")) {
    sf_data <- csv_to_sf(payload$rows)
    sf_data <- select_sf_fields(sf_data, selected_fields)
    sf_data <- clip_sf_to_peninsula(sf_data)
    if (nrow(sf_data) == 0) {
      stop("La capa no tiene entidades dentro de la España peninsular.", call. = FALSE)
    }
    layer_metadata <- layer_metadata_from_sf(sf_data)
    geojson <- sf_to_geojson(sf_data)
    clip_applied <- TRUE
    clip_profile <- paste0("espana_peninsular_buffer_", clip_buffer_m, "m")
  }
  if (identical(layer_type, "raster")) {
    raster <- payload$raster
    if (is.null(raster$base64) || is.null(raster$file_name)) {
      stop("El raster necesita el fichero GeoTIFF original.")
    }
    temp_input <- tempfile(fileext = paste0(".", tools::file_ext(raster$file_name %||% "tif")))
    writeBin(base64enc::base64decode(decode_data_url(raster$base64)), temp_input)
    clipped_raster <- clip_raster_to_peninsula(temp_input, absolute_file)
    layer_metadata <- raster_metadata(clipped_raster)
    clip_applied <- TRUE
    clip_profile <- paste0("espana_peninsular_buffer_", clip_buffer_m, "m")
  } else {
    if (identical(source_format, "shapefile_zip")) {
      sf_data <- read_shapefile_zip(payload$archive)
      sf_data <- select_sf_fields(sf_data, selected_fields)
      sf_data <- clip_sf_to_peninsula(sf_data)
      if (nrow(sf_data) == 0) {
        stop("La capa no tiene entidades dentro de la España peninsular.", call. = FALSE)
      }
      layer_metadata <- layer_metadata_from_sf(sf_data)
      geojson <- sf_to_geojson(sf_data)
      clip_applied <- TRUE
      clip_profile <- paste0("espana_peninsular_buffer_", clip_buffer_m, "m")
    }
    if (identical(source_format, "csv_join")) {
      sf_data <- csv_join_to_sf(payload$rows, payload$join %||% list())
      sf_data <- select_sf_fields(sf_data, selected_fields, mandatory_fields = payload$join$target_field %||% character())
      sf_data <- clip_sf_to_peninsula(sf_data)
      if (nrow(sf_data) == 0) {
        stop("La capa no tiene entidades dentro de la España peninsular.", call. = FALSE)
      }
      layer_metadata <- layer_metadata_from_sf(sf_data)
      geojson <- sf_to_geojson(sf_data)
      clip_applied <- TRUE
      clip_profile <- paste0("espana_peninsular_buffer_", clip_buffer_m, "m")
    }
    if (is.null(geojson) || !nzchar(geojson)) {
      stop("No se ha recibido geometria valida.")
    }
    if (identical(layer_type, "geojson") && identical(source_format, "geojson")) {
      sf_data <- geojson_to_sf(geojson)
      sf_data <- select_sf_fields(sf_data, selected_fields)
      sf_data <- clip_sf_to_peninsula(sf_data)
      if (nrow(sf_data) == 0) {
        stop("La capa no tiene entidades dentro de la España peninsular.", call. = FALSE)
      }
      layer_metadata <- layer_metadata_from_sf(sf_data)
      geojson <- sf_to_geojson(sf_data)
      clip_applied <- TRUE
      clip_profile <- paste0("espana_peninsular_buffer_", clip_buffer_m, "m")
    }
    writeBin(charToRaw(geojson), absolute_file)
  }
  new_layer <- list(
    id = id,
    name = name,
    type = layer_type,
    source_format = if (identical(layer_type, "raster")) "geotiff" else source_format,
    file = relative_file,
    owner = owner,
    scope = scope,
    target = target,
    audience = as.list(audience),
    visible = TRUE,
    opacity = payload$opacity %||% 0.65,
    scenario_national_enabled = isTRUE(payload$scenario_national_enabled),
    display_field = display_field,
    popup_fields = normalize_character_vector(selected_fields),
    order = 1,
    clipped = clip_applied,
    clip_profile = clip_profile,
    metadata = layer_metadata
  )

  layers <- c(list(new_layer), layers)
  for (i in seq_along(layers)) layers[[i]]$order <- i
  write_manifest(layers)
  list(ok = TRUE, layer = new_layer, layers = filter_layers_for_role(layers, role))
}

serve_static <- function(path) {
  rel <- sub("^/", "", path)
  if (!nzchar(rel)) rel <- "index.html"
  full_path <- normalizePath(file.path(frontend_dir, rel), winslash = "/", mustWork = FALSE)
  root <- normalizePath(frontend_dir, winslash = "/", mustWork = TRUE)
  if (!startsWith(full_path, root) || !file.exists(full_path)) {
    full_path <- file.path(frontend_dir, "index.html")
  }
  ext <- tolower(tools::file_ext(full_path))
  type <- switch(ext, html = "text/html; charset=utf-8", css = "text/css; charset=utf-8", js = "application/javascript; charset=utf-8", json = "application/json; charset=utf-8", "application/octet-stream")
  list(
    status = 200,
    headers = list(
      "Content-Type" = type,
      "Cache-Control" = "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma" = "no-cache",
      "Expires" = "0"
    ),
    body = readBin(full_path, "raw", n = file.info(full_path)$size)
  )
}

app <- list(
  call = function(req) {
    path <- req$PATH_INFO
    if (nzchar(access_password) && !identical(path, "/api/health")) {
      expected <- paste0("Basic ", base64enc::base64encode(charToRaw(paste0("plancaza:", access_password))))
      if (!identical(req$HTTP_AUTHORIZATION, expected)) {
        return(list(status = 401L,
                    headers = list("WWW-Authenticate" = 'Basic realm="PLAN-CAZA", charset="UTF-8"',
                                   "Content-Type" = "text/plain; charset=utf-8", "Cache-Control" = "no-store"),
                    body = "Acceso restringido al prototipo PLAN-CAZA."))
      }
    }
    if (!is.null(req$REQUEST_URI) && grepl("^/api/", req$REQUEST_URI)) {
      path <- sub("\\?.*$", "", req$REQUEST_URI)
    }
    method <- req$REQUEST_METHOD
    route_role <- NULL
    if (grepl("^/api/(admin|mapa|cca)(/|$)", path)) {
      route_role <- sub("^/api/(admin|mapa|cca).*$", "\\1", path)
      path <- sub("^/api/(admin|mapa|cca)", "/api", path)
    }

    if (identical(method, "OPTIONS")) {
      return(json_response(list(ok = TRUE)))
    }
    if (identical(path, "/api/health")) {
      return(json_response(list(ok = TRUE, service = "PLAN-CAZA R backend")))
    }
    if (identical(path, "/api/base-layer/ccaa")) {
      return(text_response(base_geojson("abundance_index"), "application/geo+json; charset=utf-8"))
    }
    if (identical(path, "/api/base-layer/provinces")) {
      return(text_response(province_geojson("abundance_index"), "application/geo+json; charset=utf-8"))
    }
    if (identical(path, "/api/base-layer")) {
      params <- query_params(req)
      metric <- params$metric %||% "abundance_index"
      layer <- params$layer %||% "ccaa"
      data <- if (identical(layer, "provinces")) province_geojson(metric) else base_geojson(metric)
      return(text_response(data, "application/geo+json; charset=utf-8"))
    }
    if (identical(path, "/api/layers") && identical(method, "GET")) {
      role <- normalize_role(route_role %||% query_params(req)$role)
      return(json_response(list(role = role, layers = filter_layers_for_role(read_manifest(), role))))
    }
    if (identical(path, "/api/scenarios") && identical(method, "GET")) {
      params <- query_params(req)
      role <- normalize_role(route_role %||% params$role)
      scope <- tolower(params$scope %||% "national")
      scenarios <- scenarios_for_role(read_scenarios(), role, scope)
      return(json_response(list(ok = TRUE, role = role, scope = scope, scenarios = scenarios)))
    }
    if (identical(path, "/api/scenarios") && identical(method, "POST")) {
      payload <- fromJSON(read_body(req), simplifyVector = FALSE)
      role <- normalize_role(payload$role %||% route_role %||% query_params(req)$role)
      scope <- tolower(payload$scope %||% "national")
      scenarios <- read_scenarios()
      scenario_id <- payload$id %||% NULL
      now_utc <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      scenario_name <- trimws(as.character(payload$name %||% ""))
      if (!nzchar(scenario_name)) {
        scenario_name <- if (identical(scope, "national")) "Escenario nacional" else "Escenario"
      }
      role_scope_scenarios <- scenarios_for_role(scenarios, role, scope)
      if (nzchar(scenario_name)) {
        duplicate_name <- Filter(
          function(item) identical(tolower(item$name %||% ""), tolower(scenario_name)) && !identical(item$id, scenario_id %||% ""),
          role_scope_scenarios
        )
        if (length(duplicate_name)) {
          return(json_response(list(ok = FALSE, message = "Ya existe un escenario con ese nombre."), 400))
        }
      }
      config <- scenario_payload_from_state(payload$config %||% list())
      idx <- if (!is.null(scenario_id)) match(scenario_id, vapply(scenarios, function(item) item$id %||% "", character(1))) else NA_integer_
      if (!is.na(idx)) {
        current <- normalize_scenario(scenarios[[idx]], role)
        if (!identical(normalize_role(current$role), role)) {
          return(json_response(list(ok = FALSE, message = "No tienes permisos para editar este escenario."), 403))
        }
        scenarios[[idx]] <- normalize_scenario(modifyList(current, list(
          name = scenario_name,
          scope = scope,
          role = role,
          updated_at = now_utc,
          config = config
        )), role)
        scenario <- scenarios[[idx]]
      } else {
        scenario <- normalize_scenario(list(
          id = safe_id(paste(scope, "scenario")),
          name = scenario_name,
          scope = scope,
          role = role,
          created_at = now_utc,
          updated_at = now_utc,
          config = config
        ), role)
        scenarios <- c(list(scenario), scenarios)
      }
      write_scenarios(scenarios)
      return(json_response(list(
        ok = TRUE,
        scenario = scenario,
        scenarios = scenarios_for_role(scenarios, role, scope)
      )))
    }
    if (grepl("^/api/scenarios/[^/]+/duplicate$", path) && identical(method, "POST")) {
      id <- sub("^/api/scenarios/([^/]+)/duplicate$", "\\1", path)
      payload <- fromJSON(read_body(req), simplifyVector = FALSE)
      role <- normalize_role(payload$role %||% route_role %||% query_params(req)$role)
      scenarios <- read_scenarios()
      idx <- match(id, vapply(scenarios, function(item) item$id %||% "", character(1)))
      if (is.na(idx)) {
        return(json_response(list(ok = FALSE, message = "Escenario no encontrado."), 404))
      }
      source_scenario <- normalize_scenario(scenarios[[idx]], role)
      if (!identical(normalize_role(source_scenario$role), role)) {
        return(json_response(list(ok = FALSE, message = "No tienes permisos para duplicar este escenario."), 403))
      }
      scope <- source_scenario$scope %||% "national"
      existing_names <- vapply(scenarios_for_role(scenarios, role, scope), function(item) item$name %||% "", character(1))
      base_name <- trimws(as.character(payload$name %||% paste0(source_scenario$name %||% "Escenario", " copia")))
      candidate <- base_name
      counter <- 2
      while (candidate %in% existing_names) {
        candidate <- paste(base_name, counter)
        counter <- counter + 1
      }
      now_utc <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      duplicated <- normalize_scenario(list(
        id = safe_id(paste(scope, "scenario")),
        name = candidate,
        scope = scope,
        role = role,
        created_at = now_utc,
        updated_at = now_utc,
        config = source_scenario$config %||% list()
      ), role)
      scenarios <- c(list(duplicated), scenarios)
      write_scenarios(scenarios)
      return(json_response(list(
        ok = TRUE,
        scenario = duplicated,
        scenarios = scenarios_for_role(scenarios, role, scope)
      )))
    }
    if (grepl("^/api/scenarios/[^/]+$", path) && identical(method, "DELETE")) {
      id <- sub("^/api/scenarios/([^/]+)$", "\\1", path)
      params <- query_params(req)
      role <- normalize_role(route_role %||% params$role)
      scope <- tolower(params$scope %||% "national")
      scenarios <- read_scenarios()
      idx <- match(id, vapply(scenarios, function(item) item$id %||% "", character(1)))
      if (is.na(idx)) {
        return(json_response(list(ok = FALSE, message = "Escenario no encontrado."), 404))
      }
      current <- normalize_scenario(scenarios[[idx]], role)
      if (!identical(normalize_role(current$role), role)) {
        return(json_response(list(ok = FALSE, message = "No tienes permisos para eliminar este escenario."), 403))
      }
      scenarios <- scenarios[-idx]
      write_scenarios(scenarios)
      remaining <- scenarios_for_role(scenarios, role, scope)
      active_scenario_id <- if (length(remaining)) remaining[[1]]$id %||% NULL else NULL
      return(json_response(list(
        ok = TRUE,
        active_scenario_id = active_scenario_id,
        scenarios = remaining
      )))
    }
    if (identical(path, "/api/import/inspect") && identical(method, "POST")) {
      payload <- fromJSON(read_body(req), simplifyVector = FALSE)
      result <- tryCatch(inspect_frontend_layer(payload), error = function(e) list(ok = FALSE, message = e$message))
      return(json_response(result, if (isTRUE(result$ok)) 200 else 400))
    }
    if (identical(path, "/api/layers") && identical(method, "POST")) {
      payload <- fromJSON(read_body(req), simplifyVector = FALSE)
      role <- normalize_role(payload$role %||% route_role %||% query_params(req)$role)
      result <- tryCatch(save_frontend_layer(payload, role), error = function(e) list(ok = FALSE, message = e$message))
      return(json_response(result, if (isTRUE(result$ok)) 200 else 400))
    }
    if (identical(path, "/api/layers/reorder") && identical(method, "POST")) {
      payload <- fromJSON(read_body(req), simplifyVector = FALSE)
      ids <- payload$ids %||% character()
      role <- normalize_role(payload$role %||% route_role %||% query_params(req)$role)
      layers <- read_manifest()
      if (length(ids) > 0) {
        layer_by_id <- setNames(layers, vapply(layers, function(layer) layer$id, character(1)))
        reordered <- Filter(Negate(is.null), lapply(ids, function(id) layer_by_id[[id]]))
        reordered_ids <- vapply(reordered, function(layer) layer$id, character(1))
        remaining <- Filter(function(layer) !layer$id %in% reordered_ids, layers)
        layers <- c(reordered, remaining)
        for (i in seq_along(layers)) layers[[i]]$order <- i
        write_manifest(layers)
      }
      return(json_response(list(ok = TRUE, layers = filter_layers_for_role(layers, role))))
    }
    if (grepl("^/api/layers/[^/]+$", path) && identical(method, "DELETE")) {
      id <- sub("^/api/layers/", "", path)
      role <- normalize_role(route_role %||% query_params(req)$role)
      layers <- read_manifest()
      idx <- match(id, vapply(layers, function(layer) layer$id, character(1)))
      if (!is.na(idx)) {
        if (!can_edit_layer(layers[[idx]], role)) {
          return(json_response(list(ok = FALSE, message = "No tienes permisos para eliminar esta capa."), 403))
        }
        file_path <- layer_file_path(layers[[idx]])
        if (file.exists(file_path)) unlink(file_path)
        layers <- layers[-idx]
        for (i in seq_along(layers)) layers[[i]]$order <- i
        write_manifest(layers)
      }
      return(json_response(list(ok = TRUE, layers = filter_layers_for_role(layers, role))))
    }
    if (grepl("^/api/layers/[^/]+$", path) && identical(method, "POST")) {
      id <- sub("^/api/layers/", "", path)
      payload <- fromJSON(read_body(req), simplifyVector = FALSE)
      role <- normalize_role(payload$role %||% route_role %||% query_params(req)$role)
      layers <- read_manifest()
      idx <- match(id, vapply(layers, function(layer) layer$id, character(1)))
      if (!is.na(idx)) {
        if (!can_edit_layer(layers[[idx]], role)) {
          return(json_response(list(ok = FALSE, message = "No tienes permisos para editar esta capa."), 403))
        }
        if (!is.null(payload$visible)) layers[[idx]]$visible <- isTRUE(payload$visible)
        if (!is.null(payload$opacity)) layers[[idx]]$opacity <- as.numeric(payload$opacity)
        if (!is.null(payload$scenario_national_enabled)) layers[[idx]]$scenario_national_enabled <- isTRUE(payload$scenario_national_enabled)
        if ("display_field" %in% names(payload)) {
          display_field <- trimws(as.character(payload$display_field %||% ""))
          if (!nzchar(display_field)) {
            layers[[idx]]$display_field <- NULL
          } else {
            valid_fields <- vapply(layers[[idx]]$metadata$field_info %||% list(), function(item) item$name %||% "", character(1))
            if (!display_field %in% valid_fields) {
              return(json_response(list(ok = FALSE, message = "El campo de visualización no existe en esta capa."), 400))
            }
            layers[[idx]]$display_field <- display_field
          }
        }
        if (!is.null(payload$name)) {
          new_name <- trimws(as.character(payload$name))
          if (!nzchar(new_name)) {
            return(json_response(list(ok = FALSE, message = "El nombre de la capa no puede estar vacío."), 400))
          }
          layers[[idx]]$name <- new_name
        }
        write_manifest(layers)
      }
      return(json_response(list(ok = TRUE, layers = filter_layers_for_role(layers, role))))
    }
    if (grepl("^/api/layers/[^/]+/geojson$", path)) {
      id <- sub("^/api/layers/([^/]+)/geojson$", "\\1", path)
      layers <- read_manifest()
      idx <- match(id, vapply(layers, function(layer) layer$id, character(1)))
      if (is.na(idx)) return(json_response(list(error = "No encontrada"), 404))
      file_path <- layer_file_path(layers[[idx]])
      if (!file.exists(file_path)) return(json_response(list(error = "Sin archivo"), 404))
      return(text_response(paste(readLines(file_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n"), "application/geo+json; charset=utf-8"))
    }
    if (grepl("^/api/layers/[^/]+/tiles/[0-9]+/[0-9]+/[0-9]+\\.png$", path)) {
      parts <- strsplit(path, "/", fixed = TRUE)[[1]]
      id <- parts[[4]]
      z <- as.integer(parts[[6]])
      x <- as.integer(parts[[7]])
      y <- as.integer(sub("\\.png$", "", parts[[8]]))
      layers <- read_manifest()
      idx <- match(id, vapply(layers, function(layer) layer$id, character(1)))
      if (is.na(idx)) return(json_response(list(error = "No encontrada"), 404))
      if (!identical(layers[[idx]]$type, "raster")) return(json_response(list(error = "No es raster"), 400))
      file_path <- layer_file_path(layers[[idx]])
      if (!file.exists(file_path)) return(json_response(list(error = "Sin archivo"), 404))
      png_tile <- raster_tile_payload(file_path, z, x, y)
      return(raw_response(png_tile, "image/png"))
    }
    if (grepl("^/api/layers/[^/]+/data$", path)) {
      id <- sub("^/api/layers/([^/]+)/data$", "\\1", path)
      layers <- read_manifest()
      idx <- match(id, vapply(layers, function(layer) layer$id, character(1)))
      if (is.na(idx)) return(json_response(list(error = "No encontrada"), 404))
      file_path <- layer_file_path(layers[[idx]])
      if (!file.exists(file_path)) return(json_response(list(error = "Sin archivo"), 404))
      if (identical(layers[[idx]]$type, "raster")) {
        return(json_response(raster_preview_payload(file_path)))
      }
      return(text_response(paste(readLines(file_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n"), "application/geo+json; charset=utf-8"))
    }
    if (grepl("^/api/layers/[^/]+/value$", path)) {
      id <- sub("^/api/layers/([^/]+)/value$", "\\1", path)
      payload <- tryCatch(fromJSON(read_body(req)), error = function(e) list())
      lng <- suppressWarnings(as.numeric(as.character(payload$lng %||% NA)))
      lat <- suppressWarnings(as.numeric(as.character(payload$lat %||% NA)))
      if (!is.finite(lng) || !is.finite(lat)) return(json_response(list(error = "Coordenadas inválidas"), 400))
      layers <- read_manifest()
      idx <- match(id, vapply(layers, function(layer) layer$id, character(1)))
      if (is.na(idx)) return(json_response(list(error = "No encontrada"), 404))
      if (!identical(layers[[idx]]$type, "raster")) return(json_response(list(error = "No es raster"), 400))
      file_path <- layer_file_path(layers[[idx]])
      if (!file.exists(file_path)) return(json_response(list(error = "Sin archivo"), 404))
      return(json_response(raster_point_payload(file_path, lng, lat)))
    }
    if (grepl("^/api/layers/[^/]+/download\\.csv$", path)) {
      id <- sub("^/api/layers/([^/]+)/download\\.csv$", "\\1", path)
      layers <- read_manifest()
      idx <- match(id, vapply(layers, function(layer) layer$id, character(1)))
      if (is.na(idx)) return(json_response(list(error = "No encontrada"), 404))
      file_path <- layer_file_path(layers[[idx]])
      if (!file.exists(file_path)) return(json_response(list(error = "Sin archivo"), 404))
      if (identical(layers[[idx]]$type, "raster")) {
        return(json_response(list(error = "El raster no se puede descargar como CSV de atributos."), 400))
      }
      safe_name <- gsub("[^A-Za-z0-9_-]+", "_", layers[[idx]]$name %||% layers[[idx]]$id)
      data_sf <- sf::st_read(file_path, quiet = TRUE)
      data_df <- sf::st_drop_geometry(data_sf)
      csv_path <- tempfile(fileext = ".csv")
      utils::write.csv(data_df, csv_path, row.names = FALSE, na = "")
      return(download_response(csv_path, paste0(safe_name, ".csv"), "text/csv; charset=utf-8"))
    }
    if (grepl("^/api/layers/[^/]+/download$", path)) {
      id <- sub("^/api/layers/([^/]+)/download$", "\\1", path)
      layers <- read_manifest()
      idx <- match(id, vapply(layers, function(layer) layer$id, character(1)))
      if (is.na(idx)) return(json_response(list(error = "No encontrada"), 404))
      file_path <- layer_file_path(layers[[idx]])
      if (!file.exists(file_path)) return(json_response(list(error = "Sin archivo"), 404))
      safe_name <- gsub("[^A-Za-z0-9_-]+", "_", layers[[idx]]$name %||% layers[[idx]]$id)
      ext <- if (identical(layers[[idx]]$type, "raster")) ".tif" else ".geojson"
      content_type <- if (identical(layers[[idx]]$type, "raster")) "image/tiff" else "application/geo+json"
      return(download_response(file_path, paste0(safe_name, ext), content_type))
    }

    serve_static(path)
  }
)

port <- as.integer(Sys.getenv("PORT", Sys.getenv("PLANCAZA_PORT", "8080")))
host <- Sys.getenv("PLANCAZA_HOST", "127.0.0.1")
cat(sprintf("PLAN-CAZA MapLibre app: http://%s:%s\n", host, port))
httpuv::runServer(host, port, app)
