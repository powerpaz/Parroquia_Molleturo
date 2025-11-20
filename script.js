/* =========================================================
   Geovisor Agrícola – Estética MAPBOX mejorada
========================================================= */

/* =========================================================
   MAPAS BASE (con estética Mapbox)
========================================================= */
const basemaps = {
  voyager: L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    { 
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }
  ),
  positron: L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    { 
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }
  ),
  osm: L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { 
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }
  ),
  esri: L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { 
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      maxZoom: 19
    }
  ),
};

/* =========================================================
   INICIAR MAPA con controles mejorados
========================================================= */
const map = L.map("map", {
  center: [-2.62, -79.46],
  zoom: 12,
  layers: [basemaps.voyager],
  zoomControl: false, // Vamos a añadir uno personalizado después
  attributionControl: true
});

// Control de zoom estilo Mapbox
L.control.zoom({
  position: 'topright',
  zoomInTitle: 'Acercar',
  zoomOutTitle: 'Alejar'
}).addTo(map);

// Control de atribución más compacto
map.attributionControl.setPrefix('<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet</a>');

/* Selector de mapa base */
document.getElementById("basemap").addEventListener("change", e => {
  const selected = e.target.value;
  Object.values(basemaps).forEach(b => {
    if (map.hasLayer(b)) {
      map.removeLayer(b);
    }
  });
  basemaps[selected].addTo(map);
});

/* =========================================================
   PATRÓN RAYADO MEJORADO PARA CACAO
========================================================= */
let cacaoPattern = null;
try {
  if (L.StripePattern) {
    cacaoPattern = new L.StripePattern({
      weight: 2,
      spaceWeight: 3,
      color: "#065f46",
      opacity: 0.6,
      angle: 45
    }).addTo(map);
  }
} catch (err) {
  console.warn("No se pudo cargar leaflet.pattern, usando relleno sólido.", err);
}

/* =========================================================
   PANES con z-index mejorado
========================================================= */
map.createPane("pane_limites").style.zIndex = 410;
map.createPane("pane_tematica").style.zIndex = 420;
map.createPane("pane_puntos").style.zIndex = 430;

/* =========================================================
   DEFINICIÓN DE CAPAS - Estilos mejorados
========================================================= */
const layersConfig = [
  {
    id: "Molleturo",
    label: "Límite Parroquial",
    url: "Parroquia_MolleturoJSON.geojson",
    pane: "pane_limites",
    style: {
      color: "#1e40af",
      weight: 3,
      opacity: 0.8,
      fillOpacity: 0,
      dashArray: "5, 5"
    },
    onEachFeature: (f, l) => {
      const nombre = f.properties?.Nombre ?? "Molleturo";
      l.bindPopup(`
        <div class="popup-content">
          <h4>${nombre}</h4>
          <p><strong>Parroquia:</strong> ${nombre}</p>
        </div>
      `);
      
      // Labels más elegantes
      const c = l.getBounds().getCenter();
      L.marker(c, {
        icon: L.divIcon({
          className: "label-text",
          html: nombre,
          iconSize: [100, 20]
        })
      }).addTo(map);
    }
  },
  {
    id: "Comunidades",
    label: "Comunidades / Puntos de estudio",
    url: "Puntos_de_Estudio.geojson",
    pane: "pane_puntos",
    pointToLayer: (f, latlng) =>
      L.circleMarker(latlng, {
        radius: 7,
        color: "#ffffff",
        weight: 2,
        fillColor: "#059669",
        fillOpacity: 0.9
      }),
    onEachFeature: (f, l) => {
      const p = f.properties || {};
      const nombre = p.Nombre ?? p.nam ?? "Sin nombre";
      const pob = p.Pob_estudi ?? "s/i";
      l.bindPopup(`
        <div class="popup-content">
          <h4>${nombre}</h4>
          <p><strong>Población estudio:</strong> ${pob}</p>
        </div>
      `);
    }
  },
  {
    id: "Cacao",
    label: "Áreas de cultivo de cacao",
    url: "Cacao Areas de Cultivo.geojson",
    pane: "pane_tematica",
    style: () => {
      const base = {
        color: "#065f46",
        weight: 1.5,
        opacity: 0.8,
        fillOpacity: 0.3
      };
      if (cacaoPattern) {
        base.fillPattern = cacaoPattern;
        base.fillOpacity = 0.6;
      } else {
        base.fillColor = "#10b981";
        base.fillOpacity = 0.4;
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
        <div class="popup-content">
          <h4>${label}</h4>
          <p><strong>Tamaño de parcela:</strong> ${p.tap ?? "s/i"}</p>
          <p><strong>Uso:</strong> ${p.uso ?? "s/i"}</p>
          <p><strong>Área:</strong> ${areaTxt}</p>
        </div>
      `);
    }
  }
];

/* =========================================================
   PANEL LATERAL MEJORADO
========================================================= */
const layerStore = new Map();
const layerListEl = document.getElementById("layerList");

// Crear elementos de la interfaz
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
   GESTIÓN DE CAPAS
========================================================= */
layerListEl.addEventListener("change", async e => {
  const id = e.target.dataset.layer;
  const cfg = layersConfig.find(c => c.id === id);
  if (!cfg) return;

  if (e.target.checked) {
    try {
      const data = await fetch(cfg.url).then(r => r.json());
      const layer = L.geoJSON(data, {
        pane: cfg.pane,
        style: cfg.style,
        pointToLayer: cfg.pointToLayer,
        onEachFeature: cfg.onEachFeature
      });
      layer.addTo(map);
      layerStore.set(id, layer);
    } catch (error) {
      console.error(`Error cargando capa ${cfg.label}:`, error);
      e.target.checked = false;
    }
  } else {
    const lyr = layerStore.get(id);
    if (lyr) map.removeLayer(lyr);
  }
});

/* =========================================================
   INICIALIZACIÓN
========================================================= */
const autoOnIds = ["Molleturo", "Comunidades", "Cacao"];

// Función de inicialización
(async function initialize() {
  // Activar capas por defecto
  for (const id of autoOnIds) {
    const chk = document.getElementById("chk_" + id);
    if (chk) {
      chk.checked = true;
      chk.dispatchEvent(new Event("change"));
    }
  }

  // Ajustar vista después de cargar
  setTimeout(() => {
    const lyr = layerStore.get("Molleturo");
    if (lyr) {
      map.fitBounds(lyr.getBounds(), { 
        padding: [50, 50],
        maxZoom: 14
      });
    }
  }, 1000);
})();

/* =========================================================
   MEJORAS ADICIONALES
========================================================= */

// Loading state
map.on('load', () => {
  document.body.classList.add('map-loaded');
});

// Manejo de errores de tiles
map.on('tileerror', (e) => {
  console.warn('Error loading tile:', e);
});
