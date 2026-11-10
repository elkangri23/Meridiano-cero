# T6-05 — Simulacro de desastre, actualización compatible y recursos agotados

Fecha de ejecución: 2026-11-10. Rama: `distribucion-2026-11-10` (base
994ead9). Artefactos del drill en el repo: `compose.drill.yaml`,
`scripts/drill-setup.sh`, `scripts/drill-build.sh`,
`scripts/drill-smoke.mjs`. Runbook EJECUTADO paso a paso; cada paso con
su comando real y su resultado. Nada de este simulacro tocó producción:
solo lecturas SQL y un `pg_dump` vía `scripts/backup-prod.sh`.

## Resumen medido

| Medida | Valor |
|---|---|
| Backup usado | `meridiano-20261110-184844.sql.gz`, 222.370 bytes, 18:48:44–18:48:45Z, 0,35 s; rotación en 7 |
| RPO | 410 s (antigüedad del backup en el inicio del restore, T0 18:55:35Z). Peor caso con el cron diario 03:00 UTC: ~24 h |
| Restore (DB vacía, entorno aislado) | 0,43 s, rc 0 |
| RTO a API sana | ~31 s desde T0 (health+ready 200, 18:56:06Z) |
| RTO a web sana | ~34 s desde T0 (200, 18:56:09Z) |
| RTO a partida jugable | 43 s desde T0 (smoke 18/18, 18:56:18Z) |
| Re-restore (BOR-090) | 0,78 s, rc 0 |

## 1. Entorno aislado

Copia del código de la rama en `/opt/meridiano-cero-drill` (rsync sin
`.git`, `node_modules`, `dist`, `.env*`, `.local-secrets`, `.secrets`),
verificada sin código B2 (`SKELETON_BY_DURATION` ausente) y con la
página de créditos presente. Solo el servicio `db` en
`compose.drill.yaml`: postgres:18.6 (mismo digest que producción),
volumen propio `meridiano-drill_meridiano_drill_data`, red propia,
puerto 127.0.0.1:15440, secretos propios del drill generados con
`openssl rand -hex 32` (nunca impresos). API y web del drill como el
stack E2E: contenedores `node:24.22.1` con el repo montado, API
`node --env-file-if-exists=../../.env.drill
--experimental-strip-types src/server.ts` (puerto 13000), web
`vite --host 127.0.0.1 --strictPort --port 15173`.

Configuración del drill (`.env.drill`): `APP_MODE=development`,
`LOCAL_DEV_AUTH_ENABLED=true`, `REGISTRATION_ENABLED=true`,
`AI_PROVIDER=mock`; cero menciones de `AI_API_KEY`, `RESEND_API_KEY` o
freellmapi (verificado con grep: 0).

Hallazgo de preparación (documentado, no un fallo del producto): el
`init-role.sh` con modo 0660 no lo puede leer postgres (uid 999) dentro
del contenedor, y los secretos a 0600 tampoco los lee el init. En
producción el montaje efectivo es 0644. Solución del drill: secretos a
0644 con el directorio `.drill` a 0700, y copia drill de `init-role.sh`
a 0644 (el fichero del repo queda intacto).

## 2. Backup fresco y restore

~~~text
scripts/backup-prod.sh
# -> meridiano-20261110-184844.sql.gz (222.370 bytes), 18:48:44-18:48:45Z, 0,35 s
gzip -dc /opt/meridiano-cero-backups/meridiano-20261110-184844.sql.gz \
  | docker exec -i meridiano-drill-db psql -U meridiano_owner -d meridiano -v ON_ERROR_STOP=1 -q
# -> 0,43 s, rc 0, sobre DB vacía (0 tablas, rol meridiano_app existente)
~~~

Verificación post-restore (idéntica a producción): runs=1, cases=12,
profiles=164, ai_connections=0, detective_profiles=0,
official_results=0, migrations=13, generation_jobs=69 (22 done / 47
failed, todos terminales), ai_usage=451. La partida de Antonio es
idéntica: id `00ec2578-9bd6-4353-a581-c9f6a8b3e2f6`, caso
`generado-21d02570`, normal, revisión 13, definition_hash
`295a0d6669b3a20401c93eff934a0db71d48700f283ebaa2ed22f8f78d7b238f`.

## 3. Actualización compatible

`migrate-cli.ts` del código de la rama sobre los datos restaurados:
«Migración de base completada», ledger sigue en 13, runs sigue en 1.
La actualización no rompe datos ni partidas existentes. (La salida
muestra mojibake «MigraciÃ³n»: cosmético preexistente del mensaje, no
tocado en este lote.)

## 4. Build y smoke del drill

Build en contenedor node:24 (`pnpm install --frozen-lockfile
--ignore-scripts` + builds por paquete + web): sin errores. Dists
verificados con grep: `credits.pageTitle` presente en
`packages/contracts/dist` y en el bundle web
(`index-s0qBVdn1.js`, 870 kB; «Créditos y licencias» 1×); sin
`SKELETON_BY_DURATION`.

Smoke (`scripts/drill-smoke.mjs`) 18/18 PASS: health/ready/web 200,
`/creditos` 200, registro `prueba-desastre-chochi@ejemplo.com` (perfil
`b260d710-d265-409f-9dcd-f7544c44f39e`, emailVerified false), proveedor
efectivo `{source:'mock', providerId:'mock',
model:'deterministic-ci'}`, cero conexiones personales, catálogo 13
(incluye `generado-21d02570`), partida nueva del caso fijo
`08ecf773-b62e-4930-b5bd-18adda3ac5c7` (minuto 0 → inspeccionar MAD-SALA
10 → cerradura 30 → recoger EV-02 en inventario y dossier).

Post-smoke: runs=2 (Antonio + prueba), ai_usage sigue 451 (cero consumo
IA nuevo), ai_connections 0, jobs 22 done / 47 failed sin reanudarse,
partida de Antonio revisión 13 intacta; logs de la API sin menciones a
freellmapi.

## 5. Bordes ejecutados

### BOR-079 — backup corrupto: SUPERADO

Copia del backup truncada a la mitad (111.185 bytes) → restore en DB
temporal `meridiano_drill_corrupt` falla (gzip «unexpected end of file»
+ error COPY JSON en `generation_jobs`); DB temporal borrada; el drill
sigue sano (health/ready 200, runs=2, cases=12). Sin falso éxito.

### BOR-085 — lease viejo / sin llamadas reales: SUPERADO

Trabajos restaurados todos terminales (22 done / 47 failed, ninguno
reanudado); ai_usage sin cambios (451); proveedor efectivo mock; sin
`AI_API_KEY` ni RESEND ni freellmapi en `.env.drill`; API del drill sin
red freellmapi; logs sin menciones a freellmapi.

### BOR-078 — migración parcial / esquema futuro: SUPERADO

Fila falsa `9999_futura.sql`/`deadbeef` en `base_migrations` (ledger
14) → `migrate-cli` rc=1 `MIGRATION_FAILED`, ledger intacto (14), runs
intactos (2); fila retirada → migrate-cli rc=0. Readiness: con la fila
futura, API reiniciada → health 200, **ready 503**; sin ella → ready
200. (Primer intento inválido: `docker stop` sin `rm` dejó el nombre
ocupado y la API parada — connection refused, no 503; repetido
correctamente con `rm -f`.)

### BOR-077 — disco lleno: DEMOSTRADO con matices

Intento 1 (volumen tmpfs 256 MB): DB restaurada (9.910 kB); llenado
con `gen_random_bytes` (máximo 1024 bytes por llamada; usar 1024 ×
10000 por lote ≈ 10 MB; los datos repetidos se comprimen por TOAST y
no llenan). Lote 9: **PANIC de postgres** `could not write to file
"pg_wal/xlogtemp.419": No space left on device`, servidor terminado,
tmpfs 99 % (252M/256M). Al parar el contenedor, el tmpfs perdió su
contenido (se desmonta al parar el último contenedor): al reiniciar,
initdb recreó una BD vacía. Limitación del montaje tmpfs, no de
postgres; no se pudo observar la recuperación en ese intento.

Intento 2 (imagen loopback ext4 persistente, 300 MB nominal → 265M
útiles, `/tmp/drill-disk.img` montada en `/mnt/drill-disk`):
contenedor `meridiano-drill-diskfull-db` (puerto 127.0.0.1:15441).
Restore OK (runs=1, cases=12). Lote 8: **ERROR limpio** `could not
extend file "base/16384/16972": No space left on device` (transacción
abortada), **servidor SIGUE EN PIE** (sin PANIC). Datos originales
intactos por SELECT (runs=1, cases=12, profiles=164; DB 109 MB; WAL
123 MB). `df`: 244M usados, 4,0K libres, 100 %.

Con el disco al 100 % según `df`, una API temporal (puerto 13001,
mock, contra 15441) devolvió ready 200 y el registro
`prueba-disco@ejemplo.com` devolvió 200 con perfil creado (profiles
164 → 165): las escrituras pequeñas caben en el espacio libre dentro
de las páginas ya asignadas y en el reciclado de WAL. Al crear
partidas en bucle, las 6 primeras devolvieron 201 y la 7.ª devolvió
**503 `DEPENDENCY_UNAVAILABLE`** («No se pudo completar la
solicitud.»), sin partida parcial (runs=7: 1 original + 6 creadas).
`/ready` siguió en 200 durante todo el episodio.

Conclusión: con el disco lleno, las lecturas y las escrituras pequeñas
siguen funcionando; las escrituras grandes fallan limpio y sin éxito
falso; si se agota el WAL, postgres hace PANIC y se detiene antes que
confirmar una escritura. **La readiness no detecta falta de espacio:
hay que alertar por espacio en disco, no solo por readiness.**

### BOR-090 — restore + cliente antiguo: SUPERADO

Sesión y acción confirmadas DESPUÉS del backup: login
`prueba-desastre-chochi@ejemplo.com`, acción `analyze:EV-02` en la
partida de prueba `08ecf773-…` (versión 5, clave de idempotencia
`b0d174fa-fcb6-4288-9432-2a6dae6c1529`). Re-restore del mismo backup
(0,78 s, rc 0; parar API+web, DROP/CREATE de la base, restore,
rearrancar): estado de vuelta al backup (runs=1, profiles=164,
sessions=8). Con la cookie antigua: `GET /runs/…` → **401
`SESSION_REQUIRED`**; replay de la acción con la misma clave → **401**,
sin ejecutar. Runs sigue en 1 y la partida de Antonio intacta
(revisión 13). Sin resurrección de la partida de prueba.

### Memoria al límite: sin OOM en reposo

API del drill con `--memory=160m --memory-swap=160m`: arranca y sirve
health 200. Repetido con 96m y 64m: sirve health 200 en ambos. La API
en reposo es muy frugal; no se alcanzó OOM. La API principal del drill
no se vio afectada (ready 200) y la base intacta (runs=1). El escenario
de memoria bajo carga queda fuera de este ensayo.

## 6. Desmontaje

Parados y borrados los contenedores y volúmenes del drill
(`meridiano-drill-db/api/web`, `meridiano-drill-diskfull-db/api`),
desmontada la imagen loopback, borrados `/tmp/drill-disk.img`,
`/tmp/drill-corrupt.sql.gz` y `/opt/meridiano-cero-drill`. Verificación
final: producción health/ready/web 200, runs=1, cases=12, 0/0/0,
partida de Antonio revisión 13, VPS en main 994ead9, sin cambios.

## 7. Pasos no ejecutados

Ninguno del alcance: todos los pasos del simulacro se ejecutaron en el
entorno aislado. No se hizo restore sobre producción ni se envió correo
real ni se llamó a ningún proveedor real de IA (regla del backlog).
