# T6-04 — Autoría, licencias, créditos y distribución independiente

Fecha: 2026-11-10. Rama: `distribucion-2026-11-10` (base 994ead9).
Depende de T6-05 (ejecutada primero, ver
[T6-05-desastre](T6-05-desastre.md)).

## 1. Inventario de dependencias (real, completo)

Método: `pnpm licenses list --json` en la raíz y en cada workspace (el
de raíz solo cubre sus dev; fastify/pg/react faltaban hasta hacerlo por
workspace). Fichero canónico (no versionado):
`licenses-merged.json` (274 entradas / 270 nombres únicos). Los JSON
por workspace son la fuente de la unión; `licenses-all.json` (parcial:
185 entradas, le faltan 89, entre ellas todo el runtime de `apps/api`
y `react`/`react-dom`) y `licenses-workspaces.json` (vacío, `{}`) eran
engañosos y se retiraron.

**Total unión raíz+workspaces: 274 entradas / 270 nombres únicos,
todos permisivos.** Cero GPL/AGPL/LGPL/propietarias/desconocidas. Sin
dependencias git/github en `pnpm-lock.yaml`.

| Licencia | Paquetes |
|---|---|
| MIT | 223 |
| Apache-2.0 | 20 |
| ISC | 15 |
| BSD-2-Clause | 6 |
| BSD-3-Clause | 6 |
| MPL-2.0 | 2 |
| BlueOak-1.0.0 | 1 |
| 0BSD | 1 |

- MPL-2.0 (2): `lightningcss` 1.33.0 + `lightningcss-linux-x64-gnu`,
  solo compilación; copyleft a nivel de archivo, no afecta al código
  distribuido.
- BlueOak-1.0.0 (1): `minimatch` 10.2.6.
- 0BSD (1): `tslib` 2.8.1.

Runtime verificado: fastify MIT 5.12.7, pg MIT 8.23.1, drizzle-orm
Apache-2.0 0.45.4, argon2 MIT 0.45.2, react/react-dom MIT 19.3.1,
react-router-dom MIT 6.30.6, drizzle-kit MIT 0.31.11, @playwright/test
Apache-2.0 1.64.1, vite MIT 8.3.5, vitest MIT 5.0.5, typescript
Apache-2.0 6.0.3, eslint MIT 10.13.0. Cookies sin `@fastify/cookie`:
código propio en `apps/api/src/auth/session-security.ts`.

Añadidas en NOTICE.md tras la revisión: `@eslint/js` 10.0.1,
`typescript-eslint` 8.72.1, `@types/react` 19.3.0, `@types/react-dom`
19.3.0, `@types/pg` 8.23.1 y `@types/node` (todas MIT); en `/creditos`
las 5 primeras (`@types/node` ya estaba allí). «Playwright» corregido
en ambos a la directa real `@playwright/test`; PostgreSQL/pnpm/Ollama
movidos en NOTICE.md a apartado propio de servicios externos; añadido
el asset TTS (voces del sistema) en ambos.

**Hallazgo: Zod NO es dependencia.** NOTICE.md lo listaba, pero tiene
cero referencias en el código y no está en el lockfile ni en ningún
package.json. Corregido en NOTICE.md. Añadidas en NOTICE.md: música
sintetizada, react-router-dom, pg, argon2, Drizzle Kit, TypeScript,
ESLint, dependency-cruiser, concurrently; nota de inventario completo
(274 paquetes) apuntando a este registro.

## 2. Inventario de assets

- Sin fuentes externas: solo stacks de sistema (ui-monospace, Consolas,
  system-ui). Sin Google Fonts.
- Sin imágenes ni archivos de audio: arte SVG procedural determinista;
  música WebAudio sintetizada.
- Sin pantalla de créditos en la web antes de este lote: se creó
  `/creditos`.

## 3. Créditos donde el juego los muestra

- Página pública `/creditos` (`apps/web/src/creditos/`): secciones
  Autoría / Licencia / Dependencias / Arte y sonido / Nombre y marca.
  Enlazada desde el pie del Archive (`archive.credits`). Datos: 22
  dependencias directas y 6 assets. Claves `credits.*` (54) +
  `archive.credits` en es/en/fr; `check:i18n` OK (1205 claves, 215
  ficheros). Test `creditos.test.ts` 3/3 en verde.
- `AUTHORS.md`: único autor, Antonio Moles (`git log` solo muestra a
  Antonio, con 2 emails).
- `CONTRIBUTING.md`: flujo worktree, commits en español, sin
  push/despliegue sin autorización.
- `LICENSE`: texto AGPL-3.0 íntegro con copyright FSF 2007 (sin línea
  de copyright propia, estándar). `NOTICE.md` corregido (ver §1).

## 4. Distribución independiente (verificada de verdad)

Clon limpio de la rama, 2026-11-10, sin tocar el VPS:

- `git clone --branch distribucion-2026-11-10` → `dedea92`.
- `pnpm install --frozen-lockfile`: 282 paquetes, OK.
- `pnpm setup:local`: genera `.env` y `.local-secrets/`, OK.
  (Desviación encontrada: los scripts del repo invocan `pnpm` desde el
  PATH; sin pnpm en el PATH, `db:migrate` falla con `pnpm: not found`.
  Recogido en [INSTALACION](../manuales/INSTALACION.md).)
- PostgreSQL 16 local (sin Docker, apt, puerto 15432, roles
  `meridiano_owner`/`meridiano_app`); `pnpm db:migrate` desde base
  vacía: ledger 13, 0 casos, 0 partidas.
- Build por paquetes + web: sin errores; sin código B2 en dists;
  «Créditos y licencias» en el bundle web (870 kB).
- API compilada (`pnpm --filter @meridiano/api start`): health/ready
  200 en el puerto 3000. Web dev 200, `/creditos` 200; web compilada
  (`preview`): 200.
- Smoke adaptado 16/18: las 2 «fallos» son expectativas del drill (13
  expedientes y `generado-21d02570`); en un clon limpio lo correcto es
  catálogo = 1 caso fijo (`astrolabio-tres-ciudades`), 0 generados.
  Proveedor efectivo mock (`deterministic-ci`), cero conexiones
  personales. Partida jugable del caso fijo: 201, minuto 0 → 10 →
  30, EV-02 recogido en inventario y dossier.
- `setup:local` genera `REGISTRATION_ENABLED=false`: para registrarse
  en local hay que ponerlo a `true` (recogido en el manual).

No verificado en este lote: arranque con Ollama real (no hay Ollama en
el sandbox; el adaptador Ollama está cubierto por tests unitarios y el
manual [IA-LOCAL](../manuales/IA-LOCAL.md) lo restringe a loopback).
La generación de casos sigue en pausa (FreeLLMAPI colapsado, piloto
lote 3: 0/6); este lote no genera nada.

Manuales reescritos/verificados: `INSTALACION.md` (reescrita con los
procedimientos ejecutados) y `OPERACION.md` (estado y secciones de
backup/restore/actualización con las cifras medidas del simulacro).

Segunda verificación de clon limpio (2026-11-10, `git archive HEAD` de
la rama en `71e1883`, stack en `/opt/meridiano-cero-clean`): API
`meridiano-clean-api` 127.0.0.1:13001, web 127.0.0.1:15174, Postgres
127.0.0.1:15441. health/ready 200, web 200, `/creditos` 200; registro
`prueba-limpia-chochi@ejemplo.com` 200; proveedor efectivo
mock/`deterministic-ci`, 0 conexiones; catálogo en BD nueva n=1 (solo
`astrolabio-tres-ciudades`); import del fixture `generado-21d02570` →
201 (catálogo n=2); partida del fijo jugable (minuto 0→10→30, EV-02)
y del generado importado jugable (Bilbao, 12 ofertas). Smoke 19 PASS /
2 FAIL (los 2 son el mismo hecho: catálogo n=1, no 13).

Defecto 13 (instalación nueva = solo caso fijo; los 12 generados
viven únicamente en la BD de producción): resuelto documentando
explícitamente en [INSTALACION](../manuales/INSTALACION.md) que el
clon limpio trae solo el fijo, con el procedimiento ejecutable de
exportar/importar (`GET /api/v1/cases/:caseId/export`,
`POST /api/v1/cases/import`, ≤2 MiB, 201 nuevo / 200 ya existente),
verificado con `generado-21d02570`. No se publican ficheros de casos
en este lote: los 12 generados siguen viviendo solo en producción.

Manuales corregidos con los 13 defectos de la verificación de clon
limpio: INSTALACION.md (pnpm en el VPS, binario `docker-compose`,
segunda instancia con puertos y proyecto propios, paso 7 — no existe
bootstrap de administrador ejecutable, ver nota —, comandos de
exportar/importar), BASE-LOCAL.md (cabecera de fase 1, equivalente
curl del ejemplo PowerShell, nota de binario), IA-LOCAL.md (proveedor
efectivo de la API), DESARROLLO.md (estética MS-DOS superseded por el
rediseño moderno A2), OPERACION.md (comandos del ensayo).

Nota sobre el paso 7 de INSTALACION.md: no hay comando de bootstrap
de administrador en esta versión. El registro crea cuentas de jugador
(`role: player`); SPEC-009 prevé un «bootstrap de un uso», pero
`runInitialSetup` (`packages/case-schema/src/setup-admin.ts`) es
código de biblioteca sin comando ni endpoint conectado y apunta a una
tabla `users` que el esquema actual no tiene.

## 5. Nombre y marca — DECISIÓN PENDIENTE Y BLOQUEANTE (Antonio)

No decidido en este lote. Estado actual del nombre en el repo:

| Sitio | Nombre hoy |
|---|---|
| `package.json` | `meridiano-cero` |
| Título web (`apps/web/index.html`) | `Meridiano-cero` |
| NOTICE.md | «Meridiano Cero» |
| `setup-admin.ts:231` (nombre de instancia por defecto) | «Meridiano Cero» |
| README.md | «Meridiano-cero … A.C.M.E. es el nombre provisional» |
| Dentro del juego | «A.C.M.E.» es la agencia de ficción (Equipo A.C.M.E., Atlas A.C.M.E.) |

No hay marca registrada; nada publicado ni registrado. No se publica
nada (ni GitHub Releases, ni npm, ni registros) hasta que Antonio
confirme nombre y marca. La página `/creditos` marca el nombre como
provisional sin registro.
