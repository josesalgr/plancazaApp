FROM rocker/geospatial:4.5.1

RUN Rscript -e 'pkgs <- c("httpuv", "jsonlite", "sf", "dplyr", "terra", "png", "base64enc", "openxlsx"); missing <- pkgs[!vapply(pkgs, requireNamespace, logical(1), quietly = TRUE)]; if (length(missing)) install.packages(missing); stopifnot(all(vapply(pkgs, requireNamespace, logical(1), quietly = TRUE)))'

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends coinor-libcbc-dev coinor-libclp-dev \
    && rm -rf /var/lib/apt/lists/*
COPY backend/install-planning-dependencies.R backend/install-planning-dependencies.R
RUN Rscript backend/install-planning-dependencies.R
COPY backend/ backend/
COPY frontend/ frontend/
COPY R/plan_caza_data.R R/plan_caza_data.R
COPY data/plan_caza_sample.csv data/plan_caza_sample.csv
COPY data/ccaa_boundaries.geojson data/ccaa_boundaries.geojson
COPY data/catalonia_municipalities.geojson data/catalonia_municipalities.geojson
RUN mkdir -p data/layers data/scenarios data/national && chown -R rstudio:rstudio /app

ENV PLANCAZA_HOST=0.0.0.0
ENV PORT=10000
ENV OMP_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
USER rstudio
EXPOSE 10000
CMD ["Rscript", "backend/server.R"]
