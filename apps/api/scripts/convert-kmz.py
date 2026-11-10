"""Convert a supplied KMZ to GeoJSON without inventing boundaries or classifications."""
import argparse
import hashlib
import html
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('input')
parser.add_argument('output')
parser.add_argument('--source-url', required=True)
args = parser.parse_args()
with zipfile.ZipFile(args.input) as archive:
    source = archive.read(next(n for n in archive.namelist() if n.endswith('.kml'))).decode('utf-8-sig')
# Some GIS exports use xsi:schemaLocation without declaring the prefix.
if 'xsi:' in source and 'xmlns:xsi=' not in source:
    source = source.replace('<kml ', '<kml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ', 1)
root = ET.fromstring(source)
ns = {'k': 'http://www.opengis.net/kml/2.2'}
styles = {s.get('id'): s for s in root.findall('.//k:Style', ns)}
style_maps = {s.get('id'): s for s in root.findall('.//k:StyleMap', ns)}

def color(ref):
    key = ref.lstrip('#')
    if key in style_maps:
        pairs = style_maps[key].findall('k:Pair', ns)
        pair = next((p for p in pairs if p.findtext('k:key', namespaces=ns) == 'normal'), pairs[0])
        return color(pair.findtext('k:styleUrl', default='', namespaces=ns))
    style = styles.get(key)
    kml = style.findtext('k:PolyStyle/k:color', default='80245c50', namespaces=ns) if style is not None else '80245c50'
    return '#' + kml[6:8] + kml[4:6] + kml[2:4]

def ring(element):
    raw = element.findtext('k:LinearRing/k:coordinates', default='', namespaces=ns)
    coords = [[float(v) for v in pair.split(',')[:2]] for pair in raw.split()]
    if len(coords) < 3 or any(len(p) != 2 or not -180 <= p[0] <= 180 or not -90 <= p[1] <= 90 for p in coords):
        raise ValueError('Anillo de coordenadas inválido')
    if coords[0] != coords[-1]: coords.append(coords[0])
    return coords

features = []
for index, place in enumerate(root.findall('.//k:Placemark', ns)):
    polygons = place.findall('.//k:Polygon', ns)
    if not polygons: continue
    name = place.findtext('k:name', default='', namespaces=ns).strip()
    description = place.findtext('k:description', default='', namespaces=ns)
    fields = dict(re.findall(r'<td>\s*([^<]+?)\s*</td>\s*<td>\s*([^<]+?)\s*</td>', description))
    name = html.unescape(fields.get('MACROZONA', fields.get('NOMBRE', name))).strip()
    if not name: raise ValueError('Zona sin nombre')
    geometry = []
    for polygon in polygons:
        outer = polygon.find('k:outerBoundaryIs', ns)
        if outer is None: raise ValueError('Polígono sin límite exterior')
        geometry.append([ring(outer)] + [ring(hole) for hole in polygon.findall('k:innerBoundaryIs', ns)])
    identifier = 'macro-' + hashlib.sha256(name.encode()).hexdigest()[:12]
    if any(f['properties']['id'] == identifier for f in features): raise ValueError('Nombre de zona repetido: ' + name)
    features.append({'type':'Feature','properties':{
        'id':identifier,'name':name,'description':'Macrozona del archivo proporcionado por el equipo. Su delimitación no identifica por sí sola los biotopos interiores.',
        'color':color(place.findtext('k:styleUrl', default='', namespaces=ns)),
        'kind':'macrozone','parentId':None,'source':Path(args.input).name,'sourceUrl':args.source_url,
    }, 'geometry':{'type':'MultiPolygon','coordinates':geometry}})
destination = Path(args.output)
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps({'zones':len(features),'names':[f['properties']['name'] for f in features],'bytes':destination.stat().st_size},ensure_ascii=False))
