/* =========================================================
   Geovisor Agrícola – Estética MAPBOX Light
   Capas:
   - Límite Parroquial
   - Comunidades / Puntos de estudio
   - Puntos de Campo (GPS)
   - Vías principales
   - Zonas UZ
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
========================================================= */
map.createPane("pane_limites").style.zIndex = 400;
map.createPane("pane_tematica").style.zIndex = 500;
map.createPane("pane_transicion").style.zIndex = 550;
map.createPane("pane_puntos").style.zIndex = 600;

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

// Actualiza leyenda del panel izquierdo según capas coropléticas activas
function updateSidebarLegend() {
  const sidebarEl = document.getElementById("legend");
  const mapEl = document.getElementById("mapLegend");
  if (!sidebarEl && !mapEl) return;

  const activeChoros = layersConfig
    .filter((c) => c.choropleth)
    .filter((c) => {
      const chk = document.getElementById("chk_" + c.id);
      return chk && chk.checked;
    });

  if (!activeChoros.length) {
    const emptyMsg = "<p>Activa una capa coroplética (Sectores) para ver su leyenda.</p>";
    if (sidebarEl) sidebarEl.innerHTML = emptyMsg;
    if (mapEl) mapEl.innerHTML = emptyMsg;
    return;
  }

  // Panel lateral (vertical)
  const blocksForSidebar = activeChoros.map((cfg) => {
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
        const a = fmtLegend(r[0]);
        const b = fmtLegend(r[1]);
        return `
          <div class="legend-row">
            <span class="legend-swatch" style="background:${color}"></span>
            <span class="legend-range">${a} - ${b}</span>
          </div>
        `;
      }).join("");

    return `
      <div class="legend-block">
        <div class="legend-title">${cfg.legendTitle || cfg.field || cfg.label}</div>
        ${rows}
      </div>
    `;
  });

  // Mapa (flotante) – tarjetas separadas, como simbología de WhatsApp
  const blocksForMap = activeChoros.map((cfg) => {
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
      <div class="legend-card">
        <div class="legend-title">${cfg.legendTitle || cfg.field || cfg.label}</div>
        ${rows}
      </div>
    `;
  });

  const htmlSidebar = blocksForSidebar.join("\n");
  const htmlMap = `<div class="map-legend-wrap">${blocksForMap.join("\n")}</div>`;
  if (sidebarEl) sidebarEl.innerHTML = htmlSidebar;
  if (mapEl) mapEl.innerHTML = htmlMap;
}


/* =========================================================
   DEFINICIÓN DE CAPAS
========================================================= */
const layersConfig = [
  // ----- Límite parroquial -----
  {
    id: "Molleturo",
    label: "Límite Parroquial",
    url: "Parroquia_Molleturo_Optimizado.geojson",
    pane: "pane_limites",
    style: {
      color: "#0284c7",
      weight: 2,
      fillOpacity: 0,
    },
    onEachFeature: (f, l, group) => {
      const nombre = f.properties?.Nombre ?? "Molleturo";
      l.bindPopup(`<b>Parroquia:</b> ${nombre}`);

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

  // ----- Comunidades / Puntos de estudio -----
  {
    id: "Comunidades",
    label: "Comunidades / Puntos de estudio",
    url: "Puntos_de_Estudio.geojson",
    pane: "pane_puntos",
    pointToLayer: (f, latlng) =>
      L.circleMarker(latlng, {
        radius: 6,
        color: "#0f172a",
        weight: 1.5,
        fillColor: "#22c55e",
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

  // ----- Puntos de Campo (TopoJSON) -----
  {
    id: "PuntosCampo",
    label: "Puntos de Campo (GPS)",
    url: "Puntos_de_Campo.topo.json",
    type: "topo_points",
    topoObject: "Puntos de Campo",
    pane: "pane_puntos",
    pointToLayer: (f, latlng) =>
      L.circleMarker(latlng, {
        radius: 6,
        color: "#b91c1c",
        weight: 2,
        fillColor: "#ef4444",
        fillOpacity: 0.95,
      }),
    onEachFeature: (f, l, group) => {
      const p = f.properties || {};
      const name = p.Name ?? p.NOMBRE ?? p.nombre ?? "Punto";
      const dt = p.DateTimeS ?? p.fecha ?? "";
      const elev = p.Elevation ?? p.elev ?? "";

      l.bindPopup(`
        <b>Nombre:</b> ${name}<br>
        <b>Fecha/Hora:</b> ${dt}<br>
        <b>Elevación:</b> ${elev}
      `);

      // Etiqueta (si hay nombre)
      if (name) {
        const c = l.getLatLng();
        L.marker(c, {
          icon: L.divIcon({
            className: "label-campo",
            html: name,
            iconSize: [140, 24],
            iconAnchor: [70, -10],
          }),
        }).addTo(group);
      }
    },
  },

  // ----- Vías principales -----
  {
    id: "ViasPrincipales",
    label: "Vías principales",
    url: "Vias_Principales_Optimizado.geojson",
    pane: "pane_tematica",
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

  // ----- Zonas UZ -----
  {
    id: "ZonasUZ",
    label: "Zonas UZ",
    url: "Zonas_UZ.geojson",
    pane: "pane_tematica",
    style: {
      color: "#7c3aed",
      weight: 1.2,
      fillColor: "#c4b5fd",
      fillOpacity: 0.25,
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      const z = p.Zonas ?? "UZ";
      l.bindPopup(`<b>Zona:</b> ${z}`);
    },
  },

  // ----- Sectores 2022 (coropleta, optimizada) -----
  {
    id: "Sectores2022",
    label: "Sectores 2022 (coropleta)",
    // Capa NUEVA (Sector_Censal_2022) reproyectada a WGS84 y optimizada
    url: "Sector_Censal_2022_Opt.geojson",
    pane: "pane_tematica",
    choropleth: true,
    field: "Num",
    legendStep: 1,
    legendTitle: "Población 2022",
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

  // ----- Sectores 2010 (coropleta, optimizada) -----
  {
    id: "Sectores2010",
    label: "Sectores 2010 (coropleta)",
    // Capa NUEVA (Sector_Censal_2010) optimizada
    url: "Sector_Censal_2010_Opt.geojson",
    pane: "pane_tematica",
    choropleth: true,
    field: "Pob_total",
    legendStep: 1,
    legendTitle: "Población 2010",
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
  {
    id: "AreaEstudio",
    label: "Área de estudio",
    url: "Area_Estudio_Opt.geojson",
    pane: "pane_limites",
    style: {
      color: "#0f172a",
      weight: 2,
      dashArray: "6 4",
      fillOpacity: 0,
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      l.bindPopup(`<b>Área de estudio:</b> ${p.Name ?? "Molleturo"}`);
    },
  },

  // ----- Poblados de referencia (contexto, desde 2_4_Transicion) -----
  // Color y tamaño según "Catálogo de representación: mapa de transición"
  // (Poblados de estudio: HEX #000000, punto 5pt). Se mantienen visibles
  // los 49 poblados (no solo los 3 con Pob_estudi='SI' que filtra el
  // catálogo para el mapa impreso) para no perder cobertura de referencia
  // en el visor interactivo; los de Pob_estudi='SI' se resaltan más grandes.
  {
    id: "PobladosTransicion",
    label: "Poblados (referencia)",
    url: "Poblados_Opt.geojson",
    pane: "pane_puntos",
    pointToLayer: (f, latlng) => {
      const esEstudio = (f?.properties?.Pob_estudi ?? "").toString().toUpperCase() === "SI";
      return L.circleMarker(latlng, {
        radius: esEstudio ? 6 : 4,
        color: "#000000",
        weight: esEstudio ? 2 : 1,
        fillColor: "#000000",
        fillOpacity: esEstudio ? 0.9 : 0.6,
      });
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      l.bindPopup(`
        <b>Poblado:</b> ${p.nam ?? "s/i"}<br>
        <b>Población estudio:</b> ${p.Pob_estudi ?? "s/i"}
      `);
    },
  },

  // ----- Red hídrica recortada al área de estudio (contexto, desde 2_4_Transicion) -----
  // Color según catálogo (Red hidrográfica, hyp_desc='PERENNE': HEX #005CE6).
  {
    id: "RioPrincipal",
    label: "Red hídrica (área de estudio)",
    url: "Rio_Principal_Opt.geojson",
    pane: "pane_tematica",
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

async function loadLayerData(cfg) {
  const raw = await fetch(cfg.url).then((r) => r.json());
  if (cfg.type === "topo_points") {
    return topoPointsToGeoJSON(raw, cfg.topoObject || "Puntos de Campo");
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

layersConfig.forEach((cfg) => {
  const div = document.createElement("div");
  div.className = "layer-item";

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
  style: typeof cfg.style === "function" ? cfg.style.bind(cfg) : cfg.style,
  pointToLayer: cfg.pointToLayer,
  onEachFeature: wrappedOnEach,
});

group.addLayer(geo);
group.addTo(map);

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
const autoOnIds = ["Molleturo", "Comunidades", "PuntosCampo", "ZonasUZ"];

(() => {
  autoOnIds.forEach((id) => {
    const chk = document.getElementById("chk_" + id);
    if (chk) {
      chk.checked = true;
      chk.dispatchEvent(new Event("change"));
    }
  });

  setTimeout(() => {
    const lyr = layerStore.get("Molleturo");
    if (lyr) map.fitBounds(lyr.getBounds(), { padding: [50, 50] });
  }, 800);
})();

/* =========================================================
   WIDGET TRANSICIÓN MULTITEMPORAL
   Carga dinámica desde transicion_layers.json (generado por
   convertir_transicion_geojson.py a partir de 2_4_Transicion).
   No interfiere con layersConfig / layerStore / autoOnIds.
========================================================= */

const transitionState = {
  manifest: null,
  layers: [],
  dataCache: new Map(),
  leafletLayers: new Map(),
  activeIndex: 0,
  playing: false,
  timer: null,
  categoryColorMap: new Map(),
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
// SIMBOLOGÍA OFICIAL — "Catálogo de representación: mapa de transición"
// Colores exactos definidos por el equipo GIS del proyecto. Se aplican en
// dos niveles:
//  1) Por combinación exacta old_gen → new_gen (campo "trans"), para
//     RECONFIGURACIÓN_INTERNA (cuya categoría agregada no distingue el tipo
//     de cambio interno) y para las dos persistencias con textura definida
//     en el catálogo (AGRO→AGRO, PASTO_GANADERIA→PASTO_GANADERIA).
//  2) Por categoría agregada "trans_grp", para el resto.
// Fuente: "Catalogo de representacion_mapa de transicion.docx".
// =========================================================
const TRANSITION_COMBO_STYLE = {
  "AGRO → NATURAL_SECUNDARIO": { fill: "#2E8B57", label: "Reconfiguración: agropecuario → vegetación secundaria" },
  "PASTO_GANADERIA → NATURAL_SECUNDARIO": { fill: "#66A61E", label: "Reconfiguración: pastos/ganadería → vegetación secundaria" },
  "AGRO → AGUA": { fill: "#0077B6", label: "Reconfiguración: agropecuario → agua" },
  "PLANTACION → NATURAL_SECUNDARIO": { fill: "#006D5B", label: "Reconfiguración: plantación forestal → vegetación secundaria" },
  "PASTO_GANADERIA → AGUA": { fill: "#00A6D6", label: "Reconfiguración: pastos/ganadería → agua" },
  "NO_DATA → NATURAL_SECUNDARIO": { fill: "#7A8F5A", label: "Sin información previa → vegetación secundaria" },
  "NATURAL_SECUNDARIO → AGUA": { fill: "#2C7FB8", label: "Reconfiguración: vegetación secundaria → agua" },
  // Persistencias con textura en el catálogo (se aproxima con color sólido +
  // borde del color de la trama, ya que Leaflet/SVG no rellena con tramado
  // sin una librería adicional, y el proyecto debe seguir liviano).
  "AGRO → AGRO": { fill: "#F3E8D1", border: "#D9B98A", label: "Persistencia en uso agropecuario" },
  "PASTO_GANADERIA → PASTO_GANADERIA": { fill: "#EEE9C9", border: "#734C00", label: "Persistencia en pastos y ganadería" },
  "FOREST → FOREST": { fill: "#B1FDB3", label: "Persistencia en bosques" },
};

const TRANSITION_GROUP_STYLE = {
  EXPANSION_AGRO: { fill: "#C9A15A", label: "Expansión agropecuaria" },
  EXPANSION_PASTO: { fill: "#D8D88A", label: "Expansión de pastos / ganadería" },
  EXPANSION_PLANTACION: { fill: "#6DAFA3", label: "Expansión de plantaciones forestales" },
  "EXPANSION_PLANTACION_": { fill: "#6DAFA3", label: "Expansión de plantaciones forestales" },
  EXPANSION_URBANA: { fill: "#9A8FBF", label: "Expansión urbana e infraestructura" },
  GANANCIA_BOSQUE: { fill: "#7BAE7F", label: "Ganancia / recuperación de bosque" },
  PERDIDA_BOSQUE: { fill: "#B86B5E", label: "Pérdida de bosque general" },
  PERSISTENCIA_BOSQUE: { fill: "#B1FDB3", label: "Persistencia en cobertura de bosques" },
  RECONFIGURACION_INTERNA: { fill: "#8A7FAE", label: "Reconfiguración interna (otra combinación)" },
  // Categorías de persistencia que el catálogo no detalla con HEX propio:
  // se extiende la misma lógica (tonos neutros/pálidos) para mantener
  // coherencia visual sin inventar una categoría de cambio que no existe.
  PERSISTENCIA_AGUA: { fill: "#BFE3F0", label: "Persistencia en cuerpos de agua" },
  PERSISTENCIA_VEGETACION_SECUNDARIA: { fill: "#D7E8C8", label: "Persistencia en vegetación secundaria" },
  PERSISTENCIA_URBANO_E_INFRAESTRUCTURA: { fill: "#D6D2DE", label: "Persistencia urbana e infraestructura" },
  PERSISTENCIA_PLANTACION: { fill: "#CFE3DE", label: "Persistencia en plantaciones forestales" },
  PERSISTENCIA_USO_AGROPECUARIO: { fill: "#F3E8D1", border: "#D9B98A", label: "Persistencia en uso agropecuario" },
  PERSISTENCIA_USO_AGROPECUARIA: { fill: "#F3E8D1", border: "#D9B98A", label: "Persistencia en uso agropecuario" },
  PERSISTENCIA_PASTO_GANADERIA: { fill: "#EEE9C9", border: "#734C00", label: "Persistencia en pastos y ganadería" },
  SIN_INFORMACION_PERSISTENTE: { fill: "#E5E1DA", label: "Sin información (persistente)" },
};

// Resuelve el estilo oficial de una feature de transición. Prioriza la
// combinación exacta "trans" (old_gen → new_gen); si no hay match, recurre
// a la categoría agregada "trans_grp"; si tampoco hay match conocido, cae a
// una paleta genérica estable para no dejar features sin color.
function getTransitionFeatureStyle(properties, categoryField) {
  const props = properties || {};
  const transCombo = props.trans ? normalizeTransitionValue(props.trans) : null;
  if (transCombo && TRANSITION_COMBO_STYLE[transCombo]) {
    return TRANSITION_COMBO_STYLE[transCombo];
  }

  const grpRaw = props.trans_grp ?? (categoryField ? props[categoryField] : null);
  const grp = normalizeTransitionValue(grpRaw);
  if (TRANSITION_GROUP_STYLE[grp]) return TRANSITION_GROUP_STYLE[grp];

  // Variante no anticipada: asignar color estable de la paleta genérica del
  // manifiesto, en orden de primera aparición (no se inventa una categoría
  // del catálogo, solo se evita dejarla sin pintar).
  const palette = transitionState.manifest?.categoryPalette || ["#64748b"];
  const key = transCombo || grp || "SIN_DATO";
  if (!transitionState.categoryColorMap.has(key)) {
    const idx = transitionState.categoryColorMap.size;
    transitionState.categoryColorMap.set(key, palette[idx % palette.length]);
  }
  return { fill: transitionState.categoryColorMap.get(key), label: grpRaw ? String(grpRaw) : "Sin información" };
}

// Compatibilidad: algunos llamadores solo necesitan el color de relleno a
// partir de un valor de categoría suelto (p. ej. capas externas futuras).
function getTransitionColor(category) {
  return getTransitionFeatureStyle({ trans_grp: category }, null).fill;
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

  const isOutline = TRANSITION_OUTLINE_ONLY_IDS.has(layerCfg.id);
  const categoryLine = isOutline
    ? ""
    : `<b>Categoría:</b> ${htmlEscape(getTransitionFeatureStyle(props, layerCfg._resolvedCategoryField).label)}<br>`;

  return `
    <b>${htmlEscape(layerCfg.label)}</b><br>
    <b>Periodo:</b> ${htmlEscape(layerCfg.timeLabel || "s/i")}<br>
    ${categoryLine}
    ${rows}
  `;
}

// Capas cuyo rol, según el catálogo de representación, es servir como
// contorno de referencia constante ("Cobertura de cacao") y no como
// polígono categórico de cambio. Se identifican por id de capa.
const TRANSITION_OUTLINE_ONLY_IDS = new Set(["transicion_tr0020_cacao"]);
const CACAO_OUTLINE_STYLE = { color: "#732600", weight: 1.2, opacity: 0.9, fillOpacity: 0 };

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
  const outlineOnly = TRANSITION_OUTLINE_ONLY_IDS.has(layerCfg.id);

  const geo = L.geoJSON(data, {
    pane: "pane_transicion",
    style: (feature) => {
      if (outlineOnly) return CACAO_OUTLINE_STYLE;

      const info = getTransitionFeatureStyle(feature.properties, categoryField);
      return {
        ...defaultStyle,
        color: info.border || info.fill,
        weight: info.border ? 1.4 : defaultStyle.weight,
        fillColor: info.fill,
        fillOpacity: opacity,
      };
    },
    pointToLayer: (feature, latlng) => {
      if (outlineOnly) {
        return L.circleMarker(latlng, { radius: 5, ...CACAO_OUTLINE_STYLE, fillOpacity: 0 });
      }
      const info = getTransitionFeatureStyle(feature.properties, categoryField);
      return L.circleMarker(latlng, {
        radius: 5,
        color: info.border || info.fill,
        weight: 1,
        fillColor: info.fill,
        fillOpacity: opacity,
      });
    },
    onEachFeature: (feature, layer) => {
      layer.bindPopup(buildTransitionPopup(feature, layerCfg));
    },
  });

  return geo;
}

function removeAllTransitionLayers() {
  transitionState.leafletLayers.forEach((lyr) => map.removeLayer(lyr));
  transitionState.leafletLayers.clear();
}

async function showTransitionIndex(index) {
  const els = transitionEls();
  const layers = transitionState.layers;
  if (!layers.length) return;

  const boundedIndex = Math.max(0, Math.min(index, layers.length - 1));
  transitionState.activeIndex = boundedIndex;

  const keepPrevious = !!els.keepPrevious?.checked;
  if (!keepPrevious) removeAllTransitionLayers();

  const selectedLayers = keepPrevious
    ? layers.slice(0, boundedIndex + 1)
    : [layers[boundedIndex]];

  for (const layerCfg of selectedLayers) {
    if (transitionState.leafletLayers.has(layerCfg.id)) continue;
    const data = await loadTransitionData(layerCfg);
    const lyr = createTransitionLeafletLayer(layerCfg, data);
    lyr.addTo(map);
    transitionState.leafletLayers.set(layerCfg.id, lyr);
  }

  if (!keepPrevious) {
    const currentId = layers[boundedIndex].id;
    transitionState.leafletLayers.forEach((lyr, id) => {
      if (id !== currentId) {
        map.removeLayer(lyr);
        transitionState.leafletLayers.delete(id);
      }
    });
  }

  if (els.slider) els.slider.value = String(boundedIndex);
  if (els.label) {
    const cfg = layers[boundedIndex];
    els.label.textContent = `${cfg.timeLabel || cfg.label} · ${cfg.featureCount ?? ""} elementos`;
  }

  updateTransitionCheckboxes();
  updateTransitionLegend();

  try {
    const currentLayer = transitionState.leafletLayers.get(layers[boundedIndex].id);
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
  transitionState.leafletLayers.forEach((lyr, id) => {
    // La capa de referencia (cobertura de cacao) es un contorno fijo según
    // el catálogo de representación: el slider de opacidad de transición no
    // debe rellenarla ni alterar su trazo.
    if (TRANSITION_OUTLINE_ONLY_IDS.has(id)) return;
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

  const categories = new Map();
  transitionState.leafletLayers.forEach((_, id) => {
    const cfg = transitionState.layers.find((l) => l.id === id);
    const data = transitionState.dataCache.get(id);
    if (!cfg || !data?.features) return;

    if (TRANSITION_OUTLINE_ONLY_IDS.has(cfg.id)) {
      categories.set("cobertura_cacao", { fill: CACAO_OUTLINE_STYLE.color, label: "Cobertura de cacao (referencia)" });
      return;
    }

    const field = cfg._resolvedCategoryField || cfg.categoryField;
    data.features.forEach((ft) => {
      const info = getTransitionFeatureStyle(ft.properties, field);
      const key = info.label || "Sin información";
      if (!categories.has(key)) categories.set(key, info);
    });
  });

  const rows = Array.from(categories.values()).slice(0, 20).map((info) => `
    <div class="legend-row">
      <span class="legend-swatch" style="background:${info.fill}${info.border ? `;border:2px solid ${info.border}` : ""}"></span>
      <span class="legend-range">${htmlEscape(info.label)}</span>
    </div>
  `).join("");

  const activeLabels = Array.from(transitionState.leafletLayers.keys())
    .map((id) => transitionState.layers.find((l) => l.id === id)?.timeLabel)
    .filter(Boolean)
    .join(", ");

  mapEl.innerHTML = `
    <div class="map-legend-wrap">
      <div class="legend-card">
        <div class="legend-title">Transición ${htmlEscape(activeLabels)}</div>
        ${rows || "<p>Sin categorías detectadas</p>"}
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
  if (!transitionState.layers.length) return;

  transitionState.playing = true;
  if (els.play) els.play.textContent = "⏸";

  transitionState.timer = window.setInterval(() => {
    const next = transitionState.activeIndex + 1 >= transitionState.layers.length
      ? 0
      : transitionState.activeIndex + 1;
    showTransitionIndex(next);
  }, 1400);
}

function toggleTransitionAnimation() {
  if (transitionState.playing) stopTransitionAnimation();
  else startTransitionAnimation();
}

function renderTransitionLayerList() {
  const els = transitionEls();
  if (!els.list) return;

  els.list.innerHTML = transitionState.layers.map((cfg, idx) => `
    <div class="transition-layer-item">
      <input
        type="checkbox"
        id="transition_chk_${htmlEscape(cfg.id)}"
        data-transition-layer="${htmlEscape(cfg.id)}"
        data-transition-index="${idx}"
      />
      <label for="transition_chk_${htmlEscape(cfg.id)}">
        ${htmlEscape(cfg.timeLabel || cfg.label)}
      </label>
    </div>
  `).join("");

  els.list.addEventListener("change", async (e) => {
    const chk = e.target;
    if (!chk?.dataset?.transitionLayer) return;
    const idx = Number(chk.dataset.transitionIndex);

    if (chk.checked) {
      transitionState.activeIndex = idx;
      const cfg = transitionState.layers[idx];
      const data = await loadTransitionData(cfg);
      if (!transitionState.leafletLayers.has(cfg.id)) {
        const lyr = createTransitionLeafletLayer(cfg, data);
        lyr.addTo(map);
        transitionState.leafletLayers.set(cfg.id, lyr);
      }
      if (els.slider) els.slider.value = String(idx);
      if (els.label) els.label.textContent = `${cfg.timeLabel || cfg.label} · ${cfg.featureCount ?? ""} elementos`;
    } else {
      const cfg = transitionState.layers[idx];
      const lyr = transitionState.leafletLayers.get(cfg.id);
      if (lyr) {
        map.removeLayer(lyr);
        transitionState.leafletLayers.delete(cfg.id);
      }
    }

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

    if (!transitionState.layers.length) {
      els.status.textContent = "No hay capas de transición registradas.";
      return;
    }

    els.status.textContent = `${transitionState.layers.length} capas de transición disponibles`;

    if (els.slider) {
      els.slider.disabled = false;
      els.slider.min = "0";
      els.slider.max = String(transitionState.layers.length - 1);
      els.slider.value = "0";
      els.slider.addEventListener("input", (e) => showTransitionIndex(Number(e.target.value)));
    }

    els.prev?.addEventListener("click", () => {
      const next = transitionState.activeIndex - 1 < 0
        ? transitionState.layers.length - 1
        : transitionState.activeIndex - 1;
      showTransitionIndex(next);
    });

    els.next?.addEventListener("click", () => {
      const next = transitionState.activeIndex + 1 >= transitionState.layers.length
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
