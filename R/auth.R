load_users <- function(path = "data/users.csv") {
  if (!file.exists(path)) {
    stop("No se encuentra el archivo de usuarios: ", path, call. = FALSE)
  }

  read.csv(path, stringsAsFactors = FALSE, fileEncoding = "UTF-8")
}

authenticate_user <- function(users, username, password) {
  match <- users[users$username == username & users$password == password, , drop = FALSE]
  if (nrow(match) != 1) {
    return(NULL)
  }
  as.list(match[1, ])
}

role_tabs <- function(role) {
  switch(
    role,
    admin = c("dashboard", "input", "national", "regional", "export"),
    mapa = c("dashboard", "input", "national", "export"),
    regional = c("input", "regional", "export"),
    character(0)
  )
}

can_access <- function(user, tab) {
  tab %in% role_tabs(user$role)
}

role_label <- function(user) {
  switch(
    user$role,
    admin = "Administrador",
    mapa = "MAPA",
    regional = paste("Regional", user$territory),
    user$role
  )
}
