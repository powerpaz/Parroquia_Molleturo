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
