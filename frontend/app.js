const api = {
  health: "/api/health",
  inspect: () => "/api/import/inspect",
  base: (layer) => `/api/base-layer/${encodeURIComponent(layer)}`,
  layers: () => `/api/${encodeURIComponent(state.role)}/layers`,
  layer: (id) => `/api/${encodeURIComponent(state.role)}/layers/${id}`,
  geojson: (id) => `/api/layers/${id}/geojson`,
  data: (id) => `/api/layers/${id}/data`,
  download: (id) => `/api/layers/${id}/download`,
  downloadCsv: (id) => `/api/layers/${id}/download.csv`,
  rasterTiles: (id) => `/api/layers/${id}/tiles/{z}/{x}/{y}.png`,
  reorder: () => `/api/${encodeURIComponent(state.role)}/layers/reorder`,
};

const state = {
  layers: [],
  pendingUpload: null,
  importInspection: null,
  layerRuntime: {},
  baseLayers: {
    ccaa: { name: "CCAA", metaKey: "ccaaShapes", opacity: 0.72, visible: true, mapLayers: ["base-ccaa-fill", "base-ccaa-line"] },
  },
  layerOrder: JSON.parse(localStorage.getItem("plancaza_layer_order") || '["base:ccaa"]'),
  groups: JSON.parse(localStorage.getItem("plancaza_layer_groups") || "[]"),
  lang: localStorage.getItem("plancaza_lang") || "es",
  role: localStorage.getItem("plancaza_role") || "admin",
};

const FIXED_BASE_KEYS = new Set(["base:ccaa"]);

const i18n = {
  es: {
    navInput: "Datos de entrada",
    navNational: "Escenario nacional",
    navRegional: "Escenario regional",
    navExport: "Exportación",
    layers: "Capas",
    addData: "Añadir datos",
    addDataTitle: "Añadir datos",
    dropTitle: "Suelta un archivo o haz clic para seleccionar",
    dropHint: "GeoJSON, Shapefile ZIP, CSV o GeoTIFF en WGS84",
    clipPolicy: "Los vectores y CSV se recortan automáticamente a la España peninsular con un buffer de 5 km. Los rásteres se recortan a tierra peninsular sin buffer marino.",
    noFile: "Ningún archivo seleccionado",
    layerName: "Nombre de la capa",
    overwrite: "Sobrescribir si ya existe",
    cancel: "Cancelar",
    save: "Guardar",
    opacity: "Opacidad",
    ccaaShapes: "Límites autonómicos",
    provinceShapes: "Límites provinciales",
    chooseFile: "Selecciona un archivo GeoJSON, Shapefile ZIP, CSV o GeoTIFF.",
    layerSaved: "Capa guardada.",
    nameRequired: "Pon un nombre para la capa.",
    csvLayer: "CSV con coordenadas",
    geojsonLayer: "Vector GeoJSON",
    rasterLayer: "Raster GeoTIFF",
    readError: "No se pudo leer el archivo.",
    userLabel: "Usuario",
    layerTarget: "Destino",
    csvMode: "Uso del CSV",
    csvModePoints: "Puntos con coordenadas",
    csvModeJoin: "Tabla para unir a una capa base",
    joinTarget: "Capa base de destino",
    joinTargetCcaa: "CCAA",
    joinTargetProvinces: "Provincias",
    csvJoinField: "Campo del CSV",
    joinTargetHintCcaa: "Se unirÃ¡ usando el campo autonomous_community de la capa base.",
    joinTargetHintProvinces: "Se unirÃ¡ usando el campo province de la capa base.",
    csvJoinFieldRequired: "Selecciona el campo del CSV para hacer la uniÃ³n.",
    layerNameUsed: "Ese nombre de capa ya está en uso. Elige otro.",
    importSummaryTitle: "Resumen detectado",
    importFieldsTitle: "Columnas a conservar",
    displayField: "Campo de visualización",
    displayFieldAuto: "Sin visualización temática",
    importPreviewTitle: "Vista previa",
    importGuideTitle: "Guía de importación",
    rasterExtent: "Extensión",
    rasterResolution: "Resolución",
    rasterLegendLabel: "Valores",
    summaryType: "Tipo",
    summaryFormat: "Formato",
    summaryFeatures: "Entidades",
    summaryRows: "Filas",
    summaryFields: "Campos",
    summaryGeometry: "Geometría",
    summaryBands: "Bandas",
    summaryCrs: "CRS",
    summaryCoordinates: "Coordenadas",
    targetAdmin: "Datos comunes",
    targetMapa: "Datos MAPA",
    targetCca: "Datos CCA",
    targetBoth: "Datos MAPA + CCA",
    sharedLayer: "Datos comunes",
    mapaLayer: "Datos MAPA",
    ccaLayer: "Datos CCA",
    bothLayer: "Datos MAPA + CCA",
    privateLayer: "Mis datos",
    createGroup: "Crear grupo",
    groupName: "Nombre del grupo",
    groupCategory: "Categoría",
    ecological: "Ecológica",
    social: "Social",
    groupNameUsed: "Ese nombre ya está en uso. Elige otro.",
    visualFieldLabel: "Visualiza",
    popupFieldsLabel: "Popup",
    searchPlaceholder: "Buscar ciudad, pueblo o CCAA",
    searchNoResults: "Sin resultados",
    searchError: "No se pudo completar la búsqueda",
    searchClear: "Limpiar búsqueda",
  },
  ca: {
    navInput: "Dades d'entrada",
    navNational: "Escenari nacional",
    navRegional: "Escenari regional",
    navExport: "Exportació",
    layers: "Capes",
    addData: "Afegir dades",
    addDataTitle: "Afegir dades",
    dropTitle: "Arrossega un fitxer o fes clic per seleccionar",
    dropHint: "GeoJSON, Shapefile ZIP, CSV o GeoTIFF en WGS84",
    clipPolicy: "Els vectors i CSV es retallen automàticament a l'Espanya peninsular amb un buffer de 5 km. Els ràsters es retallen a terra peninsular sense buffer marí.",
    noFile: "Cap fitxer seleccionat",
    layerName: "Nom de la capa",
    overwrite: "Sobreescriure si ja existeix",
    cancel: "Cancel·lar",
    save: "Desar",
    opacity: "Opacitat",
    ccaaShapes: "Límits autonòmics",
    provinceShapes: "Límits provincials",
    chooseFile: "Selecciona un fitxer GeoJSON, Shapefile ZIP, CSV o GeoTIFF.",
    layerSaved: "Capa desada.",
    nameRequired: "Escriu un nom per a la capa.",
    csvLayer: "CSV amb coordenades",
    geojsonLayer: "Vector GeoJSON",
    rasterLayer: "Raster GeoTIFF",
    readError: "No s'ha pogut llegir el fitxer.",
    userLabel: "Usuari",
    layerTarget: "Desti",
    csvMode: "Ãšs del CSV",
    csvModePoints: "Punts amb coordenades",
    csvModeJoin: "Taula per unir a una capa base",
    joinTarget: "Capa base de destÃ­",
    joinTargetCcaa: "CCAA",
    joinTargetProvinces: "ProvÃ­ncies",
    csvJoinField: "Camp del CSV",
    joinTargetHintCcaa: "S'unirÃ  amb el camp autonomous_community de la capa base.",
    joinTargetHintProvinces: "S'unirÃ  amb el camp province de la capa base.",
    csvJoinFieldRequired: "Selecciona el camp del CSV per fer la uniÃ³.",
    layerNameUsed: "Aquest nom de capa ja està en ús. Tria'n un altre.",
    importSummaryTitle: "Resum detectat",
    importFieldsTitle: "Columnes a conservar",
    displayField: "Camp de visualització",
    displayFieldAuto: "Sense visualització temàtica",
    importPreviewTitle: "Vista prèvia",
    importGuideTitle: "Guia d'importació",
    rasterExtent: "Extensió",
    rasterResolution: "Resolució",
    rasterLegendLabel: "Valors",
    summaryType: "Tipus",
    summaryFormat: "Format",
    summaryFeatures: "Entitats",
    summaryRows: "Files",
    summaryFields: "Camps",
    summaryGeometry: "Geometria",
    summaryBands: "Bandes",
    summaryCrs: "CRS",
    summaryCoordinates: "Coordenades",
    targetAdmin: "Dades comunes",
    targetMapa: "Dades MAPA",
    targetCca: "Dades CCA",
    targetBoth: "Dades MAPA + CCA",
    sharedLayer: "Dades comunes",
    mapaLayer: "Dades MAPA",
    ccaLayer: "Dades CCA",
    bothLayer: "Dades MAPA + CCA",
    privateLayer: "Les meves dades",
    createGroup: "Crear grup",
    groupName: "Nom del grup",
    groupCategory: "Categoria",
    ecological: "Ecològica",
    social: "Social",
    groupNameUsed: "Aquest nom ja està en ús. Tria'n un altre.",
    visualFieldLabel: "Visualitza",
    popupFieldsLabel: "Popup",
    searchPlaceholder: "Cerca ciutat, poble o CCAA",
    searchNoResults: "Sense resultats",
    searchError: "No s'ha pogut completar la cerca",
    searchClear: "Netejar cerca",
  },
};

const t = (key) => i18n[state.lang][key] || i18n.es[key] || key;

const els = {
  workspace: document.querySelector(".workspace"),
  hidePanel: document.querySelector("#hidePanel"),
  showPanel: document.querySelector("#showPanel"),
  userRole: document.querySelector("#userRole"),
  layerTree: document.querySelector("#layerTree"),
  createGroup: document.querySelector("#createGroup"),
  openAddData: document.querySelector("#openAddData"),
  fullscreenMap: document.querySelector("#fullscreenMap"),
  mapScale: document.querySelector("#mapScale"),
  mapStatus: document.querySelector("#mapStatus"),
  mapSearch: document.querySelector("#mapSearch"),
  mapSearchInput: document.querySelector("#mapSearchInput"),
  mapSearchClear: document.querySelector("#mapSearchClear"),
  mapSearchResults: document.querySelector("#mapSearchResults"),
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  selectedFile: document.querySelector("#selectedFile"),
  uploadedLayers: document.querySelector("#layerTree"),
  dialog: document.querySelector("#layerDialog"),
  layerName: document.querySelector("#layerName"),
  csvModeRow: document.querySelector("#csvModeRow"),
  csvMode: document.querySelector("#csvMode"),
  csvJoinConfig: document.querySelector("#csvJoinConfig"),
  joinTarget: document.querySelector("#joinTarget"),
  csvJoinField: document.querySelector("#csvJoinField"),
  joinTargetHint: document.querySelector("#joinTargetHint"),
  importSummary: document.querySelector("#importSummary"),
  importSummaryStats: document.querySelector("#importSummaryStats"),
  importGuidance: document.querySelector("#importGuidance"),
  importFieldSelector: document.querySelector("#importFieldSelector"),
  importFieldList: document.querySelector("#importFieldList"),
  displayFieldRow: document.querySelector("#displayFieldRow"),
  displayFieldSelect: document.querySelector("#displayFieldSelect"),
  importPreviewBlock: document.querySelector("#importPreviewBlock"),
  importPreviewTable: document.querySelector("#importPreviewTable"),
  layerWarning: document.querySelector("#layerWarning"),
  layerTarget: document.querySelector("#layerTarget"),
  dialogMessage: document.querySelector("#dialogMessage"),
  confirmLayer: document.querySelector("#confirmLayer"),
  toast: document.querySelector("#toast"),
  mapShell: document.querySelector(".map-shell"),
  mapLegend: document.querySelector("#mapLegend"),
  attributePanel: document.querySelector("#attributePanel"),
  attributePanelTitle: document.querySelector("#attributePanelTitle"),
  attributePanelSubtitle: document.querySelector("#attributePanelSubtitle"),
  attributeTableWrap: document.querySelector("#attributeTableWrap"),
  attributeSearchInput: document.querySelector("#attributeSearchInput"),
  attributePageSize: document.querySelector("#attributePageSize"),
  attributePrevPage: document.querySelector("#attributePrevPage"),
  attributeNextPage: document.querySelector("#attributeNextPage"),
  attributePageStatus: document.querySelector("#attributePageStatus"),
  closeAttributePanel: document.querySelector("#closeAttributePanel"),
  toggleAttributePanel: document.querySelector("#toggleAttributePanel"),
  attributeResizeHandle: document.querySelector("#attributeResizeHandle"),
  editAttributeTable: document.querySelector("#editAttributeTable"),
  saveAttributeTable: document.querySelector("#saveAttributeTable"),
  attributeZoomToSelection: document.querySelector("#attributeZoomToSelection"),
  renameLayerDialog: document.querySelector("#renameLayerDialog"),
  renameLayerInput: document.querySelector("#renameLayerInput"),
  renameLayerWarning: document.querySelector("#renameLayerWarning"),
  saveLayerRename: document.querySelector("#saveLayerRename"),
};

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "OpenStreetMap contributors",
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  },
  center: [-3.7, 40.2],
  zoom: 4.8,
});

let searchAbortController = null;
let searchDebounceTimer = null;
let searchResults = [];
let searchActiveIndex = -1;
let openLayerMenuId = null;
let renameLayerId = null;
const attributeState = {
  selectedLayerId: null,
  layerId: null,
  rows: [],
  selectedFeatureIndex: null,
  minimized: false,
  editMode: false,
  zoomToSelection: true,
  height: 170,
  sortColumn: "__row",
  sortDirection: "asc",
  search: "",
  page: 1,
  pageSize: 50,
};

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");

document.querySelectorAll(".layer-list > .base-card, #uploadedLayers").forEach((node) => node.remove());

function updateMapStatus(point) {
  const focus = point || map.getCenter();
  const lng = Number(focus.lng ?? focus.x ?? 0).toFixed(4);
  const lat = Number(focus.lat ?? focus.y ?? 0).toFixed(4);
  const zoom = map.getZoom().toFixed(2);
  const bearing = map.getBearing().toFixed(1);
  const pitch = map.getPitch().toFixed(1);
  const bounds = map.getBounds();
  const bbox = [
    bounds.getWest().toFixed(4),
    bounds.getSouth().toFixed(4),
    bounds.getEast().toFixed(4),
    bounds.getNorth().toFixed(4),
  ].join(", ");
  els.mapStatus.textContent = `Coords: ${lng}, ${lat}   Zoom: ${zoom}   Bearing: ${bearing}°   Pitch: ${pitch}°   BBox: ${bbox}`;
}

function syncMapScalePosition() {
  const scaleEl = document.querySelector(".maplibregl-ctrl-scale");
  if (scaleEl && !els.mapScale.contains(scaleEl)) {
    els.mapScale.innerHTML = "";
    els.mapScale.append(scaleEl);
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    els.mapShell.requestFullscreen?.();
    return;
  }
  document.exitFullscreen?.();
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  window.setTimeout(() => els.toast.classList.remove("visible"), 2600);
}

function updateSearchClearVisibility() {
  els.mapSearchClear.classList.toggle("is-hidden", !els.mapSearchInput.value.trim());
}

function collapseSearchResults() {
  searchResults = [];
  searchActiveIndex = -1;
  els.mapSearchResults.innerHTML = "";
  els.mapSearchResults.classList.add("is-hidden");
}

function searchLabelParts(item) {
  const address = item.address || {};
  const primary =
    item.name ||
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.state ||
    item.display_name?.split(",")[0] ||
    "Lugar";

  return {
    primary,
    secondary: item.display_name || "",
  };
}

function renderSearchResults(items = []) {
  searchResults = items;
  searchActiveIndex = items.length ? 0 : -1;

  if (!items.length) {
    els.mapSearchResults.innerHTML = `<button type="button" class="map-search-result"><strong>${t("searchNoResults")}</strong></button>`;
    els.mapSearchResults.classList.remove("is-hidden");
    return;
  }

  els.mapSearchResults.innerHTML = items
    .map((item, index) => {
      const label = searchLabelParts(item);
      return `
        <button type="button" class="map-search-result ${index === searchActiveIndex ? "is-active" : ""}" data-index="${index}">
          <strong>${sanitizeHtml(label.primary)}</strong>
          <span>${sanitizeHtml(label.secondary)}</span>
        </button>`;
    })
    .join("");
  els.mapSearchResults.classList.remove("is-hidden");
}

function updateSearchActiveResult() {
  const buttons = Array.from(els.mapSearchResults.querySelectorAll(".map-search-result[data-index]"));
  buttons.forEach((button, index) => {
    button.classList.toggle("is-active", index === searchActiveIndex);
  });
}

function focusSearchResult(item) {
  if (!item) return;

  els.mapSearchInput.value = item.display_name || item.name || "";
  updateSearchClearVisibility();
  collapseSearchResults();

  const bbox = item.boundingbox || [];
  if (bbox.length === 4) {
    const south = Number(bbox[0]);
    const north = Number(bbox[1]);
    const west = Number(bbox[2]);
    const east = Number(bbox[3]);
    if ([south, north, west, east].every(Number.isFinite)) {
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 42, duration: 800, maxZoom: 12 }
      );
      return;
    }
  }

  const lon = Number(item.lon);
  const lat = Number(item.lat);
  if (Number.isFinite(lon) && Number.isFinite(lat)) {
    map.flyTo({ center: [lon, lat], zoom: 11, duration: 800 });
  }
}

async function fetchSearchResults(query) {
  if (searchAbortController) {
    searchAbortController.abort();
  }
  searchAbortController = new AbortController();

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "es",
    dedupe: "1",
    limit: "8",
    "accept-language": state.lang === "ca" ? "ca,es" : "es,ca",
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    signal: searchAbortController.signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(t("searchError"));
  }

  const items = await response.json();
  return Array.isArray(items) ? items : [];
}

async function runMapSearch(query) {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    collapseSearchResults();
    return;
  }

  try {
    const results = await fetchSearchResults(trimmed);
    renderSearchResults(results);
  } catch (error) {
    if (error.name === "AbortError") return;
    renderSearchResults([]);
    toast(error.message || t("searchError"));
  }
}

function updateVisibilityButton(button, visible) {
  if (!button) return;
  button.classList.toggle("is-visible", visible);
  button.classList.toggle("is-hidden-layer", !visible);
  button.setAttribute("aria-label", visible ? "Ocultar capa" : "Mostrar capa");
  button.title = visible ? "Ocultar capa" : "Mostrar capa";
}

function closeLayerMenus() {
  openLayerMenuId = null;
  renderLayers();
}

function attributeRowsFromGeojson(geojson) {
  const features = Array.isArray(geojson.features) ? geojson.features : [];
  return features.map((feature, index) => ({ __row: index + 1, __featureIndex: index, ...(feature.properties || {}) }));
}

function attributeColumnsFromRows(rows = []) {
  const columns = new Set(["__row"]);
  rows.forEach((row) => Object.keys(row).forEach((key) => columns.add(key)));
  return Array.from(columns).filter((column) => column !== "__featureIndex");
}

function sortAttributeRows(rows = []) {
  const column = attributeState.sortColumn || "__row";
  const direction = attributeState.sortDirection === "desc" ? -1 : 1;
  const sorted = [...rows];
  sorted.sort((a, b) => {
    const av = a[column];
    const bv = b[column];
    const an = Number(av);
    const bn = Number(bv);
    const bothNumeric = Number.isFinite(an) && Number.isFinite(bn) && `${av}` !== "" && `${bv}` !== "";
    if (bothNumeric) return (an - bn) * direction;
    return `${av ?? ""}`.localeCompare(`${bv ?? ""}`, undefined, { numeric: true, sensitivity: "base" }) * direction;
  });
  return sorted;
}

function filterAttributeRows(rows = []) {
  const query = attributeState.search.trim().toLowerCase();
  if (!query) return [...rows];
  return rows.filter((row) =>
    Object.entries(row).some(([key, value]) => key !== "__featureIndex" && `${value ?? ""}`.toLowerCase().includes(query))
  );
}

function syncAttributePanelUi() {
  els.attributePanel.classList.toggle("is-minimized", attributeState.minimized);
  els.toggleAttributePanel.className = `group-toggle ${attributeState.minimized ? "is-collapsed" : "is-expanded"}`;
  els.toggleAttributePanel.innerHTML = attributeState.minimized ? "&#9656;" : "&#9662;";
  els.toggleAttributePanel.title = attributeState.minimized ? "Expandir tabla" : "Minimizar tabla";
  els.toggleAttributePanel.setAttribute("aria-label", attributeState.minimized ? "Expandir tabla" : "Minimizar tabla");
  els.editAttributeTable.classList.toggle("primary-action", attributeState.editMode);
  els.saveAttributeTable.disabled = !attributeState.editMode;
  els.attributeZoomToSelection.checked = attributeState.zoomToSelection;
  els.attributePanel.style.height = attributeState.minimized ? "52px" : `${attributeState.height}px`;
  els.attributeSearchInput.value = attributeState.search;
  els.attributePageSize.value = `${attributeState.pageSize}`;
}

function renderAttributeTable(layer, rows = []) {
  attributeState.selectedLayerId = layer?.id || attributeState.selectedLayerId;
  attributeState.layerId = layer?.id || null;
  attributeState.rows = rows.map((row) => ({ ...row }));
  els.attributePanelTitle.textContent = "Tabla de atributos";
  els.attributePanelSubtitle.textContent = layer?.name || "";
  syncAttributePanelUi();

  if (!rows.length) {
    els.attributeTableWrap.innerHTML = '<div class="attribute-empty">Esta capa no tiene atributos tabulares disponibles.</div>';
    els.attributePanel.classList.remove("is-hidden");
    return;
  }

  const columns = attributeColumnsFromRows(rows);
  const filteredRows = filterAttributeRows(attributeState.rows);
  const sortedRows = sortAttributeRows(filteredRows);
  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / attributeState.pageSize));
  attributeState.page = Math.min(Math.max(1, attributeState.page), totalPages);
  const startIndex = (attributeState.page - 1) * attributeState.pageSize;
  const endIndex = startIndex + attributeState.pageSize;
  const displayRows = sortedRows.slice(startIndex, endIndex);
  els.attributePageStatus.textContent = totalRows ? `${startIndex + 1}-${Math.min(endIndex, totalRows)} de ${totalRows}` : "0 resultados";
  els.attributePrevPage.disabled = attributeState.page <= 1;
  els.attributeNextPage.disabled = attributeState.page >= totalPages;
  els.attributeTableWrap.innerHTML = `
    <table class="attribute-table">
      <thead>
        <tr>${columns
          .map((column) => `<th class="is-sortable ${attributeState.sortColumn === column ? `is-sorted-${attributeState.sortDirection}` : ""}" data-column="${sanitizeHtml(column)}">${sanitizeHtml(column === "__row" ? "#" : column)}</th>`)
          .join("")}</tr>
      </thead>
      <tbody>
        ${displayRows
          .map(
            (row) => `<tr data-feature-index="${row.__featureIndex}" class="${attributeState.selectedFeatureIndex === row.__featureIndex ? "is-selected" : ""}">${columns
              .map((column) => {
                const editable = attributeState.editMode && column !== "__row";
                return `<td class="${editable ? "is-editing" : ""}" data-column="${sanitizeHtml(column)}" ${editable ? 'contenteditable="true"' : ""}>${sanitizeHtml(row[column] ?? "")}</td>`;
              })
              .join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
  els.attributePanel.classList.remove("is-hidden");
}

function focusFeatureRow(layerId, rowIndex) {
  const feature = state.layerRuntime[layerId]?.geojson?.features?.[rowIndex];
  if (!feature?.geometry) return;
  showHighlightedFeature(feature);
  const geometryType = feature.geometry.type || "";
  if (geometryType === "Point") {
    const [lon, lat] = feature.geometry.coordinates || [];
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      map.flyTo({ center: [lon, lat], zoom: 11, duration: 700 });
    }
    return;
  }
  const bounds = boundsFromGeojsonGeometry(feature.geometry);
  if (bounds) {
    focusBounds(bounds, { maxZoom: 12 });
  }
}

function ensureFeatureHighlightLayers() {
  if (!map.getSource("feature-highlight")) {
    map.addSource("feature-highlight", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getLayer("feature-highlight-fill")) {
    map.addLayer({
      id: "feature-highlight-fill",
      type: "fill",
      source: "feature-highlight",
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": "#ffd166",
        "fill-opacity": 0.12,
      },
    });
  }

  if (!map.getLayer("feature-highlight-line")) {
    map.addLayer({
      id: "feature-highlight-line",
      type: "line",
      source: "feature-highlight",
      filter: [
        "any",
        ["==", ["geometry-type"], "Polygon"],
        ["==", ["geometry-type"], "LineString"],
      ],
      paint: {
        "line-color": "#ff7f11",
        "line-width": 3,
      },
    });
  }

  if (!map.getLayer("feature-highlight-circle")) {
    map.addLayer({
      id: "feature-highlight-circle",
      type: "circle",
      source: "feature-highlight",
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": 7,
        "circle-color": "#ffd166",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ff7f11",
      },
    });
  }
}

function showHighlightedFeature(feature) {
  ensureFeatureHighlightLayers();
  const source = map.getSource("feature-highlight");
  source?.setData({
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: feature.properties || {}, geometry: feature.geometry }],
  });
}

async function revealFeatureInAttributeTable(layerId, featureIndex) {
  if (els.attributePanel.classList.contains("is-hidden")) return;

  if (attributeState.layerId !== layerId) {
    await openAttributeTable(layerId);
  }

  const layer = state.layers.find((item) => item.id === layerId);
  if (!layer) return;

  let rows = attributeState.rows;
  let filteredRows = filterAttributeRows(rows);
  if (!filteredRows.some((row) => row.__featureIndex === featureIndex)) {
    attributeState.search = "";
    filteredRows = [...rows];
  }

  const sortedRows = sortAttributeRows(filteredRows);
  const rowPosition = sortedRows.findIndex((row) => row.__featureIndex === featureIndex);
  if (rowPosition < 0) return;

  attributeState.selectedFeatureIndex = featureIndex;
  attributeState.page = Math.floor(rowPosition / attributeState.pageSize) + 1;
  renderAttributeTable(layer, rows);

  requestAnimationFrame(() => {
    const row = els.attributeTableWrap.querySelector(`tr[data-feature-index="${featureIndex}"]`);
    row?.scrollIntoView({ block: "nearest" });
  });
}

async function openAttributeTable(layerId) {
  const layer = state.layers.find((item) => item.id === layerId);
  if (!layer) return;
  attributeState.selectedLayerId = layerId;
  attributeState.editMode = false;
  attributeState.selectedFeatureIndex = null;
  attributeState.minimized = false;
  attributeState.sortColumn = "__row";
  attributeState.sortDirection = "asc";
  attributeState.search = "";
  attributeState.page = 1;

  if (layer.type === "raster") {
    renderAttributeTable(layer, []);
    return;
  }

  const cached = state.layerRuntime[layerId]?.attributeRows;
  if (cached) {
    renderAttributeTable(layer, cached);
    return;
  }

  const geojson = annotateGeojsonFeatures(JSON.parse(await requestText(api.data(layerId))));
  const rows = attributeRowsFromGeojson(geojson);
  state.layerRuntime[layerId] = { ...(state.layerRuntime[layerId] || {}), attributeRows: rows, geojson };
  renderAttributeTable(layer, rows);
}

function openRenameLayerDialog(layer) {
  renameLayerId = layer.id;
  els.renameLayerWarning.textContent = "";
  els.renameLayerInput.value = layer.name || "";
  els.renameLayerDialog.showModal();
  els.renameLayerInput.focus();
  els.renameLayerInput.select();
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll(".language-switch button").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === state.lang);
  });
  els.userRole.value = state.role;
  document.querySelector(".admin-target")?.classList.toggle("is-hidden", state.role !== "admin");
  els.selectedFile.textContent = els.fileInput.files?.[0]?.name || t("noFile");
  updateJoinHint();
  validateLayerDialog();
  if (state.importInspection) {
    renderImportSummary(state.importInspection);
  }
  document.querySelector("#groupDialog")?._syncGroupDialogText?.();
  document.querySelector("#groupDialog")?._validateGroupDialog?.();
  els.mapSearchInput.placeholder = t("searchPlaceholder");
  els.mapSearchClear.title = t("searchClear");
  els.mapSearchClear.setAttribute("aria-label", t("searchClear"));
  renderLayers();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || data.error || "Error de API");
  }
  return data;
}

async function requestText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("No se pudo cargar el recurso.");
  return response.text();
}

const categoryPalette = ["#d67b5b", "#e0c16f", "#6b9b7a", "#2f6f73", "#7d8cc4", "#b07aa1", "#5a9367", "#c97f52"];

function isNumericFieldType(type = "") {
  return /numeric|integer|double|float|number/i.test(type);
}

function inspectionFieldMap() {
  const fields = state.importInspection?.fields || [];
  return Object.fromEntries(fields.map((field) => [field.name, field.type || ""]));
}

function formatLegendValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString(state.lang === "ca" ? "ca-ES" : "es-ES", { maximumFractionDigits: 2 });
  }
  return `${value ?? ""}`;
}

function sanitizeHtml(value) {
  return `${value ?? ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function popupHtml(properties = {}) {
  const entries = Object.entries(properties).filter(([, value]) => value !== null && value !== undefined && `${value}` !== "");
  if (!entries.length) return "<div class=\"popup-empty\">Sin datos</div>";
  return `
    <div class="popup-card">
      ${entries
        .map(
          ([key, value]) => `
            <div class="popup-row">
              <strong>${sanitizeHtml(key)}</strong>
              <span>${sanitizeHtml(value)}</span>
            </div>`
        )
        .join("")}
    </div>`;
}

function renderLegend(layer) {
  const legend = state.layerRuntime[layer?.id]?.legend;
  if (!layer || !legend || layer.visible === false) {
    els.mapLegend.classList.add("is-hidden");
    els.mapLegend.innerHTML = "";
    return;
  }

  if (legend.kind === "numeric") {
    els.mapLegend.innerHTML = `
      <div class="map-legend-title">${sanitizeHtml(layer.name)}</div>
      <div class="map-legend-subtitle">${sanitizeHtml(layer.display_field || legend.label || t("rasterLegendLabel"))}</div>
      <div class="legend-ramp">
        <div class="legend-gradient"></div>
        <div class="legend-range">
          <span>${sanitizeHtml(formatLegendValue(legend.min))}</span>
          <span>${sanitizeHtml(formatLegendValue(legend.max))}</span>
        </div>
      </div>`;
  } else if (legend.kind === "categorical") {
    els.mapLegend.innerHTML = `
      <div class="map-legend-title">${sanitizeHtml(layer.name)}</div>
      <div class="map-legend-subtitle">${sanitizeHtml(layer.display_field)}</div>
      <div class="legend-categories">
        ${legend.items
          .map(
            (item) => `
              <div class="legend-item">
                <span class="legend-swatch" style="background:${item.color}"></span>
                <span>${sanitizeHtml(item.label)}</span>
              </div>`
          )
          .join("")}
      </div>`;
  } else {
    els.mapLegend.classList.add("is-hidden");
    els.mapLegend.innerHTML = "";
    return;
  }

  els.mapLegend.classList.remove("is-hidden");
}

function updateActiveLegend() {
  const topVisibleLayer = flattenedLayerKeys()
    .map((key) => (key.startsWith("user:") ? state.layers.find((layer) => layerKey(layer) === key) : null))
    .find((layer) => layer && layer.visible !== false && state.layerRuntime[layer.id]?.legend);
  renderLegend(topVisibleLayer || null);
}

function rasterLegend(metadata = {}) {
  const min = Number(metadata.min);
  const max = Number(metadata.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return null;
  return {
    kind: "numeric",
    min,
    max,
    label: t("rasterLegendLabel"),
  };
}

function thematicStyle(layer, geojson, geometryType) {
  const field = layer.display_field;
  if (!field) return { kind: "simple" };

  const values = (geojson.features || []).map((feature) => feature?.properties?.[field]).filter((value) => value !== null && value !== undefined && `${value}` !== "");
  if (!values.length) return { kind: "simple" };

  const fieldType = (layer.metadata?.field_info || []).find((item) => item.name === field)?.type || "";
  const numericValues = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));

  if (isNumericFieldType(fieldType) || numericValues.length === values.length) {
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      return { kind: "simple" };
    }
    return {
      kind: "numeric",
      field,
      min,
      max,
      expression: ["interpolate", ["linear"], ["to-number", ["coalesce", ["get", field], min]], min, "#d67b5b", min + (max - min) / 3, "#e0c16f", min + (2 * (max - min)) / 3, "#6b9b7a", max, "#2f6f73"],
    };
  }

  const categories = [...new Set(values.map((value) => `${value}`))].slice(0, categoryPalette.length);
  if (categories.length < 2) return { kind: "simple" };
  const colorPairs = categories.flatMap((value, index) => [value, categoryPalette[index % categoryPalette.length]]);
  return {
    kind: "categorical",
    field,
    expression: ["match", ["to-string", ["coalesce", ["get", field], ""]], ...colorPairs, "#8aa29f"],
    items: categories.map((label, index) => ({ label, color: categoryPalette[index % categoryPalette.length] })),
  };
}

async function loadBaseLayers() {
  const ccaa = await requestText(api.base("ccaa")).then(JSON.parse);

  if (map.getSource("base-ccaa")) {
    map.getSource("base-ccaa").setData(ccaa);
  } else {
    map.addSource("base-ccaa", { type: "geojson", data: ccaa });
    map.addLayer({
      id: "base-ccaa-fill",
      type: "fill",
      source: "base-ccaa",
      paint: {
        "fill-color": "#d9e2df",
        "fill-opacity": state.baseLayers.ccaa.opacity,
      },
    });
    map.addLayer({
      id: "base-ccaa-line",
      type: "line",
      source: "base-ccaa",
      paint: {
        "line-color": "#263238",
        "line-width": 1.2,
      },
    });
  }
}

function removeMapLayer(id) {
  for (const suffix of ["fill", "line", "circle", "raster"]) {
    const layerId = `${id}-${suffix}`;
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  if (map.getSource(id)) map.removeSource(id);
  delete state.layerRuntime[id.replace(/^user-/, "")];
}

function cleanupStaleUserLayers() {
  const activeSourceIds = new Set(state.layers.map((layer) => `user-${layer.id}`));
  const style = map.getStyle?.();
  const sourceIds = Object.keys(style?.sources || {}).filter((id) => id.startsWith("user-"));
  for (const sourceId of sourceIds) {
    if (!activeSourceIds.has(sourceId)) {
      removeMapLayer(sourceId);
    }
  }

  for (const layerId of Object.keys(state.layerRuntime || {})) {
    const sourceId = `user-${layerId}`;
    if (!activeSourceIds.has(sourceId)) {
      delete state.layerRuntime[layerId];
    }
  }
}

function extendBounds(bounds, lng, lat) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return bounds;
  if (!bounds) return [lng, lat, lng, lat];
  return [
    Math.min(bounds[0], lng),
    Math.min(bounds[1], lat),
    Math.max(bounds[2], lng),
    Math.max(bounds[3], lat),
  ];
}

function boundsFromCoordinates(coordinates = []) {
  const pairs = Array.isArray(coordinates) ? coordinates : Object.values(coordinates || {});
  let bounds = null;
  for (const pair of pairs) {
    if (Array.isArray(pair) && pair.length >= 2) {
      bounds = extendBounds(bounds, Number(pair[0]), Number(pair[1]));
    }
  }
  return bounds;
}

function boundsFromMetadata(metadata = {}) {
  const bbox = metadata.bounds_wgs84 || metadata.bbox || {};
  const xmin = Number(bbox.xmin);
  const ymin = Number(bbox.ymin);
  const xmax = Number(bbox.xmax);
  const ymax = Number(bbox.ymax);
  if (![xmin, ymin, xmax, ymax].every(Number.isFinite)) return null;
  return [xmin, ymin, xmax, ymax];
}

function annotateGeojsonFeatures(geojson = {}) {
  return {
    ...geojson,
    features: (geojson.features || []).map((feature, index) => ({
      ...feature,
      properties: {
        ...(feature.properties || {}),
        __featureIndex: index,
      },
    })),
  };
}

function normalizeImageCoordinates(coordinates = []) {
  const pairs = Array.isArray(coordinates) ? coordinates : Object.values(coordinates || {});
  return pairs
    .map((pair) => [Number(pair?.[0]), Number(pair?.[1])])
    .filter((pair) => pair.every(Number.isFinite));
}

function boundsFromGeojsonGeometry(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Point") {
    return boundsFromCoordinates([geometry.coordinates]);
  }
  if (geometry.type === "MultiPoint" || geometry.type === "LineString") {
    return boundsFromCoordinates(geometry.coordinates);
  }
  if (geometry.type === "MultiLineString" || geometry.type === "Polygon") {
    return geometry.coordinates.reduce((acc, part) => {
      const partBounds = boundsFromCoordinates(part);
      if (!partBounds) return acc;
      return extendBounds(extendBounds(acc, partBounds[0], partBounds[1]), partBounds[2], partBounds[3]);
    }, null);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.reduce((acc, polygon) => {
      const polygonBounds = boundsFromGeojsonGeometry({ type: "Polygon", coordinates: polygon });
      if (!polygonBounds) return acc;
      return extendBounds(extendBounds(acc, polygonBounds[0], polygonBounds[1]), polygonBounds[2], polygonBounds[3]);
    }, null);
  }
  return null;
}

function boundsFromGeojson(geojson) {
  return (geojson.features || []).reduce((acc, feature) => {
    const featureBounds = boundsFromGeojsonGeometry(feature.geometry);
    if (!featureBounds) return acc;
    return extendBounds(extendBounds(acc, featureBounds[0], featureBounds[1]), featureBounds[2], featureBounds[3]);
  }, null);
}

function focusBounds(bounds, options = {}) {
  if (!bounds || bounds.some((value) => !Number.isFinite(value))) return;
  map.fitBounds(
    [
      [bounds[0], bounds[1]],
      [bounds[2], bounds[3]],
    ],
    { padding: 54, duration: 800, maxZoom: 11, ...options }
  );
}

function focusLayerById(layerId) {
  const bounds = state.layerRuntime[layerId]?.bounds;
  if (bounds) {
    focusBounds(bounds);
  }
}

async function drawLayer(layer) {
  const sourceId = `user-${layer.id}`;
  removeMapLayer(sourceId);
  const opacity = Number(layer.opacity ?? 0.65);
  const visible = layer.visible === false ? "none" : "visible";

  if (layer.type === "raster") {
    const raster = await requestJson(api.data(layer.id));
    const imageCoordinates = normalizeImageCoordinates(raster.coordinates);
    state.layerRuntime[layer.id] = {
      bounds: boundsFromMetadata(raster.metadata) || boundsFromCoordinates(imageCoordinates),
      legend: rasterLegend(raster.metadata || {}),
    };
    map.addSource(sourceId, {
      type: "image",
      url: raster.image,
      coordinates: imageCoordinates,
    });
    map.addLayer({
      id: `${sourceId}-raster`,
      type: "raster",
      source: sourceId,
      layout: { visibility: visible },
      paint: { "raster-opacity": opacity },
    });
    return;
  }

  const geojson = annotateGeojsonFeatures(JSON.parse(await requestText(api.data(layer.id))));
  map.addSource(sourceId, { type: "geojson", data: geojson });

  const firstGeometry = geojson.features?.find((feature) => feature.geometry)?.geometry?.type || "";
  const style = thematicStyle(layer, geojson, firstGeometry);
  state.layerRuntime[layer.id] = { legend: style, bounds: boundsFromGeojson(geojson), geojson };

  if (firstGeometry.includes("Polygon")) {
    map.addLayer({
      id: `${sourceId}-fill`,
      type: "fill",
      source: sourceId,
      layout: { visibility: visible },
      paint: { "fill-color": style.expression || "#4f9a94", "fill-opacity": opacity },
    });
    map.addLayer({
      id: `${sourceId}-line`,
      type: "line",
      source: sourceId,
      layout: { visibility: visible },
      paint: { "line-color": "#1f4e52", "line-opacity": opacity, "line-width": 1.1 },
    });
  } else if (firstGeometry.includes("Line")) {
    map.addLayer({
      id: `${sourceId}-line`,
      type: "line",
      source: sourceId,
      layout: { visibility: visible },
      paint: { "line-color": style.expression || "#1f4e52", "line-opacity": opacity, "line-width": 2 },
    });
  } else {
    map.addLayer({
      id: `${sourceId}-circle`,
      type: "circle",
      source: sourceId,
      layout: { visibility: visible },
      paint: {
        "circle-radius": 5,
        "circle-color": style.expression || "#4f9a94",
        "circle-opacity": opacity,
        "circle-stroke-color": "#1f4e52",
        "circle-stroke-width": 1,
      },
    });
  }
}

function layerIdFromRenderedFeature(feature) {
  const layerId = feature?.layer?.id || "";
  const match = layerId.match(/^user-(.+?)-(fill|line|circle|raster)$/);
  return match ? match[1] : null;
}

function originalFeatureFromRenderedFeature(feature) {
  const layerId = layerIdFromRenderedFeature(feature);
  const featureIndex = Number(feature?.properties?.__featureIndex);
  if (!layerId || !Number.isInteger(featureIndex)) return feature;
  const original = state.layerRuntime[layerId]?.geojson?.features?.[featureIndex];
  return original ? { ...original, properties: original.properties || {} } : feature;
}

async function redrawUserLayers(focusId = null) {
  cleanupStaleUserLayers();
  for (const layer of state.layers) removeMapLayer(`user-${layer.id}`);
  for (const layer of [...state.layers].reverse()) await drawLayer(layer);
  applyMapOrder();
  updateActiveLegend();
  if (focusId) {
    focusLayerById(focusId);
  }
}

function renderLayers() {
  els.uploadedLayers.innerHTML = "";
  if (!state.layers.length) return;

  for (const layer of state.layers) {
    const card = document.createElement("article");
    card.className = "layer-card";
    card.draggable = true;
    card.dataset.id = layer.id;
    card.classList.toggle("is-locked", !canEditLayer(layer));
    card.innerHTML = `
      <div class="layer-row">
        <button type="button" class="visibility-toggle ${layer.visible === false ? "is-hidden-layer" : "is-visible"}" data-action="visible" aria-label="${layer.visible === false ? "Mostrar capa" : "Ocultar capa"}"></button>
        <span class="layer-glyph">▧</span>
        <strong title="${sanitizeHtml(layer.name)}">${sanitizeHtml(layer.name)}</strong>
        <span class="pill">${layer.type.toUpperCase()}</span>
        <span class="layer-tools">
          <button class="layer-tool" data-action="up" title="Subir capa">↑</button>
          <button class="layer-tool" data-action="down" title="Bajar capa">↓</button>
          <button class="layer-tool delete" data-action="delete" title="Eliminar capa">×</button>
        </span>
      </div>
      <small>${layerTypeLabel(layer)}</small>
      <label class="opacity-row">
        <span class="opacity-label">${t("opacity")}</span>
        <input type="range" min="0" max="1" step="0.05" value="${layer.opacity ?? 0.65}" data-action="opacity" />
      </label>
    `;
    els.uploadedLayers.append(card);
  }
}

function storageSet() {
  localStorage.setItem("plancaza_layer_order", JSON.stringify(state.layerOrder));
  localStorage.setItem("plancaza_layer_groups", JSON.stringify(state.groups));
}

function normalizeGroupCategory(category) {
  return category === "social" ? "social" : "ecological";
}

function categoryLabel(category) {
  return t(normalizeGroupCategory(category));
}

function layerKey(layer) {
  return `user:${layer.id}`;
}

function validTopLevelKeys() {
  const userKeys = new Set(state.layers.map(layerKey));
  const groupKeys = new Set(state.groups.map((group) => `group:${group.id}`));
  return new Set(["base:ccaa", ...userKeys, ...groupKeys]);
}

function syncLayerOrder() {
  const valid = validTopLevelKeys();
  const grouped = new Set();
  state.groups.forEach((group) => {
    group.category = normalizeGroupCategory(group.category);
    group.items = (group.items || []).filter((key) => valid.has(key) && !key.startsWith("group:") && !FIXED_BASE_KEYS.has(key));
    group.items.forEach((key) => grouped.add(key));
  });
  state.layerOrder = state.layerOrder.filter((key) => valid.has(key) && !grouped.has(key));
  for (const key of ["base:ccaa", ...state.groups.map((group) => `group:${group.id}`), ...state.layers.map(layerKey)]) {
    if (valid.has(key) && !grouped.has(key) && !state.layerOrder.includes(key)) state.layerOrder.push(key);
  }
  storageSet();
}

function flattenedLayerKeys() {
  syncLayerOrder();
  const result = [];
  for (const key of state.layerOrder) {
    if (key.startsWith("group:")) {
      const group = state.groups.find((item) => `group:${item.id}` === key);
      if (group && group.collapsed !== true) result.push(...(group.items || []));
    } else {
      result.push(key);
    }
  }
  return result;
}

function mapLayerIdsForKey(key) {
  if (key === "base:ccaa") return state.baseLayers.ccaa.mapLayers;
  if (key.startsWith("user:")) {
    const id = key.replace("user:", "");
    return [`user-${id}-raster`, `user-${id}-fill`, `user-${id}-line`, `user-${id}-circle`];
  }
  return [];
}

function applyMapOrder() {
  const bottomToTop = flattenedLayerKeys();
  for (const key of bottomToTop) {
    for (const id of mapLayerIdsForKey(key)) {
      if (map.getLayer(id)) map.moveLayer(id);
    }
  }
}

function interactiveUserLayerIds() {
  return state.layers.flatMap((layer) =>
    [`user-${layer.id}-fill`, `user-${layer.id}-line`, `user-${layer.id}-circle`].filter((id) => map.getLayer(id))
  );
}

function dragHandle() {
  return '<button type="button" class="drag-handle" draggable="true" title="Mover capa" aria-label="Mover capa"></button>';
}

function renderBaseCard(kind) {
  const base = state.baseLayers[kind];
  return `
    <article class="layer-card base-card is-locked" data-key="base:${kind}">
      <div class="layer-row base-row">
        <button type="button" class="visibility-toggle ${base.visible ? "is-visible" : "is-hidden-layer"}" data-action="base-visible" aria-label="${base.visible ? "Ocultar capa" : "Mostrar capa"}"></button>
        <strong>${base.name}</strong>
        <span class="pill">BASE</span>
      </div>
      <small>${t(base.metaKey)}</small>
      <label class="opacity-row">
        <span class="opacity-label">${t("opacity")}</span>
        <input type="range" min="0" max="1" value="${base.opacity}" step="0.05" data-action="base-opacity" />
      </label>
    </article>
  `;
}

function renderUserCard(layer) {
  const menuOpen = openLayerMenuId === layer.id;
  const selected = attributeState.selectedLayerId === layer.id;
  const isRaster = layer.type === "raster";
  return `
    <article class="layer-card ${canEditLayer(layer) ? "" : "is-locked"} ${selected ? "is-selected" : ""}" draggable="true" data-key="user:${layer.id}" data-id="${layer.id}">
      <div class="layer-row">
        ${dragHandle()}
        <button type="button" class="visibility-toggle ${layer.visible === false ? "is-hidden-layer" : "is-visible"}" data-action="visible" aria-label="${layer.visible === false ? "Mostrar capa" : "Ocultar capa"}"></button>
        <strong title="${sanitizeHtml(layer.name)}">${sanitizeHtml(layer.name)}</strong>
        <span class="pill">${layer.type.toUpperCase()}</span>
        <span class="layer-tools">
          <button class="layer-tool delete" data-action="delete" title="Eliminar capa">×</button>
        </span>
      </div>
      <label class="opacity-row">
        <span class="opacity-label">${t("opacity")}</span>
        <input type="range" min="0" max="1" step="0.05" value="${layer.opacity ?? 0.65}" data-action="opacity" />
      </label>
      <div class="layer-menu-row">
        <button type="button" class="layer-icon-button layer-table-button" data-action="open-attributes" title="Abrir tabla de atributos" aria-label="Abrir tabla de atributos"></button>
        <button type="button" class="layer-icon-button layer-zoom-button" data-action="focus-layer" title="Zoom a la capa" aria-label="Zoom a la capa"></button>
        <button type="button" class="layer-menu-toggle ${menuOpen ? "is-open" : ""}" data-action="layer-menu-toggle" title="Opciones de capa">...</button>
        ${menuOpen ? `
          <div class="layer-dropdown">
            <button type="button" data-action="rename">Renombrar</button>
            <div class="layer-dropdown-group">
              <span class="layer-dropdown-label">Descargar</span>
              <button type="button" data-action="download-geojson">${isRaster ? "GeoTIFF" : "GeoJSON"}</button>
              ${isRaster ? "" : '<button type="button" data-action="download-csv">CSV atributos</button>'}
            </div>
          </div>` : ""}
      </div>
    </article>
  `;
}

function renderGroupCard(group) {
  const expanded = group.collapsed !== true;
  const children = (group.items || []).map(renderLayerKey).join("");
  return `
    <section class="layer-group ${expanded ? "" : "is-collapsed"}" data-key="group:${group.id}">
      <article class="layer-card group-card" draggable="true" data-key="group:${group.id}">
        <div class="layer-row group-row">
          ${dragHandle()}
          <button type="button" class="group-toggle" data-action="group-toggle" aria-label="${expanded ? "Contraer grupo" : "Expandir grupo"}">${expanded ? "⌄" : "›"}</button>
          <button type="button" class="visibility-toggle ${group.visible === false ? "is-hidden-layer" : "is-visible"}" data-action="group-visible" aria-label="${group.visible === false ? "Mostrar grupo" : "Ocultar grupo"}"></button>
          <strong title="${group.name}">${group.name}</strong>
          <button class="layer-tool delete" data-action="group-delete" title="Eliminar grupo">×</button>
        </div>
        <label class="opacity-row">
          <span class="opacity-label">${t("opacity")}</span>
          <input type="range" min="0" max="1" step="0.05" value="${group.opacity ?? 1}" data-action="group-opacity" />
        </label>
      </article>
      <div class="group-children" data-group-id="${group.id}">
        ${expanded ? children : ""}
      </div>
    </section>
  `;
}

function renderGroupCardV2(group) {
  const expanded = group.collapsed !== true;
  const children = (group.items || []).map(renderLayerKey).join("");
  const category = normalizeGroupCategory(group.category);
  return `
    <section class="layer-group ${expanded ? "" : "is-collapsed"}" data-key="group:${group.id}">
      <article class="layer-card group-card" draggable="true" data-key="group:${group.id}">
        <div class="layer-row group-row">
          <button type="button" class="group-toggle ${expanded ? "is-expanded" : "is-collapsed"}" data-action="group-toggle" aria-label="${expanded ? "Contraer grupo" : "Expandir grupo"}">${expanded ? "&#9662;" : "&#9656;"}</button>
          ${dragHandle()}
          <button type="button" class="visibility-toggle ${group.visible === false ? "is-hidden-layer" : "is-visible"}" data-action="group-visible" aria-label="${group.visible === false ? "Mostrar grupo" : "Ocultar grupo"}"></button>
          <strong title="${group.name}">${group.name}</strong>
          <span class="group-badge group-badge-${category}">${categoryLabel(category)}</span>
          <button class="layer-tool delete" data-action="group-delete" title="Eliminar grupo">×</button>
        </div>
        <label class="opacity-row">
          <span class="opacity-label">${t("opacity")}</span>
          <input type="range" min="0" max="1" step="0.05" value="${group.opacity ?? 1}" data-action="group-opacity" />
        </label>
      </article>
      <div class="group-children" data-group-id="${group.id}">
        ${expanded ? children : ""}
      </div>
    </section>
  `;
}

function renderLayerKey(key) {
  if (key === "base:ccaa") return renderBaseCard("ccaa");
  if (key.startsWith("group:")) {
    const group = state.groups.find((item) => `group:${item.id}` === key);
    return group ? renderGroupCardV2(group) : "";
  }
  if (key.startsWith("user:")) {
    const layer = state.layers.find((item) => layerKey(item) === key);
    return layer ? renderUserCard(layer) : "";
  }
  return "";
}

function renderLayers() {
  syncLayerOrder();
  els.layerTree.innerHTML = state.layerOrder.map(renderLayerKey).join("");
}

async function loadLayers(focusId = null) {
  const data = await requestJson(api.layers());
  state.layers = data.layers || [];
  renderLayers();
  await redrawUserLayers(focusId);
}

function canEditLayer(layer) {
  return state.role === "admin" || layer.owner === state.role;
}

function fileBaseName(file) {
  return file.name.replace(/\.[^.]+$/, "");
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",").map((header) => header.trim());
  return lines.filter(Boolean).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
  });
}

function csvHeaders(rows) {
  return rows.length ? Object.keys(rows[0]) : [];
}

function uploadKind(file) {
  const ext = file?.name?.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "csv";
  if (ext === "zip") return "zip";
  if (ext === "tif" || ext === "tiff") return "raster";
  return "vector";
}

function updateJoinHint() {
  if (!els.joinTargetHint) return;
  els.joinTargetHint.textContent = t(els.joinTarget.value === "provinces" ? "joinTargetHintProvinces" : "joinTargetHintCcaa");
}

function populateCsvJoinFields(headers) {
  els.csvJoinField.innerHTML = headers.map((header) => `<option value="${header}">${header}</option>`).join("");
}

function detectJoinSuggestion(headers = []) {
  const rules = [
    { target: "ccaa", patterns: [/^autonomous_community$/i, /^comunidad(_autonoma)?$/i, /^ccaa$/i, /^cca$/i, /^region$/i] },
    { target: "provinces", patterns: [/^province$/i, /^provincia$/i, /^provincia_nombre$/i, /^province_name$/i] },
    { target: "provinces", patterns: [/^municipio$/i, /^municipality$/i] },
  ];

  for (const header of headers) {
    for (const rule of rules) {
      if (rule.patterns.some((pattern) => pattern.test(header))) {
        return { field: header, target: rule.target };
      }
    }
  }
  return null;
}

function bestJoinSuggestion(inspection = state.importInspection) {
  const backendSuggestion = inspection?.join_candidates?.[0];
  if (backendSuggestion?.field && backendSuggestion?.target) {
    return backendSuggestion;
  }
  return detectJoinSuggestion((inspection?.fields || []).map((field) => field.name));
}

function syncUploadConfigVisibility(file, rows = []) {
  const isCsv = uploadKind(file) === "csv";
  els.csvModeRow.classList.toggle("is-hidden", !isCsv);
  const showJoin = isCsv && els.csvMode.value === "join";
  els.csvJoinConfig.classList.toggle("is-hidden", !showJoin);
  if (isCsv) {
    const headers = csvHeaders(rows);
    populateCsvJoinFields(headers);
    const suggestion = bestJoinSuggestion({
      fields: headers.map((name) => ({ name })),
      join_candidates: state.importInspection?.join_candidates || []
    });
    if (suggestion && els.csvMode.value !== "join" && !(state.importInspection?.coordinate_candidates?.x && state.importInspection?.coordinate_candidates?.y)) {
      els.csvMode.value = "join";
      els.csvJoinConfig.classList.remove("is-hidden");
    }
    if (suggestion) {
      els.joinTarget.value = suggestion.target;
      els.csvJoinField.value = suggestion.field;
    }
    updateJoinHint();
  }
}

function layerTypeLabel(layer) {
  if (layer.type === "raster") return t("rasterLayer");
  if (layer.source_format === "csv_join") return t("csvModeJoin");
  if (layer.source_format === "shapefile_zip") return "Shapefile ZIP";
  if (layer.type === "csv") return t("csvLayer");
  return t("geojsonLayer");
}

function formatInspectionType(inspection) {
  if (inspection.detected_type === "raster") return t("rasterLayer");
  if (inspection.source_format === "csv_join") return t("csvModeJoin");
  if (inspection.source_format === "csv_points") return t("csvLayer");
  if (inspection.source_format === "shapefile_zip") return "Shapefile ZIP";
  return t("geojsonLayer");
}

function summaryStat(label, value) {
  if (value === undefined || value === null || value === "") return "";
  return `<div class="summary-stat"><span class="summary-stat-label">${label}</span><span class="summary-stat-value">${value}</span></div>`;
}

function formatInspectionCrs(crs) {
  if (!crs) return "";
  const text = `${crs}`;
  const epsgMatches = [...text.matchAll(/EPSG"\s*,\s*(\d+)/g)].map((match) => match[1]);
  if (epsgMatches.length) {
    const code = epsgMatches[epsgMatches.length - 1];
    const nameMatch = text.match(/^(PROJCRS|GEOGCRS)\["([^"]+)"/);
    return nameMatch ? `EPSG:${code} (${nameMatch[2]})` : `EPSG:${code}`;
  }
  const simple = text.replace(/\s+/g, " ").trim();
  return simple.length > 84 ? `${simple.slice(0, 81)}...` : simple;
}

function selectedImportFields() {
  return Array.from(els.importFieldList.querySelectorAll("input[type='checkbox']:checked")).map((input) => input.value);
}

function selectedDisplayField() {
  return els.displayFieldSelect.value || null;
}

function syncDisplayFieldOptions() {
  const selectedFields = selectedImportFields();
  const fieldMap = inspectionFieldMap();
  const previousValue = els.displayFieldSelect.value;
  const options = [`<option value="">${t("displayFieldAuto")}</option>`]
    .concat(
      selectedFields.map((field) => `<option value="${field}">${field}${fieldMap[field] ? ` (${fieldMap[field]})` : ""}</option>`)
    )
    .join("");
  els.displayFieldSelect.innerHTML = options;
  const preferred = selectedFields.find((field) => isNumericFieldType(fieldMap[field])) || selectedFields[0] || "";
  els.displayFieldSelect.value = selectedFields.includes(previousValue) ? previousValue : preferred;
  els.displayFieldRow.classList.toggle("is-hidden", !selectedFields.length);
}

function renderImportPreview(previewRows, selectedFields) {
  if (!previewRows.length) {
    els.importPreviewBlock.classList.add("is-hidden");
    els.importPreviewTable.innerHTML = "";
    return;
  }

  const allColumns = Object.keys(previewRows[0]);
  const columns = selectedFields.length ? allColumns.filter((column) => selectedFields.includes(column)) : allColumns;
  if (!columns.length) {
    els.importPreviewBlock.classList.add("is-hidden");
    els.importPreviewTable.innerHTML = "";
    return;
  }

  els.importPreviewBlock.classList.remove("is-hidden");
  els.importPreviewTable.innerHTML = `
    <table class="preview-table">
      <thead>
        <tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${previewRows
          .map((row) => `<tr>${columns.map((column) => `<td>${row[column] ?? ""}</td>`).join("")}</tr>`)
          .join("")}
      </tbody>
    </table>`;
}

function syncImportPreviewSelection() {
  renderImportPreview(state.importInspection?.preview_rows || [], selectedImportFields());
}

function technicalFieldNames(fields = []) {
  return fields
    .filter((field) => /^(objectid|fid|gid|id|shape_leng|shape_len|shape_area|area|length|perimeter)$/i.test(field.name))
    .map((field) => field.name);
}

function recommendedFieldNames(fields = []) {
  const technical = new Set(technicalFieldNames(fields));
  return fields
    .filter((field) => !technical.has(field.name))
    .filter((field) => !/sfc_/i.test(field.type || ""))
    .map((field) => field.name)
    .slice(0, 8);
}

function guidanceTags(items = []) {
  if (!items.length) return "";
  return `<div class="guidance-tags">${items.map((item) => `<span class="guidance-tag">${sanitizeHtml(item)}</span>`).join("")}</div>`;
}

function formatExtent(inspection) {
  const bbox = inspection.bbox || {};
  const xmin = Number(bbox.xmin);
  const ymin = Number(bbox.ymin);
  const xmax = Number(bbox.xmax);
  const ymax = Number(bbox.ymax);
  if (![xmin, ymin, xmax, ymax].every(Number.isFinite)) return "";
  return `${xmin.toFixed(4)}, ${ymin.toFixed(4)} -> ${xmax.toFixed(4)}, ${ymax.toFixed(4)}`;
}

function buildImportGuidance(inspection) {
  if (!inspection) return "";

  if (inspection.detected_type === "raster") {
    const bits = [];
    bits.push(`<p class="guidance-copy">${inspection.bands === 1 ? "Raster monobanda, bueno para índices o superficies continuas." : `Raster multibanda con ${inspection.bands} bandas, útil si luego quieres elegir composición o banda de trabajo.`}</p>`);
    if (inspection.width && inspection.height) {
      bits.push(`<p class="guidance-copy">${inspection.width} x ${inspection.height} px</p>`);
    }
    if (inspection.resolution_x && inspection.resolution_y) {
      bits.push(`<p class="guidance-copy">${t("rasterResolution")}: ${inspection.resolution_x.toFixed(6)} x ${inspection.resolution_y.toFixed(6)}</p>`);
    }
    if (inspection.bbox) {
      bits.push(`<p class="guidance-copy">${t("rasterExtent")}: ${formatExtent(inspection)}</p>`);
    }
    return `<div class="guidance-title">${t("importGuideTitle")}</div>${bits.join("")}`;
  }

  if (inspection.source_format === "csv_points" || inspection.source_format === "csv_join" || inspection.detected_type === "table") {
    const hasCoords = inspection.coordinate_candidates?.x && inspection.coordinate_candidates?.y;
    const suggestion = bestJoinSuggestion(inspection);
    const bits = [];
    if (hasCoords) {
      bits.push(`<p class="guidance-copy">He detectado coordenadas en <strong>${sanitizeHtml(inspection.coordinate_candidates.x)}</strong> y <strong>${sanitizeHtml(inspection.coordinate_candidates.y)}</strong>. Puedes importarlo como puntos directamente.</p>`);
    } else {
      bits.push(`<p class="guidance-copy">No veo coordenadas claras. Este CSV encaja mejor como tabla para unir a CCAA o provincias.</p>`);
    }
    if (suggestion) {
      const scoreText = suggestion.score ? ` (${Math.round(suggestion.score * 100)}% coincidencia)` : "";
      bits.push(`<p class="guidance-copy">También veo un campo que podría servir para unión: <strong>${sanitizeHtml(suggestion.field)}</strong>. Te he dejado sugerido <strong>${sanitizeHtml(suggestion.target)}</strong>${scoreText}.</p>`);
    }
    if (els.csvMode.value === "join") {
      bits.push(`<p class="guidance-copy">Ahora mismo lo estás preparando como unión a <strong>${sanitizeHtml(els.joinTarget.value)}</strong>. Conviene conservar el campo identificador y solo los atributos analíticos que vayas a representar.</p>`);
    } else if (hasCoords) {
      bits.push(`<p class="guidance-copy">Para no ensuciar la capa, suele merecer la pena conservar el identificador, las coordenadas y 2-4 variables útiles.</p>`);
    }
    return `<div class="guidance-title">${t("importGuideTitle")}</div>${bits.join("")}`;
  }

  const geometry = Array.isArray(inspection.geometry_type) ? inspection.geometry_type.join(", ") : inspection.geometry_type || "";
  const recommended = recommendedFieldNames(inspection.fields || []);
  const technical = technicalFieldNames(inspection.fields || []);
  const bits = [
    `<p class="guidance-copy">Geometría detectada: <strong>${sanitizeHtml(geometry)}</strong>. Antes de guardar, quédate con los atributos que luego quieras visualizar o consultar.</p>`,
  ];
  if (recommended.length) {
    bits.push(`<p class="guidance-copy">Estos campos parecen más útiles para análisis o popup:</p>${guidanceTags(recommended)}`);
  }
  if (technical.length) {
    bits.push(`<p class="guidance-copy">Estos parecen técnicos y normalmente no hace falta conservarlos salvo trabajo GIS más fino:</p>${guidanceTags(technical)}`);
  }
  return `<div class="guidance-title">${t("importGuideTitle")}</div>${bits.join("")}`;
}

function renderImportSummary(inspection) {
  state.importInspection = inspection;
  if (!inspection) {
    els.importSummary.classList.add("is-hidden");
    els.importSummaryStats.innerHTML = "";
    els.importGuidance.classList.add("is-hidden");
    els.importGuidance.innerHTML = "";
    els.importFieldSelector.classList.add("is-hidden");
    els.displayFieldRow.classList.add("is-hidden");
    els.displayFieldSelect.innerHTML = "";
    els.importPreviewBlock.classList.add("is-hidden");
    els.importFieldList.innerHTML = "";
    els.importPreviewTable.innerHTML = "";
    return;
  }

  const stats = [
    summaryStat(t("summaryType"), formatInspectionType(inspection)),
    summaryStat(t("summaryFormat"), inspection.source_format),
    summaryStat(t("summaryFeatures"), inspection.feature_count),
    summaryStat(t("summaryRows"), inspection.row_count),
    summaryStat(t("summaryFields"), inspection.field_count),
    summaryStat(t("summaryGeometry"), Array.isArray(inspection.geometry_type) ? inspection.geometry_type.join(", ") : inspection.geometry_type),
    summaryStat(t("summaryBands"), inspection.bands),
    summaryStat(t("summaryCrs"), formatInspectionCrs(inspection.crs)),
    summaryStat(
      t("summaryCoordinates"),
      inspection.coordinate_candidates?.x && inspection.coordinate_candidates?.y
        ? `${inspection.coordinate_candidates.x} / ${inspection.coordinate_candidates.y}`
        : null
    ),
  ].filter(Boolean);

  els.importSummaryStats.innerHTML = stats.join("");
  els.importSummary.classList.remove("is-hidden");
  const guidance = buildImportGuidance(inspection);
  els.importGuidance.innerHTML = guidance;
  els.importGuidance.classList.toggle("is-hidden", !guidance);

  if (inspection.detected_type === "table") {
    const suggestion = bestJoinSuggestion(inspection);
    const hasCoords = inspection.coordinate_candidates?.x && inspection.coordinate_candidates?.y;
    if (suggestion && !hasCoords) {
      els.csvMode.value = "join";
      els.csvJoinConfig.classList.remove("is-hidden");
      els.joinTarget.value = suggestion.target;
      if (els.csvJoinField.querySelector(`option[value="${suggestion.field}"]`)) {
        els.csvJoinField.value = suggestion.field;
      }
      updateJoinHint();
    }
  }

  const fields = inspection.fields || [];
  if (fields.length) {
    const recommended = recommendedFieldNames(fields);
    const defaultSelected = new Set(recommended.length ? recommended : fields.map((field) => field.name));
    els.importFieldSelector.classList.remove("is-hidden");
    els.importFieldList.innerHTML = fields
      .map(
        (field) => `
          <label class="field-option">
            <input type="checkbox" value="${field.name}" ${defaultSelected.has(field.name) ? "checked" : ""} />
            <span>
              <span class="field-option-name">${field.name}</span>
              <span class="field-option-type">${field.type}</span>
            </span>
          </label>`
      )
      .join("");
  } else {
    els.importFieldSelector.classList.add("is-hidden");
    els.importFieldList.innerHTML = "";
  }

  syncDisplayFieldOptions();
  syncImportPreviewSelection();
}

function currentUploadTarget() {
  return state.role === "admin" ? els.layerTarget.value : state.role;
}

function layerNameExists(name, target = currentUploadTarget()) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  const owner = state.role === "admin" ? "admin" : state.role;
  return state.layers.some((layer) =>
    layer.name?.trim().toLowerCase() === normalized &&
    (layer.owner || owner) === owner &&
    ((layer.target || layer.scope) === target)
  );
}

function setLayerDialogLoading(isLoading) {
  els.confirmLayer.classList.toggle("is-loading", isLoading);
  els.confirmLayer.disabled = isLoading;
  document.querySelector("#layerDialog [value='cancel']")?.toggleAttribute("disabled", isLoading);
}

function validateLayerDialog() {
  const value = els.layerName.value.trim();
  const duplicated = value.length > 0 && layerNameExists(value);
  els.layerWarning.textContent = duplicated ? t("layerNameUsed") : "";
  if (els.dialogMessage.dataset.mode !== "runtime") {
    els.dialogMessage.textContent = "";
  }
  els.confirmLayer.disabled = duplicated || value.length === 0;
  return !duplicated && value.length > 0;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se ha podido leer el archivo."));
    reader.readAsDataURL(file);
  });
}

async function refreshImportInspection(file) {
  if (!file) {
    state.pendingUpload = null;
    renderImportSummary(null);
    return;
  }

  state.pendingUpload = await prepareUpload(file);
  const response = await requestJson(api.inspect(), {
    method: "POST",
    body: JSON.stringify(state.pendingUpload),
  });
  renderImportSummary(response.inspection);
}

async function prepareUpload(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "tif" || ext === "tiff") {
    return {
      type: "raster",
      raster: {
        file_name: file.name,
        base64: await fileToDataUrl(file),
      },
    };
  }
  if (ext === "zip") {
    return {
      type: "geojson",
      source_format: "shapefile_zip",
      archive: {
        file_name: file.name,
        base64: await fileToDataUrl(file),
      },
    };
  }
  const text = await file.text();
  if (ext === "csv") {
    const rows = parseCsv(text);
    if (els.csvMode.value === "join") {
      return {
        type: "geojson",
        source_format: "csv_join",
        rows,
        join: {
          target: els.joinTarget.value,
          csv_field: els.csvJoinField.value,
          target_field: els.joinTarget.value === "provinces" ? "province" : "autonomous_community",
        },
      };
    }
    return { type: "csv", source_format: "csv_points", rows };
  }
  JSON.parse(text);
  return { type: "geojson", source_format: "geojson", geojson: text };
}

els.hidePanel.addEventListener("click", () => {
  els.workspace.classList.add("panel-collapsed");
  setTimeout(() => map.resize(), 250);
});

els.showPanel.addEventListener("click", () => {
  els.workspace.classList.remove("panel-collapsed");
  setTimeout(() => map.resize(), 250);
});

els.fullscreenMap.addEventListener("click", () => {
  toggleFullscreen();
});

document.addEventListener("fullscreenchange", () => {
  setTimeout(() => {
    map.resize();
    syncMapScalePosition();
    updateMapStatus();
  }, 50);
});

function setBaseLayerVisibility(kind, visible) {
  const ids = ["base-ccaa-fill", "base-ccaa-line"];
  const visibility = visible ? "visible" : "none";
  for (const id of ids) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
  }
}

document.querySelector(".language-switch").addEventListener("click", (event) => {
  const button = event.target.closest("[data-lang]");
  if (!button) return;
  state.lang = button.dataset.lang;
  localStorage.setItem("plancaza_lang", state.lang);
  applyLanguage();
});

els.userRole.addEventListener("change", async () => {
  state.role = els.userRole.value;
  localStorage.setItem("plancaza_role", state.role);
  applyLanguage();
  await loadLayers();
});

function createGroup(name, category) {
  const id = `group_${Date.now()}`;
  state.groups.push({ id, name: name.trim(), category: normalizeGroupCategory(category), items: [], visible: true, opacity: 1, collapsed: false });
  state.layerOrder.unshift(`group:${id}`);
  storageSet();
  renderLayers();
}

function groupNameExists(name) {
  const normalized = name.trim().toLowerCase();
  return state.groups.some((group) => group.name.trim().toLowerCase() === normalized);
}

function syncGroupCategoryAppearance(select) {
  if (!select) return;
  select.classList.remove("group-category-ecological", "group-category-social");
  select.classList.add(`group-category-${normalizeGroupCategory(select.value)}`);
}

function ensureGroupDialog() {
  let dialog = document.querySelector("#groupDialog");
  if (dialog) return dialog;
  document.body.insertAdjacentHTML(
    "beforeend",
    `<dialog id="groupDialog" class="group-dialog">
      <form method="dialog" class="dialog-card">
        <button class="dialog-close" value="cancel" title="Cerrar">&times;</button>
        <h2 data-role="group-title"></h2>
        <label>
          <span data-role="group-label"></span>
          <input id="groupNameInput" type="text" required />
        </label>
        <label>
          <span data-role="group-category-label"></span>
          <select id="groupCategorySelect">
            <option value="ecological"></option>
            <option value="social"></option>
          </select>
        </label>
        <p id="groupWarning" class="dialog-message group-warning"></p>
        <footer>
          <button class="dialog-secondary" value="cancel" data-role="group-cancel"></button>
          <button id="saveGroup" class="primary" value="default" data-role="group-save"></button>
        </footer>
      </form>
    </dialog>`
  );
  dialog = document.querySelector("#groupDialog");
  const input = dialog.querySelector("#groupNameInput");
  const categorySelect = dialog.querySelector("#groupCategorySelect");
  const warning = dialog.querySelector("#groupWarning");
  const saveButton = dialog.querySelector("#saveGroup");

  function syncGroupDialogText() {
    dialog.querySelector("[data-role='group-title']").textContent = t("createGroup");
    dialog.querySelector("[data-role='group-label']").textContent = t("groupName");
    dialog.querySelector("[data-role='group-category-label']").textContent = t("groupCategory");
    dialog.querySelector("[data-role='group-cancel']").textContent = t("cancel");
    dialog.querySelector("[data-role='group-save']").textContent = t("save");
    categorySelect.options[0].textContent = t("ecological");
    categorySelect.options[1].textContent = t("social");
    syncGroupCategoryAppearance(categorySelect);
  }

  function validateGroupDialog() {
    const value = input.value.trim();
    const duplicated = value.length > 0 && groupNameExists(value);
    warning.textContent = duplicated ? t("groupNameUsed") : "";
    saveButton.disabled = duplicated || value.length === 0;
  }

  syncGroupDialogText();
  dialog._syncGroupDialogText = syncGroupDialogText;

  input.addEventListener("input", validateGroupDialog);
  categorySelect.addEventListener("change", () => syncGroupCategoryAppearance(categorySelect));
  dialog.querySelector("#saveGroup").addEventListener("click", (event) => {
    event.preventDefault();
    validateGroupDialog();
    if (saveButton.disabled) return;
    createGroup(input.value, categorySelect.value);
    dialog.close();
  });
  dialog.addEventListener("close", () => {
    warning.textContent = "";
  });
  dialog._validateGroupDialog = validateGroupDialog;
  return dialog;
}

els.createGroup.addEventListener("click", () => {
  const dialog = ensureGroupDialog();
  const input = dialog.querySelector("#groupNameInput");
  const categorySelect = dialog.querySelector("#groupCategorySelect");
  input.value = `Group ${state.groups.length + 1}`;
  categorySelect.value = "ecological";
  syncGroupCategoryAppearance(categorySelect);
  dialog._syncGroupDialogText?.();
  dialog._validateGroupDialog?.();
  dialog.showModal();
  input.focus();
  input.select();
});

els.openAddData.addEventListener("click", () => {
  state.pendingUpload = null;
  els.fileInput.value = "";
  els.layerName.value = "";
  els.csvMode.value = "points";
  els.csvJoinField.innerHTML = "";
  els.joinTarget.value = "ccaa";
  els.layerTarget.value = "admin";
  els.layerWarning.textContent = "";
  els.dialogMessage.textContent = "";
  delete els.dialogMessage.dataset.mode;
  els.selectedFile.textContent = t("noFile");
  syncUploadConfigVisibility(null, []);
  renderImportSummary(null);
  setLayerDialogLoading(false);
  document.querySelector(".admin-target")?.classList.toggle("is-hidden", state.role !== "admin");
  els.dialog.showModal();
  validateLayerDialog();
});

document.querySelectorAll("#layerDialog [value='cancel']").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    els.dialog.close();
  });
});

els.layerName.addEventListener("input", () => {
  validateLayerDialog();
});

els.layerTarget?.addEventListener("change", () => {
  validateLayerDialog();
});

els.importFieldList.addEventListener("change", () => {
  syncDisplayFieldOptions();
  syncImportPreviewSelection();
});

els.displayFieldSelect.addEventListener("change", () => {
  validateLayerDialog();
});

els.mapSearchInput.addEventListener("input", () => {
  updateSearchClearVisibility();
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    runMapSearch(els.mapSearchInput.value);
  }, 220);
});

els.mapSearchInput.addEventListener("focus", () => {
  updateSearchClearVisibility();
  if (els.mapSearchInput.value.trim().length >= 2 && searchResults.length) {
    els.mapSearchResults.classList.remove("is-hidden");
  }
});

els.mapSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    collapseSearchResults();
    return;
  }

  if (!searchResults.length) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    searchActiveIndex = (searchActiveIndex + 1) % searchResults.length;
    updateSearchActiveResult();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    searchActiveIndex = (searchActiveIndex - 1 + searchResults.length) % searchResults.length;
    updateSearchActiveResult();
    return;
  }

  if (event.key === "Enter" && searchActiveIndex >= 0) {
    event.preventDefault();
    focusSearchResult(searchResults[searchActiveIndex]);
  }
});

els.mapSearchClear.addEventListener("click", () => {
  els.mapSearchInput.value = "";
  updateSearchClearVisibility();
  collapseSearchResults();
  els.mapSearchInput.focus();
});

els.mapSearchResults.addEventListener("click", (event) => {
  const button = event.target.closest(".map-search-result[data-index]");
  if (!button) return;
  const index = Number(button.dataset.index);
  if (!Number.isInteger(index) || !searchResults[index]) return;
  focusSearchResult(searchResults[index]);
});

document.addEventListener("click", (event) => {
  if (els.mapSearch.contains(event.target)) return;
  collapseSearchResults();
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".layer-menu-row")) return;
  if (openLayerMenuId !== null) {
    openLayerMenuId = null;
    renderLayers();
  }
});

els.layerTree.addEventListener("click", async (event) => {
  const card = event.target.closest(".layer-card[data-id]");
  if (!card) return;
  if (event.target.closest("[data-action]") || event.target.closest("input[type='range']") || event.target.closest(".drag-handle")) return;
  attributeState.selectedLayerId = card.dataset.id;
  if (!els.attributePanel.classList.contains("is-hidden")) {
    try {
      await openAttributeTable(card.dataset.id);
    } catch (error) {
      toast(error.message || "No se pudo actualizar la tabla de atributos.");
    }
  }
  renderLayers();
});

els.closeAttributePanel.addEventListener("click", () => {
  els.attributePanel.classList.add("is-hidden");
  els.attributeTableWrap.innerHTML = "";
  els.attributePanelSubtitle.textContent = "";
  attributeState.layerId = null;
  attributeState.rows = [];
  attributeState.selectedFeatureIndex = null;
  attributeState.editMode = false;
  attributeState.minimized = false;
  syncAttributePanelUi();
  renderLayers();
});

els.toggleAttributePanel.addEventListener("click", () => {
  attributeState.minimized = !attributeState.minimized;
  syncAttributePanelUi();
});

els.editAttributeTable.addEventListener("click", () => {
  if (!attributeState.layerId || !attributeState.rows.length) return;
  attributeState.editMode = !attributeState.editMode;
  const layer = state.layers.find((item) => item.id === attributeState.layerId);
  renderAttributeTable(layer, attributeState.rows);
});

els.saveAttributeTable.addEventListener("click", () => {
  if (!attributeState.editMode) return;
  attributeState.editMode = false;
  const layer = state.layers.find((item) => item.id === attributeState.layerId);
  renderAttributeTable(layer, attributeState.rows);
  toast("Cambios guardados en la sesión. El guardado persistente lo conectamos en el siguiente paso.");
});

els.attributeZoomToSelection.addEventListener("change", () => {
  attributeState.zoomToSelection = els.attributeZoomToSelection.checked;
});

els.attributeSearchInput.addEventListener("input", () => {
  attributeState.search = els.attributeSearchInput.value;
  attributeState.page = 1;
  const layer = state.layers.find((item) => item.id === attributeState.layerId);
  if (layer) renderAttributeTable(layer, attributeState.rows);
});

els.attributePrevPage.addEventListener("click", () => {
  if (attributeState.page <= 1) return;
  attributeState.page -= 1;
  const layer = state.layers.find((item) => item.id === attributeState.layerId);
  if (layer) renderAttributeTable(layer, attributeState.rows);
});

els.attributeNextPage.addEventListener("click", () => {
  attributeState.page += 1;
  const layer = state.layers.find((item) => item.id === attributeState.layerId);
  if (layer) renderAttributeTable(layer, attributeState.rows);
});

let attributeResizeSession = null;

els.attributeResizeHandle.addEventListener("mousedown", (event) => {
  if (attributeState.minimized) return;
  attributeResizeSession = {
    startY: event.clientY,
    startHeight: attributeState.height,
  };
  document.body.style.userSelect = "none";
});

document.addEventListener("mousemove", (event) => {
  if (!attributeResizeSession) return;
  const delta = attributeResizeSession.startY - event.clientY;
  const next = Math.max(92, Math.min(Math.round(window.innerHeight * 0.7), attributeResizeSession.startHeight + delta));
  attributeState.height = next;
  syncAttributePanelUi();
});

document.addEventListener("mouseup", () => {
  if (!attributeResizeSession) return;
  attributeResizeSession = null;
  document.body.style.userSelect = "";
});

els.attributeTableWrap.addEventListener("click", (event) => {
  const header = event.target.closest("th[data-column]");
  if (header) {
    const column = header.dataset.column;
    if (attributeState.sortColumn === column) {
      attributeState.sortDirection = attributeState.sortDirection === "asc" ? "desc" : "asc";
    } else {
      attributeState.sortColumn = column;
      attributeState.sortDirection = "asc";
    }
    const layer = state.layers.find((item) => item.id === attributeState.layerId);
    renderAttributeTable(layer, attributeState.rows);
    return;
  }

  const row = event.target.closest("tr[data-feature-index]");
  if (!row) return;
  const featureIndex = Number(row.dataset.featureIndex);
  if (!Number.isInteger(featureIndex)) return;
  attributeState.selectedFeatureIndex = featureIndex;
  row.closest("tbody")?.querySelectorAll("tr").forEach((item) => item.classList.remove("is-selected"));
  row.classList.add("is-selected");
  if (attributeState.zoomToSelection && attributeState.layerId) {
    focusFeatureRow(attributeState.layerId, featureIndex);
  }
});

els.attributeTableWrap.addEventListener("input", (event) => {
  const cell = event.target.closest("td[contenteditable='true']");
  const row = event.target.closest("tr[data-feature-index]");
  if (!cell || !row) return;
  const featureIndex = Number(row.dataset.featureIndex);
  const column = cell.dataset.column;
  if (!Number.isInteger(featureIndex) || !column) return;
  const targetRow = attributeState.rows.find((item) => item.__featureIndex === featureIndex);
  if (!targetRow) return;
  targetRow[column] = cell.textContent.trim();
});

els.attributeTableWrap.addEventListener("change", (event) => {
  const pageSizeSelect = event.target.closest("#attributePageSize");
  if (!pageSizeSelect) return;
  attributeState.pageSize = Number(pageSizeSelect.value) || 50;
  attributeState.page = 1;
  const layer = state.layers.find((item) => item.id === attributeState.layerId);
  renderAttributeTable(layer, attributeState.rows);
});

els.saveLayerRename.addEventListener("click", async (event) => {
  event.preventDefault();
  const layer = state.layers.find((item) => item.id === renameLayerId);
  if (!layer) {
    els.renameLayerDialog.close();
    return;
  }
  const name = els.renameLayerInput.value.trim();
  if (!name) {
    els.renameLayerWarning.textContent = "Pon un nombre para la capa.";
    return;
  }
  await requestJson(api.layer(layer.id), { method: "POST", body: JSON.stringify({ role: state.role, name }) });
  layer.name = name;
  els.renameLayerDialog.close();
  renameLayerId = null;
  renderLayers();
});

els.renameLayerDialog.addEventListener("close", () => {
  els.renameLayerWarning.textContent = "";
});

els.csvMode.addEventListener("change", async () => {
  const file = els.fileInput.files?.[0];
  if (!file || uploadKind(file) !== "csv") {
    syncUploadConfigVisibility(null, []);
    renderImportSummary(null);
    return;
  }
  const rows = parseCsv(await file.text());
  syncUploadConfigVisibility(file, rows);
  try {
    await refreshImportInspection(file);
  } catch (error) {
    renderImportSummary(null);
    els.dialogMessage.dataset.mode = "runtime";
    els.dialogMessage.textContent = error.message || t("readError");
  }
});

els.joinTarget.addEventListener("change", () => {
  updateJoinHint();
});

els.fileInput.addEventListener("change", async () => {
  const file = els.fileInput.files?.[0];
  els.selectedFile.textContent = file ? file.name : t("noFile");
  if (file && !els.layerName.value.trim()) {
    els.layerName.value = fileBaseName(file);
  }
  validateLayerDialog();
  try {
    if (file && uploadKind(file) === "csv") {
      const rows = parseCsv(await file.text());
      syncUploadConfigVisibility(file, rows);
    } else {
      syncUploadConfigVisibility(file, []);
    }
    els.dialogMessage.textContent = "";
    delete els.dialogMessage.dataset.mode;
    await refreshImportInspection(file);
  } catch (error) {
    renderImportSummary(null);
    els.dialogMessage.dataset.mode = "runtime";
    els.dialogMessage.textContent = error.message || t("readError");
  }
});

["dragenter", "dragover"].forEach((eventName) => {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("is-over");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  els.dropZone.addEventListener(eventName, () => els.dropZone.classList.remove("is-over"));
});

els.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files?.[0];
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  els.fileInput.files = transfer.files;
  els.selectedFile.textContent = file.name;
  if (!els.layerName.value.trim()) {
    els.layerName.value = fileBaseName(file);
  }
  validateLayerDialog();
  if (uploadKind(file) === "csv") {
    file.text().then(async (text) => {
      try {
        syncUploadConfigVisibility(file, parseCsv(text));
        await refreshImportInspection(file);
      } catch (error) {
        renderImportSummary(null);
        els.dialogMessage.dataset.mode = "runtime";
        els.dialogMessage.textContent = error.message || t("readError");
      }
    });
  } else {
    syncUploadConfigVisibility(file, []);
    refreshImportInspection(file).catch((error) => {
      renderImportSummary(null);
      els.dialogMessage.dataset.mode = "runtime";
      els.dialogMessage.textContent = error.message || t("readError");
    });
  }
});

els.confirmLayer.addEventListener("click", async (event) => {
  event.preventDefault();
  const file = els.fileInput.files?.[0];
  if (!file) {
    els.dialogMessage.dataset.mode = "runtime";
    els.dialogMessage.textContent = t("chooseFile");
    return;
  }
  const name = els.layerName.value.trim();
  if (!name) {
    els.dialogMessage.dataset.mode = "runtime";
    els.dialogMessage.textContent = t("nameRequired");
    return;
  }
  if (!validateLayerDialog()) return;
  if (uploadKind(file) === "csv" && els.csvMode.value === "join" && !els.csvJoinField.value) {
    els.dialogMessage.dataset.mode = "runtime";
    els.dialogMessage.textContent = t("csvJoinFieldRequired");
    return;
  }
  try {
    setLayerDialogLoading(true);
    els.dialogMessage.textContent = "";
    delete els.dialogMessage.dataset.mode;
    state.pendingUpload = await prepareUpload(file);
    const saveResponse = await requestJson(api.layers(), {
      method: "POST",
      body: JSON.stringify({
        ...state.pendingUpload,
        name,
        selected_fields: selectedImportFields(),
        display_field: selectedDisplayField(),
        role: state.role,
        target: currentUploadTarget(),
      }),
    });
    els.dialog.close();
    els.fileInput.value = "";
    toast(t("layerSaved"));
    await loadLayers(saveResponse.layer?.id || null);
  } catch (error) {
    els.dialogMessage.dataset.mode = "runtime";
    els.dialogMessage.textContent = error.message || t("readError");
  } finally {
    setLayerDialogLoading(false);
    validateLayerDialog();
  }
});

function setGroupVisibility(group, visible) {
  group.visible = visible;
  for (const key of group.items || []) {
    if (key.startsWith("base:")) {
      const kind = key.replace("base:", "");
      state.baseLayers[kind].visible = visible;
      setBaseLayerVisibility(kind, visible);
    }
    if (key.startsWith("user:")) {
      const layer = state.layers.find((item) => layerKey(item) === key);
      if (layer) {
        layer.visible = visible;
        for (const suffix of ["fill", "line", "circle", "raster"]) {
          const layerId = `user-${layer.id}-${suffix}`;
          if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
        }
      }
    }
  }
}

async function setGroupOpacity(group, opacity) {
  group.opacity = opacity;
  for (const key of group.items || []) {
    if (key.startsWith("base:")) {
      const kind = key.replace("base:", "");
      state.baseLayers[kind].opacity = opacity;
      if (kind === "ccaa" && map.getLayer("base-ccaa-fill")) map.setPaintProperty("base-ccaa-fill", "fill-opacity", opacity);
    }
    if (key.startsWith("user:")) {
      const id = key.replace("user:", "");
      const layer = state.layers.find((item) => item.id === id);
      if (layer) {
        layer.opacity = opacity;
        for (const suffix of ["fill", "circle", "line", "raster"]) {
          const layerId = `user-${id}-${suffix}`;
          if (map.getLayer(layerId)) {
            const property = suffix === "line" ? "line-opacity" : suffix === "raster" ? "raster-opacity" : `${suffix}-opacity`;
            try {
              map.setPaintProperty(layerId, property, opacity);
            } catch (_) {}
          }
        }
        if (canEditLayer(layer)) {
          await requestJson(api.layer(id), { method: "POST", body: JSON.stringify({ role: state.role, opacity }) });
        }
      }
    }
  }
  storageSet();
}

els.layerTree.addEventListener("click", async (event) => {
  const card = event.target.closest(".layer-card[data-key]");
  const button = event.target.closest("[data-action]");
  if (!card || !button) return;
  const key = card.dataset.key;
  const action = button.dataset.action;

  if (action === "base-visible") {
    const kind = key.replace("base:", "");
    const nextVisible = !state.baseLayers[kind].visible;
    state.baseLayers[kind].visible = nextVisible;
    setBaseLayerVisibility(kind, nextVisible);
    renderLayers();
    updateActiveLegend();
  }

  if (action === "group-toggle") {
    const group = state.groups.find((item) => `group:${item.id}` === key);
    if (!group) return;
    group.collapsed = group.collapsed !== true;
    storageSet();
    renderLayers();
    updateActiveLegend();
  }

  if (action === "group-visible") {
    const group = state.groups.find((item) => `group:${item.id}` === key);
    if (!group) return;
    setGroupVisibility(group, group.visible === false);
    storageSet();
    renderLayers();
    updateActiveLegend();
  }

  if (action === "group-delete") {
    const group = state.groups.find((item) => `group:${item.id}` === key);
    if (!group) return;
    state.layerOrder = state.layerOrder.filter((item) => item !== key);
    state.layerOrder.push(...(group.items || []));
    state.groups = state.groups.filter((item) => item !== group);
    storageSet();
    renderLayers();
    applyMapOrder();
    updateActiveLegend();
  }
});

els.layerTree.addEventListener("input", async (event) => {
  const card = event.target.closest(".layer-card[data-key]");
  if (!card) return;
  const key = card.dataset.key;

  if (event.target.dataset.action === "base-opacity") {
    const kind = key.replace("base:", "");
    const value = Number(event.target.value);
    state.baseLayers[kind].opacity = value;
    if (kind === "ccaa" && map.getLayer("base-ccaa-fill")) map.setPaintProperty("base-ccaa-fill", "fill-opacity", value);
  }

  if (event.target.dataset.action === "group-opacity") {
    const group = state.groups.find((item) => `group:${item.id}` === key);
    if (group) await setGroupOpacity(group, Number(event.target.value));
    renderLayers();
  }
});

els.uploadedLayers.addEventListener("click", async (event) => {
  const card = event.target.closest(".layer-card[data-id]");
  const button = event.target.closest("[data-action]");
  if (!card || !button) return;
  const id = card.dataset.id;
  const index = state.layers.findIndex((layer) => layer.id === id);
  if (index < 0) return;
  const action = button.dataset.action;

  if (action === "layer-menu-toggle") {
    openLayerMenuId = openLayerMenuId === id ? null : id;
    renderLayers();
    return;
  }

  if (action === "rename") {
    openLayerMenuId = null;
    renderLayers();
    openRenameLayerDialog(state.layers[index]);
    return;
  }

  if (action === "open-attributes") {
    openLayerMenuId = null;
    renderLayers();
    try {
      await openAttributeTable(id);
      renderLayers();
    } catch (error) {
      toast(error.message || "No se pudo abrir la tabla de atributos.");
    }
    return;
  }

  if (action === "download-geojson") {
    openLayerMenuId = null;
    renderLayers();
    window.open(api.download(id), "_blank", "noopener,noreferrer");
    return;
  }

  if (action === "download-csv") {
    openLayerMenuId = null;
    renderLayers();
    window.open(api.downloadCsv(id), "_blank", "noopener,noreferrer");
    return;
  }

  if (action === "focus-layer") {
    focusLayerById(id);
    return;
  }

  if (action === "delete") {
    if (!canEditLayer(state.layers[index])) {
      toast("Solo admin puede eliminar capas comunes.");
      return;
    }
    await fetch(api.layer(id), { method: "DELETE" });
    if (attributeState.layerId === id) {
      els.attributePanel.classList.add("is-hidden");
      els.attributeTableWrap.innerHTML = "";
      els.attributePanelSubtitle.textContent = "";
      attributeState.layerId = null;
      attributeState.rows = [];
      attributeState.selectedFeatureIndex = null;
      attributeState.editMode = false;
      attributeState.minimized = false;
      syncAttributePanelUi();
    }
    await loadLayers();
  }
  if (action === "up" && index > 0) {
    [state.layers[index - 1], state.layers[index]] = [state.layers[index], state.layers[index - 1]];
    await requestJson(api.reorder(), { method: "POST", body: JSON.stringify({ role: state.role, ids: state.layers.map((layer) => layer.id) }) });
    renderLayers();
    await redrawUserLayers();
  }
  if (action === "down" && index < state.layers.length - 1) {
    [state.layers[index + 1], state.layers[index]] = [state.layers[index], state.layers[index + 1]];
    await requestJson(api.reorder(), { method: "POST", body: JSON.stringify({ role: state.role, ids: state.layers.map((layer) => layer.id) }) });
    renderLayers();
    await redrawUserLayers();
  }
});

els.uploadedLayers.addEventListener("input", async (event) => {
  const card = event.target.closest(".layer-card[data-id]");
  if (!card) return;
  const id = card.dataset.id;
  const layer = state.layers.find((item) => item.id === id);
  if (!layer) return;

  if (event.target.dataset.action === "opacity") {
    layer.opacity = Number(event.target.value);
    for (const suffix of ["fill", "circle", "line", "raster"]) {
      const layerId = `user-${id}-${suffix}`;
      if (map.getLayer(layerId)) {
        const property = suffix === "line" ? "line-opacity" : suffix === "raster" ? "raster-opacity" : `${suffix}-opacity`;
        try {
          map.setPaintProperty(layerId, property, layer.opacity);
        } catch (_) {}
      }
    }
    if (canEditLayer(layer)) {
      await requestJson(api.layer(id), { method: "POST", body: JSON.stringify({ role: state.role, opacity: layer.opacity }) });
    }
  }
});

els.uploadedLayers.addEventListener("click", async (event) => {
  const card = event.target.closest(".layer-card[data-id]");
  if (!card || event.target.dataset.action !== "visible") return;
  const id = card.dataset.id;
  const layer = state.layers.find((item) => item.id === id);
  if (!layer) return;
  layer.visible = !event.target.classList.contains("is-visible");
  updateVisibilityButton(event.target, layer.visible);
  const visibility = layer.visible ? "visible" : "none";
  for (const suffix of ["fill", "line", "circle", "raster"]) {
    const layerId = `user-${id}-${suffix}`;
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", visibility);
  }
  if (canEditLayer(layer)) {
    await requestJson(api.layer(id), { method: "POST", body: JSON.stringify({ role: state.role, visible: layer.visible }) });
  }
  updateActiveLegend();
});

let draggingKey = null;

function removeKeyFromTree(key) {
  state.layerOrder = state.layerOrder.filter((item) => item !== key);
  state.groups.forEach((group) => {
    group.items = (group.items || []).filter((item) => item !== key);
  });
}

function containerForKey(key) {
  const group = state.groups.find((item) => (item.items || []).includes(key));
  return group ? group.items : state.layerOrder;
}

function insertRelativeToTarget(container, targetKey, movingKey, insertAfter) {
  const targetIndex = container.indexOf(targetKey);
  if (targetIndex < 0) return;
  const insertIndex = insertAfter ? targetIndex + 1 : targetIndex;
  container.splice(insertIndex, 0, movingKey);
}

async function persistUserOrder() {
  const ids = flattenedLayerKeys()
    .filter((key) => key.startsWith("user:"))
    .map((key) => key.replace("user:", ""));
  if (ids.length) {
    await requestJson(api.reorder(), { method: "POST", body: JSON.stringify({ role: state.role, ids }) });
  }
}

els.layerTree.addEventListener("dragstart", (event) => {
  const handle = event.target.closest(".drag-handle");
  const card = event.target.closest(".layer-card[data-key]");
  if (!handle || !card || FIXED_BASE_KEYS.has(card.dataset.key)) {
    event.preventDefault();
    return;
  }
  draggingKey = card.dataset.key;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});

els.layerTree.addEventListener("dragend", () => {
  draggingKey = null;
  document.querySelectorAll(".layer-card").forEach((card) => card.classList.remove("dragging", "drop-target"));
});

els.layerTree.addEventListener("dragover", (event) => {
  const card = event.target.closest(".layer-card[data-key]");
  if (!card || !draggingKey || FIXED_BASE_KEYS.has(draggingKey) || FIXED_BASE_KEYS.has(card.dataset.key)) return;
  event.preventDefault();
  card.classList.add("drop-target");
});

els.layerTree.addEventListener("dragleave", (event) => {
  const card = event.target.closest(".layer-card[data-key]");
  if (card) card.classList.remove("drop-target");
});

els.layerTree.addEventListener("drop", async (event) => {
  const card = event.target.closest(".layer-card[data-key]");
  if (!draggingKey || FIXED_BASE_KEYS.has(draggingKey)) return;
  event.preventDefault();

  if (!card) {
    removeKeyFromTree(draggingKey);
    state.layerOrder.push(draggingKey);
  } else {
    const targetKey = card.dataset.key;
    if (FIXED_BASE_KEYS.has(targetKey)) return;
    const rect = card.getBoundingClientRect();
    const insertAfter = event.clientY > rect.top + rect.height / 2;
    if (targetKey !== draggingKey && !draggingKey.startsWith("group:")) {
      const targetGroup = targetKey.startsWith("group:") ? state.groups.find((group) => `group:${group.id}` === targetKey) : null;
      removeKeyFromTree(draggingKey);
      if (targetGroup) {
        targetGroup.items = targetGroup.items || [];
        targetGroup.items.push(draggingKey);
        targetGroup.collapsed = false;
      } else {
        const container = containerForKey(targetKey);
        insertRelativeToTarget(container, targetKey, draggingKey, insertAfter);
      }
    } else if (targetKey !== draggingKey) {
      removeKeyFromTree(draggingKey);
      const container = containerForKey(targetKey);
      insertRelativeToTarget(container, targetKey, draggingKey, insertAfter);
    }
  }

  storageSet();
  renderLayers();
  applyMapOrder();
  updateActiveLegend();
  await persistUserOrder();
});

applyLanguage();
syncAttributePanelUi();

map.on("load", async () => {
  try {
    await loadBaseLayers();
    await loadLayers();
    syncMapScalePosition();
    updateMapStatus();
  } catch (error) {
    toast(error.message || "No se pudo iniciar el mapa.");
  }
});

map.on("mousemove", (event) => {
  updateMapStatus(event.lngLat);
  const features = map.queryRenderedFeatures(event.point, { layers: interactiveUserLayerIds() });
  map.getCanvas().style.cursor = features.length ? "pointer" : "";
});

map.on("click", async (event) => {
  const features = map.queryRenderedFeatures(event.point, { layers: interactiveUserLayerIds() });
  const renderedFeature = features[0];
  if (!renderedFeature) return;
  const clickedLayerId = layerIdFromRenderedFeature(renderedFeature);
  const feature = originalFeatureFromRenderedFeature(renderedFeature);
  showHighlightedFeature(feature);
  const featureIndex = Number(feature?.properties?.__featureIndex);
  if (clickedLayerId && Number.isInteger(featureIndex)) {
    try {
      await revealFeatureInAttributeTable(clickedLayerId, featureIndex);
    } catch (_) {}
  }
  new maplibregl.Popup({ closeButton: false, maxWidth: "320px" })
    .setLngLat(event.lngLat)
    .setHTML(popupHtml(feature.properties || {}))
    .addTo(map);
});

map.on("move", () => {
  updateMapStatus();
  syncMapScalePosition();
});




