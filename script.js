/* =========================================================
   Geovisor Agrícola – Estética MAPBOX Light
   Versión con puntos mejorados y capa de cacao
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
  layers: [basemaps.voyager]
});

/* Cambiar mapas base */
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
   CAPAS
========================================================= */
const layersConfig = [
  // ---------- Límite parroquial ----------
  {
    id: "Molleturo",
    label: "Límite Parroquial",
    url: "Parroquia_MolleturoJSON.geojson",
    pane: "pane_limites",
    style: {
      color: "#0284c7",
      weight: 2,
      fillOpacity: 0,
    },
    onEachFeature: (f, l) => {
      const nombre = f.properties?.Nombre ?? "Molleturo";
      l.bindPopup(`<b>Parroquia:</b> ${nombre}`);
      const c = l.getBounds().getCenter();
      L.marker(c, {
        icon: L.divIcon({
          className: "label-text",
          html: nombre,
        }),
      }).addTo(map);
    },
  },

  // ---------- Comunidades / Puntos de estudio ----------
  {
    id: "Comunidades",
    label: "Comunidades / Puntos de estudio",
    url: "Puntos_de_Estudio.geojson",
    pane: "pane_puntos",
    pointToLayer: (f, latlng) =>
      L.circleMarker(latlng, {
        radius: 6,
        color: "#0f172a",      // borde oscuro
        weight: 1.5,
        fillColor: "#22c55e",  // verde tipo Mapbox
        fillOpacity: 0.95,
      }),
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      const nombre = p.Nombre ?? p.nam ?? "Sin nombre";
      const pob = p.Pob_estudi ?? "s/i";
      l.bindPopup(`
        <b>Comunidad:</b> ${nombre}<br>
        <b>Población estudio:</b> ${pob}
      `);
      // No añadimos labels extra para no saturar el mapa.
    },
  },

  // ---------- ZAE 2020 ----------
  {
    id: "ZAE2020",
    label: "ZAE 2020",
    url: "Zae_2020JSON.geojson",
    pane: "pane_tematica",
    style: {
      color: "#0ea5e9",
      weight: 1,
      fillOpacity: 0.25,
    },
    onEachFeature: (f, l) => {
      l.bindPopup(`<b>ZAE:</b> ${f.properties?.CLASIFICAC ?? "s/i"}`);
    },
  },

  // ---------- Áreas de cultivo de cacao ----------
  {
    id: "Cacao",
    label: "Áreas de cultivo de cacao",
    url: "Cacao Areas de Cultivo.geojson",
    pane: "pane_tematica",
    style: {
      color: "#047857",        // borde verde oscuro
      weight: 1,
      fillColor: "#22c55e",    // relleno verde brillante
      fillOpacity: 0.45,
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      const label = p.label ?? p.niv5 ?? "Cacao";
      let areaTxt = "s/i";
      if (typeof p.sce === "number") {
        areaTxt = `${p.sce.toFixed(2)} ${p.usce || ""}`;
      }
      l.bindPopup(`
        <b>Etiqueta:</b> ${label}<br>
        <b>Tamaño de parcela:</b> ${p.tap ?? "s/i"}<br>
        <b>Uso:</b> ${p.uso ?? "s/i"}<br>
        <b>Área:</b> ${areaTxt}
      `);
    },
  },
];

/* =========================================================
   PANEL LATERAL
========================================================= */
const layerStore = new Map();
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
    const data = await fetch(cfg.url).then((r) => r.json());
    const layer = L.geoJSON(data, {
      pane: cfg.pane,
      style: cfg.style,
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
   CARGA AUTOMÁTICA DEL LÍMITE
========================================================= */
(() => {
  const chk = document.getElementById("chk_Molleturo");
  if (chk) {
    chk.checked = true;
    chk.dispatchEvent(new Event("change"));
  }
  setTimeout(() => {
    const lyr = layerStore.get("Molleturo");
    if (lyr) map.fitBounds(lyr.getBounds(), { padding: [50, 50] });
  }, 700);
})();

