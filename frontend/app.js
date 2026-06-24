const api = {
  health: "/api/health",
  base: (layer) => `/api/base-layer/${encodeURIComponent(layer)}`,
  layers: () => `/api/${encodeURIComponent(state.role)}/layers`,
  layer: (id) => `/api/${encodeURIComponent(state.role)}/layers/${id}`,
  geojson: (id) => `/api/layers/${id}/geojson`,
  data: (id) => `/api/layers/${id}/data`,
  reorder: () => `/api/${encodeURIComponent(state.role)}/layers/reorder`,
};

const state = {
  layers: [],
  pendingUpload: null,
  baseLayers: {
    ccaa: { name: "CCAA", metaKey: "ccaaShapes", opacity: 0.72, visible: true, mapLayers: ["base-ccaa-fill", "base-ccaa-line"] },
    provinces: { name: "Provincias", metaKey: "provinceShapes", opacity: 0.9, visible: true, mapLayers: ["base-provinces-fill", "base-provinces-line"] },
  },
  layerOrder: JSON.parse(localStorage.getItem("plancaza_layer_order") || '["base:ccaa","base:provinces"]'),
  groups: JSON.parse(localStorage.getItem("plancaza_layer_groups") || "[]"),
  lang: localStorage.getItem("plancaza_lang") || "es",
  role: localStorage.getItem("plancaza_role") || "admin",
};

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
    dropHint: "GeoJSON, CSV con lon/lat o GeoTIFF en WGS84",
    noFile: "Ningún archivo seleccionado",
    layerName: "Nombre de la capa",
    overwrite: "Sobrescribir si ya existe",
    cancel: "Cancelar",
    save: "Guardar",
    opacity: "Opacidad",
    ccaaShapes: "Límites autonómicos",
    provinceShapes: "Límites provinciales",
    chooseFile: "Selecciona un archivo GeoJSON, CSV o GeoTIFF.",
    layerSaved: "Capa guardada.",
    nameRequired: "Pon un nombre para la capa.",
    csvLayer: "CSV con coordenadas",
    geojsonLayer: "Vector GeoJSON",
    rasterLayer: "Raster GeoTIFF",
    readError: "No se pudo leer el archivo.",
    userLabel: "Usuario",
    layerTarget: "Destino",
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
    dropHint: "GeoJSON, CSV amb lon/lat o GeoTIFF en WGS84",
    noFile: "Cap fitxer seleccionat",
    layerName: "Nom de la capa",
    overwrite: "Sobreescriure si ja existeix",
    cancel: "Cancel·lar",
    save: "Desar",
    opacity: "Opacitat",
    ccaaShapes: "Límits autonòmics",
    provinceShapes: "Límits provincials",
    chooseFile: "Selecciona un fitxer GeoJSON, CSV o GeoTIFF.",
    layerSaved: "Capa desada.",
    nameRequired: "Escriu un nom per a la capa.",
    csvLayer: "CSV amb coordenades",
    geojsonLayer: "Vector GeoJSON",
    rasterLayer: "Raster GeoTIFF",
    readError: "No s'ha pogut llegir el fitxer.",
    userLabel: "Usuari",
    layerTarget: "Desti",
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
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  selectedFile: document.querySelector("#selectedFile"),
  uploadedLayers: document.querySelector("#layerTree"),
  dialog: document.querySelector("#layerDialog"),
  layerName: document.querySelector("#layerName"),
  layerTarget: document.querySelector("#layerTarget"),
  overwriteLayer: document.querySelector("#overwriteLayer"),
  dialogMessage: document.querySelector("#dialogMessage"),
  confirmLayer: document.querySelector("#confirmLayer"),
  toast: document.querySelector("#toast"),
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

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

document.querySelectorAll(".layer-list > .base-card, #uploadedLayers").forEach((node) => node.remove());

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  window.setTimeout(() => els.toast.classList.remove("visible"), 2600);
}

function updateVisibilityButton(button, visible) {
  if (!button) return;
  button.classList.toggle("is-visible", visible);
  button.classList.toggle("is-hidden-layer", !visible);
  button.setAttribute("aria-label", visible ? "Ocultar capa" : "Mostrar capa");
  button.title = visible ? "Ocultar capa" : "Mostrar capa";
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

function colorExpression() {
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "value"], 0],
    35,
    "#d67b5b",
    45,
    "#e0c16f",
    55,
    "#6b9b7a",
    65,
    "#2f6f73",
  ];
}

async function loadBaseLayers() {
  const [ccaa, provinces] = await Promise.all([
    requestText(api.base("ccaa")).then(JSON.parse),
    requestText(api.base("provinces")).then(JSON.parse),
  ]);

  if (map.getSource("base-ccaa")) {
    map.getSource("base-ccaa").setData(ccaa);
  } else {
    map.addSource("base-ccaa", { type: "geojson", data: ccaa });
    map.addLayer({
      id: "base-ccaa-fill",
      type: "fill",
      source: "base-ccaa",
      paint: {
        "fill-color": colorExpression(),
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

  if (map.getSource("base-provinces")) {
    map.getSource("base-provinces").setData(provinces);
  } else {
    map.addSource("base-provinces", { type: "geojson", data: provinces });
    map.addLayer({
      id: "base-provinces-fill",
      type: "fill",
      source: "base-provinces",
      paint: {
        "fill-color": "#ffffff",
        "fill-opacity": 0,
      },
    });
    map.addLayer({
      id: "base-provinces-line",
      type: "line",
      source: "base-provinces",
      paint: {
        "line-color": "#111827",
        "line-opacity": state.baseLayers.provinces.opacity,
        "line-width": 0.85,
        "line-dasharray": [2, 1],
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
}

async function drawLayer(layer) {
  const sourceId = `user-${layer.id}`;
  removeMapLayer(sourceId);
  const opacity = Number(layer.opacity ?? 0.65);
  const visible = layer.visible === false ? "none" : "visible";

  if (layer.type === "raster") {
    const raster = JSON.parse(await requestText(api.data(layer.id)));
    map.addSource(sourceId, {
      type: "image",
      url: raster.image,
      coordinates: raster.coordinates,
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

  const geojson = JSON.parse(await requestText(api.data(layer.id)));
  map.addSource(sourceId, { type: "geojson", data: geojson });

  const firstGeometry = geojson.features?.find((feature) => feature.geometry)?.geometry?.type || "";

  if (firstGeometry.includes("Polygon")) {
    map.addLayer({
      id: `${sourceId}-fill`,
      type: "fill",
      source: sourceId,
      layout: { visibility: visible },
      paint: { "fill-color": "#4f9a94", "fill-opacity": opacity },
    });
    map.addLayer({
      id: `${sourceId}-line`,
      type: "line",
      source: sourceId,
      layout: { visibility: visible },
      paint: { "line-color": "#1f4e52", "line-width": 1.1 },
    });
  } else if (firstGeometry.includes("Line")) {
    map.addLayer({
      id: `${sourceId}-line`,
      type: "line",
      source: sourceId,
      layout: { visibility: visible },
      paint: { "line-color": "#1f4e52", "line-opacity": opacity, "line-width": 2 },
    });
  } else {
    map.addLayer({
      id: `${sourceId}-circle`,
      type: "circle",
      source: sourceId,
      layout: { visibility: visible },
      paint: {
        "circle-radius": 5,
        "circle-color": "#4f9a94",
        "circle-opacity": opacity,
        "circle-stroke-color": "#1f4e52",
        "circle-stroke-width": 1,
      },
    });
  }
}

async function redrawUserLayers() {
  for (const layer of state.layers) removeMapLayer(`user-${layer.id}`);
  for (const layer of [...state.layers].reverse()) await drawLayer(layer);
  applyMapOrder();
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
        <strong title="${layer.name}">${layer.name}</strong>
        <span class="pill">${layer.type.toUpperCase()}</span>
        <span class="layer-tools">
          <button class="layer-tool" data-action="up" title="Subir capa">↑</button>
          <button class="layer-tool" data-action="down" title="Bajar capa">↓</button>
          <button class="layer-tool delete" data-action="delete" title="Eliminar capa">×</button>
        </span>
      </div>
      <small>${layer.type === "raster" ? t("rasterLayer") : layer.type === "csv" ? t("csvLayer") : t("geojsonLayer")}</small>
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

function layerKey(layer) {
  return `user:${layer.id}`;
}

function validTopLevelKeys() {
  const userKeys = new Set(state.layers.map(layerKey));
  const groupKeys = new Set(state.groups.map((group) => `group:${group.id}`));
  return new Set(["base:ccaa", "base:provinces", ...userKeys, ...groupKeys]);
}

function syncLayerOrder() {
  const valid = validTopLevelKeys();
  const grouped = new Set();
  state.groups.forEach((group) => {
    group.items = (group.items || []).filter((key) => valid.has(key) && !key.startsWith("group:"));
    group.items.forEach((key) => grouped.add(key));
  });
  state.layerOrder = state.layerOrder.filter((key) => valid.has(key) && !grouped.has(key));
  for (const key of ["base:ccaa", "base:provinces", ...state.groups.map((group) => `group:${group.id}`), ...state.layers.map(layerKey)]) {
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
  if (key === "base:provinces") return state.baseLayers.provinces.mapLayers;
  if (key.startsWith("user:")) {
    const id = key.replace("user:", "");
    return [`user-${id}-raster`, `user-${id}-fill`, `user-${id}-line`, `user-${id}-circle`];
  }
  return [];
}

function applyMapOrder() {
  const bottomToTop = [...flattenedLayerKeys()].reverse();
  for (const key of bottomToTop) {
    for (const id of mapLayerIdsForKey(key)) {
      if (map.getLayer(id)) map.moveLayer(id);
    }
  }
}

function dragHandle() {
  return '<button type="button" class="drag-handle" draggable="true" title="Mover capa" aria-label="Mover capa"></button>';
}

function renderBaseCard(kind) {
  const base = state.baseLayers[kind];
  return `
    <article class="layer-card base-card" draggable="true" data-key="base:${kind}">
      <div class="layer-row">
        ${dragHandle()}
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
  return `
    <article class="layer-card ${canEditLayer(layer) ? "" : "is-locked"}" draggable="true" data-key="user:${layer.id}" data-id="${layer.id}">
      <div class="layer-row">
        ${dragHandle()}
        <button type="button" class="visibility-toggle ${layer.visible === false ? "is-hidden-layer" : "is-visible"}" data-action="visible" aria-label="${layer.visible === false ? "Mostrar capa" : "Ocultar capa"}"></button>
        <strong title="${layer.name}">${layer.name}</strong>
        <span class="pill">${layer.type.toUpperCase()}</span>
        <span class="layer-tools">
          <button class="layer-tool delete" data-action="delete" title="Eliminar capa">×</button>
        </span>
      </div>
      <small>${layer.type === "raster" ? t("rasterLayer") : layer.type === "csv" ? t("csvLayer") : t("geojsonLayer")}</small>
      <label class="opacity-row">
        <span class="opacity-label">${t("opacity")}</span>
        <input type="range" min="0" max="1" step="0.05" value="${layer.opacity ?? 0.65}" data-action="opacity" />
      </label>
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

function renderLayerKey(key) {
  if (key === "base:ccaa") return renderBaseCard("ccaa");
  if (key === "base:provinces") return renderBaseCard("provinces");
  if (key.startsWith("group:")) {
    const group = state.groups.find((item) => `group:${item.id}` === key);
    return group ? renderGroupCard(group) : "";
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

async function loadLayers() {
  const data = await requestJson(api.layers());
  state.layers = data.layers || [];
  renderLayers();
  await redrawUserLayers();
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

function rasterToCanvas(width, height, values, samplesPerPixel) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  if (samplesPerPixel >= 3) {
    for (let i = 0, j = 0; i < values.length; i += samplesPerPixel, j += 4) {
      data[j] = values[i];
      data[j + 1] = values[i + 1];
      data[j + 2] = values[i + 2];
      data[j + 3] = samplesPerPixel >= 4 ? values[i + 3] : 210;
    }
  } else {
    let min = Infinity;
    let max = -Infinity;
    for (const value of values) {
      if (Number.isFinite(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    const span = max > min ? max - min : 1;
    for (let i = 0, j = 0; i < values.length; i += 1, j += 4) {
      const normalized = Math.max(0, Math.min(255, Math.round(((values[i] - min) / span) * 255)));
      data[j] = normalized;
      data[j + 1] = Math.round(120 + normalized * 0.35);
      data[j + 2] = 255 - normalized;
      data[j + 3] = Number.isFinite(values[i]) ? 210 : 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

async function parseGeoTiff(file) {
  if (!window.GeoTIFF) {
    throw new Error("No se ha podido cargar el lector GeoTIFF.");
  }
  const tiff = await GeoTIFF.fromArrayBuffer(await file.arrayBuffer());
  const image = await tiff.getImage();
  const bbox = image.getBoundingBox();
  if (!bbox || bbox.length !== 4) {
    throw new Error("El GeoTIFF necesita coordenadas geográficas.");
  }
  const width = image.getWidth();
  const height = image.getHeight();
  const samplesPerPixel = image.getSamplesPerPixel();
  const rasters = await image.readRasters({ interleave: true });
  const canvas = rasterToCanvas(width, height, rasters, samplesPerPixel);
  return {
    type: "raster",
    raster: {
      image: canvas.toDataURL("image/png"),
      coordinates: [
        [bbox[0], bbox[3]],
        [bbox[2], bbox[3]],
        [bbox[2], bbox[1]],
        [bbox[0], bbox[1]],
      ],
    },
  };
}

async function prepareUpload(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "tif" || ext === "tiff") {
    return parseGeoTiff(file);
  }
  const text = await file.text();
  if (ext === "csv") {
    return { type: "csv", rows: parseCsv(text) };
  }
  JSON.parse(text);
  return { type: "geojson", geojson: text };
}

els.hidePanel.addEventListener("click", () => {
  els.workspace.classList.add("panel-collapsed");
  setTimeout(() => map.resize(), 250);
});

els.showPanel.addEventListener("click", () => {
  els.workspace.classList.remove("panel-collapsed");
  setTimeout(() => map.resize(), 250);
});

function setBaseLayerVisibility(kind, visible) {
  const ids = kind === "ccaa" ? ["base-ccaa-fill", "base-ccaa-line"] : ["base-provinces-fill", "base-provinces-line"];
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

function createGroup(name) {
  const id = `group_${Date.now()}`;
  state.groups.push({ id, name: name.trim(), items: [], visible: true, opacity: 1, collapsed: false });
  state.layerOrder.unshift(`group:${id}`);
  storageSet();
  renderLayers();
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
        <footer>
          <button value="cancel" data-role="group-cancel"></button>
          <button id="saveGroup" class="primary" value="default" data-role="group-save"></button>
        </footer>
      </form>
    </dialog>`
  );
  dialog = document.querySelector("#groupDialog");
  dialog.querySelector("[data-role='group-title']").textContent = t("createGroup");
  dialog.querySelector("[data-role='group-label']").textContent = t("groupName");
  dialog.querySelector("[data-role='group-cancel']").textContent = t("cancel");
  dialog.querySelector("[data-role='group-save']").textContent = t("save");
  dialog.querySelector("#saveGroup").addEventListener("click", (event) => {
    event.preventDefault();
    const input = dialog.querySelector("#groupNameInput");
    if (!input.value.trim()) return;
    createGroup(input.value);
    dialog.close();
  });
  return dialog;
}

els.createGroup.addEventListener("click", () => {
  const dialog = ensureGroupDialog();
  const input = dialog.querySelector("#groupNameInput");
  input.value = `Group ${state.groups.length + 1}`;
  dialog.showModal();
  input.focus();
  input.select();
});

els.openAddData.addEventListener("click", () => {
  state.pendingUpload = null;
  els.fileInput.value = "";
  els.layerName.value = "";
  els.layerTarget.value = "admin";
  els.overwriteLayer.checked = false;
  els.dialogMessage.textContent = "";
  els.selectedFile.textContent = t("noFile");
  document.querySelector(".admin-target")?.classList.toggle("is-hidden", state.role !== "admin");
  els.dialog.showModal();
});

document.querySelectorAll("#layerDialog [value='cancel']").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    els.dialog.close();
  });
});

els.fileInput.addEventListener("change", () => {
  const file = els.fileInput.files?.[0];
  els.selectedFile.textContent = file ? file.name : t("noFile");
  if (file && !els.layerName.value.trim()) {
    els.layerName.value = fileBaseName(file);
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
});

els.confirmLayer.addEventListener("click", async (event) => {
  event.preventDefault();
  const file = els.fileInput.files?.[0];
  if (!file) {
    els.dialogMessage.textContent = t("chooseFile");
    return;
  }
  const name = els.layerName.value.trim();
  if (!name) {
    els.dialogMessage.textContent = t("nameRequired");
    return;
  }
  try {
    state.pendingUpload = await prepareUpload(file);
    await requestJson(api.layers(), {
      method: "POST",
      body: JSON.stringify({
        ...state.pendingUpload,
        name,
        role: state.role,
        target: state.role === "admin" ? els.layerTarget.value : state.role,
        overwrite: els.overwriteLayer.checked,
      }),
    });
    els.dialog.close();
    els.fileInput.value = "";
    toast(t("layerSaved"));
    await loadLayers();
  } catch (error) {
    els.dialogMessage.textContent = error.message || t("readError");
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
      if (kind === "provinces" && map.getLayer("base-provinces-line")) map.setPaintProperty("base-provinces-line", "line-opacity", opacity);
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
  }

  if (action === "group-toggle") {
    const group = state.groups.find((item) => `group:${item.id}` === key);
    if (!group) return;
    group.collapsed = group.collapsed !== true;
    storageSet();
    renderLayers();
  }

  if (action === "group-visible") {
    const group = state.groups.find((item) => `group:${item.id}` === key);
    if (!group) return;
    setGroupVisibility(group, group.visible === false);
    storageSet();
    renderLayers();
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
    if (kind === "provinces" && map.getLayer("base-provinces-line")) map.setPaintProperty("base-provinces-line", "line-opacity", value);
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

  if (action === "delete") {
    if (!canEditLayer(state.layers[index])) {
      toast("Solo admin puede eliminar capas comunes.");
      return;
    }
    await fetch(api.layer(id), { method: "DELETE" });
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
  if (!handle || !card) {
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
  if (!card || !draggingKey) return;
  event.preventDefault();
  card.classList.add("drop-target");
});

els.layerTree.addEventListener("dragleave", (event) => {
  const card = event.target.closest(".layer-card[data-key]");
  if (card) card.classList.remove("drop-target");
});

els.layerTree.addEventListener("drop", async (event) => {
  const card = event.target.closest(".layer-card[data-key]");
  if (!draggingKey) return;
  event.preventDefault();

  if (!card) {
    removeKeyFromTree(draggingKey);
    state.layerOrder.push(draggingKey);
  } else {
    const targetKey = card.dataset.key;
    if (targetKey !== draggingKey && !draggingKey.startsWith("group:")) {
      const targetGroup = targetKey.startsWith("group:") ? state.groups.find((group) => `group:${group.id}` === targetKey) : null;
      removeKeyFromTree(draggingKey);
      if (targetGroup) {
        targetGroup.items = targetGroup.items || [];
        targetGroup.items.push(draggingKey);
        targetGroup.collapsed = false;
      } else {
        const container = containerForKey(targetKey);
        const index = Math.max(0, container.indexOf(targetKey));
        container.splice(index, 0, draggingKey);
      }
    } else if (targetKey !== draggingKey) {
      removeKeyFromTree(draggingKey);
      const container = containerForKey(targetKey);
      const index = Math.max(0, container.indexOf(targetKey));
      container.splice(index, 0, draggingKey);
    }
  }

  storageSet();
  renderLayers();
  applyMapOrder();
  await persistUserOrder();
});

applyLanguage();

map.on("load", async () => {
  try {
    await loadBaseLayers();
    await loadLayers();
  } catch (error) {
    toast(error.message || "No se pudo iniciar el mapa.");
  }
});
