# Run from the application directory.
lib <- file.path(getwd(), ".Rlib")
dir.create(lib, showWarnings = FALSE)
.libPaths(c(lib, .libPaths()))
options(repos = c(CRAN = "https://cloud.r-project.org"))

dependencies <- c(
  "assertthat", "Matrix", "proto", "magrittr", "dplyr", "Rcpp", "cli", "sf",
  "RANN", "exactextractr", "ggplot2", "terra", "ggrepel", "lifecycle",
  "moocore", "RcppArmadillo", "BH"
)
missing <- dependencies[!vapply(dependencies, requireNamespace, logical(1), quietly = TRUE)]
if (length(missing)) {
  install.packages(missing, lib = lib, type = if (.Platform$OS.type == "windows") "binary" else "source")
}

install_from_commit <- function(repo, revision) {
  archive <- tempfile(fileext = ".tar.gz")
  on.exit(unlink(archive), add = TRUE)
  url <- paste0("https://codeload.github.com/", repo, "/tar.gz/", revision)
  download.file(url, archive, mode = "wb")
  install.packages(archive, lib = lib, repos = NULL, type = "source")
}

if (!requireNamespace("rcbc", quietly = TRUE)) {
  install_from_commit("dirkschumacher/rcbc", "e13c476d4733dd5cfdf30d2c7eddc31455a7067c")
}
integer_actions <- function() {
  requireNamespace("multiscape", quietly = TRUE) &&
    "decision_type" %in% names(formals(multiscape::add_actions))
}
if (!integer_actions()) {
  if ("multiscape" %in% loadedNamespaces()) unloadNamespace("multiscape")
  install_from_commit("josesalgr/multiscape", "a49582b32fa4c95c02f0f2512fc0d3fe9eade578")
}
stopifnot(requireNamespace("rcbc", quietly = TRUE), integer_actions())
