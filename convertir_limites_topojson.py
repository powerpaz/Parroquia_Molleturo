# convertir_limites_topojson.py
#
# Convierte los limites administrativos nacionales (Parroquial.geojson,
# Provincial.geojson - dataset CONALI, cientos de MB para todo Ecuador) a
# TopoJSON liviano, recortando cada uno a la feature relevante para este
# visor (parroquia Molleturo / provincia Azuay) antes de publicar.
#
# Requiere que Parroquial.geojson y Provincial.geojson existan en la
# carpeta padre del proyecto (mismo nivel que 2_4_Transicion). No se
# commitean esos archivos fuente al repo: solo el resultado liviano.
#
# Ejecutar desde la raiz del aplicativo:
#   python convertir_limites_topojson.py

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import topojson as tp

ROOT = Path(__file__).resolve().parent

CANDIDATE_DIRS = [
    ROOT.parent.parent,
    ROOT.parent,
    ROOT,
]

SIMPLIFY_TOLERANCE_DEG = 0.0003


def find_source(filename: str) -> Path:
    for d in CANDIDATE_DIRS:
        p = d / filename
        if p.exists():
            return p
    raise FileNotFoundError(
        f"No se encontro {filename}. Colocalo junto a la carpeta del proyecto."
    )


def extract_feature(src: Path, field: str, value: str) -> dict:
    """Extrae una sola feature por streaming (ijson) sin cargar el archivo
    completo en memoria: los GeoJSON nacionales pesan cientos de MB."""
    import ijson
    from decimal import Decimal

    def convert(o):
        if isinstance(o, Decimal):
            return float(o)
        if isinstance(o, list):
            return [convert(x) for x in o]
        if isinstance(o, dict):
            return {k: convert(v) for k, v in o.items()}
        return o

    with src.open("rb") as f:
        for feat in ijson.items(f, "features.item"):
            if str(feat["properties"].get(field, "")).strip().upper() == value.upper():
                return convert(feat)

    raise ValueError(f"No se encontro {field}={value} en {src.name}")


def build_topojson(feature: dict, source_crs: str, object_name: str, out_path: Path, label_field: str) -> dict:
    gdf = gpd.GeoDataFrame.from_features([feature])
    gdf = gdf.set_crs(source_crs, allow_override=True)
    if gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    try:
        gdf["geometry"] = gdf.geometry.simplify(SIMPLIFY_TOLERANCE_DEG, preserve_topology=True)
    except Exception:
        pass

    topo = tp.Topology(gdf, prequantize=False, object_name=object_name)
    topo_dict = json.loads(topo.to_json())

    out_path.write_text(json.dumps(topo_dict, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    label = feature["properties"].get(label_field, object_name)
    return {
        "object_name": object_name,
        "label": label,
        "out_path": out_path.name,
        "size_kb": round(out_path.stat().st_size / 1024, 1),
    }


def main() -> None:
    report = []

    parroquial_src = find_source("Parroquial.geojson")
    feat = extract_feature(parroquial_src, "DPA_DESPAR", "MOLLETURO")
    info = build_topojson(
        feat,
        source_crs="EPSG:32717",
        object_name="Parroquial",
        out_path=ROOT / "Parroquial.topo.json",
        label_field="DPA_DESPAR",
    )
    report.append(info)
    print(f"OK Parroquial -> {info['out_path']} ({info['size_kb']} KB)")

    provincial_src = find_source("Provincial.geojson")
    feat = extract_feature(provincial_src, "DPA_DESPRO", "AZUAY")
    info = build_topojson(
        feat,
        source_crs="EPSG:4326",
        object_name="Provincial",
        out_path=ROOT / "Provincial.topo.json",
        label_field="DPA_DESPRO",
    )
    report.append(info)
    print(f"OK Provincial -> {info['out_path']} ({info['size_kb']} KB)")

    print("Listo:", report)


if __name__ == "__main__":
    main()
