const fs   = require('fs');
const path = require('path');

const osmUrl = 'https://www.openstreetmap.org/export/embed.html?bbox=-1.3643%2C53.4165%2C-1.3443%2C53.4365&layer=mapnik&marker=53.4265%2C-1.3543';

// Match any Google Maps embed URL or previous OSM URL in src attributes
const mapRegex = /https:\/\/(?:maps\.google\.com\/maps|www\.openstreetmap\.org\/export\/embed\.html)[^"']*/g;

const outputBase = 'output/rotherham-proof';
const dirs = fs.readdirSync(outputBase).filter(d => {
  return fs.existsSync(path.join(outputBase, d, 'index.html'));
});

let patched = 0;
for (const dir of dirs) {
  const htmlPath = path.join(outputBase, dir, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  mapRegex.lastIndex = 0;
  if (!mapRegex.test(html)) { mapRegex.lastIndex = 0; console.log('No map found: ' + dir); continue; }
  mapRegex.lastIndex = 0;

  const updated = html.replace(mapRegex, osmUrl);
  if (updated === html) { console.log('No change: ' + dir); continue; }

  fs.writeFileSync(htmlPath, updated, 'utf8');
  console.log('Patched: ' + dir);
  patched++;
}
console.log('Done: ' + patched + ' files updated to OpenStreetMap embed');
