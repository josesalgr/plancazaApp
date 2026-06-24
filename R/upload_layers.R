uploaded_layer_id <- local({
  counter <- 0
  function() {
    counter <<- counter + 1
    paste0("layer_", counter)
  }
})

stored_layers_dir <- file.path("data", "uploaded_layers")

ensure_stored_layers_dir <- function() {
  dir.create(stored_layers_dir, showWarnings = FALSE, recursive = TRUE)
}

sanitize_layer_id <- function(name) {
  cleaned <- iconv(name, to = "ASCII//TRANSLIT", sub = "")
  cleaned <- tolower(gsub("[^a-zA-Z0-9]+", "_", cleaned))
  cleaned <- gsub("^_+|_+$", "", cleaned)
  if (!nzchar(cleaned)) {
    cleaned <- "layer"
  }
  paste0(cleaned, "_", format(Sys.time(), "%Y%m%d%H%M%S"), "_", sample(1000:9999, 1))
}

stored_layer_path <- function(id) {
  ensure_stored_layers_dir()
  file.path(stored_layers_dir, paste0(id, ".rds"))
}

load_stored_layers <- function() {
  ensure_stored_layers_dir()
  files <- list.files(stored_layers_dir, pattern = "\\.rds$", full.names = TRUE)
  layers <- lapply(files, function(path) {
    tryCatch(readRDS(path), error = function(e) NULL)
  })
  layers <- Filter(Negate(is.null), layers)
  layers[order(vapply(layers, function(layer) layer$order %||% 0, numeric(1)))]
}

save_stored_layer <- function(layer) {
  ensure_stored_layers_dir()
  saveRDS(layer, stored_layer_path(layer$id))
  invisible(layer)
}

save_stored_layers <- function(layers) {
  for (i in seq_along(layers)) {
    layers[[i]]$order <- i
    save_stored_layer(layers[[i]])
  }
  invisible(layers)
}

delete_stored_layer <- function(layer) {
  path <- stored_layer_path(layer$id)
  if (file.exists(path)) {
    unlink(path)
  }
  invisible(TRUE)
}

stored_layer_names <- function(layers) {
  tolower(trimws(vapply(layers, function(layer) layer$name, character(1))))
}

copy_uploaded_files <- function(files) {
  upload_dir <- tempfile("plancaza_upload_")
  dir.create(upload_dir)

  for (i in seq_len(nrow(files))) {
    file.copy(files$datapath[i], file.path(upload_dir, files$name[i]), overwrite = TRUE)
  }

  upload_dir
}

read_uploaded_csv <- function(path, display_name) {
  data <- read.csv(path, stringsAsFactors = FALSE, fileEncoding = "UTF-8")
  lower_names <- tolower(names(data))
  lon_col <- match(TRUE, lower_names %in% c("lon", "lng", "long", "longitude", "x"))
  lat_col <- match(TRUE, lower_names %in% c("lat", "latitude", "y"))

  if (!is.na(lon_col) && !is.na(lat_col)) {
    sf_data <- sf::st_as_sf(
      data,
      coords = c(names(data)[lon_col], names(data)[lat_col]),
      crs = 4326,
      remove = FALSE
    )
    return(list(id = uploaded_layer_id(), name = display_name, type = "vector", data = sf_data))
  }

  list(id = uploaded_layer_id(), name = display_name, type = "table", data = data)
}

read_uploaded_vector <- function(path, display_name) {
  layer <- sf::st_read(path, quiet = TRUE)
  if (is.na(sf::st_crs(layer))) {
    sf::st_crs(layer) <- 4326
  }
  layer <- sf::st_transform(layer, 4326)
  list(id = uploaded_layer_id(), name = display_name, type = "vector", data = layer)
}

read_uploaded_raster <- function(path, display_name) {
  raster <- raster::raster(path)
  list(id = uploaded_layer_id(), name = display_name, type = "raster", data = raster)
}

read_uploaded_layers <- function(files) {
  if (is.null(files) || nrow(files) == 0) {
    return(list())
  }

  upload_dir <- copy_uploaded_files(files)
  file_names <- list.files(upload_dir, full.names = TRUE)
  zip_files <- file_names[tolower(tools::file_ext(file_names)) == "zip"]

  for (zip_file in zip_files) {
    unzip(zip_file, exdir = file.path(upload_dir, tools::file_path_sans_ext(basename(zip_file))))
  }

  all_files <- list.files(upload_dir, full.names = TRUE, recursive = TRUE)
  extensions <- tolower(tools::file_ext(all_files))
  layers <- list()

  shp_files <- all_files[extensions == "shp"]
  for (path in shp_files) {
    layers <- c(layers, list(read_uploaded_vector(path, tools::file_path_sans_ext(basename(path)))))
  }

  geo_files <- all_files[extensions %in% c("geojson", "json", "gpkg")]
  for (path in geo_files) {
    layers <- c(layers, list(read_uploaded_vector(path, tools::file_path_sans_ext(basename(path)))))
  }

  csv_files <- all_files[extensions == "csv"]
  for (path in csv_files) {
    layers <- c(layers, list(read_uploaded_csv(path, tools::file_path_sans_ext(basename(path)))))
  }

  raster_files <- all_files[extensions %in% c("tif", "tiff", "asc", "grd")]
  for (path in raster_files) {
    layers <- c(layers, list(read_uploaded_raster(path, tools::file_path_sans_ext(basename(path)))))
  }

  layers
}

layer_summary <- function(layer) {
  switch(
    layer$type,
    vector = paste(nrow(layer$data), "elementos"),
    raster = paste(raster::nlayers(layer$data), "banda(s)"),
    table = paste(nrow(layer$data), "filas sin geometría"),
    ""
  )
}

add_uploaded_layers <- function(map, layers, selected_ids, opacity_by_id = list()) {
  if (length(layers) == 0 || is.null(selected_ids)) {
    return(map)
  }

  for (layer in layers) {
    if (!layer$id %in% selected_ids || identical(layer$type, "table")) {
      next
    }
    opacity <- opacity_by_id[[layer$id]]
    if (is.null(opacity) || is.na(opacity)) {
      opacity <- 0.65
    }

    if (identical(layer$type, "raster")) {
      pal <- colorNumeric(c("#d67b5b", "#e0c16f", "#6b9b7a", "#2f6f73"), raster::values(layer$data), na.color = "transparent")
      map <- map |>
        addRasterImage(layer$data, colors = pal, opacity = opacity, group = layer$name)
      next
    }

    geom_type <- unique(as.character(sf::st_geometry_type(layer$data)))
    if (any(grepl("POLYGON", geom_type))) {
      map <- map |>
        addPolygons(
          data = layer$data,
          group = layer$name,
          color = "#1f4e52",
          weight = 1.1,
          fillColor = "#4f9a94",
          fillOpacity = opacity,
          popup = ~ paste0("<strong>", layer$name, "</strong>")
        )
    } else if (any(grepl("LINE", geom_type))) {
      map <- map |>
        addPolylines(data = layer$data, group = layer$name, color = "#1f4e52", weight = 2, opacity = opacity)
    } else {
      coords <- sf::st_coordinates(sf::st_centroid(layer$data))
      point_data <- cbind(sf::st_drop_geometry(layer$data), .lng = coords[, "X"], .lat = coords[, "Y"])
      map <- map |>
        addCircleMarkers(
          data = point_data,
          lng = ~ .lng,
          lat = ~ .lat,
          group = layer$name,
          radius = 5,
          stroke = TRUE,
          weight = 1,
          color = "#1f4e52",
          fillColor = "#4f9a94",
          fillOpacity = opacity,
          popup = ~ paste0("<strong>", layer$name, "</strong>")
        )
    }
  }

  map
}
