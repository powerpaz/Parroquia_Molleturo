# Reporte de integración — Transición multitemporal (`2_4_Transicion`)

## 0. Actualización: simbología oficial aplicada (`Catalogo de representacion_mapa de transicion.docx`)

Se leyó el catálogo de representación cartográfica del proyecto y se
reemplazó la paleta de colores genérica (heurística por palabras clave) por
los colores **HEX exactos** definidos por el equipo GIS, en `script.js`
(`TRANSITION_COMBO_STYLE`, `TRANSITION_GROUP_STYLE`):

- **Por categoría agregada (`trans_grp`):** `EXPANSIÓN_AGRO` `#C9A15A`,
  `EXPANSIÓN_PASTO` `#D8D88A`, `EXPANSIÓN_PLANTACIÓN` `#6DAFA3`,
  `EXPANSIÓN_URBANA` `#9A8FBF`, `GANANCIA_BOSQUE` `#7BAE7F`,
  `PÉRDIDA_BOSQUE` `#B86B5E`, `PERSISTENCIA_BOSQUE` `#B1FDB3`.
- **Por combinación exacta `old_gen → new_gen` (campo `trans`)**, para
  `RECONFIGURACIÓN_INTERNA` (que el catálogo no resuelve por categoría
  agregada sino por el tipo específico de cambio) y dos persistencias con
  textura: `AGRO → AGRO` `#F3E8D1` (borde `#D9B98A`),
  `PASTO_GANADERIA → PASTO_GANADERIA` `#EEE9C9` (borde `#734C00`), más las 7
  combinaciones de reconfiguración listadas en el catálogo
  (`AGRO → NATURAL_SECUNDARIO`, `PASTO_GANADERIA → NATURAL_SECUNDARIO`,
  `AGRO → AGUA`, `PLANTACION → NATURAL_SECUNDARIO`,
  `PASTO_GANADERIA → AGUA`, `NO_DATA → NATURAL_SECUNDARIO`,
  `NATURAL_SECUNDARIO → AGUA`). Se verificó que estas 7 combinaciones cubren
  el 100% de los casos reales de `RECONFIGURACIÓN_INTERNA` presentes en los
  3 shapefiles (`tr_1990_2000`, `tr_2000_2020`, `tr_2020_2022`).
- **Capa `tr0020_cacao`:** el catálogo la define como un contorno de
  referencia constante ("Cobertura de cacao", línea `#732600`, sin relleno),
  no como polígono categórico de cambio. Se cambió su estilo en el widget de
  relleno por `trans_grp` a **solo contorno** (`TRANSITION_OUTLINE_ONLY_IDS`).
  *(Bug encontrado y corregido durante la verificación: el control de
  opacidad sobrescribía `fillOpacity` en todas las capas activas, incluida
  esta de contorno — ya excluida explícitamente en `updateTransitionOpacity()`.)*
- **Capas de contexto:** `RioPrincipal` ahora usa el azul exacto del
  catálogo para ríos perennes (`#005CE6`, antes `#0ea5e9`); `PobladosTransicion`
  usa negro (`#000000`) en vez del azul anterior, con los 3 poblados
  `Pob_estudi='SI'` resaltados más grandes (el catálogo filtra solo esos 3
  para el mapa impreso; en el visor interactivo se mantienen los 49 como
  referencia general, ya que removerlos perdería información sin necesidad).
- **Categorías de persistencia sin HEX explícito en el catálogo**
  (`PERSISTENCIA_AGUA`, `PERSISTENCIA_VEGETACION_SECUNDARIA`,
  `PERSISTENCIA_URBANO_E_INFRAESTRUCTURA`, `PERSISTENCIA_PLANTACION`,
  `SIN_INFORMACION_PERSISTENTE`): se extendió la misma lógica de tonos
  pálidos/neutros usada en el resto del catálogo, sin inventar una
  categoría de cambio. Si el equipo cartográfico define un HEX oficial para
  estas, son fáciles de ajustar en `TRANSITION_GROUP_STYLE` (`script.js`).
- La leyenda flotante y los popups ahora muestran las **etiquetas legibles
  del catálogo** (p. ej. "Reconfiguración: agropecuario → vegetación
  secundaria") en vez del código crudo (`trans_grp`/`trans`).
- Limitación técnica reconocida: el catálogo pide tramado (rayas/puntos)
  para dos persistencias; Leaflet/SVG no soporta relleno con patrón sin una
  librería adicional, así que se aproximó con color sólido + borde del color
  de la trama. Se documenta para que el equipo decida si vale la pena una
  dependencia extra para el tramado exacto.

## 1. Capas encontradas en `2_4_Transicion`

| Shapefile | Features | CRS original | Rol asignado |
|---|---|---|---|
| `tr_1990_2000.shp` | 25 | EPSG:32717 (UTM 17S) | Transición multitemporal |
| `tr_2000_2020.shp` | 32 | EPSG:32717 | Transición multitemporal |
| `tr_2020_2022.shp` | 24 | EPSG:32717 | Transición multitemporal |
| `tr0020_cacao.shp` | 127 | EPSG:32717 | Transición multitemporal (sin periodo detectable en el nombre) |
| `Area_estudio.shp` | 1 | EPSG:32717 | Capa de contexto → panel "Capas" |
| `Poblados.shp` | 49 | EPSG:32717 | Capa de contexto → panel "Capas" |
| `rio_l.shp` | 30,213 | EPSG:32717 | Capa de contexto → panel "Capas" (recortada) |

Las 4 primeras tienen el campo `trans_grp` y nombre con periodo de años: son las
"capas de transición" reales y alimentan el widget nuevo. `Area_estudio`,
`Poblados` y `rio_l` no son series temporales (no tienen año ni `trans_grp`),
así que se integraron como capas normales del panel **Capas** existente, no
en el widget de transición — evita inventar una línea de tiempo donde no
existe.

### Nota sobre `rio_l.shp`

Este shapefile es una red hidrográfica de **escala nacional** (~660 × 720 km,
30,213 features, ~3 millones de vértices), mientras el área de estudio de
Molleturo mide ~16 × 22 km. Se consultó al usuario y se confirmó **recortar**
la capa al área de estudio + 3 km de buffer (sin alterar geometrías ni
atributos dentro de ese margen). Resultado: 104 features, archivo de 96 KB en
vez de varias decenas de MB.

## 2. Capas convertidas a GeoJSON (EPSG:4326)

| Archivo generado | Features | Tipo de geometría | Campo de categoría |
|---|---|---|---|
| `Transicion_tr_1990_2000_Opt.geojson` | 25 | Polygon/MultiPolygon | `trans_grp` |
| `Transicion_tr_2000_2020_Opt.geojson` | 32 | Polygon/MultiPolygon | `trans_grp` |
| `Transicion_tr_2020_2022_Opt.geojson` | 24 | Polygon/MultiPolygon | `trans_grp` |
| `Transicion_tr0020_cacao_Opt.geojson` | 127 | Polygon/MultiPolygon | `trans_grp` |
| `Area_Estudio_Opt.geojson` | 1 | Polygon | — |
| `Poblados_Opt.geojson` | 49 | Point | — |
| `Rio_Principal_Opt.geojson` | 104 (de 30,213) | LineString/MultiLineString | `hyp_desc` (régimen) |

Todas en EPSG:4326 (lon/lat), formato plano en la raíz del aplicativo, igual
al patrón ya usado por `Sector_Censal_2022_Opt.geojson`, etc. Sin shapefiles,
sin carpetas nuevas tipo `data/`.

## 3. CRS original → CRS final

Original: `WGS_1984_UTM_Zone_17S` (EPSG:32717) en los 7 shapefiles, detectado
correctamente desde sus `.prj` (no fue necesario asumir un CRS de respaldo).
Final: EPSG:4326 (WGS84 geográfico), requerido por Leaflet.

## 4. Campo usado para simbología

`trans_grp` en las 4 capas de transición. Categorías detectadas (idénticas
en estructura a través de los periodos, con variaciones menores de nombre):
`PERSISTENCIA_BOSQUE`, `PERSISTENCIA_AGUA`, `PERSISTENCIA_USO_AGROPECUARIO(A)`,
`PERSISTENCIA_PASTO_GANADERIA`, `PERSISTENCIA_VEGETACION_SECUNDARIA`,
`PERSISTENCIA_PLANTACION`, `PERSISTENCIA_URBANO_E_INFRAESTRUCTURA`,
`GANANCIA_BOSQUE`, `PÉRDIDA_BOSQUE`, `EXPANSIÓN_AGRO`, `EXPANSIÓN_PASTO`,
`EXPANSIÓN_PLANTACIÓN`, `EXPANSIÓN_URBANA`, `RECONFIGURACIÓN_INTERNA`,
`SIN_INFORMACION_PERSISTENTE`.

**Corrección aplicada durante la verificación:** la primera versión de
`getTransitionColor()` coloreaba `EXPANSIÓN_AGRO` y `PERSISTENCIA_USO_AGROPECUARIA`
con el mismo naranja (ambas contienen "AGRO"), lo que hacía ver como "expansión
agropecuaria masiva" lo que en realidad era "persistencia" (24,628 ha estables
vs. 139 ha de expansión real en `tr_2020_2022`, según `area_ha`). Se corrigió
para que toda categoría `PERSISTENCIA_*` use grises/verdes neutros y solo
`EXPANSIÓN_*`, `GANANCIA_*`, `PÉRDIDA_*` y `RECONFIGURACIÓN_*` usen colores
vivos. Verificado visualmente tras el cambio.

## 5. Número de entidades por capa

Ver tablas de las secciones 1 y 2.

## 6. Advertencias

- `rio_l.shp`: recortado de 30,213 a 104 features (ver nota arriba). Decisión
  confirmada explícitamente por el usuario antes de ejecutar el recorte.
- Ninguna capa quedó vacía, sin CRS o sin campo de transición.
- `tr0020_cacao.shp` no tiene años en el nombre; se integró igualmente en el
  widget, etiquetada como "(sin periodo detectado en el nombre)" y ordenada al
  final de la línea de tiempo (no se inventó un periodo).
- Encoding de los `.dbf`: los acentos (`Ó`, `É`, `Ñ`) están correctamente
  codificados en UTF-8 dentro de los datos y de los GeoJSON/JSON generados.
  Si se ven como `�` en una terminal de Windows, es solo un problema de la
  consola (code page cp1252), no del archivo — confirmado inspeccionando los
  puntos de código Unicode directamente.

## 7. Archivos creados / modificados

**Nuevos:**
- `convertir_transicion_geojson.py`
- `transicion_layers.json`
- `transicion_conversion_report.json`
- `Transicion_tr_1990_2000_Opt.geojson`
- `Transicion_tr_2000_2020_Opt.geojson`
- `Transicion_tr_2020_2022_Opt.geojson`
- `Transicion_tr0020_cacao_Opt.geojson`
- `Area_Estudio_Opt.geojson`
- `Poblados_Opt.geojson`
- `Rio_Principal_Opt.geojson`
- `REPORTE_CAMBIOS_TRANSICION.md` (este archivo)

**Modificados:**
- `index.html` — nuevo `<div class="panel-section transition-widget">` con
  el widget "Transición multitemporal" (entre "Capas" y "Leyenda"). No se
  tocó el selector de mapa base, los logos ni las secciones existentes.
- `script.js` — se agregó `pane_transicion` (zIndex 550, entre `pane_tematica`
  y `pane_puntos`); se agregaron 3 entradas nuevas a `layersConfig`
  (`AreaEstudio`, `PobladosTransicion`, `RioPrincipal`, ninguna en
  `autoOnIds`); se agregó el bloque completo del widget de transición al
  final del archivo (`transitionState`, carga del manifiesto, render de
  lista, animación, opacidad, leyenda, popups). No se modificó ni eliminó
  ninguna función existente.
- `style.css` — se agregaron las clases `.transition-*` al final del
  archivo. No se modificó ningún estilo existente.

## 8. Cómo probar localmente

```bash
cd Parroquia_Molleturo-main      # esta carpeta
python convertir_transicion_geojson.py   # ya ejecutado, vuelve a correr si cambian los SHP
python -m http.server 8000
```

Abrir `http://localhost:8000` (no abrir `index.html` con doble clic: `fetch()`
falla por CORS en `file://`).

**Validado en esta sesión** (Playwright headless, sin interacción manual):
- Mapa base carga, capas existentes (`Molleturo`, `Comunidades`, `PuntosCampo`,
  `ZonasUZ`) se activan automáticamente igual que antes.
- 0 errores de consola, 0 errores de página.
- Panel "Transición multitemporal" aparece con 4 capas listadas.
- Activar una capa dibuja los polígonos y el popup muestra atributos
  (`old_gen`, `new_gen`, `trans`, `trans_grp`, `area_ha`, etc.).
- Slider de opacidad, botones Anterior/Reproducir-Pausa/Siguiente y "Combinar
  con capas anteriores" funcionan.
- La leyenda flotante cambia a categorías de transición al activar una capa,
  y al desactivar todas vuelve a la leyenda coroplética original.

## 9. Lista de validación para publicar en GitHub Pages

- [x] Todo el visor sigue siendo HTML/CSS/JS nativo + Leaflet 1.9.4 (sin
      frameworks, sin build step).
- [x] Todos los archivos de datos son `.geojson` / `.json` en la raíz, sin
      `.shp/.dbf/.shx/.prj/.cpg`.
- [x] Todas las rutas en `script.js`, `index.html` son relativas
      (`"transicion_layers.json"`, `"Transicion_xxx_Opt.geojson"`, etc.);
      sin `C:\Users\...`, sin `file:///`.
- [x] No se eliminaron capas, logos, selector de mapa base ni leyenda
      existentes.
- [ ] Subir la carpeta `Parroquia_Molleturo-main` (con los nuevos
      `.geojson`/`.json`) al repositorio de GitHub Pages y confirmar que
      `Settings → Pages` sirve desde la rama/carpeta correcta.
- [ ] Si el repositorio aplica límites de tamaño de archivo o de repo,
      verificar que `Transicion_tr_2000_2020_Opt.geojson` (~2 MB) no los
      exceda (GitHub permite archivos de hasta 100 MB sin Git LFS, así que
      no hay problema con los tamaños actuales).
