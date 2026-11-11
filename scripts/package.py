"""Build a clean unpacked-extension archive using only the Python standard library."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
files = ['manifest.json', 'background.js', 'money.js', 'content.js', 'content.css',
         'popup.html', 'popup.js', 'popup.css', 'LICENSE']
files += [f'icons/icon{size}.png' for size in (16, 32, 48, 128)]
for name in files:
    if not (ROOT / name).is_file():
        raise FileNotFoundError(name)
output = ROOT / 'dist' / f'shekel-converter-{manifest["version"]}.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', compression=ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(ROOT / name, arcname=name)
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert 'manifest.json' in archive.namelist()
    assert set(archive.namelist()) == set(files)
print(f'Created {output.name} ({output.stat().st_size:,} bytes; {len(files)} files)')
