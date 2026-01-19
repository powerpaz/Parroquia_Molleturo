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
const mapLegend = L.control({ position: "bottomright" });
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

// Construye rangos a partir de min/breaks/max
function buildRanges(minVal, breaks, maxVal) {
  const ranges = [];
  let a = minVal;
  for (let i = 0; i < breaks.length; i++) {
    const b = breaks[i];
    ranges.push([a, b]);
    a = b;
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

  const blocks = activeChoros.map((cfg) => {
    const breaks = cfg.classBreaks?.breaks || cfg._breaks || [];
    const minV = (typeof cfg.classBreaks?.min === "number")
      ? cfg.classBreaks.min
      : (typeof cfg._minVal === "number" ? cfg._minVal : 0);
    const maxV = (typeof cfg.classBreaks?.max === "number")
      ? cfg.classBreaks.max
      : (typeof cfg._maxVal === "number" ? cfg._maxVal : (breaks.length ? breaks[breaks.length - 1] : minV));
    const palette = cfg.palette || [];

    const ranges = buildRanges(minV, breaks, maxV);

    const rows = ranges.map((r, i) => {
        const color = palette[Math.min(i, palette.length - 1)] || "#ddd";
        const a = fmt6(r[0]);
        const b = fmt6(r[1]);
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

  const html = blocks.join("\n");
  if (sidebarEl) sidebarEl.innerHTML = html;
  if (mapEl) mapEl.innerHTML = html;
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
    onEachFeature: (f, l) => {
      const nombre = f.properties?.Nombre ?? "Molleturo";
      l.bindPopup(`<b>Parroquia:</b> ${nombre}`);

      // Etiqueta de la parroquia
      const c = l.getBounds().getCenter();
      L.marker(c, {
        icon: L.divIcon({
          className: "label-text",
          html: nombre,
        }),
      }).addTo(map);
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
    onEachFeature: (f, l) => {
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
      }).addTo(map);
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
        }).addTo(map);
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
    url: "Sectores_2022_Optimizado.geojson",
    pane: "pane_tematica",
    choropleth: true,
    field: "Num",
    legendTitle: "Num",
    // Discretización: cortes fijos (como tu captura)
    classBreaks: {
      min: 0,
      breaks: [6, 116, 209, 310, 421],
      max: 863,
    },
    palette: [
      "#eff6ff",
      "#bfdbfe",
      "#93c5fd",
      "#60a5fa",
      "#2563eb",
      "#1e40af",
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
      const sector = p.sector ?? p.sec ?? "(sin sector)";
      const total = p.Num ?? "s/i";
      const anio = p.anio ?? "2022";
      l.bindPopup(
        `<b>Sector:</b> ${sector}<br>` +
          `<b>Año:</b> ${anio}<br>` +
          `<b>Total (Num):</b> ${total}`
      );
    },
  },

  // ----- Sectores 2010 (coropleta, optimizada) -----
  {
    id: "Sectores2010",
    label: "Sectores 2010 (coropleta)",
    url: "Sectores_2010_Optimizado.geojson",
    pane: "pane_tematica",
    choropleth: true,
    field: "Pob_total",
    legendTitle: "Pob_total",
    // Discretización: cortes fijos (como tu captura)
    classBreaks: {
      min: 6,
      breaks: [116, 209, 310, 421],
      max: 766,
    },
    // Paleta pastel (secuencial)
    palette: [
      "#f7f7ff",
      "#e6e6fa",
      "#cfcff3",
      "#b5b5eb",
      "#9a9ae3",
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
      const sector = p.sector ?? p.DPA_SECTOR ?? "(sin código)";
      const parroquia = p.parroquia ?? p.PARROQ ?? "Molleturo";
      const anio = p.anio ?? "2010";
      const pob = p.Pob_total ?? "s/i";
      l.bindPopup(
        `<b>Sector:</b> ${sector}<br>` +
          `<b>Parroquia:</b> ${parroquia}<br>` +
          `<b>Año:</b> ${anio}<br>` +
          `<b>Población total:</b> ${pob}`
      );
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

  // Control anti-lag: si el usuario prende/apaga rápido, evitamos que una
  // descarga tardía vuelva a “encender” una capa ya apagada.
  cfg._toggleToken = (cfg._toggleToken || 0) + 1;
  const token = cfg._toggleToken;

  if (e.target.checked) {
    const data = await loadLayerData(cfg);

    // Si mientras cargaba el usuario apagó la capa, no la agregamos.
    const chkNow = document.getElementById("chk_" + id);
    if (!chkNow || !chkNow.checked || token !== cfg._toggleToken) {
      updateSidebarLegend();
      return;
    }

    const layer = L.geoJSON(data, {
      pane: cfg.pane,
      style:
        typeof cfg.style === "function" ? cfg.style.bind(cfg) : cfg.style,
      pointToLayer: cfg.pointToLayer,
      onEachFeature: cfg.onEachFeature,
    });

    layer.addTo(map);
    // Mejor interacción: asegurar que quede arriba en su pane
    if (typeof layer.bringToFront === "function") layer.bringToFront();
    layerStore.set(id, layer);
  } else {
    const lyr = layerStore.get(id);
    if (lyr) {
      map.removeLayer(lyr);
      layerStore.delete(id);
    }
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
