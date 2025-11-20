/* =========================================================
   Geovisor Agrícola – Parroquia Molleturo
   Estética Mapbox + Código Reparado + UI Limpia
========================================================= */

/* =========================================================
   1) MAPAS BASE (Mapbox-like, sin API)
========================================================= */
const basemaps = {
  stadiamaps: L.tileLayer(
    "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
    { attribution: "&copy; Stadia Maps & OSM" }
  ),

  carto: L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    { attribution: "&copy; OSM & CARTO" }
  ),

  osm: L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "&copy; OpenStreetMap" }
  ),

  esri: L.tileLayer(
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "&copy; Esri" }
  ),

  toner: L.tileLayer(
    "https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png",
    { attribution: "&copy; Stamen" }
  )
};

/* =========================================================
   2) INICIAR MAPA
========================================================= */
const map = L.map("map", {
  center: [-2.62, -79.46],
  zoom: 12,
  layers: [basemaps.stadiamaps]
});

// Cambiar mapas base
document.getElementById("basemap").addEventListener("change", e => {
  const selected = e.target.value;
  Object.values(basemaps).forEach(b => map.removeLayer(b));
  basemaps[selected].addTo(map);
});

/* =========================================================
   3) PANES
========================================================= */
map.createPane("pane_limites").style.zIndex = 400;
map.createPane("pane_tematica").style.zIndex = 500;
map.createPane("pane_puntos").style.zIndex = 600;

/* =========================================================
   4) CAPAS (ARCHIVOS REALES DE TU REPO)
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
      fillOpacity: 0
    },

    onEachFeature: (f, l) => {
      const nombre = f.properties?.Nombre ?? "Molleturo";

      l.bindPopup(`<b>Parroquia:</b> ${nombre}`);

      const center = l.getBounds().getCenter();
      L.marker(center, {
        icon: L.divIcon({
          className: "label-text",
          html: nombre
        })
      }).addTo(map);
    }
  },

  // ---------- Comunidades ----------
  {
    id: "Comunidades",
    label: "Comunidades",
    url: "Puntos_de_Estudio.geojson",
    pane: "pane_puntos",

    pointToLayer: (f, latlng) =>
      L.circleMarker(latlng, {
        radius: 6,
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.9,
        weight: 1
      }),

    onEachFeature: (f, l) => {
      const p = f.properties;
      const nombre = p?.Nombre ?? p?.nam ?? "Sin nombre";

      l.bindPopup(`
        <b>Comunidad:</b> ${nombre}<br>
        <b>Población estudio:</b> ${p?.Pob_estudi ?? "s/i"}
      `);

      L.marker(l.getLatLng(), {
        icon: L.divIcon({
          className: "label-text",
          html: nombre
        })
      }).addTo(map);
    }
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
      fillOpacity: 0.25
    },

    onEachFeature: (f, l) => {
      l.bindPopup(`<b>ZAE:</b> ${f.properties?.CLASIFICAC ?? "s/i"}`);
    }
  }
];

/* =========================================================
   5) PANEL DE CAPAS
========================================================= */
const layerStore = new Map();
const layerListEl = document.getElementById("layerList");

layersConfig.forEach(cfg => {
  const div = document.createElement("div");
  div.className = "layer-item";

  const chk = document.createElement("input");
  chk.type = "checkbox";
  chk.dataset.layer = cfg.id;
  chk.id = "chk_" + cfg.id;

  const label = document.createElement("label");
  label.textContent = cfg.label;
  label.htmlFor = chk.id;

  div.appendChild(chk);
  div.appendChild(label);
  layerListEl.appendChild(div);
});

/* =========================================================
   6) ACTIVAR / DESACTIVAR CAPAS
========================================================= */
layerListEl.addEventListener("change", async e => {
  const id = e.target.dataset.layer;
  const cfg = layersConfig.find(c => c.id === id);
  if (!cfg) return;

  if (e.target.checked) {
    const data = await fetch(cfg.url).then(r => r.json());

    const layer = L.geoJSON(data, {
      pane: cfg.pane,
      style: cfg.style,
      pointToLayer: cfg.pointToLayer,
      onEachFeature: cfg.onEachFeature
    });

    layer.addTo(map);
    layerStore.set(id, layer);

  } else {
    const layer = layerStore.get(id);
    if (layer) map.removeLayer(layer);
  }
});

/* =========================================================
   7) AUTO-CARGA LÍMITE PARROQUIAL
========================================================= */
(async () => {
  const chk = document.getElementById("chk_Molleturo");
  chk.checked = true;
  chk.dispatchEvent(new Event("change"));

  setTimeout(() => {
    const layer = layerStore.get("Molleturo");
    if (layer) map.fitBounds(layer.getBounds(), { padding: [40, 40] });
  }, 700);
})();
