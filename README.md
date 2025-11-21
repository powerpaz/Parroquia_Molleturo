# 🗺️ Parroquia Molleturo - Mapa Interactivo

Aplicación web interactiva para visualizar capas GeoJSON de provincias y parroquias del Ecuador usando Mapbox GL.

![Mapbox](https://img.shields.io/badge/Mapbox-GL-blue)
![React](https://img.shields.io/badge/React-18.2-blue)
![Vite](https://img.shields.io/badge/Vite-5.0-purple)

## 🌟 Características

- ✅ Interfaz profesional estilo Mapbox
- ✅ Carga de capas GeoJSON (provincias, parroquias, cantones)
- ✅ Control de visibilidad y opacidad por capa
- ✅ Ajuste automático del mapa a los límites del GeoJSON
- ✅ Controles de navegación (zoom, rotación, pantalla completa)
- ✅ Múltiples estilos de mapa disponibles
- ✅ Responsive design

## 📸 Captura de Pantalla

![Vista del Mapa](screenshot.png)

## 🚀 Instalación

### Prerrequisitos

- Node.js (versión 16 o superior)
- npm o yarn
- Cuenta gratuita en [Mapbox](https://account.mapbox.com/)

### Pasos de Instalación

1. **Clona el repositorio:**
```bash
git clone https://github.com/TU_USUARIO/parroquia-molleturo-map.git
cd parroquia-molleturo-map
```

2. **Instala las dependencias:**
```bash
npm install
```

3. **Configura tu token de Mapbox:**

   - Ve a [Mapbox Account](https://account.mapbox.com/)
   - Crea una cuenta gratuita o inicia sesión
   - Copia tu "Default public token"
   - Abre `src/App.jsx` y reemplaza en la línea 7:
```javascript
   const MAPBOX_TOKEN = 'TU_TOKEN_AQUI';
```

4. **Inicia el servidor de desarrollo:**
```bash
npm run dev
```

5. **Abre tu navegador en:** `http://localhost:3000`

## 📖 Uso

### Cargar una Capa GeoJSON

1. En el panel de control (esquina superior derecha)
2. Haz clic en "Cargar Provincias" o "Cargar Parroquias"
3. Selecciona tu archivo `.geojson` o `.json`
4. El mapa se ajustará automáticamente a los límites

### Controlar la Visualización

- **Checkbox:** Mostrar/ocultar capa
- **Slider:** Ajustar opacidad de la capa
- **Controles del mapa:** Zoom, rotación, pantalla completa

## 🎨 Personalización

### Cambiar Estilos del Mapa

En `src/App.jsx`, línea 209:
```javascript
mapStyle="mapbox://styles/mapbox/streets-v12"
```

**Estilos disponibles:**
- `mapbox://styles/mapbox/streets-v12` - Calles
- `mapbox://styles/mapbox/dark-v11` - Oscuro
- `mapbox://styles/mapbox/light-v11` - Claro
- `mapbox://styles/mapbox/satellite-streets-v12` - Satélite
- `mapbox://styles/mapbox/outdoors-v12` - Exterior

### Cambiar Colores de las Capas

En `src/App.jsx`, modifica el estado `layers`:
```javascript
provincias: {
  color: '#088'  // Cambia este valor
},
parroquias: {
  color: '#ff6b6b'  // Cambia este valor
}
```

### Ajustar Posición Inicial

En `src/App.jsx`, línea 10:
```javascript
const [viewState, setViewState] = useState({
  longitude: -79.0,  // Longitud
  latitude: -2.0,    // Latitud
  zoom: 8            // Nivel de zoom
});
```

## 📁 Estructura del Proyecto
```
parroquia-molleturo-map/
├── src/
│   ├── App.jsx              # Componente principal
│   ├── App.css              # Estilos
│   └── main.jsx             # Punto de entrada
├── public/
│   └── ejemplo-provincias.geojson  # Archivo de prueba
├── index.html               # HTML base
├── package.json             # Dependencias
├── vite.config.js           # Configuración de Vite
└── README.md                # Este archivo
```

## 🛠️ Tecnologías Utilizadas

- [React](https://reactjs.org/) - Framework de UI
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) - Mapas interactivos
- [react-map-gl](https://visgl.github.io/react-map-gl/) - React wrapper para Mapbox
- [Vite](https://vitejs.dev/) - Build tool

## 📝 Formato GeoJSON

Tu archivo debe seguir este formato:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "nombre": "Nombre de la provincia",
        "codigo": "P01"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [-79.5, -2.5],
            [-79.5, -2.0],
            [-79.0, -2.0],
            [-79.0, -2.5],
            [-79.5, -2.5]
          ]
        ]
      }
    }
  ]
}
```

**⚠️ Importante:** Mapbox usa coordenadas en formato `[longitud, latitud]`

## 🐛 Solución de Problemas

### La capa no se visualiza

1. **Verifica el formato GeoJSON:** Usa [geojson.io](https://geojson.io/) para validar
2. **Revisa el orden de coordenadas:** Deben ser `[longitud, latitud]`
3. **Comprueba la consola:** Abre DevTools (F12) y busca errores
4. **Verifica la opacidad:** Debe ser mayor a 0%
5. **Prueba con otro color:** Cambia temporalmente a `#FF0000` (rojo)

### Error de token

Si ves un error relacionado con el token:
- Asegúrate de haberlo configurado correctamente en `src/App.jsx`
- Verifica que el token empiece con `pk.`
- Comprueba que tu token esté activo en [Mapbox Account](https://account.mapbox.com/)

## 📦 Build para Producción
```bash
npm run build
```

Los archivos optimizados se generarán en la carpeta `dist/`

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Para cambios importantes:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## ✨ Autor

**Tu Nombre**
- GitHub: [@TU_USUARIO](https://github.com/TU_USUARIO)

## 🙏 Agradecimientos

- [Mapbox](https://www.mapbox.com/) por su increíble API
- [React Map GL](https://visgl.github.io/react-map-gl/) por el wrapper de React
- Comunidad de Ecuador por los datos GeoJSON

## 📞 Soporte

Si tienes problemas o preguntas:
- Abre un [Issue](https://github.com/TU_USUARIO/parroquia-molleturo-map/issues)
- Contacto: tu_email@example.com

---

⭐ Si te gusta este proyecto, dale una estrella en GitHub!
```

---

## 📄 **LICENSE** (Licencia MIT)
```
MIT License

Copyright (c) 2024 [Tu Nombre]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
