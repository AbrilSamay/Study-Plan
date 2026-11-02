"""Empaqueta fuentes instalables; excluye perfiles, pruebas generadas y dependencias."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parents[1]
version = json.loads((root / "manifest.json").read_text(encoding="utf-8"))["version"]
destination = root.parent / f"Unisono-Web-{version}.zip"
excluded = {"artifacts", "node_modules", ".git", "__pycache__"}

with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
    for file in sorted(root.rglob("*")):
        relative = file.relative_to(root)
        if file.is_file() and not excluded.intersection(relative.parts) and file.suffix != ".zip":
            archive.write(file, Path(root.name) / relative)

with ZipFile(destination) as archive:
    assert archive.testzip() is None
    assert f"{root.name}/manifest.json" in archive.namelist()
    assert not any("/artifacts/" in name for name in archive.namelist())
    print(f"Paquete verificado: {destination.name} ({len(archive.namelist())} archivos, {destination.stat().st_size:,} bytes)")
