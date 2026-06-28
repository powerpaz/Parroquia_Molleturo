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


def _decimal_to_float(o):
    from decimal import Decimal

    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, list):
        return [_decimal_to_float(x) for x in o]
    if isinstance(o, dict):
        return {k: _decimal_to_float(v) for k, v in o.items()}
    return o


def extract_feature(src: Path, field: str, value: str) -> dict:
    """Extrae una sola feature por streaming (ijson) sin cargar el archivo
    completo en memoria: los GeoJSON nacionales pesan cientos de MB."""
    import ijson

    with src.open("rb") as f:
        for feat in ijson.items(f, "features.item"):
            if str(feat["properties"].get(field, "")).strip().upper() == value.upper():
                return _decimal_to_float(feat)

    raise ValueError(f"No se encontro {field}={value} en {src.name}")


def extract_all_features(src: Path) -> list[dict]:
    """Extrae TODAS las features por streaming (ijson), sin cargar el
    archivo completo en memoria. Se usa para Provincial.geojson: el dataset
    nacional completo (todas las provincias de Ecuador), no solo Azuay."""
    import ijson

    feats = []
    with src.open("rb") as f:
        for feat in ijson.items(f, "features.item"):
            feats.append(_decimal_to_float(feat))
    return feats


def build_topojson(features: list[dict] | dict, source_crs: str, object_name: str, out_path: Path, label_field: str) -> dict:
    if isinstance(features, dict):
        features = [features]

    gdf = gpd.GeoDataFrame.from_features(features)
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

    labels = sorted({f["properties"].get(label_field, object_name) for f in features})
    return {
        "object_name": object_name,
        "labels": labels,
        "feature_count": len(features),
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
    feats = extract_all_features(provincial_src)
    info = build_topojson(
        feats,
        source_crs="EPSG:4326",
        object_name="Provincial",
        out_path=ROOT / "Provincial.topo.json",
        label_field="DPA_DESPRO",
    )
    report.append(info)
    print(f"OK Provincial ({info['feature_count']} provincias) -> {info['out_path']} ({info['size_kb']} KB)")

    print("Listo:", report)


if __name__ == "__main__":
    main()
