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
        color: "#0f172a",
        weight: 1,
        opacity: 0.6,
        fillColor: color,
        fillOpacity: 0.6,
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
  // Si es coroplético, calculamos breaks 1 sola vez (y los guardamos en cfg)
  if (cfg.choropleth && !cfg._breaks && raw?.features?.length) {
    const vals = raw.features
      .map((ft) => ft?.properties?.[cfg.field])
      .filter((x) => typeof x === 'number' && isFinite(x));
    cfg._breaks = computeQuantileBreaks(vals, 5);
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

  if (e.target.checked) {
    const data = await loadLayerData(cfg);
    const layer = L.geoJSON(data, {
      pane: cfg.pane,
      style:
        typeof cfg.style === "function" ? cfg.style.bind(cfg) : cfg.style,
      pointToLayer: cfg.pointToLayer,
      onEachFeature: cfg.onEachFeature,
    });

    layer.addTo(map);
    layerStore.set(id, layer);
  } else {
    const lyr = layerStore.get(id);
    if (lyr) map.removeLayer(lyr);
  }
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
