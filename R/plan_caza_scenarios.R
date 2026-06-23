normalise <- function(x) {
  rng <- range(x, na.rm = TRUE)
  if (diff(rng) == 0) {
    return(rep(1, length(x)))
  }
  (x - rng[1]) / diff(rng)
}

run_national_scenario <- function(data,
                                  quota,
                                  eco_weight,
                                  social_weight,
                                  min_abundance,
                                  redistribute_waived,
                                  spatial_limits) {
  weights_total <- eco_weight + social_weight
  eco_weight <- if (weights_total == 0) 0.5 else eco_weight / weights_total
  social_weight <- if (weights_total == 0) 0.5 else social_weight / weights_total

  result <- data |>
    mutate(
      conservation_score = 100 * (
        0.55 * normalise(abundance_index) +
          0.30 * normalise(population_trend + 30) +
          0.15 * (1 - normalise(migration_pressure))
      ),
      social_score = 100 * (
        0.70 * normalise(historic_harvest) +
          0.30 * normalise(hunting_effort)
      ),
      constrained = abundance_index < min_abundance | (spatial_limits & sensitive_area),
      scenario_score = if_else(
        constrained,
        0.2 * conservation_score,
        eco_weight * conservation_score + social_weight * social_score
      ),
      risk_index = pmin(100, 100 - conservation_score + 0.25 * migration_pressure),
      waiver_quota = if_else(redistribute_waived & waiver_rate > 0, historic_harvest * waiver_rate, 0)
    )

  score_sum <- sum(result$scenario_score)
  if (score_sum == 0) {
    result$allocated_quota <- 0
  } else {
    result$allocated_quota <- round(quota * result$scenario_score / score_sum)
  }

  if (redistribute_waived) {
    result <- result |>
      mutate(allocated_quota = pmax(0, allocated_quota - round(waiver_quota)))
  }

  result
}

run_regional_scenario <- function(data,
                                  autonomous_community,
                                  quota,
                                  temporal_weight,
                                  temporal_limits,
                                  season_window) {
  periods <- c("Temprana", "Intermedia", "Tardía")
  origins <- c("Occidental", "Central", "Norte")
  regional <- data |>
    filter(.data$autonomous_community == !!autonomous_community) |>
    tidyr::crossing(period = periods, population_origin = origins) |>
    mutate(
      hunting_area = paste("Área", row_number()),
      temporal_match = case_when(
        period == season_window ~ 1,
        period == "Intermedia" ~ 0.8,
        TRUE ~ 0.55
      ),
      origin_pressure = case_when(
        population_origin == "Occidental" ~ migration_pressure,
        population_origin == "Central" ~ migration_pressure * 0.75,
        TRUE ~ migration_pressure * 0.5
      ),
      temporal_risk = pmin(100, origin_pressure * (1.15 - temporal_match)),
      base_score = 0.45 * normalise(abundance_index) +
        0.25 * normalise(historic_harvest) +
        0.20 * active_management +
        0.10 * temporal_match,
      base_score = if_else(temporal_limits & temporal_risk > 55, base_score * 0.35, base_score),
      scenario_score = (1 - temporal_weight) * base_score +
        temporal_weight * (1 - normalise(temporal_risk))
    )

  score_sum <- sum(regional$scenario_score)
  regional |>
    mutate(allocated_quota = if (score_sum == 0) 0 else round(quota * scenario_score / score_sum))
}

build_report <- function(scope, result) {
  total <- sum(result$allocated_quota)
  mean_risk <- mean(result$risk_index %||% result$temporal_risk, na.rm = TRUE)
  lines <- c(
    "PLAN-CAZA",
    paste("Ambito:", scope),
    paste("Fecha:", Sys.Date()),
    paste("Cupo total asignado:", total),
    paste("Riesgo medio:", round(mean_risk, 2)),
    "",
    "Resumen por territorio:"
  )

  summary <- result |>
    group_by(autonomous_community, province) |>
    summarise(allocated_quota = sum(allocated_quota), .groups = "drop")

  c(lines, capture.output(print(summary, n = nrow(summary))))
}

`%||%` <- function(x, y) {
  if (is.null(x)) y else x
}
