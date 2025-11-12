/* =========================================================
   Geovisor Agrícola – Molleturo (Leaflet)
   - Capas con switches
   - Selector de mapa base
   - NUEVO: Provincias (provincias_simplificado.geojson)
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
    attribution: 'Esri World Imagery'
  }),
  toner: L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}.png', {
    attribution: 'Stamen Toner Lite via Stadia Maps'
  })
};

const map = L.map('map', {
  zoomControl: true,
  attributionControl: true,
  minZoom: 3,
  maxZoom: 19
}).setView([-2.88, -79.33], 11); // Molleturo aprox.

basemaps.carto.addTo(map);

// Selector de mapa base
const bmSel = document.getElementById('basemap');
if (bmSel) {
  bmSel.addEventListener('change', (e) => {
    const val = e.target.value;
    Object.values(basemaps).forEach(b => map.removeLayer(b));
    basemaps[val].addTo(map);
  });
}

// ---------- 2) PANELES (orden de dibujo) ----------
map.createPane('pane_provincias');      map.getPane('pane_provincias').style.zIndex = 350;  // bajo temáticas
map.createPane('pane_tematica');        map.getPane('pane_tematica').style.zIndex   = 401;  // por defecto
map.createPane('pane_parroquia');       map.getPane('pane_parroquia').style.zIndex  = 450;  // arriba

// ---------- 3) CONFIG DE CAPAS ----------
const layersConfig = [
  // NUEVO: Provincias (referencia)
  {
    id: 'Provincias',
    label: 'Provincias (simplificado)',
    url: 'provincias_simplificado.geojson',
    pane: 'pane_provincias',
    style: { color: '#94a3b8', weight: 1, fillOpacity: 0, dashArray: '4 2' },
    popup: (p) => `<b>Provincia:</b> ${p.NOMBRE ?? p.nombre ?? p.PROVINCIA ?? p.provincia ?? 's/i'}`
  },

  // Límite parroquial
  {
    id: 'Parroquia_Molleturo',
    label: 'Límite Parroquial',
    url: 'Parroquia_MolleturoJSON.geojson',
    pane: 'pane_parroquia',
    style: { color: '#00d084', weight: 2, fillOpacity: 0.05 },
    popup: (p) => `<b>Parroquia:</b> ${p.PARROQUIA ?? 'Molleturo'}`
  },

  // Temáticas
  {
    id: 'ActitudAgricola',
    label: 'Actitud Agrícola',
    url: 'ActitudAgricolaJSON.json',
    pane: 'pane_tematica',
    style: { color: '#f59e0b', weight: 0.7, fillOpacity: 0.6 },
    popup: (p) => `<b>Clase:</b> ${p.clase ?? p.CLASIFICAC ?? 's/i'}`
  },
  {
    id: 'Capacidad_uso_2021',
    label: 'Capacidad de uso (2021)',
    url: 'Capacidad_uso_2021JSON.json',
    pane: 'pane_tematica',
    style: { color: '#a855f7', weight: 0.7, fillOpacity: 0.5 },
    popup: (p) => `<b>Capacidad:</b> ${p.CAP_USO ?? p.capacidad ?? 's/i'}`
  },
  {
    id: 'conflictos_apt_uso',
    label: 'Conflictos aptitud/uso',
    url: 'conflictos_apt_usoJSON.geojson',
    pane: 'pane_tematica',
    style: { color: '#ef4444', weight: 0.7, fillOpacity: 0.5 },
    popup: (p) => `<b>Conflicto:</b> ${p.TIPO ?? p.tipo ?? 's/i'}`
  },
  {
    id: 'Sectores_2010',
    label: 'Sectores 2010',
    url: 'Sectores_2010JSON.geojson',
    pane: 'pane_tematica',
    style: { color: '#22c55e', weight: 0.5, fillOpacity: 0.25 },
    popup: (p) => `<b>Sector 2010:</b> ${p.SECTOR ?? p.sector ?? 's/i'}`
  },
  {
    id: 'Sectores_2022',
    label: 'Sectores 2022',
    url: 'Sectores_2022JSON.geojson',
    pane: 'pane_tematica',
    style: { color: '#3b82f6', weight: 0.5, fillOpacity: 0.25 },
    popup: (p) => `<b>Sector 2022:</b> ${p.SECTOR ?? p.sector ?? 's/i'}`
  },
  {
    id: 'Uso_2015',
    label: 'Uso del suelo (2015)',
    url: 'Uso_2015JSON.geojson',
    pane: 'pane_tematica',
    style: { color: '#fb923c', weight: 0.6, fillOpacity: 0.45 },
    popup: (p) => `<b>Uso:</b> ${p.USO ?? p.uso ?? p.CLASE ?? 's/i'}`
  },
  {
    id: 'Zae_2014',
    label: 'ZAE 2014',
    url: 'Zae_2014JSON.geojson',
    pane: 'pane_tematica',
    style: { color: '#10b981', weight: 0.6, fillOpacity: 0.35 },
    popup: (p) => `<b>ZAE 2014:</b> ${p.ZAE ?? p.CLASIFICAC ?? 's/i'}`
  },
  {
    id: 'Zae_2020',
    label: 'ZAE 2020',
    url: 'Zae_2020JSON.geojson',
    pane: 'pane_tematica',
    style: { color: '#06b6d4', weight: 0.6, fillOpacity: 0.35 },
    popup: (p) => `<b>ZAE 2020:</b> ${p.ZAE ?? p.CLASIFICAC ?? 's/i'}`
  }
];

// ---------- 4) HELPERS ----------
const layerStore = new Map();
const layerListEl = document.getElementById('layerList');
const legendEl = document.getElementById('legend');

function addLegendRow(color, label) {
  const sw = document.createElement('div'); sw.className = 'swatch'; sw.style.background = color;
  const lb = document.createElement('div'); lb.textContent = label;
  legendEl.appendChild(sw); legendEl.appendChild(lb);
}

function makePill(color){ const d=document.createElement('span'); d.className='pill'; d.style.background=color; return d; }

function featureStyle(styleObj){
  return () => ({
    color: styleObj.color,
    weight: styleObj.weight ?? 0.8,
    fillOpacity: styleObj.fillOpacity ?? 0.4,
    opacity: 1,
    dashArray: styleObj.dashArray ?? null
  });
}

function onEachFeatureFactory(popupFn){
  return (feature, layer) => {
    const p = feature?.properties ?? {};
    const content = popupFn ? popupFn(p) : Object.entries(p).map(([k,v])=>`<b>${k}</b>: ${v}`).join('<br>');
    layer.bindPopup(content, { maxWidth: 360 });
  };
}

// ---------- 5) CARGA DE CAPAS + UI ----------
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

  // Carga de GeoJSON
  for (const cfg of layersConfig){
    try{
      const res = await fetch(cfg.url);
      if(!res.ok) throw new Error(`HTTP ${res.status} al cargar ${cfg.url}`);
      const gj = await res.json();

      const opts = {
        pane: cfg.pane ?? 'overlayPane',
        style: featureStyle(cfg.style),
        onEachFeature: onEachFeatureFactory(cfg.popup)
      };

      const layer = L.geoJSON(gj, opts);
      layerStore.set(cfg.id, layer).get(cfg.id).addTo(map);
    }catch(err){
      console.error('Error capa', cfg.id, err);
      const chk = document.getElementById(`chk_${cfg.id}`);
      if (chk) chk.closest('.layer-item').style.borderColor = '#ef4444';
    }
  }

  // Zoom a Molleturo con el límite parroquial si está
  const parroquia = layerStore.get('Parroquia_Molleturo');
  if (parroquia){
    setTimeout(()=> map.fitBounds(parroquia.getBounds(), { padding:[20,20] }), 300);
  }
})();

