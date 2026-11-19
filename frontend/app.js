const api = {
  health: "/api/health",
  inspect: () => "/api/import/inspect",
  base: (layer) => `/api/base-layer/${encodeURIComponent(layer)}`,
  layers: () => `/api/${encodeURIComponent(state.role)}/layers`,
  layer: (id) => `/api/${encodeURIComponent(state.role)}/layers/${id}`,
  geojson: (id) => `/api/layers/${id}/geojson`,
  data: (id) => `/api/layers/${id}/data`,
  rasterValue: (id) => `/api/layers/${id}/value`,
  download: (id) => `/api/layers/${id}/download`,
  downloadCsv: (id) => `/api/layers/${id}/download.csv`,
  rasterTiles: (id) => `/api/layers/${id}/tiles/{z}/{x}/{y}.png`,
  reorder: () => `/api/${encodeURIComponent(state.role)}/layers/reorder`,
  scenarios: (scope = "national") => `/api/scenarios?role=${encodeURIComponent(state.role)}&scope=${encodeURIComponent(scope)}`,
  saveScenario: () => `/api/scenarios`,
  duplicateScenario: (id) => `/api/scenarios/${encodeURIComponent(id)}/duplicate`,
  deleteScenario: (id, scope = "national") => `/api/scenarios/${encodeURIComponent(id)}?role=${encodeURIComponent(state.role)}&scope=${encodeURIComponent(scope)}`,
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
  section: localStorage.getItem("plancaza_section") || "input",
  nationalStep: localStorage.getItem("plancaza_national_step") || "layers",
  scenarios: [],
  scenariosLoading: false,
  activeScenarioId: localStorage.getItem("plancaza_active_national_scenario") || null,
  scenarioNameDraft: "",
  scenarioRenameMode: false,
  scenarioPickerOpen: false,
  savedScenarioFingerprint: "",
  layersLoaded: false,
  descriptive: {
    layerId: null,
    field: null,
  },
  nationalDraft: {
    aggregation: { layerId: null, field: null, method: "mean" },
    weights: { items: {} },
    model: { runLabel: "", priority: "balanced", solver: "multiscale", notes: "" },
  },
};

const FIXED_BASE_KEYS = new Set(["base:ccaa"]);
let lastSyncedSection = state.section;

const i18n = {
  es: {
    navInput: "Datos de entrada",
    navNational: "Planificación nacional",
    navRegional: "Planificación regional",
    navAnalysis: "Análisis de escenarios",
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
    navNational: "Planificació nacional",
    navRegional: "Planificació regional",
    navAnalysis: "Anàlisi d'escenaris",
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

Object.assign(i18n.es, {
  panelNational: "Planificación nacional",
  panelRegional: "Planificación regional",
  panelAnalysis: "Análisis de escenarios",
  panelExport: "Exportación",
  scenarioNationalEyebrow: "Planificación nacional",
  scenarioRegionalEyebrow: "Planificación regional",
  scenarioNationalTitle: "Escenarios nacionales",
  scenarioRegionalTitle: "Escenarios regionales",
  scenarioNationalDescription: "Construye, ajusta y guarda escenarios nacionales manteniendo siempre el mapa a la vista: desde la lectura descriptiva de las capas hasta su entrada en el modelo multiobjetivo.",
  scenarioRegionalDescription: "Aquí prepararemos escenarios regionales con la misma lógica de trabajo, pero centrados en municipios y ámbitos locales.",
  scenarioAnalysisTitle: "Análisis de escenarios",
  scenarioAnalysisDescription: "Reúne las corridas guardadas de los escenarios, compara resultados y prepara lectura conjunta entre alternativas.",
  scenarioPlaceholderAnalysis: "Aquí vivirá el análisis entre corridas y escenarios guardados: comparativas, filtros por ámbito, trazabilidad y lectura conjunta de resultados.",
  scenarioExportTitle: "Preparación de exportaciones",
  scenarioExportDescription: "Centraliza las salidas cartográficas, tablas y paquetes de resultados del escenario activo.",
  stepLayers: "Capas",
  stepDescriptive: "Descriptivo",
  stepAggregation: "Agregación CCAA",
  stepWeights: "Pesos",
  stepModel: "Modelo MO",
  stepResults: "Resultados",
  scenarioManagerTitle: "Escenario activo",
  scenarioManagerBody: "Guarda el estado de capas y del descriptivo como un escenario reutilizable.",
  scenarioActiveLabel: "Escenario",
  scenarioNameLabel: "Nombre",
  scenarioCurrentLabel: "Escenario actual",
  scenarioSavedStatus: "Guardado",
  scenarioDirtyStatus: "Cambios sin guardar",
  scenarioNewOption: "Nuevo escenario...",
  scenarioSaveAsAction: "Guardar como",
  scenarioRenameAction: "Renombrar escenario",
  scenarioDeleteAction: "Eliminar escenario",
  scenarioDeleteConfirm: "¿Seguro que quieres borrar este escenario? Esta acción no se puede deshacer.",
  scenarioDeleted: "Escenario eliminado.",
  scenarioActiveBadge: "Activo",
  scenarioUpdatedLabel: "Actualizado",
  scenarioSaveAction: "Guardar",
  scenarioSaved: "Escenario guardado.",
  scenarioDuplicated: "Escenario guardado como nuevo.",
  scenarioLoaded: "Escenario cargado.",
  scenarioDefaultName: "Escenario nacional",
  scenarioNameUsed: "Ya existe un escenario con ese nombre.",
  scenarioEmptyState: "Todavía no hay escenarios guardados.",
  aggregationLayerLabel: "Capa fuente",
  aggregationFieldLabel: "Campo",
  aggregationMethodLabel: "Método",
  aggregationTargetLabel: "Salida",
  aggregationTargetFixed: "Valores por CCAA",
  aggregationMethodMean: "Media",
  aggregationMethodSum: "Suma",
  aggregationMethodMax: "Máximo",
  aggregationMethodPresence: "Presencia",
  aggregationNoLayers: "Primero marca al menos una capa en Capas para preparar la agregación.",
  weightsLayerLabel: "Criterio",
  weightsValueLabel: "Peso",
  weightsDirectionLabel: "Sentido",
  weightsDirectionMax: "Maximizar",
  weightsDirectionMin: "Minimizar",
  weightsNoLayers: "Todavía no hay capas activas para ponderar.",
  modelRunLabel: "Nombre de corrida",
  modelPriorityLabel: "Prioridad",
  modelPriorityBalanced: "Equilibrada",
  modelPriorityEcological: "Ecológica",
  modelPrioritySocial: "Social",
  modelSolverLabel: "Motor",
  modelSolverFixed: "multiscale",
  modelNotesLabel: "Notas",
  scenarioLayersTitle: "Base cartográfica y capas activas",
  scenarioLayersBody: "Empieza revisando qué capas entran en el escenario, su orden, su visibilidad y su disponibilidad para el resto del flujo.",
  scenarioLayersCardA: "Usa las capas importadas como materia prima del escenario y mantén el mapa como referencia continua.",
  scenarioLayersCardB: "Las capas base seguirán ancladas arriba para dar contexto territorial común.",
  scenarioDescriptiveTitle: "Lectura descriptiva",
  scenarioDescriptiveBody: "Aquí analizas una sola capa activa cada vez: su variable, su distribución, sus vacíos y sus rangos antes de pasar a agregación.",
  scenarioAggregationTitle: "Transformación a CCAA",
  scenarioAggregationBody: "Convierte información heterogénea a valores comparables por comunidad autónoma: medias, sumas, coberturas, porcentajes o presencia.",
  scenarioWeightsTitle: "Ponderación",
  scenarioWeightsBody: "Asigna peso y sentido a cada criterio para preparar la matriz de entrada del modelo multiobjetivo.",
  scenarioModelTitle: "Modelo multiobjetivo",
  scenarioModelBody: "Reserva este bloque para configurar corridas, restricciones, escenarios y lanzar el modelo conectado con R por debajo.",
  scenarioResultsTitle: "Resultados y comparación",
  scenarioResultsBody: "Muestra mapas finales, tablas comparativas y trazabilidad de c?mo cada criterio afecta al resultado.",
  scenarioCardStatusReady: "Listo para conectar",
  scenarioCardStatusNext: "Siguiente bloque",
  scenarioChecklistTitle: "Qué debería pasar aquí",
  scenarioPlaceholderRegional: "De momento dejamos este panel como antesala del flujo regional. El siguiente salto natural es replicar la lógica nacional pero con agregación y diagnóstico por municipios.",
  scenarioPlaceholderExport: "Desde aquí podrás empaquetar capas, tablas de atributos, pesos utilizados y salidas del modelo en formatos listos para compartir.",
  scenarioUseTitle: "Capas a usar",
  scenarioUseBody: "Marca solo las capas que de verdad quieras considerar como criterio u objetivo dentro de este escenario.",
  scenarioUseToggle: "Usar en este escenario",
  scenarioUseSelected: "Capas seleccionadas",
  scenarioUseNone: "Todav?a no has seleccionado capas para este escenario.",
  scenarioUseExplore: "Explorar",
  descriptiveNoSelected: "Primero selecciona al menos una capa en el paso Capas.",
  descriptiveLayer: "Capa",
    descriptiveVariable: "Variable",
  descriptiveNativeScale: "Escala nativa",
  descriptiveNoLayers: "No hay capas vectoriales con atributos listas para análisis.",
  descriptiveNoFields: "Esta capa no tiene campos analizables.",
  descriptiveSelectHint: "Aquí solo se muestra la capa activa en su escala original. La exploración visual y la combinación de capas se resuelven en Datos de entrada.",
  descriptiveCount: "Entidades",
  descriptiveValid: "Válidos",
  descriptiveMissing: "Vacíos",
  descriptiveMin: "Mínimo",
  descriptiveMax: "Máximo",
  descriptiveMean: "Media",
  descriptiveMedian: "Mediana",
  descriptiveUnique: "Categorías",
  descriptiveTopClass: "Más frecuente",
  descriptiveDistribution: "Distribución",
  descriptiveTopValues: "Valores principales",
  descriptiveRasterHint: "Para rásteres, la primera lectura útil es de bandas, extensión y rango. La agregación territorial la haremos más adelante.",
});

Object.assign(i18n.ca, {
  panelNational: "Planificació nacional",
  panelRegional: "Planificació regional",
  panelAnalysis: "Anàlisi d'escenaris",
  panelExport: "Exportació",
  scenarioNationalEyebrow: "Planificació nacional",
  scenarioRegionalEyebrow: "Planificació regional",
  scenarioNationalTitle: "Escenaris nacionals",
  scenarioRegionalTitle: "Escenaris regionals",
  scenarioNationalDescription: "Construeix, ajusta i desa escenaris nacionals mantenint sempre el mapa a la vista: des de la lectura descriptiva de les capes fins a la seva entrada al model multiobjectiu.",
  scenarioRegionalDescription: "Aquí prepararem escenaris regionals amb la mateixa lògica de treball, però centrats en municipis i àmbits locals.",
  scenarioAnalysisTitle: "Anàlisi d'escenaris",
  scenarioAnalysisDescription: "Reuneix les corrides desades dels escenaris, compara resultats i prepara una lectura conjunta entre alternatives.",
  scenarioPlaceholderAnalysis: "Aquí viurà l'anàlisi entre corrides i escenaris desats: comparatives, filtres per àmbit, traçabilitat i lectura conjunta de resultats.",
  scenarioExportTitle: "Preparació d'exportacions",
  scenarioExportDescription: "Centralitza les sortides cartogràfiques, taules i paquets de resultats de l'escenari actiu.",
  stepLayers: "Capes",
  stepDescriptive: "Descriptiu",
  stepAggregation: "Agregació CCAA",
  stepWeights: "Pesos",
  stepModel: "Model MO",
  stepResults: "Resultats",
  scenarioManagerTitle: "Escenari actiu",
  scenarioManagerBody: "Desa l'estat de capes i del descriptiu com un escenari reutilitzable.",
  scenarioActiveLabel: "Escenari",
  scenarioNameLabel: "Nom",
  scenarioCurrentLabel: "Escenari actual",
  scenarioSavedStatus: "Desat",
  scenarioDirtyStatus: "Canvis pendents",
  scenarioNewOption: "Nou escenari...",
  scenarioSaveAsAction: "Desar com",
  scenarioRenameAction: "Canviar nom de l'escenari",
  scenarioDeleteAction: "Eliminar escenari",
  scenarioDeleteConfirm: "Segur que vols eliminar aquest escenari? Aquesta acció no es pot desfer.",
  scenarioDeleted: "Escenari eliminat.",
  scenarioActiveBadge: "Actiu",
  scenarioUpdatedLabel: "Actualitzat",
  scenarioSaveAction: "Desar",
  scenarioSaved: "Escenari desat.",
  scenarioDuplicated: "Escenari desat com a nou.",
  scenarioLoaded: "Escenari carregat.",
  scenarioDefaultName: "Escenari nacional",
  scenarioNameUsed: "Ja existeix un escenari amb aquest nom.",
  scenarioEmptyState: "Encara no hi ha escenaris desats.",
  aggregationLayerLabel: "Capa font",
  aggregationFieldLabel: "Camp",
  aggregationMethodLabel: "Mètode",
  aggregationTargetLabel: "Sortida",
  aggregationTargetFixed: "Valors per CCAA",
  aggregationMethodMean: "Mitjana",
  aggregationMethodSum: "Suma",
  aggregationMethodMax: "Màxim",
  aggregationMethodPresence: "Presència",
  aggregationNoLayers: "Primer marca almenys una capa a Capes per preparar l'agregació.",
  weightsLayerLabel: "Criteri",
  weightsValueLabel: "Pes",
  weightsDirectionLabel: "Sentit",
  weightsDirectionMax: "Maximitzar",
  weightsDirectionMin: "Minimitzar",
  weightsNoLayers: "Encara no hi ha capes actives per ponderar.",
  modelRunLabel: "Nom de la corrida",
  modelPriorityLabel: "Prioritat",
  modelPriorityBalanced: "Equilibrada",
  modelPriorityEcological: "Ecològica",
  modelPrioritySocial: "Social",
  modelSolverLabel: "Motor",
  modelSolverFixed: "multiscale",
  modelNotesLabel: "Notes",
  scenarioLayersTitle: "Base cartogràfica i capes actives",
  scenarioLayersBody: "Comença revisant quines capes entren a l'escenari, el seu ordre, la seva visibilitat i la seva disponibilitat per a la resta del flux.",
  scenarioLayersCardA: "Fes servir les capes importades com a matèria primera de l'escenari i mantén el mapa com a referència contínua.",
  scenarioLayersCardB: "Les capes base continuaran ancorades a dalt per donar context territorial comú.",
  scenarioDescriptiveTitle: "Lectura descriptiva",
  scenarioDescriptiveBody: "Aquí analitzes una sola capa activa cada vegada: la seva variable, la seva distribució, els buits i els rangs abans de passar a l'agregació.",
  scenarioAggregationTitle: "Transformació a CCAA",
  scenarioAggregationBody: "Converteix informació heterogènia en valors comparables per comunitat autònoma: mitjanes, sumes, cobertures, percentatges o presència.",
  scenarioWeightsTitle: "Ponderació",
  scenarioWeightsBody: "Assigna pes i sentit a cada criteri per preparar la matriu d'entrada del model multiobjectiu.",
  scenarioModelTitle: "Model multiobjectiu",
  scenarioModelBody: "Reserva aquest bloc per configurar execucions, restriccions, escenaris i llançar el model connectat amb R per sota.",
  scenarioResultsTitle: "Resultats i comparació",
  scenarioResultsBody: "Muestra mapas finales, tablas comparativas y trazabilidad de c?mo cada criterio afecta al resultado.",
  scenarioCardStatusReady: "A punt per connectar",
  scenarioCardStatusNext: "Bloc següent",
  scenarioChecklistTitle: "Què hauria de passar aquí",
  scenarioPlaceholderRegional: "De moment deixem aquest panell com a avantsala del flux regional. El següent salt natural és replicar la lògica nacional però amb agregació i diagnòstic per municipis.",
  scenarioPlaceholderExport: "Des d'aquí podràs empaquetar capes, taules d'atributs, pesos utilitzats i sortides del model en formats preparats per compartir.",
  scenarioUseTitle: "Capes a fer servir",
  scenarioUseBody: "Marca nom?s les capes que realment vulguis considerar com a criteri o objectiu dins d'aquest escenari.",
  scenarioUseToggle: "Fer servir en aquest escenari",
  scenarioUseSelected: "Capes seleccionades",
  scenarioUseNone: "Encara no has seleccionat capes per a aquest escenari.",
  scenarioUseExplore: "Explorar",
  descriptiveNoSelected: "Primer selecciona almenys una capa al pas Capes.",
  descriptiveLayer: "Capa",
    descriptiveVariable: "Variable",
  descriptiveNativeScale: "Escala nativa",
  descriptiveNoLayers: "No hi ha capes vectorials amb atributs preparades per a l'anàlisi.",
  descriptiveNoFields: "Aquesta capa no té camps analitzables.",
  descriptiveSelectHint: "Aquí només es mostra la capa activa en la seva escala original. L'exploració visual i la combinació de capes es resolen a Dades d'entrada.",
  descriptiveCount: "Entitats",
  descriptiveValid: "Vàlids",
  descriptiveMissing: "Buits",
  descriptiveMin: "Mínim",
  descriptiveMax: "Màxim",
  descriptiveMean: "Mitjana",
  descriptiveMedian: "Mediana",
  descriptiveUnique: "Categories",
  descriptiveTopClass: "Més freqüent",
  descriptiveDistribution: "Distribució",
  descriptiveTopValues: "Valors principals",
  descriptiveRasterHint: "Per a ràsters, la primera lectura útil és de bandes, extensió i rang. L'agregació territorial la farem més endavant.",
});

Object.assign(i18n.es, {
  descriptiveTopShare: "% top",
  descriptiveStdDev: "Desv. típ.",
  descriptiveSum: "Suma",
  descriptiveTrue: "Verdaderos",
  descriptiveFalse: "Falsos",
  descriptiveCopy: "Copiar",
  descriptiveStatsTitle: "Estadísticas del campo",
  descriptiveStatsSubtitle: "Resumen rápido del campo seleccionado en esta capa.",
});

Object.assign(i18n.ca, {
  descriptiveTopShare: "% top",
  descriptiveStdDev: "Desv. est.",
  descriptiveSum: "Suma",
  descriptiveTrue: "Verdaders",
  descriptiveFalse: "Falsos",
  descriptiveCopy: "Copiar",
  descriptiveStatsTitle: "Estadístiques del camp",
  descriptiveStatsSubtitle: "Resum ràpid del camp seleccionat en aquesta capa.",
});

const t = (key) => i18n[state.lang][key] || i18n.es[key] || key;

const els = {
  navButtons: Array.from(document.querySelectorAll("nav button")),
  workspace: document.querySelector(".workspace"),
  layerPanel: document.querySelector("#layerPanel"),
  panelTitle: document.querySelector("#panelTitle"),
  hidePanel: document.querySelector("#hidePanel"),
  showPanel: document.querySelector("#showPanel"),
  userRole: document.querySelector("#userRole"),
  inputWorkspace: document.querySelector("#inputWorkspace"),
  scenarioWorkspace: document.querySelector("#scenarioWorkspace"),
  scenarioSectionEyebrow: document.querySelector("#scenarioSectionEyebrow"),
  scenarioSectionTitle: document.querySelector("#scenarioSectionTitle"),
  scenarioSectionDescription: document.querySelector("#scenarioSectionDescription"),
  scenarioMetaBar: document.querySelector("#scenarioMetaBar"),
  scenarioStepNav: document.querySelector("#scenarioStepNav"),
  scenarioPanelBody: document.querySelector("#scenarioPanelBody"),
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

window.ContractLiveMap?.attach(map);

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

let activePopupLayerId = null;

const NAV_SECTION_FALLBACK = ["input", "national", "regional", "analysis", "export"];

function allowedSectionsForRole(role = state.role) {
  if (role === "mapa") return ["input", "national", "analysis"];
  if (role === "cca") return ["input", "regional", "analysis"];
  return ["input", "national", "regional", "analysis", "export"];
}

function defaultSectionForRole(role = state.role) {
  if (role === "mapa") return "national";
  if (role === "cca") return "regional";
  return "input";
}

function normalizeSectionForRole(section = state.section, role = state.role) {
  const allowed = allowedSectionsForRole(role);
  if (allowed.includes(section)) return section;
  return defaultSectionForRole(role);
}

const NATIONAL_STEPS = [
  {
    id: "layers",
    labelKey: "stepLayers",
    titleKey: "scenarioLayersTitle",
    bodyKey: "scenarioLayersBody",
    checklist: [
      "Revisar capas disponibles y su disponibilidad para el escenario.",
      "Mantener visibles las capas de contexto y el orden cartográfico correcto.",
      "Elegir qué información se queda como apoyo y qué entra al flujo analítico.",
    ],
  },
  {
    id: "descriptive",
    labelKey: "stepDescriptive",
    titleKey: "scenarioDescriptiveTitle",
    bodyKey: "scenarioDescriptiveBody",
    checklist: [
      "Resúmenes básicos por capa y variable.",
      "Detección de valores ausentes, rangos raros y cobertura espacial.",
      "Primeras comparaciones antes de transformar o agregar.",
    ],
  },
  {
    id: "aggregation",
    labelKey: "stepAggregation",
    titleKey: "scenarioAggregationTitle",
    bodyKey: "scenarioAggregationBody",
    checklist: [
      "Elegir método de agregación por CCAA.",
      "Inspeccionar resultados agregados antes de pasar a pesos.",
      "Guardar una tabla nacional comparable entre capas.",
    ],
  },
  {
    id: "weights",
    labelKey: "stepWeights",
    titleKey: "scenarioWeightsTitle",
    bodyKey: "scenarioWeightsBody",
    checklist: [
      "Definir signo e importancia de cada criterio.",
      "Preparar una matriz clara para el modelo.",
      "Dejar espacio a sensibilidad y escenarios alternativos.",
    ],
  },
  {
    id: "model",
    labelKey: "stepModel",
    titleKey: "scenarioModelTitle",
    bodyKey: "scenarioModelBody",
    checklist: [
      "Configurar restricciones y objetivos.",
      "Lanzar corridas desde el backend R.",
      "Persistir parámetros y resultados de cada ejecución.",
    ],
  },
  {
    id: "results",
    labelKey: "stepResults",
    titleKey: "scenarioResultsTitle",
    bodyKey: "scenarioResultsBody",
    checklist: [
      "Comparar escenarios en mapa y tabla.",
      "Explicar por qu? sale cada resultado.",
      "Preparar exportación y reporte final.",
    ],
  },
];

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

function closeAttributePanel(resetSelected = false) {
  els.attributePanel.classList.add("is-hidden");
  els.attributeTableWrap.innerHTML = "";
  els.attributePanelSubtitle.textContent = "";
  attributeState.layerId = null;
  attributeState.rows = [];
  attributeState.selectedFeatureIndex = null;
  attributeState.editMode = false;
  attributeState.minimized = false;
  if (resetSelected) {
    attributeState.selectedLayerId = null;
  }
  syncAttributePanelUi();
  renderLayers();
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

  moveFeatureHighlightLayersToTop();
}

function moveFeatureHighlightLayersToTop() {
  for (const id of ["feature-highlight-fill", "feature-highlight-line", "feature-highlight-circle"]) {
    if (map.getLayer(id)) {
      map.moveLayer(id);
    }
  }
}

function showHighlightedFeature(feature) {
  ensureFeatureHighlightLayers();
  const source = map.getSource("feature-highlight");
  source?.setData({
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: feature.properties || {}, geometry: feature.geometry }],
  });
  moveFeatureHighlightLayersToTop();
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

function ensureNavSections() {
  els.navButtons.forEach((button, index) => {
    if (!button.dataset.section) {
      button.dataset.section = NAV_SECTION_FALLBACK[index] || "input";
    }
  });
}

function currentNationalStep() {
  return NATIONAL_STEPS.find((step) => step.id === state.nationalStep) || NATIONAL_STEPS[0];
}

function descriptiveFieldOverride(layer) {
  if (
    state.section === "national" &&
    state.nationalStep === "descriptive" &&
    state.descriptive.layerId === layer?.id &&
    state.descriptive.field
  ) {
    return state.descriptive.field;
  }
  return layer?.display_field || null;
}

function descriptiveCandidateLayers() {
  return state.layers.filter(
    (layer) => layer.scenario_national_enabled === true && (layer.type === "raster" || (layer.metadata?.field_info || []).length)
  );
}

function descriptiveFieldCandidates(layer) {
  if (layer?.type === "raster") return [];
  const fields = layer?.metadata?.field_info || [];
  return fields.filter((field) => !/^__featureindex$/i.test(field.name));
}

function inferNativeScale(layer) {
  const source = `${layer?.source_format || ""} ${layer?.name || ""}`.toLowerCase();
  if (/ccaa|autonom/.test(source)) return "CCAA";
  if (/prov/.test(source)) return "Provincias";
  if (/municip|munic/.test(source)) return "Municipios";
  const geometry = layer?.metadata?.geometry_type || "";
  if (/point/i.test(geometry)) return "Puntos";
  if (/line/i.test(geometry)) return "Líneas";
  if (/polygon/i.test(geometry)) return "Polígonos";
  return "Capa original";
}

async function ensureLayerGeojson(layerId) {
  if (state.layerRuntime[layerId]?.geojson) return state.layerRuntime[layerId].geojson;
  const geojson = annotateGeojsonFeatures(JSON.parse(await requestText(api.data(layerId))));
  state.layerRuntime[layerId] = { ...(state.layerRuntime[layerId] || {}), geojson, bounds: boundsFromGeojson(geojson) };
  return geojson;
}

function descriptiveHistogram(values = []) {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return "";
  if (min === max) {
    return `
      <div class="histogram-flat">
        <div class="histogram-flat-bar"></div>
        <span>${sanitizeHtml(formatLegendValue(min))}</span>
      </div>`;
  }
  const bins = 8;
  const step = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  values.forEach((value) => {
    const index = Math.min(bins - 1, Math.floor((value - min) / step));
    counts[index] += 1;
  });
  const top = Math.max(...counts, 1);
  return `
    <div class="mini-histogram">
      ${counts
        .map(
          (count, index) => `
            <div class="mini-histogram-bar-wrap" title="${count}">
              <span class="mini-histogram-bar" style="height:${Math.max(10, (count / top) * 88)}px"></span>
              <small>${index === 0 ? sanitizeHtml(formatLegendValue(min)) : index === bins - 1 ? sanitizeHtml(formatLegendValue(max)) : ""}</small>
            </div>`
        )
        .join("")}
    </div>`;
}

function descriptiveTopCategories(values = []) {
  const counts = new Map();
  values.forEach((value) => {
    const key = `${value}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

function descriptiveSummaryFromRows(rows = [], field, fieldType = "") {
  const values = rows.map((row) => row[field]).filter((value) => value !== null && value !== undefined && `${value}` !== "");
  const missing = rows.length - values.length;
  const uniqueCount = new Set(values.map((value) => `${value}`)).size;
  const numericValues = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  const numeric = isNumericFieldType(fieldType) || numericValues.length === values.length;
  const normalizedValues = values.map((value) => `${value}`.trim().toLowerCase());
  const booleanLike = uniqueCount > 0 && normalizedValues.every((value) => ["true", "false", "0", "1", "si", "sí", "no"].includes(value));

  if (booleanLike) {
    const trueCount = normalizedValues.filter((value) => ["true", "1", "si", "sí"].includes(value)).length;
    const falseCount = values.length - trueCount;
    return {
      mode: "boolean",
      cards: [
        [t("descriptiveCount"), rows.length],
        [t("descriptiveMissing"), missing],
        [t("descriptiveTrue"), trueCount],
        [t("descriptiveFalse"), falseCount],
        [t("descriptiveTopShare"), values.length ? `${Math.round((trueCount / values.length) * 100)}%` : "0%"],
      ],
      chart: "",
      list: [],
    };
  }

  if (numeric && numericValues.length) {
    const sorted = [...numericValues].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    const mean = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
    const variance = numericValues.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / numericValues.length;
    return {
      mode: "numeric",
      cards: [
        [t("descriptiveCount"), rows.length],
        [t("descriptiveUnique"), uniqueCount],
        [t("descriptiveMissing"), missing],
        [t("descriptiveMin"), formatLegendValue(Math.min(...numericValues))],
        [t("descriptiveMax"), formatLegendValue(Math.max(...numericValues))],
        [t("descriptiveMean"), formatLegendValue(mean)],
        [t("descriptiveMedian"), formatLegendValue(median)],
        [t("descriptiveStdDev"), formatLegendValue(Math.sqrt(variance))],
        [t("descriptiveSum"), formatLegendValue(numericValues.reduce((sum, value) => sum + value, 0))],
      ],
      chart: descriptiveHistogram(numericValues),
      list: [],
    };
  }

  const top = descriptiveTopCategories(values);
  const topShare = values.length && top[0] ? `${Math.round((top[0][1] / values.length) * 100)}%` : "0%";
  return {
    mode: "categorical",
    cards: [
      [t("descriptiveCount"), rows.length],
      [t("descriptiveMissing"), missing],
      [t("descriptiveValid"), numericValues.length],
      [t("descriptiveUnique"), uniqueCount],
      [t("descriptiveTopClass"), top[0]?.[0] || "-"],
      [t("descriptiveTopShare"), topShare],
    ],
    chart: "",
    list: top,
  };
}

function descriptiveControlsHtml(layers, selectedLayer, fields, selectedField) {
  return `
    <section class="scenario-card descriptive-controls-card">
      <div class="scenario-card-header compact-header">
        <strong>${sanitizeHtml(t("scenarioDescriptiveTitle"))}</strong>
      </div>
      <p class="descriptive-inline-hint">${sanitizeHtml(t("descriptiveSelectHint"))}</p>
      <div class="scenario-form-grid">
        <label>
          <span>${sanitizeHtml(t("descriptiveLayer"))}</span>
          <select id="descriptiveLayerSelect">
            ${layers.map((layer) => `<option value="${layer.id}" ${layer.id === selectedLayer?.id ? "selected" : ""}>${sanitizeHtml(layer.name)}</option>`).join("")}
          </select>
        </label>
        ${selectedLayer?.type === "raster"
          ? ``
          : `
        <label>
          <span>${sanitizeHtml(t("descriptiveVariable"))}</span>
          <select id="descriptiveFieldSelect">
            ${fields.map((field) => `<option value="${field.name}" ${field.name === selectedField ? "selected" : ""}>${sanitizeHtml(field.name)}</option>`).join("")}
          </select>
        </label>`}
      </div>
    </section>`;
}

function descriptiveRasterSummary(layer) {
  const metadata = layer?.metadata || {};
  const bands = Number(metadata.bands);
  const width = Number(metadata.width);
  const height = Number(metadata.height);
  const min = Number(metadata.min);
  const max = Number(metadata.max);
  const bbox = metadata.bounds_wgs84 || metadata.bbox || {};
  const xmin = Number(bbox.xmin);
  const ymin = Number(bbox.ymin);
  const xmax = Number(bbox.xmax);
  const ymax = Number(bbox.ymax);
  const resolutionX = Number.isFinite(width) && Number.isFinite(xmin) && Number.isFinite(xmax) && width > 0 ? Math.abs((xmax - xmin) / width) : null;
  const resolutionY = Number.isFinite(height) && Number.isFinite(ymin) && Number.isFinite(ymax) && height > 0 ? Math.abs((ymax - ymin) / height) : null;

  return {
    cards: [
      [t("summaryBands"), Number.isFinite(bands) ? bands : "-"],
      [t("descriptiveCount"), Number.isFinite(width) && Number.isFinite(height) ? `${formatLegendValue(width)} × ${formatLegendValue(height)}` : "-"],
      [t("descriptiveMin"), Number.isFinite(min) ? formatLegendValue(min) : "-"],
      [t("descriptiveMax"), Number.isFinite(max) ? formatLegendValue(max) : "-"],
      [t("rasterResolution"), resolutionX && resolutionY ? `${formatLegendValue(resolutionX)} × ${formatLegendValue(resolutionY)}°` : "-"],
      [t("rasterExtent"), [xmin, ymin, xmax, ymax].every(Number.isFinite) ? `${formatLegendValue(xmin)}, ${formatLegendValue(ymin)} → ${formatLegendValue(xmax)}, ${formatLegendValue(ymax)}` : "-"],
    ],
  };
}

function descriptiveStatsGridHtml(cards = []) {
  return `
    <div class="descriptive-compact-grid">
      ${cards
        .map(
          ([label, value]) => `
            <div class="descriptive-compact-cell">
              <span>${sanitizeHtml(label)}</span>
              <strong>${sanitizeHtml(value)}</strong>
            </div>`
        )
        .join("")}
    </div>`;
}

function selectedNationalScenarioLayers() {
  return state.layers.filter((layer) => layer.scenario_national_enabled === true);
}

function setLayerRenderVisibility(layerId, visible) {
  const visibility = visible ? "visible" : "none";
  for (const suffix of ["fill", "line", "circle", "raster"]) {
    const mapLayerId = `user-${layerId}-${suffix}`;
    if (map.getLayer(mapLayerId)) map.setLayoutProperty(mapLayerId, "visibility", visibility);
  }
}

function setLayerRenderMuted(layer, muted = false) {
  const opacity = Number(layer?.opacity ?? 0.65);
  const fillOpacity = muted ? Math.max(0.08, opacity * 0.18) : opacity;
  const lineOpacity = muted ? Math.max(0.18, opacity * 0.35) : opacity;
  const circleOpacity = muted ? Math.max(0.18, opacity * 0.35) : opacity;
  const rasterOpacity = muted ? Math.max(0.12, opacity * 0.22) : opacity;
  const id = layer.id;
  try {
    if (map.getLayer(`user-${id}-fill`)) map.setPaintProperty(`user-${id}-fill`, "fill-opacity", fillOpacity);
    if (map.getLayer(`user-${id}-line`)) map.setPaintProperty(`user-${id}-line`, "line-opacity", lineOpacity);
    if (map.getLayer(`user-${id}-circle`)) map.setPaintProperty(`user-${id}-circle`, "circle-opacity", circleOpacity);
    if (map.getLayer(`user-${id}-raster`)) map.setPaintProperty(`user-${id}-raster`, "raster-opacity", rasterOpacity);
  } catch (_) {}
}

function applyDescriptiveMapMode(selectedLayerId) {
  const selectedIds = new Set(selectedNationalScenarioLayers().map((layer) => layer.id));
  setBaseLayerVisibility("ccaa", true);

  for (const layer of state.layers) {
    const inScenario = selectedIds.has(layer.id);
    const isActive = layer.id === selectedLayerId;
    if (!inScenario) {
      setLayerRenderVisibility(layer.id, false);
      continue;
    }
    setLayerRenderVisibility(layer.id, isActive);
    setLayerRenderMuted(layer, false);
  }
  moveFeatureHighlightLayersToTop();
}

function currentScenarioScope() {
  return state.role === "cca" ? "regional" : "national";
}

function activeScenarioStorageKey(scope = currentScenarioScope(), role = state.role) {
  return `plancaza_active_scenario_${role}_${scope}`;
}

function readStoredActiveScenarioId(scope = currentScenarioScope(), role = state.role) {
  return localStorage.getItem(activeScenarioStorageKey(scope, role)) || null;
}

function writeStoredActiveScenarioId(id = null, scope = currentScenarioScope(), role = state.role) {
  localStorage.setItem(activeScenarioStorageKey(scope, role), id || "");
  if (scope === "national") {
    localStorage.setItem("plancaza_active_national_scenario", id || "");
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function currentScenario() {
  const scenarios = asArray(state.scenarios);
  return scenarios.find((scenario) => scenario.id === state.activeScenarioId) || scenarios[0] || null;
}

function inputWorkspaceSnapshotKey(role = state.role) {
  return `plancaza_input_workspace_${role}`;
}

function buildInputWorkspaceSnapshot() {
  return {
    baseLayers: Object.fromEntries(
      Object.entries(state.baseLayers).map(([key, layer]) => [
        key,
        {
          visible: layer.visible !== false,
          opacity: Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 0.72,
        },
      ])
    ),
    groups: state.groups.map((group) => ({
      id: group.id,
      visible: group.visible !== false,
      collapsed: group.collapsed === true,
      opacity: Number.isFinite(Number(group.opacity)) ? Number(group.opacity) : 1,
    })),
    layers: state.layers.map((layer) => ({
      id: layer.id,
      visible: layer.visible !== false,
      opacity: Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 0.65,
    })),
    selectedLayerId: attributeState.selectedLayerId || null,
    activePopupLayerId: activePopupLayerId || null,
  };
}

function saveInputWorkspaceSnapshot() {
  if (!state.layersLoaded) return;
  localStorage.setItem(inputWorkspaceSnapshotKey(), JSON.stringify(buildInputWorkspaceSnapshot()));
}

function applyInputWorkspaceSnapshotToMap() {
  Object.entries(state.baseLayers).forEach(([kind, layer]) => {
    setBaseLayerVisibility(kind, layer.visible !== false);
    if (kind === "ccaa" && map.getLayer("base-ccaa-fill")) {
      map.setPaintProperty("base-ccaa-fill", "fill-opacity", Number(layer.opacity ?? 0.72));
    }
  });

  state.layers.forEach((layer) => {
    setLayerRenderVisibility(layer.id, layer.visible !== false);
    setLayerRenderMuted(layer, false);
  });

  moveFeatureHighlightLayersToTop();
  updateActiveLegend();
}

function restoreInputWorkspaceSnapshot() {
  const raw = localStorage.getItem(inputWorkspaceSnapshotKey());
  if (!raw) {
    applyInputWorkspaceSnapshotToMap();
    renderLayers();
    return;
  }

  try {
    const snapshot = JSON.parse(raw);
    const groupMap = new Map(asArray(snapshot.groups).map((group) => [group.id, group]));
    state.groups.forEach((group) => {
      const saved = groupMap.get(group.id);
      if (!saved) return;
      group.visible = saved.visible !== false;
      group.collapsed = saved.collapsed === true;
      if (Number.isFinite(Number(saved.opacity))) {
        group.opacity = Number(saved.opacity);
      }
    });

    const layerMap = new Map(asArray(snapshot.layers).map((layer) => [layer.id, layer]));
    state.layers.forEach((layer) => {
      const saved = layerMap.get(layer.id);
      if (!saved) return;
      layer.visible = saved.visible !== false;
      if (Number.isFinite(Number(saved.opacity))) {
        layer.opacity = Number(saved.opacity);
      }
    });

    Object.entries(snapshot.baseLayers || {}).forEach(([kind, saved]) => {
      if (!state.baseLayers[kind]) return;
      state.baseLayers[kind].visible = saved.visible !== false;
      if (Number.isFinite(Number(saved.opacity))) {
        state.baseLayers[kind].opacity = Number(saved.opacity);
      }
    });

    attributeState.selectedLayerId =
      state.layers.find((layer) => layer.id === snapshot.selectedLayerId)?.id ||
      attributeState.selectedLayerId;
    activePopupLayerId =
      state.layers.find((layer) => layer.id === snapshot.activePopupLayerId)?.id || null;
  } catch (_) {}

  applyInputWorkspaceSnapshotToMap();
  renderLayers();
}

function scenarioDraftName() {
  const draft = String(state.scenarioNameDraft || "").trim();
  return draft || currentScenario()?.name || t("scenarioDefaultName");
}

function formatScenarioTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(state.lang === "ca" ? "ca-ES" : "es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function defaultNewScenarioName() {
  return `${t("scenarioDefaultName")} ${asArray(state.scenarios).length + 1}`;
}

function beginScenarioRename() {
  state.scenarioRenameMode = true;
  requestAnimationFrame(() => {
    const input = els.scenarioMetaBar.querySelector("#scenarioNameInput");
    if (!input) return;
    input.focus();
    input.select();
  });
}

function endScenarioRename() {
  state.scenarioRenameMode = false;
}

function startNewScenarioDraft() {
  state.activeScenarioId = null;
  writeStoredActiveScenarioId("", currentScenarioScope(), state.role);
  state.scenarioNameDraft = defaultNewScenarioName();
  state.scenarioRenameMode = true;
  state.savedScenarioFingerprint = "";
  syncSectionUi();
}

function scenarioComparablePayload(nameOverride = null) {
  const payload = scenarioStatePayload(nameOverride || scenarioDraftName());
  return JSON.stringify({
    name: payload.name,
    role: payload.role,
    scope: payload.scope,
    config: payload.config,
  });
}

function setSavedScenarioFingerprint(nameOverride = null) {
  state.savedScenarioFingerprint = scenarioComparablePayload(nameOverride || scenarioDraftName());
}

function isScenarioDirty() {
  if (!state.activeScenarioId) return true;
  if (!state.savedScenarioFingerprint) return false;
  return scenarioComparablePayload() !== state.savedScenarioFingerprint;
}

function defaultNationalDraft() {
  return {
    aggregation: { layerId: null, field: null, method: "mean" },
    weights: { items: {} },
    model: { runLabel: "", priority: "balanced", solver: "multiscale", notes: "" },
  };
}

function normalizeNationalDraft(raw = {}) {
  const base = defaultNationalDraft();
  return {
    aggregation: {
      layerId: raw.aggregation?.layerId || base.aggregation.layerId,
      field: raw.aggregation?.field || base.aggregation.field,
      method: raw.aggregation?.method || base.aggregation.method,
    },
    weights: {
      items: { ...(raw.weights?.items || {}) },
    },
    model: {
      runLabel: raw.model?.runLabel || base.model.runLabel,
      priority: raw.model?.priority || base.model.priority,
      solver: raw.model?.solver || base.model.solver,
      notes: raw.model?.notes || base.model.notes,
    },
  };
}

function syncNationalDraftWithLayers() {
  state.nationalDraft = normalizeNationalDraft(state.nationalDraft);
  const selectedLayers = selectedNationalScenarioLayers();
  const selectedIds = new Set(selectedLayers.map((layer) => layer.id));
  const nextItems = {};
  selectedLayers.forEach((layer) => {
    const current = state.nationalDraft.weights.items[layer.id] || {};
    nextItems[layer.id] = {
      weight: Number.isFinite(Number(current.weight)) ? Number(current.weight) : 1,
      direction: current.direction === "min" ? "min" : "max",
    };
  });
  state.nationalDraft.weights.items = nextItems;

  if (!selectedIds.has(state.nationalDraft.aggregation.layerId)) {
    state.nationalDraft.aggregation.layerId = selectedLayers[0]?.id || null;
  }

  const aggregationLayer = selectedLayers.find((layer) => layer.id === state.nationalDraft.aggregation.layerId) || null;
  const candidateFields = descriptiveFieldCandidates(aggregationLayer);
  const fieldNames = new Set(candidateFields.map((field) => field.name));
  if (!fieldNames.has(state.nationalDraft.aggregation.field)) {
    state.nationalDraft.aggregation.field =
      candidateFields.find((field) => isNumericFieldType(field.type))?.name ||
      candidateFields[0]?.name ||
      null;
  }
}

function scenarioStatePayload(nameOverride = null) {
  syncNationalDraftWithLayers();
  const scope = currentScenarioScope();
  return {
    id: state.activeScenarioId,
    name: (nameOverride || currentScenario()?.name || t("scenarioDefaultName")).trim(),
    role: state.role,
    scope,
    config: {
      selected_layer_ids: selectedNationalScenarioLayers().map((layer) => layer.id),
      descriptive: {
        layerId: state.descriptive.layerId || null,
        field: state.descriptive.field || null,
      },
      national: state.nationalDraft,
      national_step: state.nationalStep || "layers",
    },
  };
}

function syncScenarioMetaStatus() {
  const active = currentScenario();
  const dirty = !state.activeScenarioId || isScenarioDirty();
  const nameNode = els.scenarioMetaBar.querySelector("[data-scenario-current-name]");
  const metaNode = els.scenarioMetaBar.querySelector("[data-scenario-current-meta]");
  const statusNode = els.scenarioMetaBar.querySelector("[data-scenario-current-status]");
  const saveButton = els.scenarioMetaBar.querySelector("[data-action='save-scenario']");
  const saveAsButton = els.scenarioMetaBar.querySelector("[data-action='save-as-scenario']");
  const nameInput = els.scenarioMetaBar.querySelector("#scenarioNameInput");
  const pickerValue = els.scenarioMetaBar.querySelector("[data-scenario-picker-value]");
  const pickerMeta = els.scenarioMetaBar.querySelector("[data-scenario-picker-meta]");

  if (nameNode) {
    nameNode.textContent = scenarioDraftName();
  }
  if (statusNode) {
    statusNode.textContent = dirty ? t("scenarioDirtyStatus") : t("scenarioSavedStatus");
    statusNode.classList.toggle("is-dirty", dirty);
    statusNode.classList.toggle("is-clean", !dirty);
  }
  if (metaNode) {
    metaNode.textContent = active?.updated_at ? `${t("scenarioUpdatedLabel")}: ${formatScenarioTimestamp(active.updated_at)}` : "";
  }
  if (pickerValue) {
    pickerValue.textContent = active?.name || t("scenarioNewOption");
  }
  if (pickerMeta) {
    pickerMeta.textContent = active?.updated_at ? `${t("scenarioUpdatedLabel")}: ${formatScenarioTimestamp(active.updated_at)}` : "";
  }
  if (saveButton) {
    saveButton.disabled = !dirty && Boolean(active);
  }
  if (saveAsButton) {
    saveAsButton.disabled = !scenarioDraftName().trim();
  }
  if (nameInput && document.activeElement !== nameInput) {
    nameInput.value = scenarioDraftName();
  }
}

function renderScenarioMetaBar(scope = "national") {
  if (scope !== "national") {
    els.scenarioMetaBar.classList.add("is-hidden");
    els.scenarioMetaBar.innerHTML = "";
    state.scenarioPickerOpen = false;
    return;
  }

  const active = currentScenario();
  const scenarios = asArray(state.scenarios);
  const entries = scenarios
    .map((scenario) => {
      const updated = formatScenarioTimestamp(scenario.updated_at);
      return `
        <button
          type="button"
          class="scenario-picker-option ${scenario.id === active?.id ? "is-active" : ""}"
          data-action="select-scenario"
          data-id="${scenario.id}"
        >
          <span class="scenario-picker-option-title">${sanitizeHtml(scenario.name)}</span>
          <span class="scenario-picker-option-meta">${updated ? `${sanitizeHtml(t("scenarioUpdatedLabel"))}: ${sanitizeHtml(updated)}` : ""}</span>
        </button>`;
    })
    .join("");

  els.scenarioMetaBar.classList.remove("is-hidden");
  els.scenarioMetaBar.innerHTML = `
    <div class="scenario-meta-top">
      <div class="scenario-meta-copy">
        <div class="scenario-meta-label">${sanitizeHtml(t("scenarioCurrentLabel"))}</div>
        <div class="scenario-meta-name-row">
          ${
            state.scenarioRenameMode
              ? `<input type="text" id="scenarioNameInput" class="scenario-meta-name-input" value="${sanitizeHtml(scenarioDraftName())}" />`
              : `<strong class="scenario-meta-name" data-scenario-current-name></strong>`
          }
          ${active?.id ? `<span class="scenario-chip scenario-active-chip">${sanitizeHtml(t("scenarioActiveBadge"))}</span>` : ""}
          <button type="button" class="panel-icon-button scenario-rename-button" data-action="rename-scenario" title="${sanitizeHtml(t("scenarioRenameAction"))}" aria-label="${sanitizeHtml(t("scenarioRenameAction"))}">
            <span aria-hidden="true">&#9998;</span>
          </button>
          <span class="scenario-meta-status" data-scenario-current-status></span>
        </div>
        <div class="scenario-meta-subline" data-scenario-current-meta></div>
      </div>
      <span class="scenario-chip scenario-meta-count">${sanitizeHtml(`${scenarios.length}`)}</span>
    </div>
    <div class="scenario-meta-controls">
      <div class="scenario-meta-field">
        <span>${sanitizeHtml(t("scenarioActiveLabel"))}</span>
        <div class="scenario-picker ${state.scenarioPickerOpen ? "is-open" : ""}">
          <button type="button" class="scenario-picker-trigger" data-action="toggle-scenario-picker" aria-expanded="${state.scenarioPickerOpen ? "true" : "false"}">
            <span class="scenario-picker-trigger-copy">
              <strong data-scenario-picker-value>${sanitizeHtml(active?.name || t("scenarioNewOption"))}</strong>
              <span data-scenario-picker-meta>${active?.updated_at ? `${sanitizeHtml(t("scenarioUpdatedLabel"))}: ${sanitizeHtml(formatScenarioTimestamp(active.updated_at))}` : ""}</span>
            </span>
            <span class="scenario-picker-caret" aria-hidden="true">${state.scenarioPickerOpen ? "▴" : "▾"}</span>
          </button>
          ${
            state.scenarioPickerOpen
              ? `<div class="scenario-picker-dropdown">
                  ${entries || `<div class="scenario-picker-empty">${sanitizeHtml(t("scenarioEmptyState"))}</div>`}
                  <button type="button" class="scenario-picker-option scenario-picker-new" data-action="select-scenario" data-id="__new__">
                    <span class="scenario-picker-option-title">+ ${sanitizeHtml(t("scenarioNewOption"))}</span>
                    <span class="scenario-picker-option-meta"></span>
                  </button>
                </div>`
              : ""
          }
        </div>
      </div>
      <div class="scenario-meta-actions">
        <button type="button" class="scenario-inline-button" data-action="save-as-scenario">${sanitizeHtml(t("scenarioSaveAsAction"))}</button>
        <button type="button" class="panel-icon-button scenario-delete-button" data-action="delete-scenario" title="${sanitizeHtml(t("scenarioDeleteAction"))}" aria-label="${sanitizeHtml(t("scenarioDeleteAction"))}" ${active ? "" : "disabled"}>
          <span aria-hidden="true">&#128465;</span>
        </button>
        <button type="button" class="panel-icon-button scenario-save-button" data-action="save-scenario" title="${sanitizeHtml(t("scenarioSaveAction"))}" aria-label="${sanitizeHtml(t("scenarioSaveAction"))}">
          <span aria-hidden="true">&#128190;</span>
        </button>
      </div>
    </div>`;

  syncScenarioMetaStatus();
}

function renderScenarioSectionHeader(scope = "national") {
  if (scope === "national") {
    els.scenarioSectionEyebrow.textContent = t("scenarioNationalEyebrow");
    els.scenarioSectionTitle.textContent = t("scenarioNationalTitle");
    els.scenarioSectionDescription.textContent = t("scenarioNationalDescription");
    renderScenarioMetaBar("national");
    return;
  }
  if (scope === "regional") {
    els.scenarioSectionEyebrow.textContent = t("scenarioRegionalEyebrow");
    els.scenarioSectionTitle.textContent = t("scenarioRegionalTitle");
    els.scenarioSectionDescription.textContent = t("scenarioRegionalDescription");
    renderScenarioMetaBar("regional");
    return;
  }
  if (scope === "analysis") {
    els.scenarioSectionEyebrow.textContent = t("panelAnalysis");
    els.scenarioSectionTitle.textContent = t("scenarioAnalysisTitle");
    els.scenarioSectionDescription.textContent = t("scenarioAnalysisDescription");
    renderScenarioMetaBar("analysis");
    return;
  }
  els.scenarioSectionEyebrow.textContent = t("panelExport");
  els.scenarioSectionTitle.textContent = t("scenarioExportTitle");
  els.scenarioSectionDescription.textContent = t("scenarioExportDescription");
  renderScenarioMetaBar("export");
}

async function saveScenario(nameOverride = null, creating = false) {
  const payload = scenarioStatePayload(nameOverride);
  if (creating) {
    delete payload.id;
  }
  const response = await requestJson(api.saveScenario(), {
    method: "POST",
    body: JSON.stringify(payload),
  });
  state.scenarios = asArray(response.scenarios || state.scenarios);
  state.activeScenarioId = response.scenario?.id || state.activeScenarioId;
  state.scenarioNameDraft = response.scenario?.name || payload.name;
  state.scenarioRenameMode = false;
  writeStoredActiveScenarioId(state.activeScenarioId, payload.scope, state.role);
  setSavedScenarioFingerprint(state.scenarioNameDraft);
  return response.scenario;
}

async function duplicateScenario() {
  const active = currentScenario();
  if (!active) return null;
  const response = await requestJson(api.duplicateScenario(active.id), {
    method: "POST",
    body: JSON.stringify({ role: state.role }),
  });
  state.scenarios = asArray(response.scenarios || state.scenarios);
  state.activeScenarioId = response.scenario?.id || state.activeScenarioId;
  state.scenarioNameDraft = response.scenario?.name || state.scenarioNameDraft;
  state.scenarioRenameMode = false;
  writeStoredActiveScenarioId(state.activeScenarioId, currentScenarioScope(), state.role);
  setSavedScenarioFingerprint(state.scenarioNameDraft);
  return response.scenario;
}

async function deleteScenario() {
  const active = currentScenario();
  if (!active?.id) return null;
  const scope = currentScenarioScope();
  const response = await requestJson(api.deleteScenario(active.id, scope), {
    method: "DELETE",
  });
  state.scenarios = asArray(response.scenarios || []);
  state.activeScenarioId = response.active_scenario_id || state.scenarios[0]?.id || null;
  if (state.activeScenarioId) {
    const next = state.scenarios.find((item) => item.id === state.activeScenarioId) || state.scenarios[0];
    await applyScenarioConfig(next, true, { preserveCurrentStep: true });
  } else {
    state.savedScenarioFingerprint = "";
    startNewScenarioDraft();
  }
  return response;
}

async function applyScenarioConfig(scenario, persist = true, options = {}) {
  const preserveCurrentStep = options.preserveCurrentStep === true;
  if (!scenario) return;
  const selectedIds = new Set(asArray(scenario.config?.selected_layer_ids || []));
  const layerUpdates = [];
  state.layers.forEach((layer) => {
    if (FIXED_BASE_KEYS.has(layerKey(layer))) return;
    const enabled = selectedIds.has(layer.id);
    if (layer.scenario_national_enabled !== enabled) {
      layer.scenario_national_enabled = enabled;
      if (persist) {
        layerUpdates.push(persistScenarioNationalSelection(layer.id, enabled));
      }
    }
  });
  state.descriptive.layerId = scenario.config?.descriptive?.layerId || null;
  state.descriptive.field = scenario.config?.descriptive?.field || null;
  state.nationalDraft = normalizeNationalDraft(scenario.config?.national || {});
  state.nationalStep = preserveCurrentStep ? state.nationalStep || "layers" : scenario.config?.national_step || "layers";
  localStorage.setItem("plancaza_national_step", state.nationalStep);
  state.activeScenarioId = scenario.id;
  state.scenarioNameDraft = scenario.name || "";
  state.scenarioRenameMode = false;
  writeStoredActiveScenarioId(state.activeScenarioId, scenario.scope || currentScenarioScope(), state.role);
  setSavedScenarioFingerprint(state.scenarioNameDraft);
  if (layerUpdates.length) {
    const responses = await Promise.all(layerUpdates);
    const last = responses[responses.length - 1];
    if (last?.layers) {
      state.layers = last.layers;
    }
  }
  syncNationalDraftWithLayers();
  renderLayers();
  syncSectionUi();
}

async function ensureScenarioCollection() {
  if (state.scenariosLoading) return;
  state.scenariosLoading = true;
  try {
  const scope = currentScenarioScope();
  state.activeScenarioId = readStoredActiveScenarioId(scope, state.role);
  const response = await requestJson(api.scenarios(scope));
  state.scenarios = asArray(response.scenarios || []);
  let active = currentScenario();
  if (!active) {
    const created = await saveScenario(t("scenarioDefaultName"), true);
    active = created;
  }
  if (active) {
    await applyScenarioConfig(active, false, { preserveCurrentStep: state.section === "national" });
  }
  } finally {
    state.scenariosLoading = false;
  }
}

async function persistScenarioNationalSelection(layerId, enabled) {
  return requestJson(api.layer(layerId), {
    method: "POST",
    body: JSON.stringify({ role: state.role, scenario_national_enabled: enabled }),
  });
}

function renderScenarioLayersPanel() {
  const selectedCount = selectedNationalScenarioLayers().length;
  const items = state.layers
    .filter((layer) => !FIXED_BASE_KEYS.has(layerKey(layer)))
    .map(
      (layer) => `
        <article class="scenario-layer-item ${layer.scenario_national_enabled ? "is-enabled" : ""} ${state.descriptive.layerId === layer.id ? "is-current" : ""}">
          <div class="scenario-layer-main">
            <div class="scenario-layer-copy">
              <strong>${sanitizeHtml(layer.name)}</strong>
              <span>${sanitizeHtml(layerTypeLabel(layer))}</span>
            </div>
            <label class="scenario-toggle">
              <input type="checkbox" data-action="toggle-scenario-layer" data-id="${layer.id}" ${layer.scenario_national_enabled ? "checked" : ""} />
              <span>${sanitizeHtml(t("scenarioUseToggle"))}</span>
            </label>
          </div>
          <div class="scenario-layer-actions">
            <button type="button" class="scenario-inline-button" data-action="explore-scenario-layer" data-id="${layer.id}">${sanitizeHtml(t("scenarioUseExplore"))}</button>
          </div>
        </article>`
    )
    .join("");

  renderScenarioSectionHeader("national");
  els.scenarioStepNav.innerHTML = NATIONAL_STEPS
    .map(
      (item, index) => `
        <button type="button" class="scenario-step-button ${item.id === "layers" ? "is-active" : ""}" data-step="${item.id}">
          <span class="scenario-step-index">${index + 1}</span>
          <span class="scenario-step-copy"><strong>${sanitizeHtml(t(item.labelKey))}</strong></span>
        </button>`
    )
    .join("");
  els.scenarioPanelBody.innerHTML = `
    <section class="scenario-card">
      <div class="scenario-card-header">
        <strong>${sanitizeHtml(t("scenarioUseTitle"))}</strong>
        <span class="scenario-chip">${sanitizeHtml(t("scenarioUseSelected"))}: ${selectedCount}</span>
      </div>
      <p>${sanitizeHtml(t("scenarioUseBody"))}</p>
    </section>
    <section class="scenario-layer-list">
      ${items || `<section class="scenario-card"><p>${sanitizeHtml(t("scenarioUseNone"))}</p></section>`}
    </section>`;
}

async function renderDescriptivePanel() {
  renderScenarioSectionHeader("national");
  els.scenarioStepNav.innerHTML = NATIONAL_STEPS
    .map(
      (item, index) => `
        <button type="button" class="scenario-step-button ${item.id === "descriptive" ? "is-active" : ""}" data-step="${item.id}">
          <span class="scenario-step-index">${index + 1}</span>
          <span class="scenario-step-copy"><strong>${sanitizeHtml(t(item.labelKey))}</strong></span>
        </button>`
    )
    .join("");

  const layers = descriptiveCandidateLayers();
  if (!layers.length) {
    els.scenarioPanelBody.innerHTML = `<section class="scenario-card"><p>${sanitizeHtml(t("descriptiveNoSelected"))}</p></section>`;
    return;
  }

  const selectedLayer = layers.find((layer) => layer.id === state.descriptive.layerId) || layers[0];
  state.descriptive.layerId = selectedLayer.id;
  if (selectedLayer.type === "raster") {
    state.descriptive.field = null;
    const summary = descriptiveRasterSummary(selectedLayer);
    els.scenarioPanelBody.innerHTML = `
      ${descriptiveControlsHtml(layers, selectedLayer, [], "")}
      <section class="scenario-card descriptive-field-card">
        <div class="scenario-card-header compact-header">
          <div class="descriptive-title-wrap">
            <strong>${sanitizeHtml(t("descriptiveStatsTitle"))}</strong>
            <span>${sanitizeHtml(t("descriptiveRasterHint"))}</span>
          </div>
        </div>
        <div class="descriptive-field-toolbar">
          <div class="descriptive-field-meta">
            <strong>${sanitizeHtml(layerTypeLabel(selectedLayer))}</strong>
            <span>${sanitizeHtml(selectedLayer.name)} · ${sanitizeHtml(inferNativeScale(selectedLayer))}</span>
          </div>
        </div>
        ${descriptiveStatsGridHtml(summary.cards)}
      </section>`;

    await redrawUserLayers(selectedLayer.id);
    applyDescriptiveMapMode(selectedLayer.id);
    return;
  }
  const fields = descriptiveFieldCandidates(selectedLayer);
  if (!fields.length) {
    els.scenarioPanelBody.innerHTML = `${descriptiveControlsHtml(layers, selectedLayer, [], "")}<section class="scenario-card"><p>${sanitizeHtml(t("descriptiveNoFields"))}</p></section>`;
    return;
  }
  const selectedField = fields.find((field) => field.name === state.descriptive.field)?.name || fields.find((field) => isNumericFieldType(field.type))?.name || fields[0].name;
  state.descriptive.field = selectedField;

  const geojson = await ensureLayerGeojson(selectedLayer.id);
  const rows = attributeRowsFromGeojson(geojson);
  const fieldType = fields.find((field) => field.name === selectedField)?.type || "";
  const summary = descriptiveSummaryFromRows(rows, selectedField, fieldType);
  const categoricalList = summary.list.length
    ? `<div class="descriptive-top-list">${summary.list
        .map(
          ([label, count]) => `
            <div class="descriptive-top-item">
              <span>${sanitizeHtml(label)}</span>
              <strong>${sanitizeHtml(count)}</strong>
            </div>`
        )
        .join("")}</div>`
    : "";
  const distributionBlock =
    summary.mode === "numeric"
      ? `
        <section class="scenario-card descriptive-distribution-card">
          <div class="scenario-card-header compact-header">
            <strong>${sanitizeHtml(t("descriptiveDistribution"))}</strong>
          </div>
          ${summary.chart}
        </section>`
      : summary.list.length
        ? `
        <section class="scenario-card descriptive-distribution-card">
          <div class="scenario-card-header compact-header">
            <strong>${sanitizeHtml(t("descriptiveTopValues"))}</strong>
          </div>
          ${categoricalList}
        </section>`
        : "";

  els.scenarioPanelBody.innerHTML = `
    ${descriptiveControlsHtml(layers, selectedLayer, fields, selectedField)}
    <section class="scenario-card descriptive-field-card">
      <div class="scenario-card-header compact-header">
        <div class="descriptive-title-wrap">
          <strong>${sanitizeHtml(t("descriptiveStatsTitle"))}</strong>
          <span>${sanitizeHtml(t("descriptiveStatsSubtitle"))}</span>
        </div>
      </div>
      <div class="descriptive-field-toolbar">
        <div class="descriptive-field-meta">
          <strong>${sanitizeHtml(selectedField)}</strong>
          <span>${sanitizeHtml(selectedLayer.name)} · ${sanitizeHtml(inferNativeScale(selectedLayer))}</span>
        </div>
      </div>
      ${descriptiveStatsGridHtml(summary.cards)}
    </section>
    ${distributionBlock}`;

  await redrawUserLayers(selectedLayer.id);
  applyDescriptiveMapMode(selectedLayer.id);
}

function aggregationMethodOptions(selected) {
  return [
    ["mean", t("aggregationMethodMean")],
    ["sum", t("aggregationMethodSum")],
    ["max", t("aggregationMethodMax")],
    ["presence", t("aggregationMethodPresence")],
  ]
    .map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${sanitizeHtml(label)}</option>`)
    .join("");
}

function renderAggregationPanel() {
  syncNationalDraftWithLayers();
  const layers = descriptiveCandidateLayers();
  renderScenarioSectionHeader("national");
  els.scenarioStepNav.innerHTML = NATIONAL_STEPS
    .map(
      (item, index) => `
        <button type="button" class="scenario-step-button ${item.id === "aggregation" ? "is-active" : ""}" data-step="${item.id}">
          <span class="scenario-step-index">${index + 1}</span>
          <span class="scenario-step-copy"><strong>${sanitizeHtml(t(item.labelKey))}</strong></span>
        </button>`
    )
    .join("");

  if (!layers.length) {
    els.scenarioPanelBody.innerHTML = `<section class="scenario-card"><p>${sanitizeHtml(t("aggregationNoLayers"))}</p></section>`;
    return;
  }

  const selectedLayer = layers.find((layer) => layer.id === state.nationalDraft.aggregation.layerId) || layers[0];
  state.nationalDraft.aggregation.layerId = selectedLayer.id;
  const fields = descriptiveFieldCandidates(selectedLayer);
  if (!fields.find((field) => field.name === state.nationalDraft.aggregation.field)) {
    state.nationalDraft.aggregation.field = fields.find((field) => isNumericFieldType(field.type))?.name || fields[0]?.name || null;
  }

  els.scenarioPanelBody.innerHTML = `
    <section class="scenario-card">
      <div class="scenario-card-header">
        <strong>${sanitizeHtml(t("scenarioAggregationTitle"))}</strong>
        <span class="scenario-chip">${sanitizeHtml(t("aggregationTargetFixed"))}</span>
      </div>
      <p>${sanitizeHtml(t("scenarioAggregationBody"))}</p>
      <div class="scenario-form-grid">
        <label>
          <span>${sanitizeHtml(t("aggregationLayerLabel"))}</span>
          <select id="aggregationLayerSelect">
            ${layers.map((layer) => `<option value="${layer.id}" ${layer.id === selectedLayer.id ? "selected" : ""}>${sanitizeHtml(layer.name)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>${sanitizeHtml(t("aggregationFieldLabel"))}</span>
          <select id="aggregationFieldSelect">
            ${fields.map((field) => `<option value="${field.name}" ${field.name === state.nationalDraft.aggregation.field ? "selected" : ""}>${sanitizeHtml(field.name)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>${sanitizeHtml(t("aggregationMethodLabel"))}</span>
          <select id="aggregationMethodSelect">
            ${aggregationMethodOptions(state.nationalDraft.aggregation.method)}
          </select>
        </label>
        <label>
          <span>${sanitizeHtml(t("aggregationTargetLabel"))}</span>
          <input type="text" value="${sanitizeHtml(t("aggregationTargetFixed"))}" disabled />
        </label>
      </div>
    </section>
    ${scenarioChecklist(currentNationalStep().checklist)}`;
}

function renderWeightsPanel() {
  syncNationalDraftWithLayers();
  const layers = selectedNationalScenarioLayers();
  renderScenarioSectionHeader("national");
  els.scenarioStepNav.innerHTML = NATIONAL_STEPS
    .map(
      (item, index) => `
        <button type="button" class="scenario-step-button ${item.id === "weights" ? "is-active" : ""}" data-step="${item.id}">
          <span class="scenario-step-index">${index + 1}</span>
          <span class="scenario-step-copy"><strong>${sanitizeHtml(t(item.labelKey))}</strong></span>
        </button>`
    )
    .join("");

  const rows = layers
    .map((layer) => {
      const item = state.nationalDraft.weights.items[layer.id] || { weight: 1, direction: "max" };
      return `
        <div class="scenario-weight-row">
          <div class="scenario-weight-name">${sanitizeHtml(layer.name)}</div>
          <input type="number" min="0" step="0.1" data-weight-layer="${layer.id}" value="${sanitizeHtml(String(item.weight ?? 1))}" />
          <select data-weight-direction="${layer.id}">
            <option value="max" ${item.direction !== "min" ? "selected" : ""}>${sanitizeHtml(t("weightsDirectionMax"))}</option>
            <option value="min" ${item.direction === "min" ? "selected" : ""}>${sanitizeHtml(t("weightsDirectionMin"))}</option>
          </select>
        </div>`;
    })
    .join("");

  els.scenarioPanelBody.innerHTML = `
    <section class="scenario-card">
      <div class="scenario-card-header">
        <strong>${sanitizeHtml(t("scenarioWeightsTitle"))}</strong>
      </div>
      <p>${sanitizeHtml(t("scenarioWeightsBody"))}</p>
      ${
        rows
          ? `<div class="scenario-weight-grid">
              <div class="scenario-weight-head">${sanitizeHtml(t("weightsLayerLabel"))}</div>
              <div class="scenario-weight-head">${sanitizeHtml(t("weightsValueLabel"))}</div>
              <div class="scenario-weight-head">${sanitizeHtml(t("weightsDirectionLabel"))}</div>
              ${rows}
            </div>`
          : `<p>${sanitizeHtml(t("weightsNoLayers"))}</p>`
      }
    </section>
    ${scenarioChecklist(currentNationalStep().checklist)}`;
}

function renderModelPanel() {
  state.nationalDraft = normalizeNationalDraft(state.nationalDraft);
  renderScenarioSectionHeader("national");
  els.scenarioStepNav.innerHTML = NATIONAL_STEPS
    .map(
      (item, index) => `
        <button type="button" class="scenario-step-button ${item.id === "model" ? "is-active" : ""}" data-step="${item.id}">
          <span class="scenario-step-index">${index + 1}</span>
          <span class="scenario-step-copy"><strong>${sanitizeHtml(t(item.labelKey))}</strong></span>
        </button>`
    )
    .join("");

  els.scenarioPanelBody.innerHTML = `
    <section class="scenario-card">
      <div class="scenario-card-header">
        <strong>${sanitizeHtml(t("scenarioModelTitle"))}</strong>
      </div>
      <p>${sanitizeHtml(t("scenarioModelBody"))}</p>
      <div class="scenario-form-grid">
        <label>
          <span>${sanitizeHtml(t("modelRunLabel"))}</span>
          <input type="text" id="modelRunLabelInput" value="${sanitizeHtml(state.nationalDraft.model.runLabel || "")}" />
        </label>
        <label>
          <span>${sanitizeHtml(t("modelPriorityLabel"))}</span>
          <select id="modelPrioritySelect">
            <option value="balanced" ${state.nationalDraft.model.priority === "balanced" ? "selected" : ""}>${sanitizeHtml(t("modelPriorityBalanced"))}</option>
            <option value="ecological" ${state.nationalDraft.model.priority === "ecological" ? "selected" : ""}>${sanitizeHtml(t("modelPriorityEcological"))}</option>
            <option value="social" ${state.nationalDraft.model.priority === "social" ? "selected" : ""}>${sanitizeHtml(t("modelPrioritySocial"))}</option>
          </select>
        </label>
        <label>
          <span>${sanitizeHtml(t("modelSolverLabel"))}</span>
          <input type="text" id="modelSolverInput" value="${sanitizeHtml(state.nationalDraft.model.solver || t("modelSolverFixed"))}" />
        </label>
        <label class="scenario-form-span-2">
          <span>${sanitizeHtml(t("modelNotesLabel"))}</span>
          <textarea id="modelNotesInput" rows="4">${sanitizeHtml(state.nationalDraft.model.notes || "")}</textarea>
        </label>
      </div>
    </section>
    ${scenarioChecklist(currentNationalStep().checklist)}`;
}

function scenarioChecklist(items = []) {
  return `
    <section class="scenario-card scenario-checklist">
      <div class="scenario-card-header">
        <strong>${sanitizeHtml(t("scenarioChecklistTitle"))}</strong>
        <span class="scenario-chip">${sanitizeHtml(t("scenarioCardStatusReady"))}</span>
      </div>
      <ul class="scenario-checklist-list">
        ${items.map((item) => `<li>${sanitizeHtml(item)}</li>`).join("")}
      </ul>
    </section>`;
}

function renderNationalPanel() {
  if (!state.scenarios.length && !state.scenariosLoading) {
    ensureScenarioCollection().catch(() => {});
  }
  const step = currentNationalStep();
  if (step.id === "layers") {
    renderScenarioLayersPanel();
    return;
  }
  if (step.id === "descriptive") {
    renderDescriptivePanel();
    return;
  }
  if (step.id === "aggregation") {
    renderAggregationPanel();
    return;
  }
  if (step.id === "weights") {
    renderWeightsPanel();
    return;
  }
  if (step.id === "model") {
    renderModelPanel();
    return;
  }
  renderScenarioSectionHeader("national");
  els.scenarioStepNav.innerHTML = NATIONAL_STEPS
    .map(
      (item, index) => `
        <button type="button" class="scenario-step-button ${item.id === step.id ? "is-active" : ""}" data-step="${item.id}">
          <span class="scenario-step-index">${index + 1}</span>
          <span class="scenario-step-copy">
            <strong>${sanitizeHtml(t(item.labelKey))}</strong>
          </span>
        </button>`
    )
    .join("");

  const introCards =
    step.id === "layers"
      ? `
        <div class="scenario-card-grid">
          <section class="scenario-card">
            <div class="scenario-card-header">
              <strong>${sanitizeHtml(t(step.titleKey))}</strong>
              <span class="scenario-chip">${sanitizeHtml(t("scenarioCardStatusReady"))}</span>
            </div>
            <p>${sanitizeHtml(t(step.bodyKey))}</p>
          </section>
          <section class="scenario-card">
            <div class="scenario-card-header">
              <strong>Mapa siempre visible</strong>
              <span class="scenario-chip muted">${sanitizeHtml(t("scenarioCardStatusNext"))}</span>
            </div>
            <p>${sanitizeHtml(t("scenarioLayersCardA"))}</p>
            <p>${sanitizeHtml(t("scenarioLayersCardB"))}</p>
          </section>
        </div>`
      : `
        <section class="scenario-card">
          <div class="scenario-card-header">
            <strong>${sanitizeHtml(t(step.titleKey))}</strong>
            <span class="scenario-chip">${sanitizeHtml(t("scenarioCardStatusNext"))}</span>
          </div>
          <p>${sanitizeHtml(t(step.bodyKey))}</p>
        </section>`;

  els.scenarioPanelBody.innerHTML = `${introCards}${scenarioChecklist(step.checklist)}`;
}

function renderRegionalPanel() {
  renderScenarioSectionHeader("regional");
  els.scenarioStepNav.innerHTML = "";
  els.scenarioPanelBody.innerHTML = `
    <section class="scenario-card">
      <div class="scenario-card-header">
        <strong>${sanitizeHtml(t("scenarioRegionalTitle"))}</strong>
        <span class="scenario-chip muted">${sanitizeHtml(t("scenarioCardStatusNext"))}</span>
      </div>
      <p>${sanitizeHtml(t("scenarioPlaceholderRegional"))}</p>
    </section>`;
}

function renderAnalysisPanel() {
  renderScenarioSectionHeader("analysis");
  els.scenarioStepNav.innerHTML = "";
  els.scenarioPanelBody.innerHTML = `
    <section class="scenario-card">
      <div class="scenario-card-header">
        <strong>${sanitizeHtml(t("scenarioAnalysisTitle"))}</strong>
        <span class="scenario-chip">${sanitizeHtml(t("scenarioCardStatusReady"))}</span>
      </div>
      <p>${sanitizeHtml(t("scenarioPlaceholderAnalysis"))}</p>
    </section>
    <section class="scenario-card scenario-checklist">
      <div class="scenario-card-header">
        <strong>${sanitizeHtml(t("scenarioChecklistTitle"))}</strong>
        <span class="scenario-chip muted">${sanitizeHtml(t("scenarioCardStatusNext"))}</span>
      </div>
      <ul class="scenario-checklist-list">
        <li>Guardar corridas por escenario y por ámbito.</li>
        <li>Comparar resultados entre escenarios activos y archivados.</li>
        <li>Preparar tablas y mapas para lectura conjunta antes de exportar.</li>
      </ul>
    </section>`;
}

function renderExportPanel() {
  renderScenarioSectionHeader("export");
  els.scenarioStepNav.innerHTML = "";
  els.scenarioPanelBody.innerHTML = `
    <section class="scenario-card">
      <div class="scenario-card-header">
        <strong>${sanitizeHtml(t("scenarioExportTitle"))}</strong>
        <span class="scenario-chip muted">${sanitizeHtml(t("scenarioCardStatusNext"))}</span>
      </div>
      <p>${sanitizeHtml(t("scenarioPlaceholderExport"))}</p>
    </section>`;
}

function syncSectionUi() {
  ensureNavSections();
  const allowedSections = allowedSectionsForRole(state.role);
  state.section = normalizeSectionForRole(state.section, state.role);
  localStorage.setItem("plancaza_section", state.section);
  const previousSection = lastSyncedSection;
  const sectionChanged = previousSection !== state.section;
  if (sectionChanged && previousSection === "input" && state.section !== "input") {
    saveInputWorkspaceSnapshot();
  }
  if (sectionChanged && state.section === "national") {
    state.nationalStep = "layers";
    localStorage.setItem("plancaza_national_step", state.nationalStep);
  }
  lastSyncedSection = state.section;

  els.navButtons.forEach((button) => {
    const allowed = allowedSections.includes(button.dataset.section);
    button.classList.toggle("is-hidden", !allowed);
    button.disabled = !allowed;
    button.classList.toggle("active", button.dataset.section === state.section);
  });

  const isInput = state.section === "input";
  const isNational = state.section === "national";
  window.ContractData?.sync(state.section);
  window.NationalPlanning?.sync(isNational, state.role);
  const isRegional = state.section === "regional";
  const isAnalysis = state.section === "analysis";
  const isExport = state.section === "export";

  els.panelTitle.textContent = isInput ? t("layers") : isNational ? t("panelNational") : isRegional ? t("panelRegional") : isAnalysis ? t("panelAnalysis") : t("panelExport");
  els.layerPanel.classList.toggle("is-scenario-mode", !isInput);
  els.inputWorkspace.classList.toggle("is-hidden", !isInput);
  els.scenarioWorkspace.classList.toggle("is-hidden", isInput);
  els.createGroup.classList.toggle("is-hidden", !isInput);
  els.openAddData.classList.toggle("is-hidden", !isInput);

  if (sectionChanged && isInput) {
    restoreInputWorkspaceSnapshot();
  }

  if (isRegional) {
    renderRegionalPanel();
  } else if (isAnalysis) {
    renderAnalysisPanel();
  } else if (isExport) {
    renderExportPanel();
  }

  window.ContractData?.mapReady();
  requestAnimationFrame(() => map.resize());
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
  syncSectionUi();
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

function formatPopupLayerName(name = "") {
  return `${name}`.replace(/\.[^.]+$/, "").replaceAll("_", " ").trim();
}

function formatPopupCoords(lng, lat) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return "";
  return `${Number(lng).toFixed(5)}, ${Number(lat).toFixed(5)}`;
}

function formatPopupLabel(label = "") {
  return `${label}`.replaceAll("_", " ").trim();
}

function popupValueLabel(label, band = 1, totalBands = 1) {
  const normalized = formatPopupLabel(label);
  if (!normalized) return totalBands === 1 ? "Valor" : `Banda ${band}`;
  if (/^(file\d+.*|lyr\.?\d*|layer ?\d*|band ?\d*)$/i.test(normalized)) {
    return totalBands === 1 ? "Valor" : `Banda ${band}`;
  }
  return normalized;
}

function sanitizeHtml(value) {
  return `${value ?? ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function popupEntriesForLayer(layer, properties = {}) {
  const rawEntries = Object.entries(properties).filter(([key, value]) => {
    if (key.startsWith("__")) return false;
    return value !== null && value !== undefined && `${value}` !== "";
  });
  const popupFields = Array.isArray(layer?.popup_fields) ? layer.popup_fields.filter((field) => !/^__/i.test(field)) : [];
  if (popupFields.length) {
    const allowed = new Set(popupFields);
    return rawEntries.filter(([key]) => allowed.has(key));
  }
  return rawEntries;
}

function popupHtml(layer, properties = {}) {
  const entries = popupEntriesForLayer(layer, properties);
  const displayField = layer?.display_field && properties?.[layer.display_field] !== undefined && properties?.[layer.display_field] !== null && `${properties?.[layer.display_field]}` !== ""
    ? [layer.display_field, properties[layer.display_field]]
    : entries[0] || null;
  const bodyEntries = entries.filter(([key]) => key !== displayField?.[0]);
  if (!displayField && !bodyEntries.length) return "<div class=\"popup-empty\">Sin datos</div>";
  return `
    <div class="popup-card">
      <div class="popup-title-row">
        <span class="popup-title-label">${sanitizeHtml(formatPopupLayerName(layer?.name || "Capa"))}</span>
        ${displayField ? `<strong class="popup-title-value">${sanitizeHtml(displayField[1])}</strong>` : ""}
      </div>
      <div class="popup-grid">
      ${bodyEntries
        .map(
          ([key, value]) => `
            <div class="popup-row">
              <span>${sanitizeHtml(key)}</span>
              <span>${sanitizeHtml(value)}</span>
            </div>`
        )
        .join("")}
      </div>
    </div>`;
}

function rasterPopupHtml(layer, payload = {}, lngLat = null) {
  const values = Array.isArray(payload.values) ? payload.values.filter((item) => item && item.value !== null && item.value !== undefined && `${item.value}` !== "") : [];
  const primaryValue = values.length === 1 ? formatLegendValue(values[0].value) : "";
  if (!values.length) {
    return `
      <div class="popup-card">
        <div class="popup-title-row">
          <span class="popup-title-label">${sanitizeHtml(formatPopupLayerName(layer?.name || "Raster"))}</span>
          ${lngLat ? `<span class="popup-title-subtitle">${sanitizeHtml(formatPopupCoords(lngLat.lng, lngLat.lat))}</span>` : ""}
        </div>
        <div class="popup-empty">Sin valor disponible en esta celda</div>
      </div>`;
  }
  return `
    <div class="popup-card">
      <div class="popup-title-row">
        <span class="popup-title-label">${sanitizeHtml(formatPopupLayerName(layer?.name || "Raster"))}</span>
        ${lngLat ? `<span class="popup-title-subtitle">${sanitizeHtml(formatPopupCoords(lngLat.lng, lngLat.lat))}</span>` : ""}
        ${primaryValue ? `<strong class="popup-title-value">${sanitizeHtml(primaryValue)}</strong>` : ""}
      </div>
      <div class="popup-grid">
        ${values
          .map(
            (item) => `
              <div class="popup-row">
                <span>${sanitizeHtml(popupValueLabel(item.label, item.band, values.length))}</span>
                <span>${sanitizeHtml(formatLegendValue(item.value))}</span>
              </div>`
          )
          .join("")}
      </div>
    </div>`;
}

function renderLegend(layer) {
  const legend = state.layerRuntime[layer?.id]?.legend;
  const legendField = descriptiveFieldOverride(layer) || legend?.label || t("rasterLegendLabel");
  if (!layer || !legend || layer.visible === false) {
    els.mapLegend.classList.add("is-hidden");
    els.mapLegend.innerHTML = "";
    return;
  }

  if (legend.kind === "numeric") {
    els.mapLegend.innerHTML = `
      <div class="map-legend-title">${sanitizeHtml(layer.name)}</div>
      <div class="map-legend-subtitle">${sanitizeHtml(legendField)}</div>
      <div class="legend-ramp">
        <div class="legend-gradient" style="${legend.gradient ? `background:${legend.gradient};` : ""}"></div>
        <div class="legend-range">
          <span>${sanitizeHtml(formatLegendValue(legend.min))}</span>
          <span>${sanitizeHtml(formatLegendValue(legend.max))}</span>
        </div>
      </div>`;
  } else if (legend.kind === "categorical") {
    els.mapLegend.innerHTML = `
      <div class="map-legend-title">${sanitizeHtml(layer.name)}</div>
      <div class="map-legend-subtitle">${sanitizeHtml(legendField)}</div>
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
  const selectedLayer = state.layers.find((layer) => layer.id === attributeState.selectedLayerId);
  if (selectedLayer && selectedLayer.visible !== false && state.layerRuntime[selectedLayer.id]?.legend) {
    renderLegend(selectedLayer);
    return;
  }

  const topVisibleLayer = expandedLayerKeys(true)
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
    gradient: "linear-gradient(90deg, rgb(0,120,255) 0%, rgb(255,209,0) 100%)",
  };
}

function thematicStyle(layer, geojson, geometryType) {
  const field = descriptiveFieldOverride(layer);
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
  moveFeatureHighlightLayersToTop();
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
  const loaded = state.layersLoaded;
  const preservedUserKeys = new Set([
    ...state.layerOrder.filter((key) => key.startsWith("user:")),
    ...state.groups.flatMap((group) => (group.items || []).filter((key) => key.startsWith("user:"))),
  ]);
  const valid = loaded
    ? validTopLevelKeys()
    : new Set(["base:ccaa", ...state.groups.map((group) => `group:${group.id}`), ...preservedUserKeys]);
  const grouped = new Set();
  state.groups.forEach((group) => {
    group.category = normalizeGroupCategory(group.category);
    group.items = (group.items || []).filter((key) => valid.has(key) && !key.startsWith("group:") && !FIXED_BASE_KEYS.has(key));
    group.items.forEach((key) => grouped.add(key));
  });
  state.layerOrder = state.layerOrder.filter((key) => key !== "base:ccaa" && valid.has(key) && !grouped.has(key));
  for (const key of [...state.groups.map((group) => `group:${group.id}`), ...state.layers.map(layerKey)]) {
    if (valid.has(key) && !grouped.has(key) && !state.layerOrder.includes(key)) state.layerOrder.push(key);
  }
  if (!state.layerOrder.includes("base:ccaa")) state.layerOrder.push("base:ccaa");
  storageSet();
}

function expandedLayerKeys(includeCollapsedChildren = true) {
  syncLayerOrder();
  const result = [];
  for (const key of state.layerOrder) {
    if (key.startsWith("group:")) {
      const group = state.groups.find((item) => `group:${item.id}` === key);
      if (group && (includeCollapsedChildren || group.collapsed !== true)) result.push(...(group.items || []));
    } else {
      result.push(key);
    }
  }
  return result;
}

function flattenedLayerKeys() {
  return expandedLayerKeys(false);
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
  const bottomToTop = [...expandedLayerKeys(true)].reverse();
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

function interactiveLayerIdsForLayer(layerId) {
  return [`user-${layerId}-fill`, `user-${layerId}-line`, `user-${layerId}-circle`].filter((id) => map.getLayer(id));
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
  const attributeOpenForLayer = !els.attributePanel.classList.contains("is-hidden") && attributeState.layerId === layer.id;
  const popupActiveForLayer = activePopupLayerId === layer.id;
  const isRaster = layer.type === "raster";
  const visualFields = descriptiveFieldCandidates(layer);
  const currentVisualField = layer.display_field || "";
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
      ${!isRaster && visualFields.length ? `
      <label class="layer-field-row">
        <span class="opacity-label">${sanitizeHtml(t("visualFieldLabel"))}</span>
        <select data-action="display-field">
          <option value="">${sanitizeHtml(t("displayFieldAuto"))}</option>
          ${visualFields.map((field) => `<option value="${sanitizeHtml(field.name)}" ${currentVisualField === field.name ? "selected" : ""}>${sanitizeHtml(field.name)}</option>`).join("")}
        </select>
      </label>` : ""}
      <div class="layer-menu-row">
        <button type="button" class="layer-icon-button layer-table-button ${attributeOpenForLayer ? "is-active" : ""}" data-action="open-attributes" title="${attributeOpenForLayer ? "Cerrar tabla de atributos" : "Abrir tabla de atributos"}" aria-label="${attributeOpenForLayer ? "Cerrar tabla de atributos" : "Abrir tabla de atributos"}"></button>
        <button type="button" class="layer-icon-button layer-zoom-button" data-action="focus-layer" title="Zoom a la capa" aria-label="Zoom a la capa"></button>
        <button type="button" class="layer-icon-button layer-popup-button ${popupActiveForLayer ? "is-active" : ""}" data-action="toggle-popup-layer" title="${popupActiveForLayer ? "Desactivar popup de esta capa" : "Activar popup de esta capa"}" aria-label="${popupActiveForLayer ? "Desactivar popup de esta capa" : "Activar popup de esta capa"}"></button>
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
  state.layersLoaded = true;
  if (state.section === "input") {
    restoreInputWorkspaceSnapshot();
  } else {
    renderLayers();
  }
  await redrawUserLayers(focusId);
  if (state.section === "national") {
    if (state.nationalStep === "descriptive") {
      await renderDescriptivePanel();
    } else {
      renderNationalPanel();
    }
  }
}

function canEditLayer(layer) {
  return state.role === "admin" || layer.owner === state.role;
}

function fileBaseName(file) {
  return file.name.replace(/\.[^.]+$/, "");
}

function detectCsvDelimiter(text = "") {
  const sample = `${text}`.split(/\r?\n/).slice(0, 5).join("\n");
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestScore = -1;
  for (const delimiter of candidates) {
    const score = sample
      .split(/\r?\n/)
      .filter(Boolean)
      .reduce((acc, line) => acc + Math.max(0, line.split(delimiter).length - 1), 0);
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
}

function parseDelimitedLine(line, delimiter) {
  const values = [];
  let current = "";
  let insideQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }
    if (char === delimiter && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function parseCsv(text) {
  const normalized = `${text}`.replace(/^\uFEFF/, "").trim();
  if (!normalized) return [];
  const delimiter = detectCsvDelimiter(normalized);
  const lines = normalized.split(/\r?\n/);
  const headers = parseDelimitedLine(lines.shift(), delimiter).map((header, index) => header.trim() || `column_${index + 1}`);
  return lines.filter(Boolean).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
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

function hasImportableCsvGeometry(inspection = state.importInspection) {
  const mode = inspection?.coordinate_candidates?.mode;
  if (mode === "xy") {
    return Boolean(inspection?.coordinate_candidates?.x && inspection?.coordinate_candidates?.y);
  }
  if (mode === "mgrs") {
    return Boolean(inspection?.coordinate_candidates?.field || (inspection?.coordinate_candidates?.zone_field && inspection?.coordinate_candidates?.cell_field));
  }
  return false;
}

function csvGeometryLabel(inspection = state.importInspection) {
  const candidate = inspection?.coordinate_candidates || {};
  if (candidate.mode === "xy" && candidate.x && candidate.y) return `${candidate.x} / ${candidate.y}`;
  if (candidate.mode === "mgrs" && candidate.field) return `${candidate.field} (UTM/MGRS)`;
  if (candidate.mode === "mgrs" && candidate.zone_field && candidate.cell_field) return `${candidate.zone_field} + ${candidate.cell_field} (UTM/MGRS)`;
  return null;
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
    if (suggestion && els.csvMode.value !== "join" && !hasImportableCsvGeometry(state.importInspection)) {
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

function csvLooksLikeUtmGrid(inspection) {
  const names = (inspection?.fields || []).map((field) => `${field.name || ""}`.toLowerCase());
  const hasUtmLikeField = names.some((name) => /utm|mgrs|huso|zone|zona|cell|celda/.test(name));
  const preview = Array.isArray(inspection?.preview_rows) ? inspection.preview_rows : [];
  const sampleValues = preview.flatMap((row) => Object.values(row || {})).map((value) => `${value || ""}`);
  const hasGridCode = sampleValues.some((value) => /\b\d{1,2}[A-Z][A-Z]{2}\d{2,}\b/.test(value.trim().toUpperCase()));
  return hasUtmLikeField || hasGridCode;
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
    const hasCoords = hasImportableCsvGeometry(inspection);
    const suggestion = bestJoinSuggestion(inspection);
    const bits = [];
    if (inspection.coordinate_candidates?.mode === "xy" && hasCoords) {
      bits.push(`<p class="guidance-copy">He detectado coordenadas en <strong>${sanitizeHtml(inspection.coordinate_candidates.x)}</strong> y <strong>${sanitizeHtml(inspection.coordinate_candidates.y)}</strong>. Puedes importarlo como puntos directamente.</p>`);
    } else if (inspection.coordinate_candidates?.mode === "mgrs" && hasCoords) {
      bits.push(`<p class="guidance-copy">He detectado una referencia de <strong>malla UTM/MGRS</strong>. La capa se importará convirtiendo esas celdas a <strong>geometría espacial</strong> automáticamente.</p>`);
    } else if (csvLooksLikeUtmGrid(inspection)) {
      bits.push(`<p class="guidance-copy">Veo campos que parecen <strong>UTM/MGRS</strong>, pero no llegan como coordenadas X/Y numéricas listas para pintar puntos. Este CSV parece más bien una <strong>malla o código de celda</strong>, no un listado clásico de lon/lat.</p>`);
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
    } else if (csvLooksLikeUtmGrid(inspection)) {
      bits.push(`<p class="guidance-copy">Si quieres llevar esto al mapa como geometría, el siguiente paso correcto sería <strong>decodificar esas celdas UTM/MGRS</strong> y convertirlas a puntos o polígonos antes de guardar.</p>`);
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
      csvGeometryLabel(inspection)
    ),
  ].filter(Boolean);

  els.importSummaryStats.innerHTML = stats.join("");
  els.importSummary.classList.remove("is-hidden");
  const guidance = buildImportGuidance(inspection);
  els.importGuidance.innerHTML = guidance;
  els.importGuidance.classList.toggle("is-hidden", !guidance);

  if (inspection.detected_type === "table") {
    const suggestion = bestJoinSuggestion(inspection);
    const hasCoords = hasImportableCsvGeometry(inspection);
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

function layerNameExists(name) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return state.layers.some((layer) => layer.name?.trim().toLowerCase() === normalized);
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

function dismissMapPopups() {
  document.querySelectorAll(".maplibregl-popup").forEach((node) => node.remove());
}

async function setActiveLayer(layerId, { syncTable = false } = {}) {
  if (!layerId) return;
  attributeState.selectedLayerId = layerId;
  updateActiveLegend();
  if (syncTable && !els.attributePanel.classList.contains("is-hidden") && attributeState.layerId !== layerId) {
    await openAttributeTable(layerId);
  }
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

els.navButtons.forEach((button, index) => {
  if (!button.dataset.section) {
    button.dataset.section = NAV_SECTION_FALLBACK[index] || "input";
  }
  button.addEventListener("click", () => {
    const nextSection = button.dataset.section || "input";
    if (!allowedSectionsForRole(state.role).includes(nextSection)) return;
    state.section = nextSection;
    localStorage.setItem("plancaza_section", state.section);
    syncSectionUi();
  });
});

els.scenarioStepNav.addEventListener("click", (event) => {
  const button = event.target.closest("[data-step]");
  if (!button) return;
  state.nationalStep = button.dataset.step || "layers";
  localStorage.setItem("plancaza_national_step", state.nationalStep);
  syncScenarioMetaStatus();
  renderNationalPanel();
});

els.scenarioPanelBody.addEventListener("change", async (event) => {
  if (event.target.matches("[data-action='toggle-scenario-layer']")) {
    const id = event.target.dataset.id;
    const enabled = event.target.checked;
    const layer = state.layers.find((item) => item.id === id);
    if (!layer) return;
    layer.scenario_national_enabled = enabled;
    syncNationalDraftWithLayers();
    renderScenarioLayersPanel();
    syncScenarioMetaStatus();
    try {
      const response = await persistScenarioNationalSelection(id, enabled);
      state.layers = response.layers || state.layers;
      syncNationalDraftWithLayers();
      renderLayers();
      if (state.nationalStep === "descriptive") {
        await renderDescriptivePanel();
      } else {
        renderScenarioLayersPanel();
      }
    } catch (error) {
      layer.scenario_national_enabled = !enabled;
      renderScenarioLayersPanel();
      toast(error.message || "No se pudo guardar la selección.");
    }
    return;
  }
  if (event.target.id === "descriptiveLayerSelect") {
  state.descriptive.layerId = event.target.value;
  state.descriptive.field = null;
  syncScenarioMetaStatus();
  await renderDescriptivePanel();
  return;
}
if (event.target.id === "descriptiveFieldSelect") {
  state.descriptive.field = event.target.value;
  syncScenarioMetaStatus();
  await renderDescriptivePanel();
  return;
}
if (event.target.id === "aggregationLayerSelect") {
  state.nationalDraft.aggregation.layerId = event.target.value;
  state.nationalDraft.aggregation.field = null;
  syncScenarioMetaStatus();
  renderAggregationPanel();
  return;
}
  if (event.target.id === "aggregationFieldSelect") {
    state.nationalDraft.aggregation.field = event.target.value;
    syncScenarioMetaStatus();
    return;
  }
  if (event.target.id === "aggregationMethodSelect") {
    state.nationalDraft.aggregation.method = event.target.value;
    syncScenarioMetaStatus();
    return;
  }
  if (event.target.matches("[data-weight-layer]")) {
    const layerId = event.target.dataset.weightLayer;
    const current = state.nationalDraft.weights.items[layerId] || {};
    state.nationalDraft.weights.items[layerId] = {
      weight: Number(event.target.value || 0),
      direction: current.direction === "min" ? "min" : "max",
    };
    syncScenarioMetaStatus();
    return;
  }
  if (event.target.matches("[data-weight-direction]")) {
    const layerId = event.target.dataset.weightDirection;
    const current = state.nationalDraft.weights.items[layerId] || {};
    state.nationalDraft.weights.items[layerId] = {
      weight: Number.isFinite(Number(current.weight)) ? Number(current.weight) : 1,
      direction: event.target.value === "min" ? "min" : "max",
    };
    syncScenarioMetaStatus();
    return;
  }
  if (event.target.id === "modelPrioritySelect") {
    state.nationalDraft.model.priority = event.target.value;
    syncScenarioMetaStatus();
    return;
  }
  if (event.target.id === "modelSolverInput") {
    state.nationalDraft.model.solver = event.target.value.trim();
    syncScenarioMetaStatus();
    return;
  }
});

els.scenarioPanelBody.addEventListener("input", (event) => {
  if (event.target.id === "modelRunLabelInput") {
    state.nationalDraft.model.runLabel = event.target.value;
    syncScenarioMetaStatus();
    return;
  }
  if (event.target.id === "modelNotesInput") {
    state.nationalDraft.model.notes = event.target.value;
    syncScenarioMetaStatus();
    return;
  }
  if (event.target.matches("[data-weight-layer]")) {
    const layerId = event.target.dataset.weightLayer;
    const current = state.nationalDraft.weights.items[layerId] || {};
    state.nationalDraft.weights.items[layerId] = {
      weight: Number(event.target.value || 0),
      direction: current.direction === "min" ? "min" : "max",
    };
    syncScenarioMetaStatus();
  }
});

els.scenarioMetaBar.addEventListener("input", (event) => {
  if (event.target.id !== "scenarioNameInput") return;
  state.scenarioNameDraft = event.target.value;
  syncScenarioMetaStatus();
});

els.scenarioMetaBar.addEventListener("keydown", (event) => {
  if (event.target.id !== "scenarioNameInput") return;
  if (event.key === "Enter") {
    event.preventDefault();
    endScenarioRename();
    syncSectionUi();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    if (state.activeScenarioId) {
      state.scenarioNameDraft = currentScenario()?.name || state.scenarioNameDraft;
    }
    endScenarioRename();
    syncSectionUi();
  }
});

els.scenarioMetaBar.addEventListener("focusout", (event) => {
  if (event.target.id !== "scenarioNameInput") return;
  setTimeout(() => {
    if (!els.scenarioMetaBar.contains(document.activeElement) && state.scenarioRenameMode) {
      endScenarioRename();
      syncSectionUi();
    }
  }, 0);
});

els.scenarioMetaBar.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton?.dataset.action === "toggle-scenario-picker") {
    state.scenarioPickerOpen = !state.scenarioPickerOpen;
    syncSectionUi();
    return;
  }
  if (actionButton?.dataset.action === "select-scenario") {
    state.scenarioPickerOpen = false;
    if (actionButton.dataset.id === "__new__") {
      startNewScenarioDraft();
      return;
    }
    const scenario = state.scenarios.find((item) => item.id === actionButton.dataset.id);
    if (!scenario) return;
    try {
      await applyScenarioConfig(scenario, true);
      toast(t("scenarioLoaded"));
    } catch (error) {
      toast(error.message || "No se pudo cargar el escenario.");
    }
    return;
  }
  if (actionButton?.dataset.action === "rename-scenario") {
    beginScenarioRename();
    syncSectionUi();
    return;
  }
  if (actionButton?.dataset.action === "save-scenario") {
    const name = state.scenarioRenameMode
      ? els.scenarioMetaBar.querySelector("#scenarioNameInput")?.value?.trim() || scenarioDraftName()
      : scenarioDraftName();
    try {
      await saveScenario(name, !state.activeScenarioId);
      syncSectionUi();
      toast(t("scenarioSaved"));
    } catch (error) {
      toast(error.message || t("scenarioNameUsed"));
    }
    return;
  }
  if (actionButton?.dataset.action === "save-as-scenario") {
    const name = state.scenarioRenameMode
      ? els.scenarioMetaBar.querySelector("#scenarioNameInput")?.value?.trim() || scenarioDraftName()
      : scenarioDraftName();
    try {
      await saveScenario(name, true);
      syncSectionUi();
      toast(t("scenarioDuplicated"));
    } catch (error) {
      toast(error.message || t("scenarioNameUsed"));
    }
    return;
  }
  if (actionButton?.dataset.action === "delete-scenario") {
    const active = currentScenario();
    if (!active?.id) return;
    if (!window.confirm(t("scenarioDeleteConfirm"))) return;
    try {
      await deleteScenario();
      syncSectionUi();
      toast(t("scenarioDeleted"));
    } catch (error) {
      toast(error.message || "No se pudo eliminar el escenario.");
    }
    return;
  }
});

els.scenarioPanelBody.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action='explore-scenario-layer']");
  if (!button) return;
  const id = button.dataset.id;
  const layer = state.layers.find((item) => item.id === id);
  if (!layer) return;
  if (!layer.scenario_national_enabled) {
    layer.scenario_national_enabled = true;
    syncNationalDraftWithLayers();
    try {
      const response = await persistScenarioNationalSelection(id, true);
      state.layers = response.layers || state.layers;
      syncNationalDraftWithLayers();
      renderLayers();
    } catch (error) {
      layer.scenario_national_enabled = false;
      toast(error.message || "No se pudo guardar la selección.");
      return;
    }
  }
  await ensureLayerVisibleForExploration(id);
  await setActiveLayer(id, { syncTable: !els.attributePanel.classList.contains("is-hidden") });
  state.descriptive.layerId = id;
  state.descriptive.field = null;
  state.nationalStep = "descriptive";
  localStorage.setItem("plancaza_national_step", state.nationalStep);
  syncScenarioMetaStatus();
  await renderDescriptivePanel();
});

els.userRole.addEventListener("change", async () => {
  state.role = els.userRole.value;
  localStorage.setItem("plancaza_role", state.role);
  state.section = normalizeSectionForRole(state.section, state.role);
  localStorage.setItem("plancaza_section", state.section);
  state.activeScenarioId = readStoredActiveScenarioId(currentScenarioScope(), state.role);
  applyLanguage();
  await loadLayers();
  if (state.section === "national" || state.section === "analysis") {
    await ensureScenarioCollection();
  }
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
  if (state.scenarioPickerOpen && !event.target.closest(".scenario-picker")) {
    state.scenarioPickerOpen = false;
    syncSectionUi();
    return;
  }
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
  await setActiveLayer(card.dataset.id, { syncTable: true });
  if (!els.attributePanel.classList.contains("is-hidden")) {
    renderLayers();
    return;
  }
  renderLayers();
});

els.closeAttributePanel.addEventListener("click", () => {
  closeAttributePanel();
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

  if (action !== "delete") {
    try {
      await setActiveLayer(id, { syncTable: action !== "open-attributes" });
    } catch (error) {
      toast(error.message || "No se pudo activar la capa.");
      return;
    }
  }

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
    if (!els.attributePanel.classList.contains("is-hidden") && attributeState.layerId === id) {
      closeAttributePanel();
      return;
    }
    renderLayers();
    try {
      await openAttributeTable(id);
      renderLayers();
    } catch (error) {
      toast(error.message || "No se pudo abrir la tabla de atributos.");
    }
    return;
  }

  if (action === "toggle-popup-layer") {
    openLayerMenuId = null;
    activePopupLayerId = activePopupLayerId === id ? null : id;
    dismissMapPopups();
    renderLayers();
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
    renderLayers();
    focusLayerById(id);
    return;
  }

  if (action === "delete") {
    if (!canEditLayer(state.layers[index])) {
      toast("Solo admin puede eliminar capas comunes.");
      return;
    }
    if (activePopupLayerId === id) {
      activePopupLayerId = null;
      dismissMapPopups();
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
    await setActiveLayer(id, { syncTable: true });
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
  if (event.target.dataset.action === "display-field") {
    await setActiveLayer(id, { syncTable: true });
    layer.display_field = event.target.value || null;
    if (canEditLayer(layer)) {
      await requestJson(api.layer(id), { method: "POST", body: JSON.stringify({ role: state.role, display_field: event.target.value || "" }) });
    }
    await drawLayer(layer);
    applyMapOrder();
    moveFeatureHighlightLayersToTop();
    updateActiveLegend();
    renderLayers();
  }
});

els.uploadedLayers.addEventListener("click", async (event) => {
  const card = event.target.closest(".layer-card[data-id]");
  if (!card || event.target.dataset.action !== "visible") return;
  const id = card.dataset.id;
  const layer = state.layers.find((item) => item.id === id);
  if (!layer) return;
  await setActiveLayer(id, { syncTable: true });
  layer.visible = !event.target.classList.contains("is-visible");
  if (!layer.visible && activePopupLayerId === id) {
    activePopupLayerId = null;
    dismissMapPopups();
  }
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
  const ids = expandedLayerKeys(true)
    .filter((key) => key.startsWith("user:"))
    .map((key) => key.replace("user:", ""));
  if (ids.length) {
    await requestJson(api.reorder(), { method: "POST", body: JSON.stringify({ role: state.role, ids }) });
  }
}

function parentGroupForLayerId(layerId) {
  const key = `user:${layerId}`;
  return state.groups.find((group) => (group.items || []).includes(key)) || null;
}

async function ensureLayerVisibleForExploration(layerId) {
  const layer = state.layers.find((item) => item.id === layerId);
  if (!layer) return;

  const group = parentGroupForLayerId(layerId);
  if (group) {
    group.visible = true;
    group.collapsed = false;
  }

  if (layer.visible === false) {
    layer.visible = true;
    const visibility = "visible";
    for (const suffix of ["fill", "line", "circle", "raster"]) {
      const mapLayerId = `user-${layer.id}-${suffix}`;
      if (map.getLayer(mapLayerId)) map.setLayoutProperty(mapLayerId, "visibility", visibility);
    }
    if (canEditLayer(layer)) {
      await requestJson(api.layer(layer.id), { method: "POST", body: JSON.stringify({ role: state.role, visible: true }) });
    }
  }

  renderLayers();
  updateActiveLegend();
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
    await ensureScenarioCollection();
    window.ContractData?.mapReady();
    syncMapScalePosition();
    updateMapStatus();
  } catch (error) {
    toast(error.message || "No se pudo iniciar el mapa.");
  }
});

map.on("mousemove", (event) => {
  if (state.section === "input" || state.section === "national") return;
  updateMapStatus(event.lngLat);
  const hoveredLayers = activePopupLayerId ? interactiveLayerIdsForLayer(activePopupLayerId) : [];
  const features = hoveredLayers.length ? map.queryRenderedFeatures(event.point, { layers: hoveredLayers }) : [];
  map.getCanvas().style.cursor = features.length ? "pointer" : "";
});

map.on("click", async (event) => {
  if (state.section === "input" || state.section === "national") return;
  if (!activePopupLayerId) return;

  const targetPopupLayer = activePopupLayerId ? state.layers.find((layer) => layer.id === activePopupLayerId) || null : null;
  if (!targetPopupLayer || targetPopupLayer.visible === false) return;

  const vectorPopupLayers = targetPopupLayer
    ? targetPopupLayer.type === "raster"
      ? []
      : interactiveLayerIdsForLayer(targetPopupLayer.id)
    : interactiveUserLayerIds();
  const features = vectorPopupLayers.length ? map.queryRenderedFeatures(event.point, { layers: vectorPopupLayers }) : [];
  const renderedFeature = features[0];
  if (renderedFeature) {
    const clickedLayerId = layerIdFromRenderedFeature(renderedFeature);
    const feature = originalFeatureFromRenderedFeature(renderedFeature);
    const layer = state.layers.find((item) => item.id === clickedLayerId) || null;
    showHighlightedFeature(feature);
    const featureIndex = Number(feature?.properties?.__featureIndex);
    if (clickedLayerId && Number.isInteger(featureIndex)) {
      try {
        await revealFeatureInAttributeTable(clickedLayerId, featureIndex);
      } catch (_) {}
    }
    dismissMapPopups();
    new maplibregl.Popup({ closeButton: false, maxWidth: "320px", className: "plancaza-popup" })
      .setLngLat(event.lngLat)
      .setHTML(popupHtml(layer, feature.properties || {}))
      .addTo(map);
    return;
  }

  const rasterLayer = targetPopupLayer?.type === "raster" ? targetPopupLayer : null;
  if (!rasterLayer) return;

  try {
    const payload = await requestJson(api.rasterValue(rasterLayer.id), {
      method: "POST",
      body: JSON.stringify({ lng: event.lngLat.lng, lat: event.lngLat.lat }),
    });
    dismissMapPopups();
    new maplibregl.Popup({ closeButton: false, maxWidth: "320px", className: "plancaza-popup" })
      .setLngLat(event.lngLat)
      .setHTML(rasterPopupHtml(rasterLayer, payload, event.lngLat))
      .addTo(map);
  } catch (_) {}
});

map.on("move", () => {
  updateMapStatus();
  syncMapScalePosition();
});






