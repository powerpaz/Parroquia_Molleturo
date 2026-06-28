/* =========================================================
   Geovisor Agrícola – Estética MAPBOX Light
   Capas:
   - Límite Parroquial
   - Comunidades / Puntos de estudio
   - Red vial estatal
========================================================= */

/* =========================================================
   MAPAS BASE (tipo Mapbox, sin API)
========================================================= */
const basemaps = {
  voyager: L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    { attribution: "&copy; CARTO & OSM" }
  ),
  positron: L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    { attribution: "&copy; CARTO & OSM" }
  ),
  osm: L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "&copy; OpenStreetMap" }
  ),
  esri: L.tileLayer(
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "&copy; Esri" }
  ),
};

/* =========================================================
   INICIAR MAPA
========================================================= */
const map = L.map("map", {
  center: [-2.62, -79.46],
  zoom: 12,
  layers: [basemaps.voyager],
});

// Leyenda flotante (abajo en el mapa) para coropletas
const mapLegend = L.control({ position: "bottomleft" });
mapLegend.onAdd = function () {
  const div = L.DomUtil.create("div", "map-legend");
  div.id = "mapLegend";
  // Evitar que el scroll/click de la leyenda interfiera con el mapa
  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);
  return div;
};
mapLegend.addTo(map);

/* Selector de mapa base */
document.getElementById("basemap").addEventListener("change", (e) => {
  const selected = e.target.value;
  Object.values(basemaps).forEach((b) => map.removeLayer(b));
  basemaps[selected].addTo(map);
});

/* =========================================================
   PANES
   El widget de transición multitemporal mantiene su pane fijo propio
   (no participa del reordenamiento manual de capas). Las capas de
   layersConfig reciben, más abajo, un pane dinámico e independiente por
   capa ("pane_" + id) para que el orden del panel controle de verdad el
   apilamiento visual en el mapa (ver applyLayerDrawOrder).
========================================================= */
map.createPane("pane_transicion").style.zIndex = 550;

/* =========================================================
   UTILIDADES COROPLÉTICAS (ligeras, sin dependencias)
========================================================= */
function computeQuantileBreaks(values, k = 5) {
  const v = values
    .filter((x) => typeof x === 'number' && isFinite(x))
    .sort((a, b) => a - b);
  if (!v.length) return [];
  const breaks = [];
  for (let i = 1; i < k; i++) {
    const idx = Math.floor((i * (v.length - 1)) / k);
    breaks.push(v[idx]);
  }
  // asegurar estrictamente creciente (evita clases vacías)
  const uniq = [];
  breaks.forEach((b) => {
    if (!uniq.length || b > uniq[uniq.length - 1]) uniq.push(b);
  });
  return uniq;
}

function getChoroplethColor(value, breaks, palette) {
  if (typeof value !== 'number' || !isFinite(value)) return palette[0];
  for (let i = 0; i < breaks.length; i++) {
    if (value <= breaks[i]) return palette[i];
  }
  return palette[palette.length - 1];
}

// Formato numérico consistente para leyendas (como en mapas estadísticos)
function fmt6(n) {
  const x = Number(n);
  if (!isFinite(x)) return "s/i";
  return x.toFixed(6);
}

function fmtLegend(n) {
  const x = Number(n);
  if (!isFinite(x)) return "s/i";
  // Leyenda como en mapas estadísticos: enteros (sin decimales)
  return (Number.isInteger(x) ? String(x) : String(Math.round(x)));
}

// Construye rangos a partir de min/breaks/max
function buildRangesDiscrete(minVal, breaks, maxVal, step = 1) {
  // Para leyendas tipo mapa estadístico: rangos enteros contiguos
  // Ej: min=0, breaks=[5,116] => [0-5], [6-116], ...
  const ranges = [];
  let a = minVal;
  for (let i = 0; i < breaks.length; i++) {
    const b = breaks[i];
    ranges.push([a, b]);
    a = (typeof b === "number" && isFinite(b)) ? (b + step) : b;
  }
  ranges.push([a, maxVal]);
  return ranges;
}

// Construye un bloque de leyenda para una capa no-coroplética, a partir de
// cfg.legendItems (lista plana) o cfg.legendGroups (agrupada, p.ej. los 4
// grupos oficiales de Cobertura 2015). Reutiliza legendSwatchStyle
// (definida más abajo para la leyenda de transición) para que un mismo
// "look" de swatch sirva para toda la app.
function buildGeneralLegendBlock(cfg, cardClass) {
  const renderItem = (info) => `
    <div class="legend-row">
      <span class="legend-swatch" style="${legendSwatchStyle(info)}"></span>
      <span class="legend-range">${htmlEscape(info.label)}</span>
    </div>
  `;

  let body = "";
  if (cfg.legendGroups && cfg.legendGroups.length) {
    body = cfg.legendGroups.map((group) => `
      <div class="legend-subtitle">${htmlEscape(group.title)}</div>
      ${group.items.map(renderItem).join("")}
    `).join("");
  } else {
    body = (cfg.legendItems || []).map(renderItem).join("");
  }

  return `
    <div class="${cardClass}">
      <div class="legend-title">${htmlEscape(cfg.label)}</div>
      ${body}
    </div>
  `;
}

// Construye un bloque de leyenda coroplética (rangos numéricos discretos)
// a partir de cfg.classBreaks/palette. Compartido entre el panel lateral
// (siempre, estén o no encendidas) y la leyenda flotante (solo activas).
function buildChoroLegendBlock(cfg, cardClass) {
  const breaks = cfg.classBreaks?.breaks || cfg._breaks || [];
  const minV = (typeof cfg.classBreaks?.min === "number")
    ? cfg.classBreaks.min
    : (typeof cfg._minVal === "number" ? cfg._minVal : 0);
  const maxV = (typeof cfg.classBreaks?.max === "number")
    ? cfg.classBreaks.max
    : (typeof cfg._maxVal === "number" ? cfg._maxVal : (breaks.length ? breaks[breaks.length - 1] : minV));
  const palette = cfg.palette || [];

  const ranges = buildRangesDiscrete(minV, breaks, maxV, (typeof cfg.legendStep === 'number' ? cfg.legendStep : 1));

  const rows = ranges.map((r, i) => {
    const color = palette[Math.min(i, palette.length - 1)] || "#ddd";
    return `
      <div class="legend-row">
        <span class="legend-swatch" style="background:${color}"></span>
        <span class="legend-range">${fmtLegend(r[0])} - ${fmtLegend(r[1])}</span>
      </div>
    `;
  }).join("");

  return `
    <div class="${cardClass}">
      <div class="legend-title">${htmlEscape(cfg.legendTitle || cfg.field || cfg.label)}</div>
      ${rows}
    </div>
  `;
}

// Leyenda de todo: el panel lateral siempre muestra la simbología completa
// de todas las capas configuradas (estén o no encendidas), tal como exige
// el catálogo de representación. La leyenda flotante sobre el mapa sigue
// mostrando solo las capas activas, para no tapar el mapa. No toca la
// leyenda del widget de transición (updateTransitionLegend la gestiona
// aparte y sigue funcionando igual que antes).
function updateSidebarLegend() {
  const sidebarEl = document.getElementById("legend");
  const mapEl = document.getElementById("mapLegend");
  if (!sidebarEl && !mapEl) return;

  const isChecked = (c) => {
    const chk = document.getElementById("chk_" + c.id);
    return chk && chk.checked;
  };

  const allGeneral = layersConfig.filter((c) =>
    !c.choropleth && ((c.legendItems && c.legendItems.length) || (c.legendGroups && c.legendGroups.length))
  );
  const allChoros = layersConfig.filter((c) => c.choropleth);
  const activeGeneral = allGeneral.filter(isChecked);
  const activeChoros = allChoros.filter(isChecked);

  const htmlSidebar = allGeneral.map((cfg) => buildGeneralLegendBlock(cfg, "legend-block")).join("\n")
    + allChoros.map((cfg) => buildChoroLegendBlock(cfg, "legend-block")).join("\n");
  if (sidebarEl) sidebarEl.innerHTML = htmlSidebar;

  if (mapEl) {
    if (!activeGeneral.length && !activeChoros.length) {
      mapEl.innerHTML = "<p>Activa una capa para ver su leyenda.</p>";
    } else {
      const mapBlocks = activeGeneral.map((cfg) => buildGeneralLegendBlock(cfg, "legend-card")).join("\n")
        + activeChoros.map((cfg) => buildChoroLegendBlock(cfg, "legend-card")).join("\n");
      mapEl.innerHTML = `<div class="map-legend-wrap">${mapBlocks}</div>`;
    }
  }
}


// Exclusión puntual de nombres de lugar (p.ej. "Cacao Loma") sin editar los
// GeoJSON fuente: se usa como filtro en capas de comunidades/poblados.
const EXCLUDED_PLACE_NAMES = new Set(["CACAO LOMA"]);

function normalizeUpperNoAccents(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function isExcludedPlaceName(feature) {
  const p = feature?.properties || {};
  const name = normalizeUpperNoAccents(p.nam ?? p.Nombre ?? p.name ?? "");
  return EXCLUDED_PLACE_NAMES.has(name);
}

// Categorías de "Poblados IGM 1:250.000" por campo na3_desc — espejo del
// Catálogo de representación (2do envío).
const POBLADOS_IGM250_STYLE = {
  "CABECERA CANTONAL": { fill: "#FF0000", border: "#FF0000", radius: 7, fillOpacity: 1, label: "Cabecera cantonal" },
  "PARROQUIA RURAL": { fill: "#FF73DF", border: "#FF73DF", radius: 7, fillOpacity: 1, label: "Parroquia rural" },
  "PARROQUIA URBANA": { fill: "#A7C636", border: "#A7C636", radius: 7, fillOpacity: 1, label: "Parroquia urbana" },
  POBLADO: { fill: "transparent", border: "#000000", radius: 6, fillOpacity: 0, label: "Poblado" },
  _default: { fill: "transparent", border: "#000000", radius: 6, fillOpacity: 0, label: "Poblado" },
};

// SNAP: solo se filtran/etiquetan las 4 áreas protegidas del catálogo.
const SNAP_ALLOWED_NAMES = new Set(["CAJAS", "MAZAN", "CURIQUINGUE GALLOCANTANA", "QUIMSACOCHA"]);

// Grupos oficiales de "Cobertura y uso 2015" (cob_2015), según el Catálogo
// de representación (2do envío) y el mapa 02_1_Cobertura_suelo.pdf.
// ADVERTENCIA: no existe en los insumos del proyecto un shapefile/GeoJSON
// de cob_2015 completo (con los grupos A, B y D); solo está disponible
// cacao_2015.shp / Cacao_2015_Opt.geojson, que cubre exclusivamente el
// Grupo C (sistemas cacaoteros). Por eso esta capa solo dibuja Grupo C: no
// se inventan polígonos que no existen en los datos entregados. La leyenda
// sí muestra los 4 grupos completos, tal como exige el catálogo.
const COBERTURA_2015_GROUPS = [
  {
    title: "Grupo A. Coberturas naturales y ambientales",
    items: [
      { key: "Bosque", fill: "#267300", label: "Bosque" },
      { key: "Vegetación secundaria", fill: "#BFD999", label: "Vegetación secundaria" },
      { key: "Agua y elementos naturales", fill: "#0070FF", label: "Área hidrográfica y elementos naturales" },
      { key: "Sin información", fill: "#828282", label: "Sin información" },
    ],
  },
  {
    title: "Grupo B. Cultivos alimentarios",
    items: [
      { key: "Plátano / Banano", fill: "#E4EDC2", label: "Plátano / Banano" },
      { key: "Otros cultivos alimentarios", fill: "#FFDE3E", label: "Otros cultivos alimentarios" },
    ],
  },
  {
    title: "Grupo C. Sistemas cacaoteros",
    items: [
      { key: "Cultivos exclusivos de cacao", fill: "#732600", label: "Cultivos exclusivos de cacao" },
      { key: "Cultivos mixtos de cacao", fill: "#E69800", label: "Cultivos mixtos de cacao" },
      { key: "Cacao con teca y cultivos mixtos", fill: "#734C00", border: "#00FFC5", weight: 1, label: "Cacao con teca y cultivos mixtos" },
    ],
  },
  {
    title: "Grupo D. Otros usos productivos y antrópicos",
    items: [
      { key: "Sistema silvopastoril", fill: "#70A800", label: "Sistema silvopastoril" },
      { key: "Pasto / Ganadería", fill: "#AAFF00", label: "Pasto / Ganadería" },
      { key: "Plantación forestal", fill: "#3CAF99", label: "Plantación forestal" },
      { key: "Tierras despejadas / degradadas", fill: "#FFA77F", label: "Tierras despejadas / degradadas" },
      { key: "Otros usos productivos", fill: "#E8BEFF", label: "Otros usos productivos" },
      { key: "Infraestructura y áreas pobladas", fill: "#4E4E4E", label: "Infraestructura y áreas pobladas" },
    ],
  },
];

const COBERTURA_2015_STYLE = Object.fromEntries(
  COBERTURA_2015_GROUPS.flatMap((g) => g.items.map((item) => [normalizeUpperNoAccents(item.key), item]))
);

// Letra de grupo (A-D) en el mismo orden que COBERTURA_2015_GROUPS, usada
// para construir la fila de checkboxes por grupo en el panel de capas.
const COBERTURA_2015_GROUP_LETTERS = ["A", "B", "C", "D"];

// El shapefile entregado describe el Grupo C con frases largas en el campo
// "cob_label" (no con el nombre corto del catálogo); se traducen aquí a la
// clave canónica para reutilizar la misma paleta sin duplicar colores.
const COB_LABEL_RAW_TO_KEY = {
  [normalizeUpperNoAccents("Cacao sin cultivos alimentarios próximos")]: "Cultivos exclusivos de cacao",
  [normalizeUpperNoAccents("Cacao próximo a cultivos alimentarios")]: "Cultivos mixtos de cacao",
  [normalizeUpperNoAccents("Cacao con componente arbóreo próximo a alimentos")]: "Cacao con teca y cultivos mixtos",
};

function getCobertura2015Style(value) {
  const normalized = normalizeUpperNoAccents(value);
  const mappedKey = COB_LABEL_RAW_TO_KEY[normalized];
  const lookupKey = mappedKey ? normalizeUpperNoAccents(mappedKey) : normalized;
  return COBERTURA_2015_STYLE[lookupKey] || {
    fill: "#D1D5DB",
    border: "#6B7280",
    weight: 0.6,
    label: "Sin clasificar",
  };
}

/* =========================================================
   DEFINICIÓN DE CAPAS
========================================================= */
const layersConfig = [
  // ----- Límite parroquial (CONALI, recortado a Molleturo y convertido a TopoJSON) -----
  // Estilo según 01_3_Accesibilidad.pdf: tramado diagonal gris (#9CA3AF).
  {
    id: "Molleturo",
    label: "Límite Parroquial",
    url: "Parroquial.topo.json",
    type: "topo_polygons",
    topoObject: "Parroquial",
    pane: "pane_limites",
    // Sin relleno: solo borde (ajuste de última revisión).
    legendItems: [{ fill: "transparent", border: "#000000", label: "Límite Parroquial" }],
    style: {
      color: "#000000",
      weight: 1.5,
      fillOpacity: 0,
    },
    onEachFeature: (f, l, group) => {
      const p = f.properties || {};
      const nombre = p.Nombre ?? p.DPA_DESPAR ?? "Molleturo";
      l.bindPopup(`<b>Parroquia:</b> ${nombre}<br><b>Cantón:</b> ${p.DPA_DESCAN ?? "s/i"}<br><b>Provincia:</b> ${p.DPA_DESPRO ?? "s/i"}`);

      // Etiqueta de la parroquia
      const c = l.getBounds().getCenter();
      L.marker(c, {
        icon: L.divIcon({
          className: "label-text",
          html: nombre,
        }),
      }).addTo(group);
    },
  },

  // ----- Límite provincial, fuente Min. Gobierno/CONALI (25 provincias, TopoJSON) -----
  // Estilo según 01_3_Accesibilidad.pdf / 02_1_Cobertura_suelo.pdf:
  // "Límite provincial (Min. Gobierno)" = línea negra sólida.
  {
    id: "LimiteProvincial",
    label: "Límite provincial (Min. Gobierno)",
    url: "Provincial.topo.json",
    type: "topo_polygons",
    topoObject: "Provincial",
    pane: "pane_limites",
    legendItems: [{ fill: "#FFFFFF", border: "#000000", label: "Límite provincial (Min. Gobierno)" }],
    style: {
      color: "#000000",
      weight: 1.5,
      fillOpacity: 0,
    },
    onEachFeature: (f, l, group) => {
      const p = f.properties || {};
      const nombre = p.DPA_DESPRO ?? "AZUAY";
      l.bindPopup(`<b>Provincia:</b> ${nombre}`);

      // Etiqueta de la provincia (mismo patrón que el límite parroquial)
      const c = l.getBounds().getCenter();
      L.marker(c, {
        icon: L.divIcon({
          className: "label-text label-provincia",
          html: nombre,
        }),
      }).addTo(group);
    },
  },

  // ----- Límite provincial, fuente GAD Provincial de Azuay (2do envío) -----
  // Estilo según 01_3_Accesibilidad.pdf / 02_1_Cobertura_suelo.pdf:
  // "Límite provincial (GAD Provincial de Azuay)" = línea olivo punteada.
  {
    id: "LimiteProvincialGAD",
    label: "Límite provincial (GAD Azuay)",
    url: "Limite_Provincial_GAD_Opt.geojson",
    pane: "pane_limites",
    legendItems: [{ fill: "#FFFFFF", border: "#979F26", label: "Límite provincial (GAD Azuay)" }],
    style: {
      color: "#979F26",
      weight: 2,
      dashArray: "8 5",
      fillOpacity: 0,
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      l.bindPopup(`<b>Provincia (GAD):</b> ${p.Provincia ?? "Azuay"}`);
    },
  },

  // ----- Comunidades / Puntos de estudio -----
  // Color según 01_3_Accesibilidad.pdf ("Poblados de estudio": punto verde).
  {
    id: "Comunidades",
    label: "Comunidades / Puntos de estudio",
    url: "Puntos_de_Estudio.geojson",
    pane: "pane_puntos",
    filter: (f) => !isExcludedPlaceName(f),
    legendItems: [{ fill: "#38AA00", border: "#1F6B00", label: "Comunidades / Puntos de estudio" }],
    pointToLayer: (f, latlng) =>
      L.circleMarker(latlng, {
        radius: 6,
        color: "#1F6B00",
        weight: 1.5,
        fillColor: "#38AA00",
        fillOpacity: 0.95,
      }),
    onEachFeature: (f, l, group) => {
      const p = f.properties || {};
      const nombre = p.Nombre ?? p.nam ?? "Sin nombre";
      const pob = p.Pob_estudi ?? "s/i";

      // Popup
      l.bindPopup(`
        <b>Comunidad:</b> ${nombre}<br>
        <b>Población estudio:</b> ${pob}
      `);

      // Etiqueta permanente
      const c = l.getLatLng();
      L.marker(c, {
        icon: L.divIcon({
          className: "label-poblado",
          html: nombre,
          iconSize: [120, 24],
          iconAnchor: [60, -10],
        }),
      }).addTo(group);
    },
  },

  // ----- Vías principales (renombrada a "Red vial estatal" en última revisión) -----
  {
    id: "ViasPrincipales",
    label: "Red vial estatal",
    url: "Vias_Principales_Optimizado.geojson",
    pane: "pane_tematica",
    legendItems: [{ fill: "#FFFFFF", border: "#111827", label: "Red vial estatal" }],
    style: (f) => {
      const hwy = f?.properties?.highway ?? "";
      const major = ["motorway", "trunk", "primary", "secondary"].includes(hwy);
      return {
        color: "#111827",
        weight: major ? 2.4 : 1.2,
        opacity: 0.85,
      };
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      const name = p.name ?? "(sin nombre)";
      const hwy = p.highway ?? "s/i";
      const clase = p.CLASE_VIA ?? "s/i";
      l.bindPopup(`
        <b>Vía:</b> ${name}<br>
        <b>Highway:</b> ${hwy}<br>
        <b>Clase:</b> ${clase}
      `);
    },
  },

  // ----- Sectores 2022 (Población, Núm. hab.) -----
  {
    id: "Sectores2022",
    label: "Población (Núm. hab) 2022",
    // Capa NUEVA (Sector_Censal_2022) reproyectada a WGS84 y optimizada
    url: "Sector_Censal_2022_Opt.geojson",
    pane: "pane_tematica",
    choropleth: true,
    field: "Num",
    legendStep: 1,
    legendTitle: "Población (Núm. hab) 2022",
    fitOnEnable: true,
    // Discretización: cortes fijos (como tu captura)
    classBreaks: {
      min: 0,
      breaks: [5, 116, 209, 310, 421],
      max: 863,
    },
    palette: [
      "#bdbdbd",
      "#cfe8ff",
      "#9fd3ff",
      "#6cbcff",
      "#3aa2ff",
      "#1f78d1",
    ],
    style: function (f) {
      const v = f?.properties?.Num;
      const color = getChoroplethColor(v, this._breaks || [], this.palette);
      return {
        // Sin borde (solo relleno)
        color: "#000000",
        weight: 0,
        opacity: 0,
        fillColor: color,
        fillOpacity: 0.85,
      };
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      const total = p.Num ?? "s/i";
      l.bindPopup(`<b>Población 2022:</b> ${total}`);
    },
  },

  // ----- Sectores 2010 (Población, Núm. hab.) -----
  {
    id: "Sectores2010",
    label: "Población (Núm. hab) 2010",
    // Capa NUEVA (Sector_Censal_2010) optimizada
    url: "Sector_Censal_2010_Opt.geojson",
    pane: "pane_tematica",
    choropleth: true,
    field: "Pob_total",
    legendStep: 1,
    legendTitle: "Población (Núm. hab) 2010",
    fitOnEnable: true,
    // Discretización: cortes fijos (como tu captura)
    classBreaks: {
      min: 6,
      breaks: [116, 209, 310, 421],
      max: 766,
    },
    // Paleta pastel (secuencial)
    palette: [
      "#d7eef6",
      "#a9dced",
      "#7cc7e3",
      "#4faad3",
      "#2d77b8",
    ],
    style: function (f) {
      const v = f?.properties?.Pob_total;
      const color = getChoroplethColor(v, this._breaks || [], this.palette);
      return {
        // Sin borde (solo relleno)
        color: "#000000",
        weight: 0,
        opacity: 0,
        fillColor: color,
        fillOpacity: 0.85,
      };
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      const pob = p.Pob_total ?? "s/i";
      l.bindPopup(`<b>Población 2010:</b> ${pob}`);
    },
  },

  // ----- Área de estudio (contexto, desde 2_4_Transicion) -----
  // Color según 01_3_Accesibilidad.pdf / 02_1_Cobertura_suelo.pdf:
  // "Área de estudio" = línea magenta sólida.
  {
    id: "AreaEstudio",
    label: "Área de estudio",
    url: "Area_Estudio_Opt.geojson",
    pane: "pane_limites",
    legendItems: [{ fill: "#FFFFFF", border: "#BD09E8", label: "Área de estudio" }],
    style: {
      color: "#BD09E8",
      weight: 2.5,
      fillOpacity: 0,
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      l.bindPopup(`<b>Área de estudio:</b> ${p.Name ?? "Molleturo"}`);
    },
  },

  // ----- Red hídrica recortada al área de estudio (contexto, desde 2_4_Transicion) -----
  // Color según catálogo (Red hidrográfica, hyp_desc='PERENNE': HEX #005CE6).
  {
    id: "RioPrincipal",
    label: "Red hídrica (área de estudio)",
    url: "Rio_Principal_Opt.geojson",
    pane: "pane_tematica",
    legendItems: [{ fill: "#FFFFFF", border: "#005CE6", label: "Red hídrica (área de estudio)" }],
    style: (f) => {
      const hyp = f?.properties?.hyp_desc ?? "";
      return {
        color: "#005CE6",
        weight: hyp === "PERENNE" ? 2 : 1.2,
        dashArray: hyp === "INTERMITENTE" ? "4 3" : hyp === "SECO" ? "2 4" : null,
      };
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      l.bindPopup(`
        <b>Río:</b> ${p.nam ?? "s/n"}<br>
        <b>Régimen:</b> ${p.hyp_desc ?? "s/i"}
      `);
    },
  },

  // ----- Sistema Nacional de Áreas Protegidas (2do envío, snap_mae) -----
  // Color según 01_3_Accesibilidad.pdf: tramado verde (aproximado con
  // puntos, ya que SVG/Leaflet no soporta el ícono orgánico original sin
  // una librería adicional).
  {
    id: "SNAP",
    label: "Sistema Nacional de Áreas Protegidas",
    url: "SNAP_Opt.geojson",
    pane: "pane_limites",
    filter: (f) => SNAP_ALLOWED_NAMES.has(normalizeUpperNoAccents(f?.properties?.Nombre)),
    legendItems: [{ fill: "#E8F0E0", border: "#3F7A36", pattern: "dot", label: "Sistema Nacional de Áreas Protegidas" }],
    style: {
      color: "#3F7A36",
      weight: 1.5,
      fillColor: "url(#hatchSNAP)",
      fillOpacity: 1,
    },
    onEachFeature: (f, l, group) => {
      const p = f.properties || {};
      const nombre = p.Nombre ?? "s/i";
      l.bindPopup(`
        <b>Área protegida:</b> ${nombre}<br>
        <b>Categoría:</b> ${p["Categoría"] ?? "s/i"}<br>
        <b>Tipo:</b> ${p.Tipo ?? "s/i"}
      `);

      // Etiqueta: [Categoría] + " " + [Nombre], según el catálogo.
      const etiqueta = `${p["Categoría"] ?? ""} ${nombre !== "s/i" ? nombre : ""}`.trim();
      if (etiqueta && l.getBounds) {
        const c = l.getBounds().getCenter();
        L.marker(c, {
          icon: L.divIcon({
            className: "label-text label-snap",
            html: htmlEscape(etiqueta),
          }),
        }).addTo(group);
      }
    },
  },

  // ----- Vías locales (2do envío, via_l, recortada al área de estudio) -----
  // Renombrada de "Red vial estatal" a "Vías locales" en última revisión;
  // color según Catálogo de representación (2do envío): #FF7F7F.
  {
    id: "RedVialEstatal",
    label: "Vías locales",
    url: "Red_Vial_Estatal_Opt.geojson",
    pane: "pane_tematica",
    legendItems: [{ fill: "#FFFFFF", border: "#FF7F7F", label: "Vías locales" }],
    style: {
      color: "#FF7F7F",
      weight: 0.8,
      opacity: 0.9,
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      l.bindPopup(`
        <b>Vía:</b> ${p.descripcio ?? "s/i"}<br>
        <b>Tipo:</b> ${p.typ_desc ?? "s/i"}<br>
        <b>Jerarquía:</b> ${p.hct_desc ?? "s/i"}
      `);
    },
  },

  // ----- Poblados IGM 1:250.000 (2do envío, contexto regional) -----
  // Simbología por campo na3_desc, según el Catálogo de representación
  // (2do envío): cabecera cantonal (rojo), parroquia rural (rosado),
  // parroquia urbana (verde) y poblado (sin relleno, borde negro).
  {
    id: "PobladosIGM250",
    label: "Poblados IGM (1:250.000)",
    url: "Poblados_IGM250_Opt.geojson",
    pane: "pane_puntos",
    filter: (f) => Number(f?.properties?.LABEL) === 1 && !isExcludedPlaceName(f),
    legendItems: Object.values(POBLADOS_IGM250_STYLE).filter((item, idx, arr) =>
      idx === arr.findIndex((x) => x.label === item.label)
    ),
    pointToLayer: (f, latlng) => {
      const key = String(f?.properties?.na3_desc ?? "").trim().toUpperCase();
      const info = POBLADOS_IGM250_STYLE[key] || POBLADOS_IGM250_STYLE._default;
      return L.circleMarker(latlng, {
        radius: info.radius,
        color: info.border,
        weight: 1.4,
        fillColor: info.fill === "transparent" ? "#ffffff" : info.fill,
        fillOpacity: info.fillOpacity,
      });
    },
    onEachFeature: (f, l, group) => {
      const p = f.properties || {};
      const nombre = p.nam ?? "s/i";
      l.bindPopup(`
        <b>Poblado:</b> ${nombre}<br>
        <b>Tipo:</b> ${p.na3_desc ?? "s/i"}
      `);

      if (nombre !== "s/i") {
        const c = l.getLatLng();
        L.marker(c, {
          icon: L.divIcon({
            className: "label-poblado label-poblado-igm",
            html: htmlEscape(nombre),
            iconSize: [120, 20],
            iconAnchor: [60, -9],
          }),
        }).addTo(group);
      }
    },
  },

  // ----- Sistemas cacaoteros (año 2015) -----
  // id histórico "CoberturaCacao2015" mantenido para no romper referencias;
  // nombre visible y simbología actualizados al Catálogo de representación
  // (2do envío). Ver advertencia sobre cob_2015 junto a COBERTURA_2015_GROUPS.
  {
    id: "CoberturaCacao2015",
    label: "Sistemas cacaoteros (año 2015)",
    url: "Cacao_2015_Opt.geojson",
    pane: "pane_tematica",
    legendGroups: COBERTURA_2015_GROUPS,
    style: (f) => {
      const p = f.properties || {};
      const info = getCobertura2015Style(p.cob_label);
      return {
        color: info.border || info.fill,
        weight: info.weight || 0.5,
        fillColor: info.fill,
        fillOpacity: 0.85,
      };
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      l.bindPopup(`
        <b>Cobertura:</b> ${p.cob_label ?? "s/i"}<br>
        <b>Área:</b> ${p.area_ha ? Number(p.area_ha).toFixed(2) + " ha" : "s/i"}
      `);
    },
  },
];

/* =========================================================
   PANEL LATERAL
========================================================= */
const layerStore = new Map();

// =========================================================
// TopoJSON (solo puntos) -> GeoJSON FeatureCollection
// Nota: No usamos librerías externas para mantener el proyecto liviano.
// =========================================================
function topoPointsToGeoJSON(topo, objectName) {
  const obj = topo?.objects?.[objectName];
  if (!obj || obj.type !== "GeometryCollection") {
    throw new Error(`TopoJSON: no encuentro el objeto '${objectName}'`);
  }

  const feats = (obj.geometries || []).map((g) => ({
    type: "Feature",
    properties: g.properties || {},
    geometry: {
      type: "Point",
      // TopoJSON exportado en lon/lat (y a veces elevación en 3er valor)
      coordinates: Array.isArray(g.coordinates) ? g.coordinates.slice(0, 2) : g.coordinates,
    },
  }));

  return { type: "FeatureCollection", features: feats };
}

// =========================================================
// TopoJSON (polígonos: límites administrativos) -> GeoJSON
// Usa topojson-client (cargado en index.html) para decodificar arcos
// compartidos. Independiente de topoPointsToGeoJSON: no la modifica.
// =========================================================
function topoPolygonsToGeoJSON(topo, objectName) {
  const obj = topo?.objects?.[objectName];
  if (!obj) {
    throw new Error(`TopoJSON: no encuentro el objeto '${objectName}'`);
  }
  if (typeof window.topojson === "undefined") {
    throw new Error("topojson-client no está cargado (revisa el <script> en index.html)");
  }
  return window.topojson.feature(topo, obj);
}

async function loadLayerData(cfg) {
  const raw = await fetch(cfg.url).then((r) => r.json());
  if (cfg.type === "topo_points") {
    return topoPointsToGeoJSON(raw, cfg.topoObject || "Puntos de Campo");
  }
  if (cfg.type === "topo_polygons") {
    return topoPolygonsToGeoJSON(raw, cfg.topoObject);
  }
  // Si es coroplético, definimos breaks una sola vez (y los guardamos en cfg)
  if (cfg.choropleth && raw?.features?.length) {
    // 1) Cortes fijos (preferente, porque garantiza la misma leyenda)
    if (cfg.classBreaks?.breaks?.length) {
      cfg._breaks = cfg.classBreaks.breaks.slice();
      cfg._minVal = typeof cfg.classBreaks.min === "number" ? cfg.classBreaks.min : cfg._minVal;
      cfg._maxVal = typeof cfg.classBreaks.max === "number" ? cfg.classBreaks.max : cfg._maxVal;
    } else if (!cfg._breaks) {
      // 2) Fallback: cuantiles (k=5)
      const vals = raw.features
        .map((ft) => ft?.properties?.[cfg.field])
        .filter((x) => typeof x === 'number' && isFinite(x));
      cfg._breaks = computeQuantileBreaks(vals, 5);
      if (vals.length) {
        cfg._minVal = Math.min(...vals);
        cfg._maxVal = Math.max(...vals);
      }
    }
  }

  return raw; // GeoJSON normal
}

const layerListEl = document.getElementById("layerList");

// Cada capa recibe su propio pane de Leaflet (en vez de compartir unos
// pocos panes temáticos fijos), para que el orden del panel ("layer-item")
// pueda controlar de verdad el apilamiento visual en applyLayerDrawOrder.
layersConfig.forEach((cfg) => {
  cfg.pane = "pane_" + cfg.id;
  map.createPane(cfg.pane);
});

layersConfig.forEach((cfg) => {
  const div = document.createElement("div");
  div.className = "layer-item";
  div.draggable = true;
  div.dataset.layerId = cfg.id;

  const handle = document.createElement("span");
  handle.className = "layer-drag-handle";
  handle.textContent = "⋮⋮";
  handle.title = "Mover capa";
  div.appendChild(handle);

  if (cfg.id === "CoberturaCacao2015") {
    // Espejo visual del catálogo (4 grupos A-D): solo el Grupo C tiene
    // datos vectoriales en este envío (ver advertencia junto a
    // COBERTURA_2015_GROUPS), así que es la única fila con checkbox
    // funcional; las otras 3 quedan deshabilitadas y anotadas como tal,
    // en vez de simularse como si tuvieran datos.
    div.classList.add("cobertura2015-item");
    const groupsWrap = document.createElement("div");
    groupsWrap.className = "cobertura2015-groups";

    COBERTURA_2015_GROUPS.forEach((group, idx) => {
      const letter = COBERTURA_2015_GROUP_LETTERS[idx];
      const hasData = letter === "C";
      const row = document.createElement("div");
      row.className = "cobertura2015-row" + (hasData ? "" : " is-disabled");

      const rowChk = document.createElement("input");
      rowChk.type = "checkbox";
      rowChk.disabled = !hasData;
      const rowLab = document.createElement("label");
      rowLab.textContent = group.title;

      if (hasData) {
        rowChk.dataset.layer = cfg.id;
        rowChk.id = "chk_" + cfg.id;
        rowLab.htmlFor = rowChk.id;
        rowLab.id = "lab_" + cfg.id;
      } else {
        row.title = "Sin datos vectoriales en este envío";
        const note = document.createElement("span");
        note.className = "cobertura2015-note";
        note.textContent = "(sin datos vectoriales en este envío)";
        row.appendChild(rowChk);
        row.appendChild(rowLab);
        row.appendChild(note);
        groupsWrap.appendChild(row);
        return;
      }

      row.appendChild(rowChk);
      row.appendChild(rowLab);
      groupsWrap.appendChild(row);
    });

    div.appendChild(groupsWrap);
    layerListEl.appendChild(div);
    return;
  }

  const chk = document.createElement("input");
  chk.type = "checkbox";
  chk.dataset.layer = cfg.id;
  chk.id = "chk_" + cfg.id;

  const lab = document.createElement("label");
  lab.textContent = cfg.label;
  lab.htmlFor = chk.id;
  lab.id = "lab_" + cfg.id;

  div.appendChild(chk);
  div.appendChild(lab);
  layerListEl.appendChild(div);
});

// Z-index inicial de cada pane, según el orden inicial del panel (antes de
// cualquier arrastre). applyLayerDrawOrder se define más abajo (function
// declaration, hoisted), así que puede llamarse aquí sin problema.
applyLayerDrawOrder();

/* =========================================================
   REORDENAMIENTO MANUAL DE CAPAS (drag and drop)
   No afecta encendido/apagado, leyenda ni el widget de transición: solo
   cambia el orden visual en el panel y, al soltar, el orden de dibujo en
   el mapa (bringToFront en cascada según el nuevo orden).
========================================================= */
let draggedLayerItem = null;

layerListEl.addEventListener("dragstart", (e) => {
  const item = e.target.closest(".layer-item");
  if (!item) return;
  draggedLayerItem = item;
  item.classList.add("is-dragging");
  e.dataTransfer.effectAllowed = "move";
});

layerListEl.addEventListener("dragend", () => {
  if (draggedLayerItem) draggedLayerItem.classList.remove("is-dragging");
  draggedLayerItem = null;
  syncLayersConfigOrderFromDOM();
  applyLayerDrawOrder();
});

layerListEl.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (!draggedLayerItem) return;
  const afterElement = getDragAfterElement(layerListEl, e.clientY);
  if (afterElement == null) {
    layerListEl.appendChild(draggedLayerItem);
  } else {
    layerListEl.insertBefore(draggedLayerItem, afterElement);
  }
});

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".layer-item:not(.is-dragging)")];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// El orden del panel pasa a ser el orden "canónico" en memoria (no se
// persiste en localStorage); solo reordena el arreglo, no recrea capas.
function syncLayersConfigOrderFromDOM() {
  const ids = [...layerListEl.querySelectorAll(".layer-item")].map((el) => el.dataset.layerId);
  layersConfig.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}

// Lo que está arriba en el panel queda encima en el mapa. Como cada capa
// tiene su propio pane (asignado en el bucle que construye #layerList), el
// apilamiento real se controla con el z-index del pane, no con
// bringToFront (que solo reordena dentro de un mismo pane/SVG y no sirve
// para comparar capas que viven en panes distintos). El rango (401+) se
// mantiene siempre por debajo de "pane_transicion" (550), así el widget de
// transición no se ve afectado por este reordenamiento.
function applyLayerDrawOrder() {
  const ids = [...layerListEl.querySelectorAll(".layer-item")].map((el) => el.dataset.layerId);
  const n = ids.length;
  ids.forEach((id, i) => {
    const pane = map.getPane("pane_" + id);
    if (pane) pane.style.zIndex = String(401 + (n - i));
  });
}

/* =========================================================
   ACTIVAR / DESACTIVAR CAPAS
========================================================= */
layerListEl.addEventListener("change", async (e) => {
  const id = e.target.dataset.layer;
  const cfg = layersConfig.find((c) => c.id === id);
  if (!cfg) return;

  const labelEl = document.getElementById("lab_" + id);

  // Control anti-lag: si el usuario prende/apaga rápido, evitamos que una
  // descarga tardía vuelva a “encender” una capa ya apagada.
  cfg._toggleToken = (cfg._toggleToken || 0) + 1;
  const token = cfg._toggleToken;

  if (e.target.checked) {
    if (labelEl) labelEl.classList.add("is-loading");
    const data = cfg._data || await loadLayerData(cfg);
    cfg._data = data;

    // Si mientras cargaba el usuario apagó la capa, no la agregamos.
    const chkNow = document.getElementById("chk_" + id);
    if (!chkNow || !chkNow.checked || token !== cfg._toggleToken) {
      if (labelEl) labelEl.classList.remove("is-loading");
      updateSidebarLegend();
      return;
    }


// Agrupamos todo (geometrías + etiquetas/popup extra) en un FeatureGroup
// para que al apagar la capa se elimine absolutamente todo lo que se dibujó.
const group = L.featureGroup();

const wrappedOnEach = cfg.onEachFeature
  ? (f, l) => cfg.onEachFeature(f, l, group)
  : undefined;

const geo = L.geoJSON(data, {
  pane: cfg.pane,
  filter: cfg.filter,
  style: typeof cfg.style === "function" ? cfg.style.bind(cfg) : cfg.style,
  pointToLayer: cfg.pointToLayer,
  onEachFeature: wrappedOnEach,
});

group.addLayer(geo);
group.addTo(map);

// Patrón SVG (tramado de puntos) para "SNAP", según 01_3_Accesibilidad.pdf.
// Los fill="url(#id)" son reactivos: si el patrón se registra después de
// pintar el path, el navegador lo aplica igual. Cada capa tiene su propio
// pane ahora, así que el patrón se registra directamente sobre cfg.pane.
if (cfg.id === "SNAP") {
  ensurePanePatterns(cfg.pane, [
    { id: "hatchSNAP", bg: "#E8F0E0", dot: "#3F7A36", size: "10", dotRadius: "1.3" },
  ]);
}

// Si se trata de coropletas (sectores), hacemos un fitBounds al prender
// para que el usuario las vea de inmediato (especialmente si el mapa está alejado).
try {
  if (cfg.fitOnEnable && geo.getBounds && geo.getBounds().isValid()) {
    map.fitBounds(geo.getBounds(), { padding: [30, 30] });
  }
} catch (_) {}

if (labelEl) labelEl.classList.remove("is-loading");

// Mejor interacción: asegurar que quede arriba en su pane
if (typeof geo.bringToFront === "function") geo.bringToFront();
layerStore.set(id, group);
applyLayerDrawOrder();
  } else {
    const lyr = layerStore.get(id);
    if (lyr) {
      map.removeLayer(lyr);
      layerStore.delete(id);
    }
    if (labelEl) labelEl.classList.remove("is-loading");
  }

  updateSidebarLegend();
});

/* =========================================================
   ARRANQUE AUTO
========================================================= */
const autoOnIds = ["Molleturo", "LimiteProvincial", "LimiteProvincialGAD", "Comunidades"];

// Zoom inicial al área de estudio (Area_Estudio_Opt.geojson), sin que la
// capa "Área de estudio" deba quedar encendida. Si por algún motivo no se
// puede cargar, recae sobre los límites de "Límite Parroquial".
async function fitToStudyArea() {
  try {
    const data = await fetch("Area_Estudio_Opt.geojson").then((r) => r.json());
    const tmp = L.geoJSON(data);
    if (tmp.getBounds && tmp.getBounds().isValid()) {
      map.fitBounds(tmp.getBounds(), { padding: [45, 45] });
      return;
    }
  } catch (err) {
    console.warn("No se pudo hacer zoom al área de estudio", err);
  }

  const lyr = layerStore.get("Molleturo");
  if (lyr && lyr.getBounds && lyr.getBounds().isValid()) {
    map.fitBounds(lyr.getBounds(), { padding: [50, 50] });
  }
}

(() => {
  autoOnIds.forEach((id) => {
    const chk = document.getElementById("chk_" + id);
    if (chk) {
      chk.checked = true;
      // bubbles:true es obligatorio: el listener real está delegado en
      // layerListEl (el contenedor), y un Event sin bubbles nunca llega ahí,
      // por lo que las capas auto-on quedaban "marcadas" pero sin dibujarse.
      chk.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  setTimeout(() => {
    fitToStudyArea();
  }, 800);
})();

/* =========================================================
   WIDGET TRANSICIÓN MULTITEMPORAL
   Carga dinámica desde transicion_layers.json (generado por
   convertir_transicion_geojson.py a partir de 2_4_Transicion).
   No interfiere con layersConfig / layerStore / autoOnIds.

   Espejo del mapa oficial "02_4_Transición.pdf" (THE COCOA SOCIETY —
   Transición de cobertura y uso del suelo y áreas de cacao 1990-2000-2020-2022):
   - 3 escenarios animables: 1990–2000, 2000–2020, 2020–2022.
   - La capa tr0020_cacao ("Transición hacia el cacao") no es un 4º escenario:
     en el PDF aparece como una superposición exclusiva del panel 2000–2020,
     así que aquí se dibuja automáticamente ENCIMA de esa capa cuando está
     activa, igual que en el mapa impreso.
   - Colores y agrupación de leyenda calcados del PDF (LEYENDA 1990-2000,
     LEYENDA 2000-2020, LEYENDA 2020-2022 + LEYENDA COMÚN).
========================================================= */

const ID_1990_2000 = "transicion_tr_1990_2000";
const ID_2000_2020 = "transicion_tr_2000_2020";
const ID_2020_2022 = "transicion_tr_2020_2022";
const ID_CACAO = "transicion_tr0020_cacao";

const transitionState = {
  manifest: null,
  layers: [],          // las 4 capas del manifiesto (incluye cacao), para la lista de checkboxes
  timelineLayers: [],   // solo los 3 escenarios reales del PDF, para slider/play/prev/next
  dataCache: new Map(),
  leafletLayers: new Map(),
  activeIndex: 0,
  playing: false,
  timer: null,
  categoryColorMap: new Map(),
  patternsReady: false,
};

function transitionEls() {
  return {
    status: document.getElementById("transitionStatus"),
    prev: document.getElementById("transitionPrev"),
    play: document.getElementById("transitionPlay"),
    next: document.getElementById("transitionNext"),
    slider: document.getElementById("transitionSlider"),
    label: document.getElementById("transitionCurrentLabel"),
    opacity: document.getElementById("transitionOpacity"),
    keepPrevious: document.getElementById("transitionKeepPrevious"),
    autoFit: document.getElementById("transitionAutoFit"),
    list: document.getElementById("transitionLayerList"),
  };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeTransitionValue(value) {
  if (value === null || value === undefined || value === "") return "SIN_DATO";
  return String(value)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// =========================================================
// SIMBOLOGÍA OFICIAL — espejo de "02_4_Transición.pdf"
// Colores muestreados directamente del mapa impreso (THE COCOA SOCIETY,
// escala 1:128.000, fuente IGM/MAG/MAE). Estructura en 3 niveles, igual que
// el PDF:
//   1) "Cambios principales de cobertura" — mismo color en los 3 escenarios.
//   2) "Coberturas persistentes" — en 1990-2000 y 2000-2020 el PDF agrupa
//      TODO lo no-bosque en una sola categoría gris "Persistencia en otros
//      usos"; en 2020-2022 el PDF sí distingue uso agropecuario (tramado) y
//      pastos/ganadería (puntos).
//   3) "Reconfiguración interna" — color por combinación exacta old_gen →
//      new_gen (campo "trans"), específico de cada escenario (el PDF usa un
//      tono distinto por panel para la misma combinación).
// =========================================================

const CAMBIOS_PRINCIPALES_STYLE = {
  EXPANSION_AGRO: { fill: "#D8BE8B", label: "Expansión agropecuaria" },
  EXPANSION_PASTO: { fill: "#E4E5AC", label: "Expansión de pastos / ganadería" },
  EXPANSION_PLANTACION: { fill: "#9BC6BF", label: "Expansión de plantaciones forestales" },
  EXPANSION_URBANA: { fill: "#B8B3D3", label: "Expansión urbana e infraestructura" },
  GANANCIA_BOSQUE: { fill: "#9FC8A1", label: "Recuperación / ganancia de bosque" },
  PERDIDA_BOSQUE: { fill: "#D29790", label: "Pérdida de bosque" },
};

const PERSISTENCE_BOSQUE_STYLE = { fill: "#B6FDB8", label: "Persistencia en cobertura de bosques" };
const PERSISTENCE_OTROS_STYLE = { fill: "#A8A8A8", label: "Persistencia en otros usos" };
// Texturas exclusivas del panel 2020-2022 (las únicas con tramado en el PDF).
const PERSISTENCE_AGRO_HATCH_STYLE = {
  fill: "#F3E8D1", border: "#D9B98A", pattern: "hatch", svgFill: "url(#hatchAgro)",
  label: "Persistencia en uso agropecuario",
};
const PERSISTENCE_PASTO_DOT_STYLE = {
  fill: "#EEE9C9", border: "#734C00", pattern: "dot", svgFill: "url(#dotPasto)",
  label: "Persistencia en pastos y ganadería",
};

const RECONFIG_STYLE_BY_LAYER = {
  [ID_1990_2000]: {
    "AGRO → NATURAL_SECUNDARIO": { fill: "#4C9C74", label: "Reconfiguración: agropecuario → vegetación secundaria" },
    "PASTO_GANADERIA → NATURAL_SECUNDARIO": { fill: "#7CB43F", label: "Reconfiguración: pastos/ganadería → vegetación secundaria" },
    "AGRO → AGUA": { fill: "#3485C4", label: "Reconfiguración: agropecuario → área hidrográfica" },
  },
  [ID_2000_2020]: {
    "PASTO_GANADERIA → NATURAL_SECUNDARIO": { fill: "#80B143", label: "Reconfiguración: pastos/ganadería → vegetación secundaria" },
    "PLANTACION → NATURAL_SECUNDARIO": { fill: "#C5E9FF", label: "Reconfiguración: plantación forestal → vegetación secundaria" },
    "PASTO_GANADERIA → AGUA": { fill: "#33ACDA", label: "Reconfiguración: pastos/ganadería → área hidrográfica" },
    "NO_DATA → NATURAL_SECUNDARIO": { fill: "#8CA176", label: "Sin información previa → vegetación secundaria" },
  },
  [ID_2020_2022]: {
    "NATURAL_SECUNDARIO → AGUA": { fill: "#4892C0", label: "Reconfiguración: vegetación secundaria → área hidrográfica" },
    "AGRO → NATURAL_SECUNDARIO": { fill: "#509B6D", label: "Reconfiguración: agropecuario → vegetación secundaria" },
    "PLANTACION → NATURAL_SECUNDARIO": { fill: "#1E836D", label: "Reconfiguración: plantación forestal → vegetación secundaria" },
    "NO_DATA → NATURAL_SECUNDARIO": { fill: "#909F74", label: "Sin información previa → vegetación secundaria" },
  },
};

// "Transición 2000-2020 hacia el cacao (información año 2015)": por
// combinación exacta old_gen → new_gen, igual que el panel central del PDF.
const CACAO_TRANS_STYLE = {
  "FOREST → AGRO": {
    fill: "#FAF7EC", border: "#765D43",
    label: "Conversión de bosque hacia usos agropecuarios y cacao",
  },
  "PASTO_GANADERIA → AGRO": {
    fill: "#FFFFFF", border: "#DE394D",
    label: "Conversión de pasto y ganadería hacia usos agropecuarios y cacao",
  },
  "AGUA → AGRO": {
    fill: "#A8ECFD", border: "#2C7FB8", pattern: "dot", svgFill: "url(#dotAgua)",
    label: "Área hídrica reclasificada a uso agropecuario asociado a cacao",
  },
  "NO_DATA → AGRO": {
    fill: "#FFFFFF", border: "#6B7280",
    label: "Conversión de coberturas sin información previa hacia agropecuario y cacao",
  },
};

// Define los patrones SVG (tramado/puntos) una sola vez sobre el <svg> que
// Leaflet crea para el pane de transición. Sin librerías externas.
const _panesWithPatterns = new Set();

// Reutilizable: registra patrones SVG (tramado/puntos) una sola vez sobre el
// <svg> que Leaflet crea para un pane dado. Sin librerías externas. Se usa
// tanto para el pane de transición (hatch/dot ya existentes) como para
// pane_limites (hatch de "Límite parroquial de Molleturo" y de "Sistema
// Nacional de Áreas Protegidas", según 01_3_Accesibilidad.pdf).
function ensurePanePatterns(paneName, specs) {
  if (_panesWithPatterns.has(paneName)) return;
  const pane = map.getPane(paneName);
  const svg = pane?.querySelector("svg");
  if (!svg) return;

  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.insertBefore(defs, svg.firstChild);
  }

  specs.forEach((spec) => {
    if (defs.querySelector(`#${spec.id}`)) return;
    const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    pattern.setAttribute("id", spec.id);
    pattern.setAttribute("width", spec.size || "8");
    pattern.setAttribute("height", spec.size || "8");
    pattern.setAttribute("patternUnits", "userSpaceOnUse");
    if (spec.line) pattern.setAttribute("patternTransform", "rotate(45)");

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", spec.size || "8");
    rect.setAttribute("height", spec.size || "8");
    rect.setAttribute("fill", spec.bg);
    pattern.appendChild(rect);

    if (spec.line) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", "0");
      line.setAttribute("y1", "0");
      line.setAttribute("x2", "0");
      line.setAttribute("y2", spec.size || "8");
      line.setAttribute("stroke", spec.line);
      line.setAttribute("stroke-width", spec.lineWidth || "2.5");
      pattern.appendChild(line);
    }
    if (spec.dot) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const c = (Number(spec.size) || 8) / 2;
      circle.setAttribute("cx", String(c));
      circle.setAttribute("cy", String(c));
      circle.setAttribute("r", spec.dotRadius || "1.6");
      circle.setAttribute("fill", spec.dot);
      pattern.appendChild(circle);
    }
    defs.appendChild(pattern);
  });

  _panesWithPatterns.add(paneName);
}

function ensureTransitionPatterns() {
  ensurePanePatterns("pane_transicion", [
    { id: "hatchAgro", bg: "#F3E8D1", line: "#D9B98A" },
    { id: "dotPasto", bg: "#EEE9C9", dot: "#734C00" },
    { id: "dotAgua", bg: "#A8ECFD", dot: "#2C7FB8" },
  ]);
}


// Resuelve el estilo oficial de una feature, según la capa (escenario) a la
// que pertenece:
//  - Capa cacao: por combinación exacta "trans" contra CACAO_TRANS_STYLE.
//  - "Cambios principales" (expansión/ganancia/pérdida): color universal.
//  - "Reconfiguración interna": por combinación "trans", específica del
//    escenario (RECONFIG_STYLE_BY_LAYER[layerId]).
//  - "Persistencia"/"Sin información": bosque en verde siempre; en el
//    escenario 2020-2022 se distingue uso agropecuario (tramado) y pastos/
//    ganadería (puntos); en el resto, un solo gris "otros usos", igual que
//    el PDF.
function getTransitionFeatureStyle(properties, categoryField, layerId) {
  const props = properties || {};
  const transCombo = props.trans ? normalizeTransitionValue(props.trans) : null;

  if (layerId === ID_CACAO) {
    if (transCombo && CACAO_TRANS_STYLE[transCombo]) return CACAO_TRANS_STYLE[transCombo];
    return { fill: "#FFFFFF", border: "#6B7280", label: "Transición hacia cacao (sin clasificar)" };
  }

  const grpRaw = props.trans_grp ?? (categoryField ? props[categoryField] : null);
  const grp = normalizeTransitionValue(grpRaw);

  if (CAMBIOS_PRINCIPALES_STYLE[grp]) return CAMBIOS_PRINCIPALES_STYLE[grp];

  if (grp.startsWith("RECONFIGURACION")) {
    const byLayer = RECONFIG_STYLE_BY_LAYER[layerId] || {};
    if (transCombo && byLayer[transCombo]) return byLayer[transCombo];
    return { fill: "#8A7FAE", label: "Reconfiguración interna (otra combinación)" };
  }

  if (grp.includes("PERSISTENCIA") || grp.includes("SIN_INFORMACION")) {
    if (grp.includes("BOSQUE")) return PERSISTENCE_BOSQUE_STYLE;
    if (layerId === ID_2020_2022) {
      if (grp.includes("USO_AGROPECUARI")) return PERSISTENCE_AGRO_HATCH_STYLE;
      if (grp.includes("PASTO")) return PERSISTENCE_PASTO_DOT_STYLE;
    }
    return PERSISTENCE_OTROS_STYLE;
  }

  // Variante no anticipada: asignar color estable de la paleta genérica del
  // manifiesto, en orden de primera aparición (no se inventa una categoría
  // del PDF, solo se evita dejarla sin pintar).
  const palette = transitionState.manifest?.categoryPalette || ["#64748b"];
  const key = transCombo || grp || "SIN_DATO";
  if (!transitionState.categoryColorMap.has(key)) {
    const idx = transitionState.categoryColorMap.size;
    transitionState.categoryColorMap.set(key, palette[idx % palette.length]);
  }
  return { fill: transitionState.categoryColorMap.get(key), label: grpRaw ? String(grpRaw) : "Sin información" };
}

// =========================================================
// LEYENDA — calcada de los 3 bloques del PDF (LEYENDA 1990-2000,
// LEYENDA 2000-2020, LEYENDA 2020-2022), construida a partir de los mismos
// objetos de estilo que pintan el mapa (cero duplicación de colores).
// =========================================================
const LEGEND_DEFS = {
  [ID_1990_2000]: {
    title: "LEYENDA 1990–2000",
    sections: [
      { title: "Cambios principales de cobertura", items: Object.values(CAMBIOS_PRINCIPALES_STYLE) },
      { title: "Coberturas persistentes", items: [PERSISTENCE_BOSQUE_STYLE, PERSISTENCE_OTROS_STYLE] },
      { title: "Reconfiguración interna", items: Object.values(RECONFIG_STYLE_BY_LAYER[ID_1990_2000]) },
    ],
  },
  [ID_2000_2020]: {
    title: "LEYENDA 2000–2020",
    sections: [
      { title: "Cambios principales de cobertura", items: Object.values(CAMBIOS_PRINCIPALES_STYLE) },
      { title: "Coberturas persistentes", items: [PERSISTENCE_BOSQUE_STYLE, PERSISTENCE_OTROS_STYLE] },
      { title: "Reconfiguración interna", items: Object.values(RECONFIG_STYLE_BY_LAYER[ID_2000_2020]) },
      {
        title: "Transición hacia el cacao (información 2015)",
        items: Object.values(CACAO_TRANS_STYLE),
        onlyWithCacao: true,
      },
    ],
  },
  [ID_2020_2022]: {
    title: "LEYENDA 2020–2022",
    sections: [
      { title: "Cambios principales de cobertura", items: Object.values(CAMBIOS_PRINCIPALES_STYLE) },
      {
        title: "Coberturas persistentes",
        items: [PERSISTENCE_BOSQUE_STYLE, PERSISTENCE_AGRO_HATCH_STYLE, PERSISTENCE_PASTO_DOT_STYLE, PERSISTENCE_OTROS_STYLE],
      },
      { title: "Reconfiguración interna", items: Object.values(RECONFIG_STYLE_BY_LAYER[ID_2020_2022]) },
    ],
  },
};

function legendSwatchStyle(info) {
  if (info.pattern === "hatch") {
    return `background:repeating-linear-gradient(45deg, ${info.border} 0, ${info.border} 2px, ${info.fill} 2px, ${info.fill} 7px);border:1px solid ${info.border}`;
  }
  if (info.pattern === "dot") {
    return `background-color:${info.fill};background-image:radial-gradient(circle, ${info.border} 1.3px, transparent 1.5px);background-size:7px 7px;border:1px solid ${info.border}`;
  }
  return `background:${info.fill}${info.border ? `;border:2px solid ${info.border}` : ""}`;
}

function renderLegendSection(section) {
  const rows = section.items.map((info) => `
    <div class="legend-row">
      <span class="legend-swatch" style="${legendSwatchStyle(info)}"></span>
      <span class="legend-range">${htmlEscape(info.label)}</span>
    </div>
  `).join("");
  return `<div class="legend-subtitle">${htmlEscape(section.title)}</div>${rows}`;
}

function getTransitionCategoryField(layerCfg, featureCollection) {
  if (layerCfg.categoryField) return layerCfg.categoryField;

  const features = featureCollection?.features || [];
  if (!features.length) return null;

  const priority = [
    "trans_grp", "transicion", "transition", "cambio", "change",
    "categoria", "category", "clase", "class", "tipo", "cobertura",
    "leyenda", "legend", "name", "nombre"
  ];

  const props = features[0].properties || {};
  const keys = Object.keys(props);
  const lowerMap = Object.fromEntries(keys.map((k) => [k.toLowerCase(), k]));

  for (const p of priority) {
    if (lowerMap[p.toLowerCase()]) return lowerMap[p.toLowerCase()];
  }

  return null;
}

async function loadTransitionData(layerCfg) {
  if (transitionState.dataCache.has(layerCfg.id)) {
    return transitionState.dataCache.get(layerCfg.id);
  }

  const data = await fetch(layerCfg.url).then((r) => {
    if (!r.ok) throw new Error(`No se pudo cargar ${layerCfg.url}`);
    return r.json();
  });

  transitionState.dataCache.set(layerCfg.id, data);
  return data;
}

function buildTransitionPopup(feature, layerCfg) {
  const props = feature.properties || {};
  const rows = Object.entries(props)
    .slice(0, 18)
    .map(([k, v]) => `<b>${htmlEscape(k)}:</b> ${htmlEscape(v)}`)
    .join("<br>");

  const info = getTransitionFeatureStyle(props, layerCfg._resolvedCategoryField, layerCfg.id);

  return `
    <b>${htmlEscape(layerCfg.label)}</b><br>
    <b>Periodo:</b> ${htmlEscape(layerCfg.timeLabel || "s/i")}<br>
    <b>Categoría:</b> ${htmlEscape(info.label)}<br>
    ${rows}
  `;
}

function createTransitionLeafletLayer(layerCfg, data) {
  const opacity = Number(transitionEls().opacity?.value ?? 0.55);
  const defaultStyle = transitionState.manifest?.defaultStyle || {
    color: "#7f1d1d",
    weight: 1.1,
    opacity: 0.85,
    fillColor: "#f97316",
    fillOpacity: opacity,
  };

  const categoryField = getTransitionCategoryField(layerCfg, data);
  layerCfg._resolvedCategoryField = categoryField;

  const geo = L.geoJSON(data, {
    pane: "pane_transicion",
    style: (feature) => {
      const info = getTransitionFeatureStyle(feature.properties, categoryField, layerCfg.id);
      return {
        ...defaultStyle,
        color: info.border || info.fill,
        weight: info.border ? 1.4 : defaultStyle.weight,
        fillColor: info.svgFill || info.fill,
        fillOpacity: opacity,
      };
    },
    pointToLayer: (feature, latlng) => {
      const info = getTransitionFeatureStyle(feature.properties, categoryField, layerCfg.id);
      return L.circleMarker(latlng, {
        radius: 5,
        color: info.border || info.fill,
        weight: 1,
        fillColor: info.svgFill || info.fill,
        fillOpacity: opacity,
      });
    },
    onEachFeature: (feature, layer) => {
      layer.bindPopup(buildTransitionPopup(feature, layerCfg));
    },
  });

  return geo;
}

async function addTransitionLayerToMap(layerCfg) {
  if (transitionState.leafletLayers.has(layerCfg.id)) return transitionState.leafletLayers.get(layerCfg.id);
  const data = await loadTransitionData(layerCfg);
  const lyr = createTransitionLeafletLayer(layerCfg, data);
  lyr.addTo(map);
  ensureTransitionPatterns();
  transitionState.leafletLayers.set(layerCfg.id, lyr);
  return lyr;
}

function removeAllTransitionLayers() {
  transitionState.leafletLayers.forEach((lyr) => map.removeLayer(lyr));
  transitionState.leafletLayers.clear();
}

// "La capa tr0020_cacao va encima de 2000-2020": se agrega DESPUÉS de la
// capa base 2000-2020 para que, dentro del mismo pane SVG, quede pintada
// por encima — igual que la superposición del panel central del PDF.
async function addCacaoOverlay() {
  const cfg = transitionState.layers.find((l) => l.id === ID_CACAO);
  if (!cfg) return;
  if (transitionState.leafletLayers.has(cfg.id)) {
    transitionState.leafletLayers.get(cfg.id).eachLayer((l) => l.bringToFront && l.bringToFront());
  } else {
    await addTransitionLayerToMap(cfg);
  }
  const chk = document.getElementById(`transition_chk_${cfg.id}`);
  if (chk) chk.checked = true;
}

function removeCacaoOverlay() {
  const lyr = transitionState.leafletLayers.get(ID_CACAO);
  if (lyr) {
    map.removeLayer(lyr);
    transitionState.leafletLayers.delete(ID_CACAO);
  }
  const chk = document.getElementById(`transition_chk_${ID_CACAO}`);
  if (chk) chk.checked = false;
}

async function showTransitionIndex(index) {
  const els = transitionEls();
  const layers = transitionState.timelineLayers;
  if (!layers.length) return;

  const boundedIndex = Math.max(0, Math.min(index, layers.length - 1));
  transitionState.activeIndex = boundedIndex;
  const cfg = layers[boundedIndex];

  const keepPrevious = !!els.keepPrevious?.checked;
  if (!keepPrevious) removeAllTransitionLayers();

  const selectedLayers = keepPrevious ? layers.slice(0, boundedIndex + 1) : [cfg];

  for (const layerCfg of selectedLayers) {
    await addTransitionLayerToMap(layerCfg);
  }

  if (!keepPrevious) {
    transitionState.leafletLayers.forEach((lyr, id) => {
      if (id !== cfg.id) {
        map.removeLayer(lyr);
        transitionState.leafletLayers.delete(id);
      }
    });
  }

  const includes2000_2020 = selectedLayers.some((l) => l.id === ID_2000_2020);
  if (includes2000_2020) {
    await addCacaoOverlay();
  } else if (!keepPrevious) {
    removeCacaoOverlay();
  }

  if (els.slider) els.slider.value = String(boundedIndex);
  if (els.label) {
    els.label.textContent = `${cfg.timeLabel || cfg.label} · ${cfg.featureCount ?? ""} elementos`;
  }

  updateTransitionCheckboxes();
  updateTransitionLegend();

  try {
    const currentLayer = transitionState.leafletLayers.get(cfg.id);
    if (els.autoFit?.checked && currentLayer?.getBounds && currentLayer.getBounds().isValid()) {
      map.fitBounds(currentLayer.getBounds(), { padding: [30, 30] });
    }
  } catch (_) {}
}

function updateTransitionCheckboxes() {
  const activeIds = new Set(transitionState.leafletLayers.keys());
  document.querySelectorAll("[data-transition-layer]").forEach((chk) => {
    chk.checked = activeIds.has(chk.dataset.transitionLayer);
  });
}

function updateTransitionOpacity() {
  const opacity = Number(transitionEls().opacity?.value ?? 0.55);
  transitionState.leafletLayers.forEach((lyr) => {
    lyr.eachLayer((sub) => {
      if (sub.setStyle) {
        sub.setStyle({ fillOpacity: opacity, opacity: Math.max(opacity, 0.35) });
      }
    });
  });
}

function updateTransitionLegend() {
  const mapEl = document.getElementById("mapLegend");
  if (!mapEl) return;

  if (!transitionState.leafletLayers.size) {
    updateSidebarLegend();
    return;
  }

  const cfg = transitionState.timelineLayers[transitionState.activeIndex];
  const def = cfg && LEGEND_DEFS[cfg.id];
  if (!def) {
    mapEl.innerHTML = "";
    return;
  }

  const cacaoVisible = transitionState.leafletLayers.has(ID_CACAO);
  const sections = def.sections.filter((s) => !s.onlyWithCacao || cacaoVisible);

  mapEl.innerHTML = `
    <div class="map-legend-wrap">
      <div class="legend-card legend-card-transicion">
        <div class="legend-title">${htmlEscape(def.title)}</div>
        ${sections.map(renderLegendSection).join("")}
      </div>
    </div>
  `;
}

function stopTransitionAnimation() {
  const els = transitionEls();
  transitionState.playing = false;
  if (transitionState.timer) window.clearInterval(transitionState.timer);
  transitionState.timer = null;
  if (els.play) els.play.textContent = "▶";
}

function startTransitionAnimation() {
  const els = transitionEls();
  if (!transitionState.timelineLayers.length) return;

  transitionState.playing = true;
  if (els.play) els.play.textContent = "⏸";

  transitionState.timer = window.setInterval(() => {
    const next = transitionState.activeIndex + 1 >= transitionState.timelineLayers.length
      ? 0
      : transitionState.activeIndex + 1;
    showTransitionIndex(next);
  }, 1700);
}

function toggleTransitionAnimation() {
  if (transitionState.playing) stopTransitionAnimation();
  else startTransitionAnimation();
}

function renderTransitionLayerList() {
  const els = transitionEls();
  if (!els.list) return;

  els.list.innerHTML = transitionState.layers.map((cfg, idx) => {
    const isCacao = cfg.id === ID_CACAO;
    const labelText = isCacao
      ? "Transición hacia el cacao (automática, sobre 2000–2020)"
      : (cfg.timeLabel || cfg.label);
    return `
      <div class="transition-layer-item">
        <input
          type="checkbox"
          id="transition_chk_${htmlEscape(cfg.id)}"
          data-transition-layer="${htmlEscape(cfg.id)}"
          data-transition-index="${idx}"
        />
        <label for="transition_chk_${htmlEscape(cfg.id)}">
          ${htmlEscape(labelText)}
        </label>
      </div>
    `;
  }).join("");

  // Nota: la capa cacao es un overlay independiente (se prende/apaga sin
  // afectar el escenario activo). Los 3 escenarios reales del PDF, en
  // cambio, delegan en showTransitionIndex() para que el slider, la
  // leyenda flotante y el respeto de "Combinar con capas anteriores" se
  // mantengan siempre sincronizados sin importar si el usuario interactúa
  // desde esta lista de checkboxes o desde el slider/Anterior/Siguiente.
  // (Antes esto solo agregaba/quitaba la capa sin tocar activeIndex, por
  // lo que la leyenda se quedaba "pegada" en el primer escenario mostrado.)
  els.list.addEventListener("change", async (e) => {
    const chk = e.target;
    if (!chk?.dataset?.transitionLayer) return;
    const idx = Number(chk.dataset.transitionIndex);
    const cfg = transitionState.layers[idx];
    if (!cfg) return;

    if (cfg.id === ID_CACAO) {
      if (chk.checked) {
        await addCacaoOverlay();
      } else {
        removeCacaoOverlay();
      }
      updateTransitionOpacity();
      updateTransitionLegend();
      return;
    }

    const timelineIdx = transitionState.timelineLayers.findIndex((l) => l.id === cfg.id);

    if (chk.checked) {
      if (timelineIdx >= 0) await showTransitionIndex(timelineIdx);
      return;
    }

    // Apagar manualmente un escenario: solo lo removemos (el usuario puede
    // dejar el mapa sin ningún escenario activo); no forzamos otro.
    const lyr = transitionState.leafletLayers.get(cfg.id);
    if (lyr) {
      map.removeLayer(lyr);
      transitionState.leafletLayers.delete(cfg.id);
    }
    if (cfg.id === ID_2000_2020) removeCacaoOverlay();
    updateTransitionOpacity();
    updateTransitionLegend();
  });
}

async function initTransitionWidget() {
  const els = transitionEls();
  if (!els.status) return;

  try {
    const manifest = await fetch("transicion_layers.json").then((r) => {
      if (!r.ok) throw new Error("No existe transicion_layers.json");
      return r.json();
    });

    transitionState.manifest = manifest;
    transitionState.layers = (manifest.layers || []).slice().sort((a, b) => {
      const ay = a.yearFrom ?? 9999;
      const by = b.yearFrom ?? 9999;
      if (ay !== by) return ay - by;
      return (a.order ?? 0) - (b.order ?? 0);
    });
    transitionState.timelineLayers = transitionState.layers.filter((l) => l.id !== ID_CACAO);

    if (!transitionState.timelineLayers.length) {
      els.status.textContent = "No hay capas de transición registradas.";
      return;
    }

    const hasCacao = transitionState.layers.some((l) => l.id === ID_CACAO);
    els.status.textContent = `${transitionState.timelineLayers.length} escenarios de transición disponibles`
      + (hasCacao ? " (cacao se superpone automáticamente en 2000–2020)" : "");

    if (els.slider) {
      els.slider.disabled = false;
      els.slider.min = "0";
      els.slider.max = String(transitionState.timelineLayers.length - 1);
      els.slider.value = "0";
      els.slider.addEventListener("input", (e) => showTransitionIndex(Number(e.target.value)));
    }

    els.prev?.addEventListener("click", () => {
      const next = transitionState.activeIndex - 1 < 0
        ? transitionState.timelineLayers.length - 1
        : transitionState.activeIndex - 1;
      showTransitionIndex(next);
    });

    els.next?.addEventListener("click", () => {
      const next = transitionState.activeIndex + 1 >= transitionState.timelineLayers.length
        ? 0
        : transitionState.activeIndex + 1;
      showTransitionIndex(next);
    });

    els.play?.addEventListener("click", toggleTransitionAnimation);
    els.opacity?.addEventListener("input", updateTransitionOpacity);
    els.keepPrevious?.addEventListener("change", () => showTransitionIndex(transitionState.activeIndex));

    renderTransitionLayerList();
    showTransitionIndex(0);
  } catch (err) {
    els.status.textContent = "No se cargaron capas de transición. Ejecuta primero convertir_transicion_geojson.py";
    console.warn("Transición multitemporal:", err);
  }
}

initTransitionWidget();
