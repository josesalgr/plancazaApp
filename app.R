library(shiny)
library(bslib)
library(dplyr)
library(ggplot2)
library(DT)
library(leaflet)

source("R/plan_caza_data.R", encoding = "UTF-8")
source("R/plan_caza_scenarios.R", encoding = "UTF-8")
source("R/auth.R", encoding = "UTF-8")
source("R/upload_layers.R", encoding = "UTF-8")

plan_data <- load_plan_caza_data()
plan_shapes <- load_ccaa_shapes()
plan_municipalities <- load_catalonia_municipalities()
plan_users <- load_users()
auth_enabled <- FALSE
default_user <- authenticate_user(plan_users, "admin", "admin123")

theme <- bs_theme(
  version = 5,
  bootswatch = "flatly",
  primary = "#2f6f73",
  secondary = "#6b7f5f",
  base_font = font_collection("Segoe UI", "Arial", "sans-serif"),
  heading_font = font_collection("Segoe UI", "Arial", "sans-serif")
)

page_header <- tags$head(
  tags$link(rel = "stylesheet", type = "text/css", href = "styles.css"),
  tags$script(HTML("
    $(document).on('click', '#toggle_input_panel', function() {
      $('.input-map-workspace').addClass('panel-collapsed');
      setTimeout(function(){ $(window).trigger('resize'); }, 250);
    });
    $(document).on('click', '#show_input_panel', function() {
      $('.input-map-workspace').removeClass('panel-collapsed');
      setTimeout(function(){ $(window).trigger('resize'); }, 250);
    });
    $(document).on('dragstart', '.layer-item[data-layer-id]', function(event) {
      event.originalEvent.dataTransfer.setData('text/plain', $(this).data('layer-id'));
      $(this).addClass('is-dragging');
    });
    $(document).on('dragend', '.layer-item[data-layer-id]', function() {
      $(this).removeClass('is-dragging');
    });
    $(document).on('dragover', '.layer-item[data-layer-id]', function(event) {
      event.preventDefault();
      $(this).addClass('is-drop-target');
    });
    $(document).on('dragleave', '.layer-item[data-layer-id]', function() {
      $(this).removeClass('is-drop-target');
    });
    $(document).on('drop', '.layer-item[data-layer-id]', function(event) {
      event.preventDefault();
      $('.layer-item').removeClass('is-drop-target');
      var source = event.originalEvent.dataTransfer.getData('text/plain');
      var target = $(this).data('layer-id');
      if (source && target && source !== target) {
        Shiny.setInputValue('layer_reorder', {source: source, target: target, nonce: Math.random()}, {priority: 'event'});
      }
    });
  "))
)

login_ui <- page_fillable(
  theme = theme,
  page_header,
  div(
    class = "login-shell",
    card(
      class = "login-card",
      card_header("PLAN-CAZA"),
      textInput("login_user", "Usuario"),
      passwordInput("login_password", "Contraseña"),
      actionButton("login_button", "Entrar", class = "btn-primary"),
      div(class = "login-error", textOutput("login_error")),
      tags$hr(),
      tags$small("Usuarios de prueba: admin/admin123, mapa/mapa123, catalunya/cat123")
    )
  )
)

dashboard_panel <- function() {
  nav_panel(
    "Cuadro de mando",
    layout_columns(
      value_box("Cupo nacional", textOutput("total_quota"), showcase = bsicons::bs_icon("clipboard-data")),
      value_box("Territorios", textOutput("territory_count"), showcase = bsicons::bs_icon("map")),
      value_box("Riesgo medio", textOutput("mean_risk"), showcase = bsicons::bs_icon("activity")),
      col_widths = c(4, 4, 4)
    ),
    layout_columns(
      card(full_screen = TRUE, card_header("Asignación por territorio"), leafletOutput("overview_map", height = 500)),
      card(full_screen = TRUE, card_header("Indicadores agregados"), plotOutput("overview_plot", height = 500)),
      col_widths = c(7, 5)
    )
  )
}

input_panel <- function() {
  nav_panel(
    "Datos de entrada",
    div(
      class = "input-map-workspace",
      div(
        class = "input-layer-panel",
        actionButton("toggle_input_panel", "‹", class = "panel-toggle", title = "Ocultar panel"),
        selectInput(
          "input_layer",
          "Capa",
          choices = c(
            "Abundancia relativa" = "abundance_index",
            "Tendencia poblacional" = "population_trend",
            "Capturas históricas" = "historic_harvest",
            "Esfuerzo cinegético" = "hunting_effort",
            "Presión migratoria" = "migration_pressure"
          )
        ),
        tags$hr(),
        div(class = "pane-title", "Capas"),
        fileInput(
          "layer_upload",
          "Subir datos",
          multiple = TRUE,
          accept = c(".zip", ".shp", ".dbf", ".shx", ".prj", ".csv", ".geojson", ".json", ".gpkg", ".tif", ".tiff", ".asc", ".grd")
        ),
        actionButton("add_layers", "Añadir capa", class = "btn-primary"),
        div(class = "layer-list", uiOutput("base_layer_ui")),
        uiOutput("uploaded_layers_ui")
      ),
      div(
        class = "input-map-panel",
        actionButton("show_input_panel", "Layers", class = "panel-show"),
        leafletOutput("input_map", height = "100%")
      )
    )
  )
}

national_panel <- function() {
  nav_panel(
    "Escenario nacional",
    div(
      class = "scenario-workspace",
      div(
        class = "scenario-pane scenario-controls",
        div(class = "pane-title", "Parámetros"),
        numericInput("national_quota", "Cupo nacional", value = 12000, min = 0, step = 500),
        sliderInput("eco_weight", "Peso ecológico", min = 0, max = 1, value = 0.6, step = 0.05),
        sliderInput("social_weight", "Peso social", min = 0, max = 1, value = 0.4, step = 0.05),
        sliderInput("min_abundance", "Umbral mínimo de abundancia", min = 0, max = 100, value = 35),
        checkboxInput("redistribute_waived", "Redistribuir cupos renunciados", value = TRUE),
        checkboxInput("spatial_limits", "Restricciones espaciales", value = TRUE)
      ),
      div(
        class = "scenario-map-shell",
        leafletOutput("national_map", height = "100%")
      ),
      div(
        class = "scenario-pane scenario-inspector",
        div(class = "pane-title", "Indicadores"),
        plotOutput("national_tradeoff", height = 260),
        div(class = "pane-title pane-title-spaced", "Resultado nacional"),
        DTOutput("national_table")
      )
    )
  )
}

regional_panel <- function() {
  nav_panel(
    "Escenario regional",
    div(
      class = "scenario-workspace",
      div(
        class = "scenario-pane scenario-controls",
        div(class = "pane-title", "Parámetros"),
        tags$div(class = "fixed-region", tags$strong("Comunidad autónoma"), tags$span("Cataluña")),
        numericInput("regional_quota", "Cupo regional", value = 1600, min = 0, step = 100),
        sliderInput("temporal_weight", "Peso temporal", min = 0, max = 1, value = 0.35, step = 0.05),
        checkboxInput("temporal_limits", "Restricciones temporales", value = TRUE),
        selectInput("season_window", "Ventana de media veda", choices = c("Temprana", "Intermedia", "Tardía"))
      ),
      div(
        class = "scenario-map-shell",
        leafletOutput("regional_map", height = "100%")
      ),
      div(
        class = "scenario-pane scenario-inspector",
        div(class = "pane-title", "Indicadores"),
        plotOutput("regional_plot", height = 280),
        div(class = "pane-title pane-title-spaced", "Resultado regional"),
        DTOutput("regional_table")
      )
    )
  )
}

export_panel <- function(user) {
  export_choices <- switch(
    user$role,
    admin = c("Nacional", "Regional"),
    mapa = "Nacional",
    regional = "Regional",
    c("Nacional", "Regional")
  )

  nav_panel(
    "Exportación",
    layout_columns(
      card(
        card_header("Escenario seleccionado"),
        selectInput("export_scope", "Ámbito", choices = export_choices),
        downloadButton("download_results", "Descargar resultados"),
        downloadButton("download_report", "Descargar informe")
      ),
      card(card_header("Trazabilidad"), verbatimTextOutput("traceability")),
      col_widths = c(4, 8)
    )
  )
}

build_app_ui <- function(user) {
  navs <- list()
  if (can_access(user, "dashboard")) navs <- c(navs, list(dashboard_panel()))
  if (can_access(user, "input")) navs <- c(navs, list(input_panel()))
  if (can_access(user, "national")) navs <- c(navs, list(national_panel()))
  if (can_access(user, "regional")) navs <- c(navs, list(regional_panel()))
  if (can_access(user, "export")) navs <- c(navs, list(export_panel(user)))

  do.call(
    page_navbar,
    c(
      list(
        title = tagList(
          "PLAN-CAZA",
          tags$span(class = "user-badge", role_label(user)),
          if (auth_enabled) actionLink("logout", "Salir") else NULL
        ),
        theme = theme,
        header = page_header,
        selected = if (auth_enabled) NULL else "Datos de entrada"
      ),
      navs
    )
  )
}

ui <- uiOutput("app_ui")

layer_action_button <- function(action, id, label, title) {
  tags$button(
    type = "button",
    class = paste("layer-tool", paste0("layer-tool-", action)),
    title = title,
    onclick = sprintf(
      "Shiny.setInputValue('layer_action', {action: '%s', id: '%s', nonce: Math.random()}, {priority: 'event'})",
      action,
      id
    ),
    label
  )
}

server <- function(input, output, session) {
  auth <- reactiveValues(user = if (auth_enabled) NULL else default_user, login_error = "")
  uploaded_layers <- reactiveVal(load_stored_layers())

  current_user <- reactive(auth$user)

  output$app_ui <- renderUI({
    user <- current_user()
    if (is.null(user)) {
      login_ui
    } else {
      build_app_ui(user)
    }
  })

  output$login_error <- renderText(auth$login_error)

  observeEvent(input$login_button, {
    user <- authenticate_user(plan_users, input$login_user, input$login_password)
    if (is.null(user)) {
      auth$login_error <- "Usuario o contraseña incorrectos."
    } else {
      auth$user <- user
      auth$login_error <- ""
    }
  })

  observeEvent(input$logout, {
    auth$user <- if (auth_enabled) NULL else default_user
    auth$login_error <- ""
  })

  observeEvent(input$add_layers, {
    req(input$layer_upload)
    default_name <- tools::file_path_sans_ext(input$layer_upload$name[1])
    showModal(modalDialog(
      title = "Guardar capa",
      textInput("new_layer_name", "Nombre de la capa", value = default_name),
      checkboxInput("overwrite_layer", "Sobrescribir si ya existe una capa con este nombre", value = FALSE),
      footer = tagList(
        modalButton("Cancelar"),
        actionButton("confirm_save_layer", "Guardar", class = "btn-primary")
      ),
      easyClose = TRUE
    ))
  })

  observeEvent(input$confirm_save_layer, {
    req(input$layer_upload)
    layer_name <- trimws(input$new_layer_name %||% "")
    if (!nzchar(layer_name)) {
      showNotification("Pon un nombre para guardar la capa.", type = "error")
      return()
    }

    layers <- uploaded_layers()
    existing_index <- which(stored_layer_names(layers) == tolower(layer_name))
    if (length(existing_index) > 0 && !isTRUE(input$overwrite_layer)) {
      showNotification(
        "Ya existe una capa con ese nombre. Marca sobrescribir para reemplazarla.",
        type = "warning",
        duration = 7
      )
      return()
    }

    new_layers <- tryCatch(
      read_uploaded_layers(input$layer_upload),
      error = function(e) {
        showNotification(paste("No se pudo cargar la capa:", e$message), type = "error", duration = 8)
        list()
      }
    )

    if (length(new_layers) > 0) {
      if (length(existing_index) > 0) {
        lapply(layers[existing_index], delete_stored_layer)
        layers <- layers[-existing_index]
      }

      for (i in seq_along(new_layers)) {
        suffix <- if (length(new_layers) > 1) paste0(" ", i) else ""
        new_layers[[i]]$name <- paste0(layer_name, suffix)
        new_layers[[i]]$id <- sanitize_layer_id(new_layers[[i]]$name)
        new_layers[[i]]$visible <- TRUE
        new_layers[[i]]$opacity <- 0.65
      }

      layers <- c(new_layers, layers)
      save_stored_layers(layers)
      uploaded_layers(layers)
      removeModal()
      showNotification(paste(length(new_layers), "capa(s) guardada(s)."), type = "message")
    }
  })

  observeEvent(input$layer_action, {
    action <- input$layer_action$action
    id <- input$layer_action$id
    layers <- uploaded_layers()
    index <- match(id, vapply(layers, function(layer) layer$id, character(1)))
    if (is.na(index)) {
      return()
    }

    if (identical(action, "delete")) {
      delete_stored_layer(layers[[index]])
      layers <- layers[-index]
    } else if (identical(action, "up") && index > 1) {
      layers[c(index - 1, index)] <- layers[c(index, index - 1)]
    } else if (identical(action, "down") && index < length(layers)) {
      layers[c(index, index + 1)] <- layers[c(index + 1, index)]
    }

    save_stored_layers(layers)
    uploaded_layers(layers)
  }, ignoreInit = TRUE)

  observeEvent(input$layer_reorder, {
    layers <- uploaded_layers()
    ids <- vapply(layers, function(layer) layer$id, character(1))
    source_index <- match(input$layer_reorder$source, ids)
    target_index <- match(input$layer_reorder$target, ids)
    if (is.na(source_index) || is.na(target_index) || identical(source_index, target_index)) {
      return()
    }

    moving_layer <- layers[[source_index]]
    layers <- layers[-source_index]
    target_index <- match(input$layer_reorder$target, vapply(layers, function(layer) layer$id, character(1)))
    layers <- append(layers, list(moving_layer), after = target_index - 1)
    save_stored_layers(layers)
    uploaded_layers(layers)
  }, ignoreInit = TRUE)

  observe({
    layers <- uploaded_layers()
    if (length(layers) == 0) {
      return()
    }

    changed <- FALSE
    for (i in seq_along(layers)) {
      visible_id <- paste0("layer_visible_", layers[[i]]$id)
      opacity_id <- paste0("layer_opacity_", layers[[i]]$id)
      visible <- input[[visible_id]]
      opacity <- input[[opacity_id]]

      if (!is.null(visible) && !identical(isTRUE(visible), isTRUE(layers[[i]]$visible))) {
        layers[[i]]$visible <- isTRUE(visible)
        changed <- TRUE
      }
      if (!is.null(opacity) && !is.na(opacity) && !identical(as.numeric(opacity), as.numeric(layers[[i]]$opacity))) {
        layers[[i]]$opacity <- as.numeric(opacity)
        changed <- TRUE
      }
    }

    if (changed) {
      save_stored_layers(layers)
      uploaded_layers(layers)
    }
  })

  output$base_layer_ui <- renderUI({
    div(
      class = "layer-item",
      div(
        class = "layer-item-head",
        checkboxInput("show_base_input_layer", NULL, value = TRUE),
        span(class = "layer-icon", "▧"),
        div(class = "layer-name", "PLAN-CAZA"),
        span(class = "layer-pill", "BASE")
      ),
      div(class = "layer-meta", textOutput("base_layer_meta", inline = TRUE)),
      sliderInput("base_input_opacity", "Opacidad", min = 0, max = 1, value = 0.72, step = 0.05)
    )
  })

  output$base_layer_meta <- renderText({
    paste(input$input_layer %||% "abundance_index", "por CCAA")
  })

  output$uploaded_layers_ui <- renderUI({
    layers <- uploaded_layers()
    if (length(layers) == 0) {
      return(div(class = "layer-empty", "No hay capas cargadas."))
    }

    tagList(lapply(layers, function(layer) {
      visible_id <- paste0("layer_visible_", layer$id)
      opacity_id <- paste0("layer_opacity_", layer$id)
      div(
        class = "layer-item",
        `data-layer-id` = layer$id,
        draggable = "true",
        div(
          class = "layer-item-head",
          checkboxInput(visible_id, NULL, value = isTRUE(layer$visible %||% TRUE)),
          span(class = "layer-icon", ifelse(layer$type == "raster", "▦", "▧")),
          div(class = "layer-name", layer$name),
          span(class = "layer-pill", toupper(layer$type)),
          div(
            class = "layer-tools",
            layer_action_button("up", layer$id, "↑", "Subir capa"),
            layer_action_button("down", layer$id, "↓", "Bajar capa"),
            layer_action_button("delete", layer$id, "×", "Eliminar capa")
          )
        ),
        div(class = "layer-meta", layer_summary(layer)),
        sliderInput(opacity_id, "Opacidad", min = 0, max = 1, value = layer$opacity %||% 0.65, step = 0.05)
      )
    }))
  })

  permitted_input_data <- reactive({
    user <- req(current_user())
    data <- plan_data
    if (identical(user$role, "mapa")) {
      data <- data
    } else if (identical(user$role, "regional")) {
      data <- filter(data, autonomous_community == user$territory)
    }
    data
  })

  filtered_input_data <- reactive({
    permitted_input_data()
  })

  national_result <- reactive({
    req(current_user())
    run_national_scenario(
      plan_data,
      quota = input$national_quota %||% 12000,
      eco_weight = input$eco_weight %||% 0.6,
      social_weight = input$social_weight %||% 0.4,
      min_abundance = input$min_abundance %||% 35,
      redistribute_waived = input$redistribute_waived %||% TRUE,
      spatial_limits = input$spatial_limits %||% TRUE
    )
  })

  regional_result <- reactive({
    req(current_user())
    run_regional_scenario(
      plan_data,
      autonomous_community = "Cataluña",
      quota = input$regional_quota %||% 1600,
      temporal_weight = input$temporal_weight %||% 0.35,
      temporal_limits = input$temporal_limits %||% TRUE,
      season_window = input$season_window %||% "Temprana"
    )
  })

  output$total_quota <- renderText(format(sum(national_result()$allocated_quota), big.mark = "."))
  output$territory_count <- renderText(length(unique(plan_data$province)))
  output$mean_risk <- renderText(sprintf("%.1f", mean(national_result()$risk_index)))

  output$overview_map <- renderLeaflet({
    render_community_quota_map(national_result(), plan_shapes, "allocated_quota", "Cupo asignado")
  })

  output$overview_plot <- renderPlot({
    national_result() |>
      group_by(autonomous_community) |>
      summarise(allocated_quota = sum(allocated_quota), conservation_score = mean(conservation_score), .groups = "drop") |>
      ggplot(aes(reorder(autonomous_community, allocated_quota), allocated_quota, fill = conservation_score)) +
      geom_col(width = 0.72) +
      coord_flip() +
      scale_fill_gradient(low = "#d67b5b", high = "#2f6f73") +
      labs(x = NULL, y = "Cupo", fill = "Conservación") +
      theme_minimal(base_size = 13)
  })

  output$input_map <- renderLeaflet({
    base_visible <- isTRUE(input$show_base_input_layer %||% TRUE)
    base_opacity <- input$base_input_opacity %||% 0.72

    if (base_visible) {
      base_map <- render_community_map(
        filtered_input_data(),
        plan_shapes,
        value_col = input$input_layer,
        legend_title = input$input_layer,
        fill_opacity = base_opacity
      )
    } else {
      base_map <- leaflet() |>
        setView(lng = -6.5, lat = 37.5, zoom = 4) |>
        addProviderTiles(providers$CartoDB.Positron)
    }

    layers <- uploaded_layers()
    selected_ids <- vapply(layers, function(layer) {
      visible <- input[[paste0("layer_visible_", layer$id)]] %||% layer$visible %||% TRUE
      if (isTRUE(visible)) layer$id else NA_character_
    }, character(1))
    selected_ids <- stats::na.omit(selected_ids)

    opacity_by_id <- lapply(layers, function(layer) input[[paste0("layer_opacity_", layer$id)]] %||% layer$opacity %||% 0.65)
    names(opacity_by_id) <- vapply(layers, function(layer) layer$id, character(1))

    input_map <- add_uploaded_layers(base_map, rev(layers), selected_ids, opacity_by_id)

    current_center <- isolate(input$input_map_center)
    current_zoom <- isolate(input$input_map_zoom)
    if (
      !is.null(current_center$lng) &&
        !is.null(current_center$lat) &&
        !is.null(current_zoom)
    ) {
      input_map <- input_map |>
        setView(lng = current_center$lng, lat = current_center$lat, zoom = current_zoom)
    }

    input_map
  })

  output$national_map <- renderLeaflet({
    render_community_quota_map(national_result(), plan_shapes, "allocated_quota", "Cupo asignado")
  })

  output$national_tradeoff <- renderPlot({
    national_result() |>
      ggplot(aes(social_score, conservation_score, size = allocated_quota, color = risk_index)) +
      geom_point(alpha = 0.85) +
      scale_color_gradient(low = "#2f6f73", high = "#b54b4b") +
      scale_size_continuous(range = c(4, 16)) +
      labs(x = "Ajuste social", y = "Conservación", color = "Riesgo", size = "Cupo") +
      theme_minimal(base_size = 13)
  })

  output$national_table <- renderDT({
    datatable(
      national_result() |>
        select(autonomous_community, province, allocated_quota, conservation_score,
               social_score, risk_index, waiver_quota, constrained),
      rownames = FALSE,
      options = list(pageLength = 12, scrollX = TRUE)
    )
  })

  output$regional_map <- renderLeaflet({
    render_municipality_quota_map(
      regional_result(),
      plan_municipalities,
      filter(plan_data, autonomous_community == "Cataluña"),
      "Cupo municipal"
    )
  })

  output$regional_plot <- renderPlot({
    regional_result() |>
      ggplot(aes(period, allocated_quota, fill = population_origin)) +
      geom_col(position = "stack", width = 0.72) +
      facet_wrap(~ province, scales = "free_y") +
      labs(x = NULL, y = "Cupo", fill = "Población") +
      theme_minimal(base_size = 13) +
      theme(axis.text.x = element_text(angle = 35, hjust = 1))
  })

  output$regional_table <- renderDT({
    datatable(
      regional_result() |>
        select(autonomous_community, province, hunting_area, period, population_origin,
               allocated_quota, temporal_risk, active_management),
      rownames = FALSE,
      options = list(pageLength = 12, scrollX = TRUE)
    )
  })

  selected_export <- reactive({
    user <- req(current_user())
    scope <- input$export_scope
    if (is.null(scope)) {
      scope <- if (identical(user$role, "regional")) "Regional" else "Nacional"
    }
    if (identical(user$role, "mapa")) scope <- "Nacional"
    if (identical(user$role, "regional")) scope <- "Regional"
    if (identical(scope, "Nacional")) national_result() else regional_result()
  })

  output$download_results <- downloadHandler(
    filename = function() paste0("plan-caza-", tolower(input$export_scope %||% "resultados"), ".csv"),
    content = function(file) write.csv(selected_export(), file, row.names = FALSE, fileEncoding = "UTF-8")
  )

  output$download_report <- downloadHandler(
    filename = function() paste0("plan-caza-", tolower(input$export_scope %||% "informe"), ".txt"),
    content = function(file) {
      writeLines(build_report(input$export_scope %||% "Escenario", selected_export()), file, useBytes = TRUE)
    }
  )

  output$traceability <- renderText({
    user <- req(current_user())
    paste(
      paste("Usuario:", user$username),
      paste("Rol:", role_label(user)),
      "Datos: data/plan_caza_sample.csv",
      "Modelo: R/plan_caza_scenarios.R",
      paste("Ámbito:", input$export_scope %||% ifelse(identical(user$role, "regional"), "Regional", "Nacional")),
      paste("Fecha:", Sys.Date()),
      sep = "\n"
    )
  })
}

shinyApp(ui, server)
