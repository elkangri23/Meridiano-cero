# T6-05 — Simulacro de desastre, actualización compatible y recursos agotados

Fecha de ejecución: 2026-11-10. Rama: `distribucion-2026-11-10` (base
994ead9). Dos ejecuciones: primera 18:48–19:06 UTC; segunda 19:09–19:23
UTC (confirmación independiente, §8). Artefactos del drill en el repo:
`compose.drill.yaml`, `scripts/drill-setup.sh`,
`scripts/drill-build.sh`, `scripts/drill-smoke.mjs`,
`scripts/drill-start.sh`, `scripts/drill-fencing.mjs`,
`scripts/drill-upgrade.sh`, `scripts/drill-upgrade-smoke.mjs`,
`scripts/drill-failures.sh`. Runbook EJECUTADO paso a paso; cada paso
con su comando real y su resultado. Nada de este simulacro tocó
producción: solo lecturas SQL y un `pg_dump` vía
`scripts/backup-prod.sh`.

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

Segunda ejecución (confirmación independiente, §8): backup fresco
`meridiano-20261110-190921.sql.gz` (19:09:21 UTC); **RPO 31 s**; restore
<1 s; **RTO a partida jugable 2 min 44 s** (incluye la reconstrucción
completa desde fuente; el RTO de 43 s de la primera ejecución no incluía
el build — ambas cifras son válidas y miden cosas distintas, ver §8).

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

## 8. Segunda ejecución — confirmación independiente (19:09–19:23 UTC)

La primera ejecución se desmontó a las ~19:06 UTC (§6); al retomar el
lote, el drill ya no existía. Segunda ejecución completa desde cero
para confirmar las mediciones con un backup fresco y código de la rama
recién reconstruido.

### 8.1 Entorno y tiempos

`/opt/meridiano-cero-drill` recreado desde `git archive HEAD` de la
rama (el anterior fue desmontado por el agente anterior); scripts del
drill copiados desde el trabajo del lote 4. OJO: la copia de trabajo de
`drill-setup.sh` no tenía la guarda de producción que sí tiene el
commiteado (`dedea92` se niega si existe `.env.prod`); a partir de
ahora, usar siempre los scripts commiteados en `scripts/`.

Backup fresco `meridiano-20261110-190921.sql.gz` (19:09:21 UTC,
rotación en 7, `gzip -t` previo OK). T0 (desastre declarado):
19:09:52Z. DB sana 19:09:58 (+6 s). **RPO 31 s** (backup 19:09:21 →
T0 19:09:52). Restore <1 s, 0 errores. Build 19:10:57→19:11:38 (41 s;
dists verificados: `credits.pageTitle` presente, sin
`SKELETON_BY_DURATION`). API+web sanas 19:12:30. **Smoke 18/18 PASS a
las 19:12:36 → RTO 2 min 44 s** (incluye la reconstrucción completa
desde fuente; el RTO de 43 s de la primera ejecución no incluía el
build: ambas cifras son válidas y miden cosas distintas — 43 s es el
tiempo de restore+arranque con el código ya compilado; 2 min 44 s es
el tiempo total de reconstruir desde fuente y volver a jugar).

DB del drill verificada: 12 casos, 1 run (copia de 00ec2578 en
generado-21d02570, `engine_state` 1387 bytes), 164 profiles,
migraciones 0012, 0/0/0. Smoke: health/ready/web 200, `/creditos` 200,
registro `prueba-desastre-chochi@ejemplo.com` 200 (perfil
`f145ae2e-ff34-4ae5-b13c-ace2b07c4cf0`), proveedor efectivo
mock/`deterministic-ci`, 0 conexiones, catálogo 13, partida del caso
fijo 201 (`8fc2422a-5f9a-4501-9666-5788103b8148`, minuto 0 → 10 → 30,
EV-02 en inventario y dossier).

### 8.2 Bordes en la segunda ejecución

**BOR-090 (fencing, `scripts/drill-fencing.mjs`): 6/6 PASS.** Acción
con `expectedVersion` desfasada → 400, estado sin cambios (versión 1,
minuto 0); con la versión correcta → 200 y el reloj avanza (minuto
10). Un cliente viejo no ejecuta a ciegas tras el restore.

**BOR-085 (lease viejo / sin llamadas reales): SUPERADO.**
`generation_jobs` 22 done / 47 failed, 0 creados en los últimos 2 días;
proveedor mock; 0 conexiones. Nada que reanudarse automáticamente.

**BOR-079 (backup corrupto): SUPERADO, con lección nueva.** `gzip -t`
detecta la corrupción («unexpected end of file»); restore exit 3
(`invalid input syntax for type json`). **Lección: el restore fallido
deja una BD PARCIAL (12 casos pero 0 runs y 0 profiles)** — el runbook
debe exigir descartar la BD destino ante cualquier fallo de restore
(DROP DATABASE), nunca fiarse de un contenido parcial. Drill sano
intacto (12 casos, API 200).

**BOR-077 (disco lleno): DEMOSTRADO, con lecciones nuevas.** Dos
intentos inválidos antes del válido: (1) el llenado con `awk` no
escribió nada (fallo silencioso) y el restore pasó; (2) la ruta era
`/var/lib/postgresql/data` pero el PGDATA real de postgres:18 es
**`/var/lib/postgresql/18/docker`**; con 7 MB y con 3 MB libres el
restore PASÓ (el volcado es diminuto, ~2 MB, y cabe en WAL reciclado).
**Intento válido (disco al 100 %, 0 MB libres):** restore exit 3,
`could not extend file "base/16384/1249": No space left on device`,
BD destino inutilizable (`generated_cases` no existe), drill sano
intacto (12 casos, API 200). **Lección: el reintento ingenuo sobre el
esquema parcial FALLA** (exit 3, `function "delete_run" already
exists` — el dump no lleva `--clean`); **la recuperación correcta
(DROP + CREATE de la BD vacía + restore) funciona**: exit 0, 12 casos,
1 run. Postgres sobrevivió al disco lleno en este intento.

### 8.3 Actualización compatible — segunda vía, por API

Primer intento FALLÓ en silencio: el backup viejo
`meridiano-20261109-081220.sql.gz` ya había rotado fuera de los 7;
`gunzip` falló pero `psql` con stdin vacío dio exit 0; el bucle de
espera tampoco fallaba al agotar el tiempo. Ambos defectos corregidos
en el script (`scripts/drill-upgrade.sh`): guarda `test -f`,
descompresión a fichero con exit comprobado, verificación de
recuentos, fallo explícito al agotar la espera.

Rehecho con el backup más viejo disponible
`meridiano-20261109-115523.sql.gz` (219.263 bytes, 2026-11-09 11:55
UTC; migraciones ya en 0012; 12 casos, 2 runs — incluye el 61559996
borrado por Antonio y el 00ec2578 —, 151 profiles): API actual de la
rama sana en 5 s (19:22:44→19:22:49), migraciones no-op (0012), runs
intactos (2); **smoke de upgrade 10/10 PASS**
(`scripts/drill-upgrade-smoke.mjs`: registro
`prueba-actualizacion-chochi@ejemplo.com`, catálogo 13, partida nueva
en el caso viejo generado-21d02570, minuto 0→10).

### 8.4 Lecciones nuevas de la segunda ejecución (para OPERACION.md)

- Descartar la BD destino ante cualquier fallo de restore; un restore
  fallido deja contenido parcial que parece casi completo.
- El reintento de restore sobre un esquema parcial falla (sin
  `--clean`); la recuperación es DROP + CREATE + restore.
- PGDATA de postgres:18: `/var/lib/postgresql/18/docker`.
- El tubo `gunzip | psql` da exit 0 aunque `gunzip` falle;
  descomprimir a fichero y comprobar el exit de gunzip.
- El RTO depende de si se incluye el build desde fuente (43 s sin
  build, 2 min 44 s con build).
- `scripts/drill-failures.sh` es la versión consolidada y corregida
  de las pruebas de fallo (los intentos intermedios `drill-diskfull2/3`
  tenían defectos y no se versionan).
