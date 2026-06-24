.libPaths(c(file.path(getwd(), ".Rlib"), .libPaths()))

library(httpuv)
library(jsonlite)
library(sf)
library(dplyr)

`%||%` <- function(x, y) {
  if (is.null(x)) y else x
}

source("R/plan_caza_data.R", encoding = "UTF-8")

plan_data <- load_plan_caza_data()
plan_shapes <- load_ccaa_shapes()

frontend_dir <- file.path(getwd(), "frontend")
layer_root <- file.path(getwd(), "data", "layers")
legacy_layer_dir <- file.path(getwd(), "data", "frontend_layers")
manifest_path <- file.path(layer_root, "manifest.json")

dir.create(layer_root, showWarnings = FALSE, recursive = TRUE)

json_response <- function(data, status = 200) {
  list(
    status = status,
    headers = list(
      "Content-Type" = "application/json; charset=utf-8",
      "Access-Control-Allow-Origin" = "*",
      "Access-Control-Allow-Headers" = "Content-Type",
      "Access-Control-Allow-Methods" = "GET, POST, DELETE, OPTIONS"
    ),
    body = toJSON(data, auto_unbox = TRUE, null = "null", digits = 8)
  )
}

text_response <- function(text, content_type = "text/plain; charset=utf-8", status = 200) {
  list(status = status, headers = list("Content-Type" = content_type), body = text)
}

read_body <- function(req) {
  raw <- req$rook.input$read()
  rawToChar(raw)
}

query_params <- function(req) {
  query <- req$QUERY_STRING %||% ""
  if (!nzchar(query) && !is.null(req$REQUEST_URI) && grepl("\\?", req$REQUEST_URI)) {
    query <- sub("^[^?]*\\?", "", req$REQUEST_URI)
  }
  if (!nzchar(query)) return(list())
  parts <- strsplit(query, "&", fixed = TRUE)[[1]]
  values <- lapply(parts, function(part) {
    item <- strsplit(part, "=", fixed = TRUE)[[1]]
    key <- URLdecode(item[[1]])
    value <- if (length(item) > 1) URLdecode(item[[2]]) else ""
    setNames(list(value), key)
  })
  do.call(c, values)
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

csv_to_geojson <- function(rows) {
  data <- as.data.frame(rows, stringsAsFactors = FALSE)
  lower_names <- tolower(names(data))
  lon_index <- match(TRUE, lower_names %in% c("lon", "lng", "long", "longitude", "x"))
  lat_index <- match(TRUE, lower_names %in% c("lat", "latitude", "y"))
  if (is.na(lon_index) || is.na(lat_index)) {
    stop("El CSV necesita columnas lon/lat, lng/lat, longitude/latitude o x/y.")
  }
  data[[lon_index]] <- as.numeric(data[[lon_index]])
  data[[lat_index]] <- as.numeric(data[[lat_index]])
  data <- data[!is.na(data[[lon_index]]) & !is.na(data[[lat_index]]), , drop = FALSE]
  sf_data <- sf::st_as_sf(data, coords = c(names(data)[lon_index], names(data)[lat_index]), crs = 4326, remove = FALSE)
  sf_to_geojson(sf_data)
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
  existing <- which(
    tolower(vapply(layers, function(layer) layer$name, character(1))) == tolower(name) &
      vapply(layers, function(layer) identical(layer$owner, owner) && identical(layer$target %||% layer$scope, target), logical(1))
  )
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
  file_name <- paste0(id, if (identical(layer_type, "raster")) ".json" else ".geojson")
  relative_file <- file.path(folder, file_name)
  absolute_file <- file.path(layer_root, relative_file)
  dir.create(dirname(absolute_file), showWarnings = FALSE, recursive = TRUE)
  geojson <- payload$geojson
  if (identical(layer_type, "csv")) {
    geojson <- csv_to_geojson(payload$rows)
  }
  if (identical(layer_type, "raster")) {
    raster <- payload$raster
    if (is.null(raster$image) || is.null(raster$coordinates)) {
      stop("El raster necesita imagen y coordenadas.")
    }
    writeBin(charToRaw(toJSON(raster, auto_unbox = TRUE, null = "null")), absolute_file)
  } else {
    if (is.null(geojson) || !nzchar(geojson)) {
      stop("No se ha recibido geometria valida.")
    }
    writeBin(charToRaw(geojson), absolute_file)
  }
  new_layer <- list(
    id = id,
    name = name,
    type = layer_type,
    file = relative_file,
    owner = owner,
    scope = scope,
    target = target,
    audience = as.list(audience),
    visible = TRUE,
    opacity = payload$opacity %||% 0.65,
    order = 1
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
  list(status = 200, headers = list("Content-Type" = type), body = readBin(full_path, "raw", n = file.info(full_path)$size))
}

app <- list(
  call = function(req) {
    path <- req$PATH_INFO
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
    if (grepl("^/api/layers/[^/]+/data$", path)) {
      id <- sub("^/api/layers/([^/]+)/data$", "\\1", path)
      layers <- read_manifest()
      idx <- match(id, vapply(layers, function(layer) layer$id, character(1)))
      if (is.na(idx)) return(json_response(list(error = "No encontrada"), 404))
      file_path <- layer_file_path(layers[[idx]])
      if (!file.exists(file_path)) return(json_response(list(error = "Sin archivo"), 404))
      content_type <- if (identical(layers[[idx]]$type, "raster")) "application/json; charset=utf-8" else "application/geo+json; charset=utf-8"
      return(text_response(paste(readLines(file_path, warn = FALSE, encoding = "UTF-8"), collapse = "\n"), content_type))
    }

    serve_static(path)
  }
)

port <- as.integer(Sys.getenv("PLANCAZA_PORT", "8080"))
cat(sprintf("PLAN-CAZA MapLibre app: http://127.0.0.1:%s\n", port))
httpuv::runServer("127.0.0.1", port, app)
