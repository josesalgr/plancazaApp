load_plan_caza_data <- function(path = "data/plan_caza_sample.csv") {
  if (!file.exists(path)) {
    stop("No se encuentra el archivo de datos: ", path, call. = FALSE)
  }

  read.csv(path, stringsAsFactors = FALSE, fileEncoding = "UTF-8") |>
    mutate(
      sensitive_area = as.logical(sensitive_area),
      active_management = as.logical(active_management)
    )
}

load_ccaa_shapes <- function(path = "data/ccaa_boundaries.geojson", include_autonomous_cities = FALSE) {
  if (!file.exists(path)) {
    stop("No se encuentra el archivo de limites autonomicos: ", path, call. = FALSE)
  }

  shapes <- sf::st_read(path, quiet = TRUE) |>
    mutate(
      autonomous_community = recode(
        shapeName,
        "Cataluña/Catalunya" = "Cataluña",
        "Comunitat Valenciana" = "Comunidad Valenciana",
        "Comunidad de Madrid" = "Madrid",
        "Comunidad Foral de Navarra" = "Navarra",
        "Illes Balears" = "Islas Baleares",
        "País Vasco/Euskadi" = "País Vasco",
        "Principado de Asturias" = "Asturias",
        "Región de Murcia" = "Murcia"
      )
    )

  if (!isTRUE(include_autonomous_cities)) {
    shapes <- shapes |>
      filter(!autonomous_community %in% c("Ciudad Autónoma de Ceuta", "Ciudad Autónoma de Melilla"))
  }

  shapes |>
    select(autonomous_community, shapeName, geometry)
}

load_catalonia_municipalities <- function(path = "data/catalonia_municipalities.geojson") {
  if (!file.exists(path)) {
    stop("No se encuentra el archivo de municipios de Cataluna: ", path, call. = FALSE)
  }

  sf::st_read(path, quiet = TRUE) |>
    mutate(municipality = coalesce(municipality, shapeName)) |>
    select(municipality, shapeName, geometry)
}

build_timeseries <- function(data, variable) {
  years <- 2021:2026
  data |>
    group_by(autonomous_community) |>
    summarise(value = mean(.data[[variable]], na.rm = TRUE), .groups = "drop") |>
    tidyr::crossing(year = years) |>
    group_by(autonomous_community) |>
    mutate(value = pmax(0, value * (1 + (year - min(year)) * 0.015) + sin(row_number()) * 2)) |>
    ungroup()
}

community_aggregation <- function(value_col) {
  if (value_col %in% c("allocated_quota", "historic_harvest", "hunting_effort", "waiver_quota")) {
    return("sum")
  }
  "mean"
}

format_map_value <- function(value) {
  format(round(value, 1), big.mark = ".", decimal.mark = ",")
}

render_quota_map <- function(data, value_col, legend_title) {
  data <- data |>
    mutate(.map_value = .data[[value_col]])

  pal <- colorNumeric(
    palette = c("#d67b5b", "#e0c16f", "#6b9b7a", "#2f6f73"),
    domain = data$.map_value
  )

  leaflet(data) |>
    addProviderTiles(providers$CartoDB.Positron) |>
    addCircleMarkers(
      lng = ~ longitude,
      lat = ~ latitude,
      radius = ~ pmax(6, sqrt(pmax(.map_value, 0)) / 4),
      stroke = TRUE,
      weight = 1,
      color = "#263238",
      fillColor = ~ pal(.map_value),
      fillOpacity = 0.82,
      popup = ~ paste0(
        "<strong>", province, "</strong><br>",
        autonomous_community, "<br>",
        legend_title, ": ", round(.map_value, 1)
      )
    ) |>
    addLegend("bottomright", pal = pal, values = data$.map_value, title = legend_title)
}

render_community_map <- function(data,
                                 shapes = load_ccaa_shapes(),
                                 value_col,
                                 legend_title,
                                 aggregation = community_aggregation(value_col),
                                 fill_opacity = 0.72) {
  summarise_value <- function(x) {
    if (identical(aggregation, "sum")) {
      sum(x, na.rm = TRUE)
    } else {
      mean(x, na.rm = TRUE)
    }
  }

  community_data <- data |>
    group_by(autonomous_community) |>
    summarise(
      .map_value = summarise_value(.data[[value_col]]),
      province_count = n_distinct(province),
      .has_data = TRUE,
      .groups = "drop"
    )

  if ("conservation_score" %in% names(data)) {
    community_data <- community_data |>
      left_join(
        data |>
          group_by(autonomous_community) |>
          summarise(conservation_score = mean(conservation_score, na.rm = TRUE), .groups = "drop"),
        by = "autonomous_community"
      )
  }

  if ("risk_index" %in% names(data)) {
    community_data <- community_data |>
      left_join(
        data |>
          group_by(autonomous_community) |>
          summarise(risk_index = mean(risk_index, na.rm = TRUE), .groups = "drop"),
        by = "autonomous_community"
      )
  }

  map_data <- shapes |>
    left_join(community_data, by = "autonomous_community") |>
    mutate(
      .has_data = tidyr::replace_na(.has_data, FALSE),
      .map_value = tidyr::replace_na(.map_value, 0),
      province_count = tidyr::replace_na(province_count, 0)
    )

  if (!"conservation_score" %in% names(map_data)) {
    map_data$conservation_score <- NA_real_
  }
  if (!"risk_index" %in% names(map_data)) {
    map_data$risk_index <- NA_real_
  }

  pal <- colorNumeric(
    palette = c("#d67b5b", "#e0c16f", "#6b9b7a", "#2f6f73"),
    domain = map_data$.map_value[map_data$.has_data]
  )

  map_data$.fill_color <- "#d7dcda"
  map_data$.fill_color[map_data$.has_data] <- pal(map_data$.map_value[map_data$.has_data])

  leaflet(map_data) |>
    setView(lng = -6.5, lat = 37.5, zoom = 4) |>
    addProviderTiles(providers$CartoDB.Positron) |>
    addPolygons(
      color = "#263238",
      weight = 1.2,
      opacity = 0.9,
      fillColor = ~ .fill_color,
      fillOpacity = ~ ifelse(.has_data, fill_opacity, min(fill_opacity, 0.35)),
      smoothFactor = 0.3,
      label = ~ paste0(
        autonomous_community,
        ": ",
        ifelse(.has_data, format_map_value(.map_value), "sin datos")
      ),
      popup = ~ paste0(
        "<strong>", autonomous_community, "</strong><br>",
        legend_title, ": ",
        ifelse(.has_data, format_map_value(.map_value), "sin datos"), "<br>",
        "Provincias en datos: ", province_count, "<br>",
        ifelse(!is.na(conservation_score), paste0("Conservacion media: ", round(conservation_score, 1), "<br>"), ""),
        ifelse(!is.na(risk_index), paste0("Riesgo medio: ", round(risk_index, 1)), "")
      )
    ) |>
    addLegend("bottomright", pal = pal, values = map_data$.map_value[map_data$.has_data], title = legend_title)
}

render_community_quota_map <- function(data,
                                       shapes = load_ccaa_shapes(),
                                       value_col = "allocated_quota",
                                       legend_title = "Cupo asignado",
                                       fill_opacity = 0.72) {
  render_community_map(
    data = data,
    shapes = shapes,
    value_col = value_col,
    legend_title = legend_title,
    aggregation = "sum",
    fill_opacity = fill_opacity
  )
}

assign_municipality_provinces <- function(municipalities, province_data) {
  province_points <- province_data |>
    distinct(province, latitude, longitude)

  centroids <- suppressWarnings(sf::st_centroid(municipalities))
  coords <- sf::st_coordinates(centroids)
  municipality_points <- sf::st_drop_geometry(municipalities) |>
    mutate(.longitude = coords[, "X"], .latitude = coords[, "Y"])

  assigned <- lapply(seq_len(nrow(municipality_points)), function(i) {
    distances <- (province_points$longitude - municipality_points$.longitude[i])^2 +
      (province_points$latitude - municipality_points$.latitude[i])^2
    province_points$province[which.min(distances)]
  })

  municipalities$province <- unlist(assigned)
  municipalities
}

build_municipality_allocations <- function(regional_result, municipalities, province_data) {
  province_quota <- regional_result |>
    group_by(province) |>
    summarise(
      allocated_quota = sum(allocated_quota, na.rm = TRUE),
      temporal_risk = mean(temporal_risk, na.rm = TRUE),
      active_management = any(active_management),
      .groups = "drop"
    )

  municipal_data <- assign_municipality_provinces(municipalities, province_data) |>
    left_join(province_quota, by = "province") |>
    mutate(
      allocated_quota = tidyr::replace_na(allocated_quota, 0),
      temporal_risk = tidyr::replace_na(temporal_risk, 0),
      active_management = tidyr::replace_na(active_management, FALSE),
      .municipality_score = 1 + (as.integer(factor(municipality)) %% 17) / 20
    )

  weights <- municipal_data |>
    sf::st_drop_geometry() |>
    group_by(province) |>
    summarise(.province_score = sum(.municipality_score), .groups = "drop")

  municipal_data |>
    left_join(weights, by = "province") |>
    mutate(
      municipality_quota = ifelse(
        .province_score > 0,
        round(allocated_quota * .municipality_score / .province_score),
        0
      )
    )
}

render_municipality_quota_map <- function(regional_result,
                                          municipalities,
                                          province_data,
                                          legend_title = "Cupo municipal") {
  map_data <- build_municipality_allocations(regional_result, municipalities, province_data)

  pal <- colorNumeric(
    palette = c("#d67b5b", "#e0c16f", "#6b9b7a", "#2f6f73"),
    domain = map_data$municipality_quota
  )

  leaflet(map_data) |>
    setView(lng = 1.55, lat = 41.75, zoom = 8) |>
    addProviderTiles(providers$CartoDB.Positron) |>
    addPolygons(
      color = "#263238",
      weight = 0.55,
      opacity = 0.75,
      fillColor = ~ pal(municipality_quota),
      fillOpacity = 0.72,
      smoothFactor = 0.25,
      label = ~ paste0(municipality, ": ", municipality_quota),
      popup = ~ paste0(
        "<strong>", municipality, "</strong><br>",
        "Provincia asignada: ", province, "<br>",
        legend_title, ": ", municipality_quota, "<br>",
        "Riesgo temporal medio: ", round(temporal_risk, 1), "<br>",
        "Gestion activa: ", ifelse(active_management, "si", "no")
      )
    ) |>
    addLegend("bottomright", pal = pal, values = map_data$municipality_quota, title = legend_title)
}
