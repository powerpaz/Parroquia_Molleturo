/* =========================================================
   Geovisor Agrícola – Estética MAPBOX Light
   Versión con Cacao rayado y sin ZAE en el panel
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

/* Selector de mapa base */
document.getElementById("basemap").addEventListener("change", e => {
  const selected = e.target.value;
  Object.values(basemaps).forEach(b => map.removeLayer(b));
  basemaps[selected].addTo(map);
});

/* =========================================================
   PATRÓN RAYADO PARA CACAO (con fallback)
========================================================= */
let cacaoPattern = null;
try {
  if (L.StripePattern) {
    cacaoPattern = new L.StripePattern({
      weight: 2,
      spaceWeight: 4,
      color: "#000000",
      opacity: 0.7,
      angle: 45
    }).addTo(map);
  }
} catch (err) {
  console.warn("No se pudo cargar leaflet.pattern, usando relleno sólido.", err);
}

/* =========================================================
   PANES
========================================================= */
map.createPane("pane_limites").style.zIndex = 400;
map.createPane("pane_tematica").style.zIndex = 500;
map.createPane("pane_puntos").style.zIndex = 600;

/* =========================================================
   DEFINICIÓN DE CAPAS
========================================================= */
const layersConfig = [

  // ----- Límite parroquial -----
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
      const c = l.getBounds().getCenter();
      L.marker(c, {
        icon: L.divIcon({
          className: "label-text",
          html: nombre
        })
      }).addTo(map);
    }
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
        fillOpacity: 0.95
      }),
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      const nombre = p.Nombre ?? p.nam ?? "Sin nombre";
      const pob = p.Pob_estudi ?? "s/i";
      l.bindPopup(`
        <b>Comunidad:</b> ${nombre}<br>
        <b>Población estudio:</b> ${pob}
      `);
    }
  },

  // ----- Cacao Areas de Cultivo (rayado o sólido) -----
  {
    id: "Cacao",
    label: "Áreas de cultivo de cacao",
    url: "Cacao Areas de Cultivo.geojson",
    pane: "pane_tematica",
    style: () => {
      const base = {
        color: "#047857",
        weight: 1
      };
      if (cacaoPattern) {
        base.fillPattern = cacaoPattern;
      } else {
        base.fillColor = "#bbf7d0";
        base.fillOpacity = 0.6;
      }
      return base;
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      const label = p.label ?? "Cacao";
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
    }
  },

  // ----- Conflictos -----
  {
    id: "Conflictos",
    label: "Conflictos aptitud de uso",
    url: "conflictos_apt_usoJSON.geojson",
    pane: "pane_tematica",
    style: {
      color: "#dc2626",
      weight: 1,
      fillOpacity: 0.25
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      const nombre = p.label ?? p.simbolgia ?? "Conflicto";
      l.bindPopup(`<b>Conflicto:</b> ${nombre}`);
    }
  },

  // ----- Sectores 2010 -----
  {
    id: "Sectores2010",
    label: "Sectores 2010",
    url: "Sectores_2010JSON.geojson",
    pane: "pane_tematica",
    style: {
      color: "#4b5563",
      weight: 0.8,
      fillOpacity: 0.12
    },
    onEachFeature: (f, l) => {
      l.bindPopup(`<b>Sector 2010</b>`);
    }
  },

  // ----- Sectores 2022 -----
  {
    id: "Sectores2022",
    label: "Sectores 2022",
    url: "Sectores_2022JSON.geojson",
    pane: "pane_tematica",
    style: {
      color: "#7c3aed",
      weight: 0.8,
      fillOpacity: 0.12
    },
    onEachFeature: (f, l) => {
      l.bindPopup(`<b>Sector 2022</b>`);
    }
  },

  // ----- Uso 2015 -----
  {
    id: "Uso2015",
    label: "Uso del suelo 2015",
    url: "Uso_2015JSON.geojson",
    pane: "pane_tematica",
    style: {
      color: "#f97316",
      weight: 0.8,
      fillOpacity: 0.20
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      const nombre = p.label ?? p.uso ?? "Uso";
      l.bindPopup(`<b>Uso 2015:</b> ${nombre}`);
    }
  },

  // ----- Capacidad de uso 2021 -----
  {
    id: "Capacidad2021",
    label: "Capacidad de uso 2021",
    url: "Capacidad_uso_2021JSON.json",
    pane: "pane_tematica",
    style: {
      color: "#16a34a",
      weight: 0.8,
      fillOpacity: 0.20
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      const nombre = p.label ?? p.simbolgia ?? "Capacidad";
      l.bindPopup(`<b>Capacidad 2021:</b> ${nombre}`);
    }
  },

  // ----- Aptitud Agrícola -----
  {
    id: "Aptitud",
    label: "Aptitud agrícola",
    url: "ActitudAgricolaJSON.json",
    pane: "pane_tematica",
    style: {
      color: "#22c55e",
      weight: 0.8,
      fillOpacity: 0.20
    },
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      const nombre = p.label ?? p.simbolgia ?? "Aptitud agrícola";
      l.bindPopup(`<b>Aptitud agrícola:</b> ${nombre}`);
    }
  }

  // 🔹 ZAE2014 y ZAE2020 eliminadas del panel (no están en layersConfig)
];

/* =========================================================
   PANEL LATERAL
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
    const lyr = layerStore.get(id);
    if (lyr) map.removeLayer(lyr);
  }
});

/* =========================================================
   ARRANQUE: CAPAS PRENDIDAS POR DEFECTO
========================================================= */
const autoOnIds = [
  "Molleturo",
  "Comunidades",
  "Cacao",
  "Conflictos",
  "Sectores2010",
  "Sectores2022",
  "Uso2015",
  "Capacidad2021",
  "Aptitud"
];

(() => {
  autoOnIds.forEach(id => {
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
