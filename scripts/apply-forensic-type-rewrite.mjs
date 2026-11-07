// Reescritura de tipos forenses (2026-11-07): añade `forensicType` al único
// análisis (EV-02 -> EV-03) de cada expediente generado del mapa, recalcula
// `definition_hash` con el mismo `hashDefinition` del repo y emite el SQL de
// actualización. Uso (en local, con el repo construido):
//   node scripts/apply-forensic-type-rewrite.mjs <export.jsonl> [salida.sql]
// El export es una línea JSON por caso: {case_id, definition, definition_hash},
// tal como lo saca `psql -At -c "select jsonb_build_object(...)"`.
// El script NO toca la base de datos: revisa el SQL generado antes de
// aplicarlo en el VPS con `docker exec meridiano-db psql -U meridiano_app -d meridiano -f <sql>`.
// Comprueba, por caso: que la definición exportada coincide con el mapa (11
// casos, 1 análisis EV-02->EV-03 sin tipo), que la definición reescrita sigue
// validando v1.5 y que el hash nuevo difiere solo por el tipo añadido.
import { readFileSync, writeFileSync } from 'node:fs';

const { hashDefinition } = await import('../packages/case-schema/dist/server.js');
const { validateCaseDefinition } = await import('../packages/case-schema/dist/validator.js');
const { FORENSIC_TYPES } = await import('../packages/case-schema/dist/forensics.js');

const [exportPath, outPath = 'scripts/forensic-type-rewrite-2026-11-07.sql'] = process.argv.slice(2);
if (!exportPath) {
  console.error('Uso: node scripts/apply-forensic-type-rewrite.mjs <export.jsonl> [salida.sql]');
  process.exit(2);
}
const map = JSON.parse(readFileSync(new URL('./forensic-type-rewrite-2026-11-07.json', import.meta.url), 'utf8'));
const rows = readFileSync(exportPath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));

const caseIds = Object.keys(map.cases);
if (rows.length !== caseIds.length) throw new Error(`El export trae ${rows.length} casos y el mapa ${caseIds.length}.`);
const sql = ['BEGIN;'];
for (const row of rows) {
  const entry = map.cases[row.case_id];
  if (!entry) throw new Error(`Caso ${row.case_id} sin entrada en el mapa.`);
  if (!FORENSIC_TYPES.includes(entry.forensicType)) throw new Error(`Tipo no canónico en ${row.case_id}: ${entry.forensicType}.`);
  const definition = row.definition;
  const analyses = definition?.mechanics?.analyses;
  if (!Array.isArray(analyses) || analyses.length !== 1) throw new Error(`${row.case_id}: se esperaba exactamente 1 análisis.`);
  const analysis = analyses[0];
  if (analysis.inputEvidenceId !== 'EV-02' || analysis.resultEvidenceId !== 'EV-03') {
    throw new Error(`${row.case_id}: el análisis no es EV-02 -> EV-03.`);
  }
  if (analysis.forensicType !== undefined) throw new Error(`${row.case_id}: ya tiene forensicType (${analysis.forensicType}).`);
  const before = hashDefinition(definition);
  // El hash guardado puede estar ya obsoleto: las definiciones se
  // reescribieron en producción tras generarse sin recalcularlo (nada lo
  // compara al cargar una partida; solo lo usa la deduplicación de la
  // importación). Se avisa y se recompone desde la definición real, que es
  // lo que la importación espera.
  if (before !== row.definition_hash) console.warn(`${row.case_id}: el hash guardado estaba obsoleto (${row.definition_hash.slice(0, 8)}); se recompone desde la definición actual (${before.slice(0, 8)}).`);
  analysis.forensicType = entry.forensicType;
  const validation = validateCaseDefinition(definition);
  if (!validation.valid) throw new Error(`${row.case_id}: la definición reescrita no valida v1.5: ${validation.errors.join('; ')}`);
  const after = hashDefinition(definition);
  if (after === before) throw new Error(`${row.case_id}: el hash no cambió tras añadir el tipo.`);
  const literal = JSON.stringify(definition).replace(/'/g, "''");
  sql.push(`UPDATE generated_cases SET definition = '${literal}'::jsonb, definition_hash = '${after}' WHERE case_id = '${row.case_id}';`);
  console.log(`${row.case_id}: ${entry.forensicType} (hash ${before.slice(0, 8)} -> ${after.slice(0, 8)})`);
}
sql.push('COMMIT;');
writeFileSync(outPath, sql.join('\n') + '\n');
console.log(`SQL escrito en ${outPath} (${sql.length - 2} actualizaciones).`);
