const fs   = require('fs');
const path = require('path');

const OLD = 'href="https://local.inboxingproweb.com/"';
const NEW = 'href="https://local.inboxingproweb.com/web-design-sheffield/"';

const sheffieldSlugs = [
  'broomhill','crookes','dore','ecclesall','fulwood',
  'hillsborough','kelham-island','nether-edge','sheffield-city-centre','woodseats'
];

let patched = 0;
for (const slug of sheffieldSlugs) {
  const htmlPath = path.join('output/rotherham-proof', slug, 'index.html');
  if (!fs.existsSync(htmlPath)) { console.log('MISSING: ' + slug); continue; }

  let html = fs.readFileSync(htmlPath, 'utf8');
  if (!html.includes(OLD)) { console.log('No hub link found: ' + slug); continue; }

  const count = (html.match(new RegExp(OLD.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g')) || []).length;
  html = html.split(OLD).join(NEW);
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('Patched ' + count + ' links in: ' + slug);
  patched++;
}
console.log('Done: ' + patched + ' Sheffield cluster pages updated');
