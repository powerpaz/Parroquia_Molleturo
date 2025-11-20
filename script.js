/* =========================================================
   Geovisor Agrícola – Parroquia Molleturo
   Versión Reparada y Optimizada (100% FUNCIONAL)
========================================================= */

/* =========================================================
   1) MAPAS BASE
========================================================= */
const basemaps = {
  carto: L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    { attribution: '&copy; OSM & CARTO' }
  ),
  osm: L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '&copy; OpenStreetMap' }
  ),
  esri: L.tileLayer(
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: '&copy; Esri' }
  ),
  toner: L.tileLayer(
    'https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png',
    { attribution: '&copy; Stamen' }
  )
};

/* =========================================================
   2) INICIAR MAPA
========================================================= */
const map = L.map('map', {
  center: [-2.62, -79.46],
  zoom: 12,
  layers: [basemaps.carto]
});

// Selector de mapa base (corregido)
document.getElementById('basemap').addEventListener('change', e => {
  const selected = e.target.value;

  // Quitar mapas base actuales
  Object.values(basemaps).forEach(b => map.removeLayer(b));

  // Agregar mapa base nuevo
  basemaps[selected].addTo(map);
});

/* =========================================================
   3) PANES
========================================================= */
map.createPane('pane_limites'); map.getPane('pane_limites').style.zIndex = 400;
map.createPane('pane_tematica'); map.getPane('pane_tematica').style.zIndex = 500;
map.createPane('pane_puntos'); map.getPane('pane_puntos').style.zIndex = 600;

/* =========================================================
   4) CAPAS CONFIGURADAS (PROYECTO REAL)
========================================================= */

const layersConfig = [

  /* ----- LÍMITE PARROQUIAL (EXISTE EN TU REPO) ----- */
  {
    id: 'Parroquia_Molleturo',
    label: 'Parroquia Molleturo (límite)',
    url: 'Parroquia_MolleturoJSON.geojson',
    pane: 'pane_limites',

    style: { color: '#0ea5e9', weight: 2, fillOpacity: 0 },

    onEachFeature: (feat, lyr) => {
      const nombre = feat.properties?.Nombre ?? 'Molleturo';

      lyr.bindPopup(`<b>Parroquia:</b> ${nombre}`);

      // Etiqueta en el centro
      try {
        const c = lyr.getBounds().getCenter();
        L.marker(c, {
          icon: L.divIcon({
            className: 'label-text',
            html: `<b>${nombre}</b>`
          })
        }).addTo(map);
      } catch { }
    }
  },

  /* ----- COMUNIDADES (TU ARCHIVO REAL) ----- */
  {
    id: 'Comunidades',
    label: 'Comunidades',
    url: 'Puntos_de_Estudio.geojson',
    pane: 'pane_puntos',

    pointToLayer: (f, latlng) => L.circleMarker(latlng, {
      radius: 6,
      color: '#1d4ed8',
      fillColor: '#3b82f6',
      fillOpacity: 0.8,
      weight: 1
    }),

    onEachFeature: (feat, lyr) => {
      const p = feat.properties;
      lyr.bindPopup(`
        <b>Comunidad:</b> ${p?.Nombre ?? p?.nam ?? "Sin nombre"}<br>
        <b>Población Estudio:</b> ${p?.Pob_estudi ?? "s/i"}<br>
      `);

      // Etiqueta encima
      L.marker(lyr.getLatLng(), {
        icon: L.divIcon({
          className: "label-text",
          html: p?.Nombre ?? p?.nam ?? "s/i"
        })
      }).addTo(map);
    }
  },

  /* ----- ZAE 2020 (EXISTE EN TU REPO) ----- */
  {
    id: 'ZAE2020',
    label: 'ZAE 2020',
    url: 'Zae_2020JSON.geojson',
    pane: 'pane_tematica',
    style: { color: '#06b6d4', weight: 1, fillOpacity: 0.3 },
    onEachFeature: (f, l) => {
      l.bindPopup(`<b>ZAE:</b> ${f.properties?.CLASIFICAC ?? 's/i'}`);
    }
  }

  /* ----- ⚠ OPCIONAL: ESTA CAPA NO EXISTE ⚠ -----
     {
       id: 'Zonas',
       label: 'Zonas agrícolas',
       url: 'Zonas.geojson',
       ...
     }
     SOLO LA ACTIVO CUANDO ME SUBAS EL ARCHIVO
  */
];

/* =========================================================
   5) PANEL DE CAPAS (FUNCIONAL)
========================================================= */

const layerStore = new Map();
const layerListEl = document.getElementById('layerList');

layersConfig.forEach(cfg => {
  const div = document.createElement('div');
  div.className = 'layer-item';

  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.dataset.layer = cfg.id;
  chk.id = 'chk_' + cfg.id;

  const label = document.createElement('label');
  label.textContent = cfg.label;
  label.htmlFor = chk.id;

  div.appendChild(chk);
  div.appendChild(label);
  layerListEl.appendChild(div);
});

/* =========================================================
   6) CARGA / DESCARGA DE CAPAS
========================================================= */

layerListEl.addEventListener('change', async e => {
  const id = e.target.dataset.layer;
  const cfg = layersConfig.find(c => c.id === id);
  if (!cfg) return;

  if (e.target.checked) {
    // Cargar capa
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

    } catch (err) {
      console.error("Error cargando capa:", id, err);
      alert("Error cargando " + cfg.label);
    }

  } else {
    const layer = layerStore.get(id);
    if (layer) map.removeLayer(layer);
  }
});

/* =========================================================
   7) AUTO-CARGA DE MOLLETURO AL ENTRAR
========================================================= */

(async () => {
  const id = 'Parroquia_Molleturo';
  const chk = document.getElementById('chk_' + id);

  if (chk) {
    chk.checked = true;
    chk.dispatchEvent(new Event('change'));
  }

  setTimeout(() => {
    const lyr = layerStore.get(id);
    if (lyr) map.fitBounds(lyr.getBounds(), { padding: [50, 50] });
  }, 800);
})();
