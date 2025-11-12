/* =========================================================
   Geovisor Agrícola – Molleturo
   - UI estilo moderno
   - Carga y switches de capas GeoJSON
   - Select de mapa base
   ========================================================= */

// ---------- 1) MAPA BASE ----------
const basemaps = {
  carto: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM & CARTO'
  }),
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }),
  esri: L.tileLayer(
    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Esri World Imagery' }
  ),
  toner: L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}.png', {
    attribution: 'Stamen Toner Lite via Stadia Maps'
  })
};

const map = L.map('map', {
  zoomControl: true,
  attributionControl: true,
  minZoom: 3,
  maxZoom: 19
}).setView([-2.88, -79.33], 11); // centro aproximado Molleturo

basemaps.carto.addTo(map);

// selector UI de base
document.getElementById('basemap').addEventListener('change', (e) => {
  const val = e.target.value;
  Object.values(basemaps).forEach(b => map.removeLayer(b));
  basemaps[val].addTo(map);
});

// ---------- 2) CONFIG DE CAPAS ----------
// OJO: nombres de archivos según tu repo (pantallazo de GitHub)
const layersConfig = [
  {
    id: 'Parroquia_Molleturo',
    label: 'Límite Parroquial',
    url: 'Parroquia_MolleturoJSON.geojson',
    style: { color: '#00d084', weight: 2, fillOpacity: 0.05 },
    popup: (p) => `<b>Parroquia:</b> ${p.PARROQUIA ?? 'Molleturo'}`
  },
  {
    id: 'ActitudAgricola',
    label: 'Actitud Agrícola',
    url: 'ActitudAgricolaJSON.json',
    style: { color: '#f59e0b', weight: 0.7, fillOpacity: 0.6 },
    popup: (p) => `<b>Clase:</b> ${p.clase ?? p.CLASIFICAC ?? 's/i'}`
  },
  {
    id: 'Capacidad_uso_2021',
    label: 'Capacidad de uso (2021)',
    url: 'Capacidad_uso_2021JSON.json',
    style: { color: '#a855f7', weight: 0.7, fillOpacity: 0.5 },
    popup: (p) => `<b>Capacidad:</b> ${p.CAP_USO ?? p.capacidad ?? 's/i'}`
  },
  {
    id: 'conflictos_apt_uso',
    label: 'Conflictos aptitud/uso',
    url: 'conflictos_apt_usoJSON.geojson',
    style: { color: '#ef4444', weight: 0.7, fillOpacity: 0.5 },
    popup: (p) => `<b>Conflicto:</b> ${p.TIPO ?? p.tipo ?? 's/i'}`
  },
  {
    id: 'Sectores_2010',
    label: 'Sectores 2010',
    url: 'Sectores_2010JSON.geojson',
    style: { color: '#22c55e', weight: 0.5, fillOpacity: 0.25 },
    popup: (p) => `<b>Sector 2010:</b> ${p.SECTOR ?? p.sector ?? 's/i'}`
  },
  {
    id: 'Sectores_2022',
    label: 'Sectores 2022',
    url: 'Sectores_2022JSON.geojson',
    style: { color: '#3b82f6', weight: 0.5, fillOpacity: 0.25 },
    popup: (p) => `<b>Sector 2022:</b> ${p.SECTOR ?? p.sector ?? 's/i'}`
  },
  {
    id: 'Uso_2015',
    label: 'Uso del suelo (2015)',
    url: 'Uso_2015JSON.geojson',
    style: { color: '#fb923c', weight: 0.6, fillOpacity: 0.45 },
    popup: (p) => `<b>Uso:</b> ${p.USO ?? p.uso ?? p.CLASE ?? 's/i'}`
  },
  {
    id: 'Zae_2014',
    label: 'ZAE 2014',
    url: 'Zae_2014JSON.geojson',
    style: { color: '#10b981', weight: 0.6, fillOpacity: 0.35 },
    popup: (p) => `<b>ZAE 2014:</b> ${p.ZAE ?? p.CLASIFICAC ?? 's/i'}`
  },
  {
    id: 'Zae_2020',
    label: 'ZAE 2020',
    url: 'Zae_2020JSON.geojson',
    style: { color: '#06b6d4', weight: 0.6, fillOpacity: 0.35 },
    popup: (p) => `<b>ZAE 2020:</b> ${p.ZAE ?? p.CLASIFICAC ?? 's/i'}`
  }
];

// ---------- 3) HELPERS ----------
const layerStore = new Map();
const layerListEl = document.getElementById('layerList');
const legendEl = document.getElementById('legend');

function addLegendRow(color, label){
  const sw = document.createElement('div'); sw.className = 'swatch'; sw.style.background = color;
  const lb = document.createElement('div'); lb.textContent = label;
  legendEl.appendChild(sw); legendEl.appendChild(lb);
}

function makePill(color){ const d=document.createElement('span'); d.className='pill'; d.style.background=color; return d; }

function featureStyle(styleObj){
  return (/*feature*/) => ({
    color: styleObj.color,
    weight: styleObj.weight ?? 0.8,
    fillOpacity: styleObj.fillOpacity ?? 0.4,
    opacity: 1
  });
}

function onEachFeatureFactory(popupFn){
  return (feature, layer) => {
    const p = feature?.properties ?? {};
    const content = popupFn ? popupFn(p) : Object.entries(p).map(([k,v])=>`<b>${k}</b>: ${v}`).join('<br>');
    layer.bindPopup(content, { maxWidth: 360 });
  };
}

// ---------- 4) CARGA DE CAPAS + UI ----------
(async function init(){
  // Panel de capas
  layersConfig.forEach(cfg => {
    const row = document.createElement('div');
    row.className = 'layer-item';

    const left = document.createElement('label');
    left.htmlFor = `chk_${cfg.id}`;
    left.appendChild(makePill(cfg.style.color));
    left.appendChild(document.createTextNode(cfg.label));

    const right = document.createElement('input');
    right.type = 'checkbox';
    right.id = `chk_${cfg.id}`;
    right.checked = true;

    row.appendChild(left);
    row.appendChild(right);
    layerListEl.appendChild(row);

    right.addEventListener('change', () => {
      const lyr = layerStore.get(cfg.id);
      if (!lyr) return;
      if (right.checked) lyr.addTo(map);
      else map.removeLayer(lyr);
    });

    addLegendRow(cfg.style.color, cfg.label);
  });

  // Carga GeoJSON (misma carpeta; en GitHub Pages funciona bien por origen común)
  for (const cfg of layersConfig){
    try{
      const res = await fetch(cfg.url);
      if(!res.ok) throw new Error(`HTTP ${res.status} al cargar ${cfg.url}`);
      const gj = await res.json();

      const layer = L.geoJSON(gj, {
        style: featureStyle(cfg.style),
        onEachFeature: onEachFeatureFactory(cfg.popup)
      });

      layerStore.set(cfg.id, layer).get(cfg.id).addTo(map);
    }catch(err){
      console.error('Error capa', cfg.id, err);
      // marca la fila en rojo si falla
      const chk = document.getElementById(`chk_${cfg.id}`);
      if (chk) chk.closest('.layer-item').style.borderColor = '#ef4444';
    }
  }

  // Zoom a Molleturo cuando la capa parroquia esté lista
  const parroquia = layerStore.get('Parroquia_Molleturo');
  if (parroquia){
    setTimeout(()=> map.fitBounds(parroquia.getBounds(), { padding:[20,20] }), 300);
  }
})();
