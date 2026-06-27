# convertir_transicion_geojson.py
#
# Convierte los Shapefiles de la carpeta 2_4_Transicion a GeoJSON optimizado
# (EPSG:4326) y los publica en la raíz del aplicativo, siguiendo el mismo
# esquema plano que ya usa Parroquia_Molleturo-main (.geojson / .json en raíz).
#
# Genera:
#   - Transicion_<nombre>_Opt.geojson   (las 4 capas multitemporales reales,
#                                         con campo trans_grp -> alimentan el
#                                         widget "Transición multitemporal")
#   - Area_Estudio_Opt.geojson          (capa de contexto -> panel "Capas")
#   - Poblados_Opt.geojson              (capa de contexto -> panel "Capas")
#   - Rio_Principal_Opt.geojson         (capa de contexto, recortada al área
#                                         de estudio -> panel "Capas")
#   - transicion_layers.json            (manifiesto que consume script.js)
#   - transicion_conversion_report.json (reporte de auditoría de la conversión)
#
# Ejecutar desde la raíz del aplicativo:
#   python convertir_transicion_geojson.py

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path

import geopandas as gpd

ROOT = Path(__file__).resolve().parent

# Candidatas en orden de búsqueda. Se incluyen variantes anidadas porque el
# ZIP del visor puede quedar extraído dentro de una subcarpeta intermedia.
CANDIDATE_DIRS = [
    ROOT / "2_4_Transicion",
    ROOT.parent / "2_4_Transicion",
    ROOT.parent.parent / "2_4_Transicion",
    ROOT.parent.parent if ROOT.parent.parent.name == "2_4_Transicion" else None,
    ROOT.parent if ROOT.parent.name == "2_4_Transicion" else None,
    ROOT / "insumos" / "2_4_Transicion",
    ROOT / "capas" / "2_4_Transicion",
    ROOT / "shapes" / "2_4_Transicion",
    ROOT / "data" / "2_4_Transicion",
]
CANDIDATE_DIRS = [d for d in CANDIDATE_DIRS if d is not None]

OUT_MANIFEST = ROOT / "transicion_layers.json"
OUT_REPORT = ROOT / "transicion_conversion_report.json"

# Tolerancia de simplificación en grados (ligera, para no deformar polígonos
# pequeños a escala de comuna). ~0.00005 grados ~ 5 m en el ecuador.
SIMPLIFY_TOLERANCE = 0.00005

# Buffer (en metros, sobre la proyección UTM original) usado para recortar
# capas de contexto que excedan ampliamente el área de estudio (p. ej. redes
# hídricas nacionales). No se inventan datos: solo se descarta lo que cae
# fuera del entorno inmediato de Molleturo.
CONTEXT_CLIP_BUFFER_M = 3000

# Las 4 capas reales de transición multitemporal (tienen año/periodo en el
# nombre y campo categórico trans_grp). Alimentan transicion_layers.json y
# el widget "Transición multitemporal".
TRANSITION_SHP_STEMS = {
    "tr0020_cacao",
    "tr_1990_2000",
    "tr_2000_2020",
    "tr_2020_2022",
}

# Capas de contexto (no son series temporales): se integran como capas
# normales del panel "Capas" existente, no en el widget de transición.
CONTEXT_LAYER_PLAN = {
    "Area_estudio": {"out_name": "Area_Estudio_Opt.geojson", "clip_to_study_area": False},
    "Poblados": {"out_name": "Poblados_Opt.geojson", "clip_to_study_area": False},
    "rio_l": {"out_name": "Rio_Principal_Opt.geojson", "clip_to_study_area": True},
}

STYLE_FIELDS = [
    "trans_grp", "Trans_grp", "TRANS_GRP",
    "transicion", "Transicion", "TRANSICION",
    "transition", "cambio", "change",
    "categoria", "category", "clase", "class",
    "tipo", "cobertura", "leyenda", "legend", "name", "nombre",
]


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^a-zA-Z0-9_]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    return value or "capa"


def _relative_label(path: Path, base: Path) -> str:
    """Etiqueta legible sin exponer rutas absolutas de Windows en los
    reportes JSON publicados junto al visor."""
    try:
        return str(path.relative_to(base))
    except ValueError:
        try:
            import os
            return os.path.relpath(path, base).replace("\\", "/")
        except ValueError:
            return path.name


def find_transition_folder() -> Path:
    for folder in CANDIDATE_DIRS:
        if folder.exists() and folder.is_dir() and list(folder.glob("*.shp")):
            return folder
    raise FileNotFoundError(
        "No se encontró la carpeta 2_4_Transicion con archivos .shp. "
        "Colócala junto a index.html, en el nivel superior del proyecto, "
        "o dentro de insumos/capas/shapes/data, y vuelve a ejecutar este script."
    )


def infer_years(name: str) -> dict:
    years = re.findall(r"(?:19|20)\d{2}", name)
    years_unique = []
    for y in years:
        if y not in years_unique:
            years_unique.append(y)
    result = {
        "years": [int(y) for y in years_unique],
        "yearFrom": None,
        "yearTo": None,
        "timeLabel": name,
    }
    if len(years_unique) >= 2:
        result["yearFrom"] = int(years_unique[0])
        result["yearTo"] = int(years_unique[-1])
        result["timeLabel"] = f"{years_unique[0]}–{years_unique[-1]}"
    elif len(years_unique) == 1:
        result["yearFrom"] = int(years_unique[0])
        result["yearTo"] = int(years_unique[0])
        result["timeLabel"] = years_unique[0]
    return result


def pick_category_field(columns: list[str]) -> str | None:
    lower_map = {c.lower(): c for c in columns}
    for p in STYLE_FIELDS:
        if p.lower() in lower_map:
            return lower_map[p.lower()]
    return None


def geometry_type_label(gdf: gpd.GeoDataFrame) -> str:
    try:
        geom_types = sorted(set(gdf.geometry.geom_type.dropna().astype(str)))
        return ",".join(geom_types)
    except Exception:
        return "Unknown"


def reproject_and_clean(gdf: gpd.GeoDataFrame, item_report: dict) -> gpd.GeoDataFrame:
    if gdf.crs is None:
        gdf = gdf.set_crs(epsg=32717, allow_override=True)
        msg = "CRS ausente en el shapefile. Se asumió EPSG:32717 (UTM 17S, igual al .prj de las capas hermanas). Verificar manualmente."
        item_report["warnings"].append(msg)
    elif gdf.crs.to_epsg() != 4326:
        item_report["sourceCrs"] = str(gdf.crs)

    gdf = gdf.to_crs(epsg=4326)

    gdf = gdf[gdf.geometry.notna()].copy()
    gdf = gdf[~gdf.geometry.is_empty].copy()

    try:
        gdf["geometry"] = gdf.geometry.make_valid()
    except Exception:
        try:
            gdf["geometry"] = gdf.geometry.buffer(0)
        except Exception as exc:
            item_report["warnings"].append(f"No se pudo reparar geometría automáticamente: {exc}")

    try:
        gdf["geometry"] = gdf.geometry.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
    except Exception as exc:
        item_report["warnings"].append(f"No se pudo simplificar geometría: {exc}")

    gdf = gdf[~gdf.geometry.is_empty].copy()
    return gdf


def export_geojson(gdf: gpd.GeoDataFrame, out_path: Path) -> None:
    gdf.to_file(out_path, driver="GeoJSON")
    with out_path.open("r", encoding="utf-8") as f:
        geojson = json.load(f)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))


def process_transition_layer(shp: Path, idx: int, report: dict) -> dict | None:
    item_report = {"source": str(shp.name), "status": "pending", "warnings": [], "role": "transicion_multitemporal"}
    try:
        gdf = gpd.read_file(shp)
        original_count = len(gdf)
        if original_count == 0:
            item_report["status"] = "skipped_empty"
            report["layers"].append(item_report)
            return None

        gdf = reproject_and_clean(gdf, item_report)

        base_name = slugify(shp.stem)
        out_name = f"Transicion_{base_name}_Opt.geojson"
        out_path = ROOT / out_name
        export_geojson(gdf, out_path)

        y0y1 = infer_years(shp.stem)
        fields = [c for c in gdf.columns if c != gdf.geometry.name]
        category_field = pick_category_field(fields)
        geom_type = geometry_type_label(gdf)

        if shp.stem == "tr0020_cacao":
            # Nombre oficial según "02_4_Transición.pdf": esta capa es la
            # superposición "Transición 2000-2020 hacia el cacao", no un
            # escenario independiente (se solapa automáticamente sobre
            # 2000-2020 en el visor).
            label = "Transición 2000–2020 hacia el cacao (información 2015)"
        elif y0y1["yearFrom"] is not None:
            label = f"Transición {y0y1['timeLabel']}"
        else:
            human_name = shp.stem.replace("_", " ").replace("-", " ").strip()
            label = f"Transición {human_name} (sin periodo detectado en el nombre)"

        layer_obj = {
            "id": f"transicion_{base_name}".lower(),
            "label": label,
            "url": out_name,
            "source": shp.name,
            "geometryType": geom_type,
            "featureCount": int(len(gdf)),
            "categoryField": category_field,
            "fields": fields,
            "order": idx,
            **y0y1,
        }

        item_report.update({
            "status": "ok",
            "output": out_name,
            "featuresOriginal": int(original_count),
            "featuresOutput": int(len(gdf)),
            "crsOutput": "EPSG:4326",
            "geometryType": geom_type,
            "categoryField": category_field,
            "fields": fields,
        })
        report["layers"].append(item_report)
        return layer_obj
    except Exception as exc:
        item_report["status"] = "error"
        item_report["error"] = str(exc)
        report["layers"].append(item_report)
        return None


def process_context_layer(shp: Path, plan: dict, study_area_geom_4326, report: dict) -> dict | None:
    item_report = {"source": str(shp.name), "status": "pending", "warnings": [], "role": "capa_contexto_panel_capas"}
    try:
        gdf = gpd.read_file(shp)
        original_count = len(gdf)
        if original_count == 0:
            item_report["status"] = "skipped_empty"
            report["layers"].append(item_report)
            return None

        gdf = reproject_and_clean(gdf, item_report)

        if plan["clip_to_study_area"] and study_area_geom_4326 is not None:
            before = len(gdf)
            gdf = gpd.clip(gdf, study_area_geom_4326)
            gdf = gdf[~gdf.geometry.is_empty].copy()
            item_report["warnings"].append(
                f"Capa recortada al área de estudio + buffer de {CONTEXT_CLIP_BUFFER_M} m "
                f"(decisión confirmada por el usuario: la capa original es de escala nacional). "
                f"Features antes del recorte: {before}, después: {len(gdf)}."
            )

        out_name = plan["out_name"]
        out_path = ROOT / out_name
        export_geojson(gdf, out_path)

        fields = [c for c in gdf.columns if c != gdf.geometry.name]
        geom_type = geometry_type_label(gdf)

        item_report.update({
            "status": "ok",
            "output": out_name,
            "featuresOriginal": int(original_count),
            "featuresOutput": int(len(gdf)),
            "crsOutput": "EPSG:4326",
            "geometryType": geom_type,
            "fields": fields,
        })
        report["layers"].append(item_report)
        return {"id": shp.stem, "output": out_name, "featureCount": int(len(gdf)), "fields": fields, "geometryType": geom_type}
    except Exception as exc:
        item_report["status"] = "error"
        item_report["error"] = str(exc)
        report["layers"].append(item_report)
        return None


def main() -> None:
    src_dir = find_transition_folder()
    shp_files = sorted(src_dir.glob("*.shp"))

    report = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "sourceFolder": _relative_label(src_dir, ROOT),
        "outputFolder": ".",
        "formatRule": "GeoJSON/JSON planos en la raíz del aplicativo (igual al ZIP original)",
        "layers": [],
        "warnings": [],
        "contextLayers": [],
    }

    # Geometría del área de estudio en EPSG:4326 (para recortar capas de
    # contexto desproporcionadas, p. ej. rio_l).
    study_area_geom_4326 = None
    area_shp = src_dir / "Area_estudio.shp"
    if area_shp.exists():
        area_gdf = gpd.read_file(area_shp)
        if area_gdf.crs is None:
            area_gdf = area_gdf.set_crs(epsg=32717, allow_override=True)
        area_gdf_m = area_gdf.to_crs(epsg=32717)
        buffered = area_gdf_m.buffer(CONTEXT_CLIP_BUFFER_M)
        study_area_geom_4326 = gpd.GeoSeries(buffered, crs=32717).to_crs(epsg=4326)

    transition_layers: list[dict] = []
    context_layers: list[dict] = []

    for idx, shp in enumerate(shp_files, start=1):
        stem = shp.stem
        if stem in TRANSITION_SHP_STEMS:
            layer_obj = process_transition_layer(shp, idx, report)
            if layer_obj:
                transition_layers.append(layer_obj)
        elif stem in CONTEXT_LAYER_PLAN:
            ctx = process_context_layer(shp, CONTEXT_LAYER_PLAN[stem], study_area_geom_4326, report)
            if ctx:
                context_layers.append(ctx)
        else:
            report["layers"].append({
                "source": shp.name,
                "status": "skipped_unrecognized",
                "warnings": [
                    "Shapefile no reconocido en TRANSITION_SHP_STEMS ni CONTEXT_LAYER_PLAN. "
                    "No se convirtió para evitar suposiciones sobre su rol en el visor."
                ],
            })

    transition_layers = sorted(
        transition_layers,
        key=lambda x: (
            x.get("yearFrom") if x.get("yearFrom") is not None else 9999,
            x.get("yearTo") if x.get("yearTo") is not None else 9999,
            x.get("label", ""),
        ),
    )
    for i, layer in enumerate(transition_layers, start=1):
        layer["order"] = i

    manifest = {
        "type": "transition_layers_manifest",
        "version": "1.0",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "structure": "flat-root-geojson-json",
        "description": "Capas convertidas desde SHP de 2_4_Transicion para visor Leaflet estático.",
        "layers": transition_layers,
        "defaultStyle": {
            "color": "#7f1d1d",
            "weight": 1.1,
            "opacity": 0.85,
            "fillColor": "#f97316",
            "fillOpacity": 0.45,
        },
        "categoryPalette": [
            "#7f1d1d", "#b91c1c", "#dc2626", "#f97316", "#f59e0b",
            "#84cc16", "#16a34a", "#0891b2", "#2563eb", "#7c3aed",
            "#9333ea", "#db2777", "#475569", "#111827",
        ],
    }

    report["contextLayers"] = context_layers

    with OUT_MANIFEST.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    with OUT_REPORT.open("w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("Conversion finalizada")
    print(f"Carpeta origen: {src_dir}")
    print(f"Capas de transicion multitemporal: {len(transition_layers)}")
    print(f"Capas de contexto: {len(context_layers)}")
    print(f"Manifiesto: {OUT_MANIFEST.name}")
    print(f"Reporte: {OUT_REPORT.name}")


if __name__ == "__main__":
    main()
