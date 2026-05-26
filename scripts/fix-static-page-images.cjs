const fs = require('fs');

const [,, pagePath, serviceKey, domain = 'https://local.inboxingproweb.com'] = process.argv;
if (!pagePath || !serviceKey) {
  console.error('Usage: node scripts/fix-static-page-images.cjs PAGE_PATH SERVICE_KEY [DOMAIN]');
  process.exit(1);
}

let html = fs.readFileSync(pagePath, 'utf8');
const svc = serviceKey.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
const base = domain.replace(/\/+$/, '') + '/assets/inboxingproweb/' + svc;
const slots = ['hero', 'support', 'trust', 'conversion'];
let idx = 0;

html = html.replace(/<img\b[^>]*>/gi, (tag) => {
  if (tag.includes('Proweb-1-1.png.webp')) return tag;
  if (idx >= slots.length) return tag;
  const slot = slots[idx++];
  return tag.replace(/\bsrc="[^"]*"/i, `src="${base}/${slot}.webp"`);
});

fs.writeFileSync(pagePath, html, 'utf8');
console.log(`PASS: mapped ${idx} images for ${pagePath}`);
