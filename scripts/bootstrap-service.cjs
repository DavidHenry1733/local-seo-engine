const fs = require('fs');
const path = require('path');

const [,, rawName] = process.argv;

if (!rawName) {
  console.error('Usage: node scripts/bootstrap-service.cjs "Service Name"');
  process.exit(1);
}

const key = rawName
  .trim()
  .toLowerCase()
  .replace(/[\s_]+/g, '-')
  .replace(/[^a-z0-9-]/g, '')
  .replace(/-+/g, '-')
  .replace(/^-+|-+$/g, '');

const ROOT = process.cwd();
const LIB  = path.join(ROOT, 'assets', 'image-library');
const MANIFEST = path.join(LIB, 'image-library.json');

const slots = ['hero', 'support', 'trust', 'conversion'];

for (const slot of slots) {
  fs.mkdirSync(path.join(LIB, key, slot), { recursive: true });
}

let manifest = { images: [] };

if (fs.existsSync(MANIFEST)) {
  manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

manifest.images = manifest.images || [];

const exists = manifest.images.some(i => i.service === key);

if (!exists) {
  console.log('✓ Service bootstrapped:', key);
  console.log('✓ Folders created');
  console.log('⚠ No images yet — AI/library generation required');
} else {
  console.log('✓ Service already exists in manifest');
}

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

console.log('\nSERVICE KEY:', key);
