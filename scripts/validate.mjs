import fs from 'node:fs';

const roles = JSON.parse(fs.readFileSync(new URL('../config/roles.json', import.meta.url), 'utf8'));
if (roles.coveragePolicy !== 1) throw new Error('coveragePolicy must remain 1.0');
if (!Array.isArray(roles.roles) || roles.roles.length !== 8) throw new Error('Expected 8 canonical Octopus roles');
const ids = new Set();
for (const role of roles.roles) {
  if (!role.id || ids.has(role.id)) throw new Error(`Invalid/duplicate role id: ${role.id}`);
  ids.add(role.id);
  if (!Array.isArray(role.dimensions) || role.dimensions.length === 0) throw new Error(`Role ${role.id} has no dimensions`);
}
console.log(`ok: ${roles.roles.length} roles; coveragePolicy=${roles.coveragePolicy}`);
