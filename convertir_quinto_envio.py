# convertir_quinto_envio.py
#
# Convierte la capa del "5to envio" (carpeta QUINTO ENVIO) a GeoJSON
# optimizado en EPSG:4326, lista para el visor:
#   - InventarioVial_GADPA_25nov2025_l.shp -> InventarioVial_GADPA_Opt.geojson
#       (Inventario vial del GAD Provincial de Azuay, escala provincial;
#       igual que via_l en el 2do envío, se recorta al área de estudio +
#       buffer para no cargar las ~4000 vías de toda la provincia)
#
# Ejecutar desde la raíz del aplicativo:
#   python convertir_quinto_envio.py

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd

ROOT = Path(__file__).resolve().parent

CANDIDATE_DIRS = [
    ROOT.parent.parent / "5to envio" / "QUINTO ENVIO",
    ROOT.parent / "5to envio" / "QUINTO ENVIO",
    ROOT / "5to envio" / "QUINTO ENVIO",
]

SIMPLIFY_TOLERANCE_DEG = 0.00003
VIAL_CLIP_BUFFER_M = 5000


def find_dir() -> Path:
    for d in CANDIDATE_DIRS:
        if d.exists():
            return d
    raise FileNotFoundError("No se encontró la carpeta '5to envio/QUINTO ENVIO'.")


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

    # --- InventarioVial_GADPA: recortar al área de estudio (escala provincial original) ---
    area_path = ROOT / "Area_Estudio_Opt.geojson"
    area_gdf = gpd.read_file(area_path)
    area_gdf_m = area_gdf.to_crs(epsg=32717)
    buffered = area_gdf_m.buffer(VIAL_CLIP_BUFFER_M)
    clip_geom_4326 = gpd.GeoSeries(buffered, crs=32717).to_crs(epsg=4326)

    gdf = load_reproject(src_dir / "InventarioVial_GADPA_25nov2025_l.shp", "EPSG:32717")
    before = len(gdf)
    gdf = gpd.clip(gdf, clip_geom_4326)
    gdf = clean_and_simplify(gdf)
    info = export(gdf, ROOT / "InventarioVial_GADPA_Opt.geojson")
    info["features_before_clip"] = before
    report.append(("InventarioVial_GADPA_25nov2025_l", info))

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
