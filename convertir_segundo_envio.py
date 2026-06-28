# convertir_segundo_envio.py
#
# Convierte las 5 capas del "2do envio" (carpeta SEGUNDO ENVIO) a GeoJSON
# optimizado en EPSG:4326, listas para el visor:
#   - cacao_2015.shp          -> Cacao_2015_Opt.geojson
#       (Grupo C "Sistemas cacaoteros destacados" del mapa
#       02_1_Cobertura_suelo.pdf; es la ÚNICA cobertura de suelo
#       disponible como vector en este envío — no incluye Bosque,
#       Pasto, Agua, etc. de los grupos A/B/D del mismo mapa)
#   - limite_provincial_gad.shp -> Limite_Provincial_GAD_Opt.geojson
#   - poblados_igm250.shp      -> Poblados_IGM250_Opt.geojson
#   - snap_mae.shp             -> SNAP_Opt.geojson
#   - via_l.shp                -> Red_Vial_Estatal_Opt.geojson (recortada
#       al área de estudio + buffer: el shapefile original es la red vial
#       estatal completa, ~206 mil features a escala nacional)
#
# Ejecutar desde la raíz del aplicativo:
#   python convertir_segundo_envio.py

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd

ROOT = Path(__file__).resolve().parent

CANDIDATE_DIRS = [
    ROOT.parent.parent / "2do envio" / "SEGUNDO ENVIO",
    ROOT.parent / "2do envio" / "SEGUNDO ENVIO",
    ROOT / "2do envio" / "SEGUNDO ENVIO",
]

SIMPLIFY_TOLERANCE_DEG = 0.00003
VIAL_CLIP_BUFFER_M = 5000

# cacao_sys -> categoría oficial "Grupo C" del mapa 02_1_Cobertura_suelo.pdf.
# Inferido del propio nombre del campo (alim = mezclado con cultivos
# alimentarios, sin = sin cultivos alimentarios cercanos = exclusivo de
# cacao, teca = con teca): no se inventan categorías, se usa la única
# correspondencia consistente con los 3 valores reales del campo y los 3
# ítems reales de la leyenda "Grupo C".
CACAO_SYS_TO_GRUPO_C = {
    "CACAO_ALIM_SIN50B": "Cultivos de exclusivos de cacao",
    "CACAO_ALIM_CON50B": "Cultivos mixtos de cacao",
    "CACAO_TECA_CON50B": "Cacao con teca y cultivos mixtos",
}


def find_dir() -> Path:
    for d in CANDIDATE_DIRS:
        if d.exists():
            return d
    raise FileNotFoundError("No se encontró la carpeta '2do envio/SEGUNDO ENVIO'.")


def export(gdf: gpd.GeoDataFrame, out_path: Path) -> dict:
    gdf.to_file(out_path, driver="GeoJSON")
    with out_path.open("r", encoding="utf-8") as f:
        geojson = json.load(f)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))
    return {"file": out_path.name, "features": len(gdf), "size_kb": round(out_path.stat().st_size / 1024, 1)}


def load_reproject(path: Path, assumed_crs: str | None) -> gpd.GeoDataFrame:
    gdf = gpd.read_file(path)
    if gdf.crs is None:
        if not assumed_crs:
            raise ValueError(f"{path.name}: sin CRS y sin asumido de respaldo")
        gdf = gdf.set_crs(assumed_crs, allow_override=True)
    if gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)
    return gdf


def clean_and_simplify(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
    try:
        gdf["geometry"] = gdf.geometry.make_valid()
    except Exception:
        try:
            gdf["geometry"] = gdf.geometry.buffer(0)
        except Exception:
            pass
    try:
        gdf["geometry"] = gdf.geometry.simplify(SIMPLIFY_TOLERANCE_DEG, preserve_topology=True)
    except Exception:
        pass
    return gdf[~gdf.geometry.is_empty].copy()


def main() -> None:
    src_dir = find_dir()
    report = []

    # --- cacao_2015 ---
    gdf = load_reproject(src_dir / "cacao_2015.shp", "EPSG:32717")
    gdf = clean_and_simplify(gdf)
    gdf["grupo_c"] = gdf["cacao_sys"].astype(str).str.upper().map(CACAO_SYS_TO_GRUPO_C)
    unmapped = gdf["grupo_c"].isna().sum()
    info = export(gdf, ROOT / "Cacao_2015_Opt.geojson")
    info["unmapped_cacao_sys"] = int(unmapped)
    report.append(("cacao_2015", info))

    # --- limite_provincial_gad ---
    gdf = load_reproject(src_dir / "limite_provincial_gad.shp", "EPSG:32717")
    gdf = clean_and_simplify(gdf)
    info = export(gdf, ROOT / "Limite_Provincial_GAD_Opt.geojson")
    report.append(("limite_provincial_gad", info))

    # --- poblados_igm250 ---
    gdf = load_reproject(src_dir / "poblados_igm250.shp", "EPSG:32717")
    gdf = clean_and_simplify(gdf)
    info = export(gdf, ROOT / "Poblados_IGM250_Opt.geojson")
    report.append(("poblados_igm250", info))

    # --- snap_mae (ya trae CRS propio: EPSG:3857) ---
    gdf = load_reproject(src_dir / "snap_mae.shp", None)
    gdf = clean_and_simplify(gdf)
    info = export(gdf, ROOT / "SNAP_Opt.geojson")
    report.append(("snap_mae", info))

    # --- via_l: recortar al área de estudio (escala nacional original) ---
    area_path = src_dir.parent.parent / "Area_estudio.shp"
    if not area_path.exists():
        area_path = ROOT.parent.parent / "Area_estudio.shp"
    area_gdf = gpd.read_file(area_path)
    if area_gdf.crs is None:
        area_gdf = area_gdf.set_crs("EPSG:32717", allow_override=True)
    area_gdf_m = area_gdf.to_crs(epsg=32717)
    buffered = area_gdf_m.buffer(VIAL_CLIP_BUFFER_M)
    clip_geom_4326 = gpd.GeoSeries(buffered, crs=32717).to_crs(epsg=4326)

    gdf = load_reproject(src_dir / "via_l.shp", "EPSG:32717")
    before = len(gdf)
    gdf = gpd.clip(gdf, clip_geom_4326)
    gdf = clean_and_simplify(gdf)
    info = export(gdf, ROOT / "Red_Vial_Estatal_Opt.geojson")
    info["features_before_clip"] = before
    report.append(("via_l", info))

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
