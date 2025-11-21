import React, { useState, useRef, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl, ScaleControl, FullscreenControl } from 'react-map-gl';
import './App.css';

// IMPORTANTE: Reemplaza con tu token de Mapbox
// Obtén uno gratis en: https://account.mapbox.com/
const MAPBOX_TOKEN = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

function App() {
  const mapRef = useRef();
  
  // Estado inicial del mapa centrado en Ecuador
  const [viewState, setViewState] = useState({
    longitude: -79.0,
    latitude: -2.0,
    zoom: 8
  });

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
    }
  });

  const [loading, setLoading] = useState(false);

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

      // Ajustar el mapa a los límites del GeoJSON
      if (geojson.type === 'FeatureCollection' && geojson.features.length > 0) {
        fitMapToGeoJSON(geojson);
      }
      
      console.log('✅ Capa cargada exitosamente');
    } catch (error) {
      console.error('❌ Error cargando GeoJSON:', error);
      console.error('📋 Stack trace:', error.stack);
      alert('Error al cargar el archivo GeoJSON. Verifica que sea un archivo válido.');
    } finally {
      setLoading(false);
    }
  };

  // Ajustar el mapa a los límites del GeoJSON
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

  // Alternar visibilidad de capa
  const toggleLayer = (layerKey) => {
    setLayers(prev => ({
      ...prev,
      [layerKey]: {
        ...prev[layerKey],
        visible: !prev[layerKey].visible
      }
    }));
  };

  // Cambiar opacidad de capa
  const handleOpacityChange = (layerKey, opacity) => {
    setLayers(prev => ({
      ...prev,
      [layerKey]: {
        ...prev[layerKey],
        opacity: parseFloat(opacity)
      }
    }));
  };

  // Estilo de capa de polígonos (para provincias)
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

  // Estilo de capa de polígonos (para parroquias)
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

  return (
    <div className="map-container">
      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p style={{ marginTop: '10px', textAlign: 'center' }}>Cargando...</p>
        </div>
      )}

      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
      >
        {/* Controles de navegación */}
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
      </Map>

      {/* Panel de control de capas */}
      <div className="layer-control">
        <h3>Capas del Mapa</h3>
        
        {Object.entries(layers).map(([key, layer]) => (
          <div key={key} className="layer-item">
            <label>
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={() => toggleLayer(key)}
              />
              {layer.name}
            </label>
            
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
            
            {!layer.data && (
              <div style={{ marginTop: '5px' }}>
                <label style={{ 
                  fontSize: '11px', 
                  padding: '4px 8px', 
                  background: '#f0f0f0',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}>
                  Cargar {layer.name}
                  <input
                    type="file"
                    accept=".geojson,.json"
                    onChange={(e) => handleFileUpload(e, key)}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
