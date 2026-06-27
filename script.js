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
        color: "#5b21b6",
        weight: 1.5,
        fillColor: "#8b5cf6",
        fillOpacity: 0.95,
      }),
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      const name = p.Name ?? p.NOMBRE ?? p.nombre ?? "Punto";
      const dt = p.DateTimeS ?? p.fecha ?? "";
      const elev = p.Elevation ?? p.elev ?? "";

      l.bindPopup(`
        <b>Nombre:</b> ${name}<br>
        <b>Fecha/Hora:</b> ${dt}<br>
        <b>Elevación:</b> ${elev}
      `);
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
      // bubbles:true es obligatorio: el listener real está delegado en
      // layerListEl (el contenedor), y un Event sin bubbles nunca llega ahí,
      // por lo que las capas auto-on quedaban "marcadas" pero sin dibujarse.
      chk.dispatchEvent(new Event("change", { bubbles: true }));
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
    "AGRO → AGUA": { fill: "#3485C4", label: "Reconfiguración: agropecuario → agua" },
  },
  [ID_2000_2020]: {
    "PASTO_GANADERIA → NATURAL_SECUNDARIO": { fill: "#80B143", label: "Reconfiguración: pastos/ganadería → vegetación secundaria" },
    "PLANTACION → NATURAL_SECUNDARIO": { fill: "#C5E9FF", label: "Reconfiguración: plantación forestal → vegetación secundaria" },
    "PASTO_GANADERIA → AGUA": { fill: "#33ACDA", label: "Reconfiguración: pastos/ganadería → agua" },
    "NO_DATA → NATURAL_SECUNDARIO": { fill: "#8CA176", label: "Sin información previa → vegetación secundaria" },
  },
  [ID_2020_2022]: {
    "NATURAL_SECUNDARIO → AGUA": { fill: "#4892C0", label: "Reconfiguración: vegetación secundaria → agua" },
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
function ensureTransitionPatterns() {
  if (transitionState.patternsReady) return;
  const pane = map.getPane("pane_transicion");
  const svg = pane?.querySelector("svg");
  if (!svg) return;

  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.insertBefore(defs, svg.firstChild);
  }

  const specs = [
    { id: "hatchAgro", bg: "#F3E8D1", line: "#D9B98A" },
    { id: "dotPasto", bg: "#EEE9C9", dot: "#734C00" },
    { id: "dotAgua", bg: "#A8ECFD", dot: "#2C7FB8" },
  ];

  specs.forEach((spec) => {
    if (defs.querySelector(`#${spec.id}`)) return;
    const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    pattern.setAttribute("id", spec.id);
    pattern.setAttribute("width", "8");
    pattern.setAttribute("height", "8");
    pattern.setAttribute("patternUnits", "userSpaceOnUse");
    if (spec.line) pattern.setAttribute("patternTransform", "rotate(45)");

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", "8");
    rect.setAttribute("height", "8");
    rect.setAttribute("fill", spec.bg);
    pattern.appendChild(rect);

    if (spec.line) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", "0");
      line.setAttribute("y1", "0");
      line.setAttribute("x2", "0");
      line.setAttribute("y2", "8");
      line.setAttribute("stroke", spec.line);
      line.setAttribute("stroke-width", "2.5");
      pattern.appendChild(line);
    }
    if (spec.dot) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "4");
      circle.setAttribute("cy", "4");
      circle.setAttribute("r", "1.6");
      circle.setAttribute("fill", spec.dot);
      pattern.appendChild(circle);
    }
    defs.appendChild(pattern);
  });

  transitionState.patternsReady = true;
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

  // Nota: este checkbox controla la capa de forma manual (modo "combinar"),
  // independiente del índice del slider de los 3 escenarios — por eso no
  // toca transitionState.activeIndex ni el slider.
  els.list.addEventListener("change", async (e) => {
    const chk = e.target;
    if (!chk?.dataset?.transitionLayer) return;
    const idx = Number(chk.dataset.transitionIndex);
    const cfg = transitionState.layers[idx];
    if (!cfg) return;

    if (chk.checked) {
      await addTransitionLayerToMap(cfg);
    } else {
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
