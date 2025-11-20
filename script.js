/* =========================================================
   Geovisor Agrícola – Molleturo (Leaflet)
   - Capas con switches
   - Selector de mapa base
   - NUEVO: Provincias (provincias_simplificado.geojson)
   - NUEVO: Puntos de Estudio (puntos_de_estudio.geojson)
   ========================================================= */

// ---------- 1) MAPA BASE ----------
const basemaps = {
  carto: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM & CARTO'
  }),
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }),
  esri: L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Esri'
  })
};

// ---------- MAPA PRINCIPAL ----------
const map = L.map('map', {
  center: [-2.88, -79.29],
  zoom: 12,
  layers: [basemaps.carto]
});

// ---------- SELECTOR DE BASEMAP ----------
L.control.layers(basemaps, null, { position: 'topright' }).addTo(map);

// ---------- 2) PANELES ----------
map.createPane('pane_limites');
map.getPane('pane_limites').style.zIndex = 400;

map.createPane('pane_tematica');
map.getPane('pane_tematica').style.zIndex = 500;

map.createPane('pane_puntos');
map.getPane('pane_puntos').style.zIndex = 600;

// ---------- 3) CONFIGURACIÓN DE CAPAS ----------
const layersConfig = [

  // --- LIMITE PARROQUIAL ---
  {
    id: 'Parroquia_Molleturo',
    label: 'Parroquia Molleturo (límite)',
    url: 'Molleturo_Limite.geojson',
    pane: 'pane_limites',
    style: { color: '#0ea5e9', weight: 2, fillOpacity: 0 },
    popup: p => `<b>Parroquia:</b> ${p.Nombre || 'Molleturo'}`
  },

  // --- COMUNIDADES ---
  {
    id: 'Comunidades',
    label: 'Comunidades',
    url: 'Comunidades.geojson',
    pane: 'pane_puntos',
    pointToLayer: (f, latlng) => L.circleMarker(latlng, {
      radius: 5,
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.6,
      weight: 1
    }),
    popup: p => `<b>Comunidad:</b> ${p.Nombre ?? 's/i'}`
  },

  // --- ZONAS ---
  {
    id: 'Zonas',
    label: 'Zonas agrícolas',
    url: 'Zonas.geojson',
    pane: 'pane_tematica',
    style: { color: '#14b8a6', weight: 1, fillOpacity: 0.25 },
    popup: p => `<b>Zona:</b> ${p.Nombre ?? 's/i'}`
  },

  // --- ZAE ---
  {
    id: 'ZAE2020',
    label: 'ZAE 2020',
    url: 'Zae_2020JSON.geojson',
    pane: 'pane_tematica',
    style: { color: '#06b6d4', weight: 0.6, fillOpacity: 0.35 },
    popup: p => `<b>ZAE 2020:</b> ${p.ZAE ?? p.CLASIFICAC ?? 's/i'}`
  },

  // =========================================================
  //     ★★ NUEVA CAPA – PUNTOS DE ESTUDIO ★★
  // =========================================================
  {
    id: 'Puntos_Estudio',
    label: 'Puntos de Estudio',
    url: 'Puntos_de_Estudio.geojson',
    pane: 'pane_puntos',

    pointToLayer: (f, latlng) => L.circleMarker(latlng, {
      radius: 6,
      color: '#d97706',
      fillColor: '#fbbf24',
      fillOpacity: 0.75,
      weight: 1
    }),

    popup: p => `
      <b>Punto de Estudio</b><br>
      ${p.Nombre ?? ''}<br>
      <b>Descripción:</b> ${p.Descripcion ?? 's/i'}
    `
  }

];

// ---------- 4) HELPERS ----------
const layerStore = new Map();
const layerListEl = document.getElementById('layerList');
const legendEl = document.getElementById('legend');

function addLegendRow(color, label) {
  const sw = document.createElement('div');
  sw.className = 'swatch';
  sw.style.background = color;

  const row = document.createElement('div');
  row.className = 'legend-row';
  row.appendChild(sw);
  row.appendChild(document.createTextNode(label));

  legendEl.appendChild(row);
}

// ---------- 5) CONSTRUIR LISTA DE CAPAS ----------
layersConfig.forEach(cfg => {
  const item = document.createElement('div');
  item.className = 'layer-item';

  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.id = `chk_${cfg.id}`;
  chk.dataset.layer = cfg.id;

  const label = document.createElement('label');
  label.htmlFor = chk.id;
  label.textContent = cfg.label;

  item.appendChild(chk);
  item.appendChild(label);
  layerListEl.appendChild(item);
});

// ---------- 6) MANEJO DE ACTIVACIÓN DE CAPAS ----------
layerListEl.addEventListener('change', async e => {
  const id = e.target.dataset.layer;
  const cfg = layersConfig.find(x => x.id === id);

  if (!cfg) return;

  if (e.target.checked) {
    try {
      const resp = await fetch(cfg.url);
      const data = await resp.json();

      const layer = L.geoJSON(data, {
        pane: cfg.pane,
        style: cfg.style,
        pointToLayer: cfg.pointToLayer,
        onEachFeature: (feat, lyr) => {
          const p = feat.properties;
          if (cfg.popup) lyr.bindPopup(cfg.popup(p));
        }
      });

      layer.addTo(map);
      layerStore.set(id, layer);

    } catch (err) {
      console.error("Error cargando capa:", id, err);
      alert("No se pudo cargar " + id);
    }

  } else {
    const l = layerStore.get(id);
    if (l) map.removeLayer(l);
  }
});

// ---------- 7) CARGAR AUTOMÁTICO EL LÍMITE DE MOLLETURO ----------
(async () => {
  const auto = ['Parroquia_Molleturo'];
  for (const id of auto) {
    const chk = document.getElementById(`chk_${id}`);
    if (chk) {
      chk.checked = true;
      chk.dispatchEvent(new Event('change'));
    }
  }

  const parroquia = layerStore.get('Parroquia_Molleturo');
  if (parroquia) {
    setTimeout(() => map.fitBounds(parroquia.getBounds(), { padding: [20, 20] }), 300);
  }
})();


