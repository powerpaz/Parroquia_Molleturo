// Crear el mapa
var map = L.map('map').setView([-2.7756, -79.3497], 11);

// Agregar capa base de OpenStreetMap
var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Agregar capa base de satélite
var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

// Crear objeto para almacenar las capas
var layers = {};

// Función para cargar una capa GeoJSON
function loadGeoJSON(url, layerName) {
    fetch(url)
        .then(response => response.json())
        .then(data => {
            layers[layerName] = L.geoJSON(data).addTo(map);
            controlLayer();
        });
}

// Cargar las capas GeoJSON
loadGeoJSON('ActitudAgricolaJSON.geojson', 'ActitudAgricola');
loadGeoJSON('Capacidad_uso_2021JSON.geojson', 'Capacidad_uso_2021');
loadGeoJSON('conflictos_apt_usoJSON.geojson', 'conflictos_apt_uso');
loadGeoJSON('Parroquia_MolleturoJSON.geojson', 'Parroquia_Molleturo');
loadGeoJSON('Sectores_2010JSON.geojson', 'Sectores_2010');
loadGeoJSON('Sectores_2022JSON.geojson', 'Sectores_2022');
loadGeoJSON('Uso_2015JSON.geojson', 'Uso_2015');
loadGeoJSON('Zae_2014JSON.geojson', 'Zae_2014');
loadGeoJSON('Zae_2020JSON.geojson', 'Zae_2020');

// Función para controlar la visibilidad de las capas
function controlLayer() {
    document.querySelectorAll('#layer-control input[type=checkbox]').forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            let layerName = this.id;
            if (this.checked) {
                map.addLayer(layers[layerName]);
            } else {
                map.removeLayer(layers[layerName]);
            }
        });
    });
}

// Agregar control de capas base
var baseLayers = {
    "OpenStreetMap": osm,
    "Satélite": satellite
};

L.control.layers(baseLayers).addTo(map);
