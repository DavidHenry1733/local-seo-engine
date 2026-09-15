const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [,, rawService] = process.argv;

if (!rawService) {
  console.error('Usage: node scripts/generate-service-pack.cjs "Service Name"');
  process.exit(1);
}

const service = rawService
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

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
manifest.images = manifest.images || [];

for (const slot of slots) {

  const id = `${service}-${slot}-${crypto.randomBytes(4).toString('hex')}`;

  const dir = path.join(LIB, service, slot);

  fs.mkdirSync(dir, { recursive: true });

  const filename = `${id}.txt`;

  fs.writeFileSync(
    path.join(dir, filename),
    `AI PLACEHOLDER FOR ${service} ${slot}`
  );

  manifest.images.push({
    id,
    service,
    slot,
    filename,
    description: `${service} ${slot}`,
    altTemplate: `{{Service}} {{Location}} — professional ${service} services`,
    tags: [],
    approved: true,
    addedAt: new Date().toISOString()
  });

  console.log('✓ created', slot, id);
}

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

console.log('\n✓ AI pack scaffold created for:', service);
