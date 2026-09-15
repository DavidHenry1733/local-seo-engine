const fs = require('fs');

const [,, filePath, serviceKey] = process.argv;

if (!filePath || !serviceKey) {
  console.error('Usage: node scripts/validate-service-page.cjs FILE SERVICE_KEY');
  process.exit(1);
}

const html = fs.readFileSync(filePath, 'utf8').toLowerCase();

const rules = {
  'google-business-profile': {
    mustInclude: [
      'google business profile',
      'google maps',
      'reviews'
    ],
    forbidden: [
      'homeowners',
      'landlords',
      'tenants',
      'rental',
      'property owners',
      'property details',
      'home or rental',
      'site visit',
      'on-site property visit'
    ]
  }
};

const rule = rules[serviceKey];
if (!rule) {
  console.log('PASS: no strict rule for service', serviceKey);
  process.exit(0);
}

const missing = rule.mustInclude.filter(x => !html.includes(x));
const forbidden = rule.forbidden.filter(x => html.includes(x));

if (missing.length || forbidden.length) {
  console.error('FAIL SERVICE VALIDATION');
  console.error('service:', serviceKey);
  console.error('missing:', missing.join(', ') || 'none');
  console.error('forbidden:', forbidden.join(', ') || 'none');
  process.exit(2);
}

console.log('PASS SERVICE VALIDATION:', serviceKey);
