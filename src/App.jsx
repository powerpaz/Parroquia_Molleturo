import React, { useState, useRef } from 'react';
import Map, { Source, Layer, NavigationControl, ScaleControl, FullscreenControl } from 'react-map-gl';
import './App.css';

// IMPORTANTE: Reemplaza con tu token de Mapbox
const MAPBOX_TOKEN = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

function App() {
  const mapRef = useRef();
  
  const [viewState, setViewState] = useState({
    longitude: -79.5,
    latitude: -2.7,
    zoom: 11
  });

  const [basemap, setBasemap] = useState('mapbox://styles/mapbox/outdoors-v12');
  
  const [layers, setLayers] = useState({
    provincias: {
      visible: true,
      opacity: 0.7,
      data: null,
      name: 'Provincias',
      color: '#088'
    },
    parroquias: {
      visible: true,
      opacity: 0.8,
      data: null,
      name: 'Parroquias',
      color: '#ff6b6b'
    },
    cacao: {
      visible: true,
      opacity: 0.6,
      data: null,
      name: 'Zonas de Cacao',
      color: '#8B4513'
    }
  });

  const [loading, setLoading] = useState(false);

  // Estilos de mapa disponibles
  const basemapStyles = {
    voyager: 'mapbox://styles/mapbox/outdoors-v12',
    positron: 'mapbox://styles/mapbox/light-v11',
    osm: 'mapbox://styles/mapbox/streets-v12',
    esri: 'mapbox://styles/mapbox/satellite-streets-v12'
  };

  // Cargar GeoJSON desde archivo
  const handleFileUpload = async (event, layerKey) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log('📁 Cargando archivo:', file.name);
    setLoading(true);
    
    try {
      const text = await file.text();
      console.log('📝 Tamaño del archivo:', text.length, 'caracteres');
      
      const geojson = JSON.parse(text);
      console.log('✅ GeoJSON parseado correctamente');
      console.log('📊 Tipo:', geojson.type);
      console.log('📊 Número de features:', geojson.features?.length);
      
      if (geojson.features && geojson.features.length > 0) {
        const firstFeature = geojson.features[0];
        console.log('📊 Primera feature:', firstFeature);
        console.log('📊 Tipo de geometría:', firstFeature.geometry?.type);
        console.log('📊 Primera coordenada:', firstFeature.geometry?.coordinates[0]);
      }
      
      setLayers(prev => ({
        ...prev,
        [layerKey]: {
          ...prev[layerKey],
          data: geojson
        }
      }));

      if (geojson.type === 'FeatureCollection' && geojson.features.length > 0) {
        fitMapToGeoJSON(geojson);
      }
      
      console.log('✅ Capa cargada exitosamente');
    } catch (error) {
      console.error('❌ Error cargando GeoJSON:', error);
      alert('Error al cargar el archivo GeoJSON. Verifica que sea un archivo válido.');
    } finally {
      setLoading(false);
    }
  };

  const fitMapToGeoJSON = (geojson) => {
    if (!mapRef.current) return;

    const bounds = [
      [Infinity, Infinity],
      [-Infinity, -Infinity]
    ];

    const processCoordinates = (coords) => {
      if (typeof coords[0] === 'number') {
        bounds[0][0] = Math.min(bounds[0][0], coords[0]);
        bounds[0][1] = Math.min(bounds[0][1], coords[1]);
        bounds[1][0] = Math.max(bounds[1][0], coords[0]);
        bounds[1][1] = Math.max(bounds[1][1], coords[1]);
      } else {
        coords.forEach(processCoordinates);
      }
    };

    geojson.features.forEach(feature => {
      if (feature.geometry) {
        processCoordinates(feature.geometry.coordinates);
      }
    });

    if (bounds[0][0] !== Infinity) {
      mapRef.current.fitBounds(bounds, {
        padding: 50,
        duration: 1000
      });
    }
  };

  const toggleLayer = (layerKey) => {
    setLayers(prev => ({
      ...prev,
      [layerKey]: {
        ...prev[layerKey],
        visible: !prev[layerKey].visible
      }
    }));
  };

  const handleOpacityChange = (layerKey, opacity) => {
    setLayers(prev => ({
      ...prev,
      [layerKey]: {
        ...prev[layerKey],
        opacity: parseFloat(opacity)
      }
    }));
  };

  const handleBasemapChange = (e) => {
    setBasemap(basemapStyles[e.target.value]);
  };

  // Estilos de capas
  const provinciasLayerStyle = {
    id: 'provincias-fill',
    type: 'fill',
    paint: {
      'fill-color': layers.provincias.color,
      'fill-opacity': layers.provincias.opacity
    }
  };

  const provinciasLineLayerStyle = {
    id: 'provincias-line',
    type: 'line',
    paint: {
      'line-color': '#000',
      'line-width': 2
    }
  };

  const parroquiasLayerStyle = {
    id: 'parroquias-fill',
    type: 'fill',
    paint: {
      'fill-color': layers.parroquias.color,
      'fill-opacity': layers.parroquias.opacity
    }
  };

  const parroquiasLineLayerStyle = {
    id: 'parroquias-line',
    type: 'line',
    paint: {
      'line-color': '#fff',
      'line-width': 1
    }
  };

  const cacaoLayerStyle = {
    id: 'cacao-fill',
    type: 'fill',
    paint: {
      'fill-color': layers.cacao.color,
      'fill-opacity': layers.cacao.opacity
    }
  };

  const cacaoLineLayerStyle = {
    id: 'cacao-line',
    type: 'line',
    paint: {
      'line-color': '#654321',
      'line-width': 1
    }
  };

  return (
    <>
      {/* Barra superior */}
      <header className="topbar">
        <div className="topbar-logos topbar-logos-left">
          <img src="/logo_unibonn.png" alt="Universität Bonn" />
          <img src="/logo_zef.png" alt="ZEF - Center for Development Research" />
        </div>
        
        <div className="topbar-center">
          <h1>
            The Cocoa Society: Navigating Agrarian Extractivism and Food Sovereignty
            in Molleturo-Azuay, Ecuador.
          </h1>
          <div className="basemap-select">
            <label htmlFor="basemap">Mapa base:</label>
            <select id="basemap" onChange={handleBasemapChange}>
              <option value="voyager">Mapbox style (Voyager)</option>
              <option value="positron">Mapbox Light style</option>
              <option value="osm">OpenStreetMap</option>
              <option value="esri">Esri World Imagery</option>
            </select>
          </div>
        </div>
        
        <div className="topbar-logos topbar-logos-right">
          <img src="/logo_rlc.png" alt="Right Livelihood College" />
          <img src="/logo_fiat_panis.png" alt="Foundation fiat panis" />
        </div>
      </header>

      {/* Panel lateral + mapa */}
      <main className="main-container">
        <aside className="panel">
          <div className="panel-section">
            <h3>Capas</h3>
            <div className="layer-list">
              {Object.entries(layers).map(([key, layer]) => (
                <div key={key} className="layer-item">
                  <label className="layer-checkbox">
                    <input
                      type="checkbox"
                      checked={layer.visible}
                      onChange={() => toggleLayer(key)}
                    />
                    <span>{layer.name}</span>
                  </label>
                  
                  {!layer.data && (
                    <div className="layer-load-btn">
                      <label className="load-file-label">
                        📁 Cargar archivo
                        <input
                          type="file"
                          accept=".geojson,.json"
                          onChange={(e) => handleFileUpload(e, key)}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  )}
                  
                  {layer.data && layer.visible && (
                    <div className="opacity-control">
                      <label>
                        Opacidad: {Math.round(layer.opacity * 100)}%
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={layer.opacity}
                          onChange={(e) => handleOpacityChange(key, e.target.value)}
                        />
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <h3>Leyenda</h3>
            <div className="legend">
              {Object.entries(layers).map(([key, layer]) => (
                layer.visible && layer.data && (
                  <div key={key} className="legend-item">
                    <span 
                      className="legend-color" 
                      style={{ 
                        backgroundColor: layer.color,
                        opacity: layer.opacity 
                      }}
                    />
                    <span className="legend-label">{layer.name}</span>
                  </div>
                )
              ))}
              {!Object.values(layers).some(l => l.visible && l.data) && (
                <p>Activa o carga las capas desde el panel superior.</p>
              )}
            </div>
          </div>

          <div className="panel-section">
            <h3>Info</h3>
            <p>Haz clic sobre los elementos del mapa para ver sus atributos.</p>
          </div>
        </aside>

        <div className="map-wrapper">
          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <p>Cargando...</p>
            </div>
          )}

          <Map
            ref={mapRef}
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            mapboxAccessToken={MAPBOX_TOKEN}
            style={{ width: '100%', height: '100%' }}
            mapStyle={basemap}
          >
            <NavigationControl position="top-left" />
            <ScaleControl position="bottom-left" />
            <FullscreenControl position="top-left" />

            {/* Capa de Provincias */}
            {layers.provincias.visible && layers.provincias.data && (
              <Source id="provincias-source" type="geojson" data={layers.provincias.data}>
                <Layer {...provinciasLayerStyle} />
                <Layer {...provinciasLineLayerStyle} />
              </Source>
            )}

            {/* Capa de Parroquias */}
            {layers.parroquias.visible && layers.parroquias.data && (
              <Source id="parroquias-source" type="geojson" data={layers.parroquias.data}>
                <Layer {...parroquiasLayerStyle} />
                <Layer {...parroquiasLineLayerStyle} />
              </Source>
            )}

            {/* Capa de Cacao */}
            {layers.cacao.visible && layers.cacao.data && (
              <Source id="cacao-source" type="geojson" data={layers.cacao.data}>
                <Layer {...cacaoLayerStyle} />
                <Layer {...cacaoLineLayerStyle} />
              </Source>
            )}
          </Map>
        </div>
      </main>

      <footer className="footer">
        <span>© Elaborado por Geopaz_Eguez&Pazmiño</span>
      </footer>
    </>
  );
}

export default App;
