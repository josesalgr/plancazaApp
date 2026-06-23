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
        actionButton("clear_layers", "Limpiar capas", class = "btn-outline-secondary"),
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
        title = tagList("PLAN-CAZA", tags$span(class = "user-badge", role_label(user)), actionLink("logout", "Salir")),
        theme = theme,
        header = page_header
      ),
      navs
    )
  )
}

ui <- uiOutput("app_ui")

server <- function(input, output, session) {
  auth <- reactiveValues(user = NULL, login_error = "")
  uploaded_layers <- reactiveVal(list())

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
    auth$user <- NULL
    auth$login_error <- ""
  })

  observeEvent(input$add_layers, {
    req(input$layer_upload)
    new_layers <- tryCatch(
      read_uploaded_layers(input$layer_upload),
      error = function(e) {
        showNotification(paste("No se pudo cargar la capa:", e$message), type = "error", duration = 8)
        list()
      }
    )

    if (length(new_layers) > 0) {
      uploaded_layers(c(uploaded_layers(), new_layers))
      showNotification(paste(length(new_layers), "capa(s) añadida(s)."), type = "message")
    }
  })

  observeEvent(input$clear_layers, {
    uploaded_layers(list())
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
        div(
          class = "layer-item-head",
          checkboxInput(visible_id, NULL, value = TRUE),
          span(class = "layer-icon", ifelse(layer$type == "raster", "▦", "▧")),
          div(class = "layer-name", layer$name),
          span(class = "layer-pill", toupper(layer$type))
        ),
        div(class = "layer-meta", layer_summary(layer)),
        sliderInput(opacity_id, "Opacidad", min = 0, max = 1, value = 0.65, step = 0.05)
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
      if (isTRUE(input[[paste0("layer_visible_", layer$id)]] %||% TRUE)) layer$id else NA_character_
    }, character(1))
    selected_ids <- stats::na.omit(selected_ids)

    opacity_by_id <- lapply(layers, function(layer) input[[paste0("layer_opacity_", layer$id)]] %||% 0.65)
    names(opacity_by_id) <- vapply(layers, function(layer) layer$id, character(1))

    input_map <- add_uploaded_layers(base_map, layers, selected_ids, opacity_by_id)

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
