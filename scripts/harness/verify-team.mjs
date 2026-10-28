// Offline validation against Harness's real schema, scope policy and prompt builder.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.join(os.homedir(), '.local/share/meridiano-harness/source');
const moduleAt = (relative) => import(pathToFileURL(path.join(source, relative)).href);
const { loadProject } = await moduleAt('packages/config/src/index.ts');
const { checkScope } = await moduleAt('packages/policy/src/index.ts');
const { buildTaskPrompt } = await moduleAt('packages/planner/src/index.ts');
const config = loadProject(project).harness;
const directory = path.join(project, 'docs/agents');
const team = JSON.parse(fs.readFileSync(path.join(directory, 'equipo.json'), 'utf8'));
const common = fs.readFileSync(path.join(directory, team.common), 'utf8').trim();
assert.deepEqual(Object.keys(config.roles), Object.keys(team.roles));
assert.equal(config.policy.autonomy, 'assisted');
assert.equal(config.land, 'manual');
assert.equal(config.limits.max_parallel_workers, 2);
assert.equal(config.limits.max_delegated_children, 0);
assert.equal(config.limits.lead_followups, 0);
const writers = Object.entries(config.roles).filter(([, role]) => role.mode === 'write');
const owners = (file) => writers.filter(([, role]) => checkScope([file], role.paths_allow, role.paths_deny).allowed.length).map(([name]) => name);
let probes = 0;
for (const [name, metadata] of Object.entries(team.roles)) {
  const role = config.roles[name];
  const profile = fs.readFileSync(path.join(directory, metadata.profile), 'utf8').trim();
  assert.equal(role.instructions.trim(), common + '\n\n' + profile, `Incomplete instructions: ${name}`);
  assert.equal(role.concurrency, 1);
  assert.equal(role.route, 'freellmapi');
  const rendered = buildTaskPrompt({ role: name, instructions: role.instructions, taskId: 'PROFILE-CHECK', title: 'Offline validation', body: '', acceptance: [], agentsMd: true, pathsAllow: role.paths_allow ?? [], pathsDeny: role.paths_deny, checks: [] });
  assert.ok(rendered.includes(common) && rendered.includes(profile), `Truncated task profile: ${name}`);
  if (role.mode === 'readonly') {
    assert.equal(checkScope(['apps/api/probe.ts', 'harness.yaml'], role.paths_allow, role.paths_deny).allowed.length, 0);
    continue;
  }
  for (const pattern of role.paths_allow) {
    const file = pattern.replaceAll('**', '__scope_probe__/file').replaceAll('*', '__scope_probe__');
    assert.deepEqual(owners(file), [name], `Overlapping or blocked parcel: ${file}`);
    probes++;
  }
}
for (const file of ['harness.yaml', 'AGENTS.md', 'docs/agents/COMUN.md', 'docs/meridi/originales/source.docx', 'docs/plan/BACKLOG.md', 'docs/quality/ACEPTACION.md', 'docs/quality/FASE-0.md', 'README.md', '.harness/checks.yaml', 'scripts/harness/wsl.sh', 'apps/api/.env.local', 'packages/engine/credentials.json', 'apps/web/private.key']) {
  assert.deepEqual(owners(file), [], `Shared/protected/secret file unexpectedly writable: ${file}`);
}
console.log(`OK: ${Object.keys(config.roles).length} complete profiles; ${probes} parcel probes with one writer; shared/protected paths excluded; human approval preserved.`);
