# Contribuir con traducciones (i18n)

Meridiano-cero es un proyecto abierto y su interfaz está preparada para
traducirse. La interfaz y el contenido del juego están traducidos al
español, al inglés y al francés (cobertura completa en los tres idiomas
desde el lote `i18n-traduccion-2026-11-08`); cualquier idioma nuevo es
copiar unos ficheros, traducir sus cadenas y registrarlo. Este documento
explica cómo hacerlo y cómo se comprueba.

## Cómo funciona el sistema

- Los textos de la interfaz viven en `packages/contracts/src/locales/`:
  `es.ts` es el idioma de referencia (completo, 1110 claves),
  `en.ts` y `fr.ts` están completos en los tres idiomas.
- Las claves son planas con prefijo de sección: `common.*` (palabras
  compartidas), `settings.*` (Ajustes), `game.*` (pantalla de juego),
  `archive.*` (archivo), `auth.*` (registro/acceso), `labels.*`
  (etiquetas: delitos, dificultades, tipos de evidencia…),
  `windows.*` (títulos de ventana), `team.*` (roles y peticiones del
  equipo), `profile.*`, `career.*`, `generation.*`, `glossary.*`,
  `prototype.*`, `initialRun.*` (ficha inicial) y `newRun.*`.
- El contenido del juego vive en claves `engine.*` (narración del motor:
  ofertas, eventos, motivos de rechazo, informe final, equipo, terminal)
  y en los módulos de casos `packages/contracts/src/locales/cases-en.ts`
  y `cases-fr.ts` (títulos, objetivos, lugares, NPC, hechos, saludos y
  negativas de los 13 casos; resueltos con `caseText()` y con fallback
  al español de la definición cuando falta una traducción).
- La web resuelve cada cadena con `t('seccion.clave')` (hook
  `useTranslation()` en `apps/web/src/i18n.tsx`, proveedor montado en
  `main.tsx`). El código que no es React usa `translateUi(clave)` desde
  `apps/web/src/preferences.ts`.
- **Fallback**: idioma elegido → español → la propia clave (solo en
  desarrollo, con aviso en consola). Una clave que falta nunca rompe el
  juego ni muestra basura al jugador.
- **Interpolación**: las variables se escriben `{nombre}` dentro del
  texto (`'Minuto {minute} de {deadline}'`) y se pasan como segundo
  argumento de `t()`: `t('game.resumeLine', { minute, deadline })`.
- El idioma elegido vive en las preferencias del jugador
  (`preferences.language`, guardado en localStorage junto al resto de
  preferencias) y se cambia en Ajustes → «Idioma».
- **Cómo viaja el idioma hasta el servidor**: la web añade la cabecera
  `x-meridiano-language: es|en|fr` en todas las llamadas de juego (vista,
  catálogo, carrera, acción, guardados, creación de partida) desde el
  `request()` único de cada cliente, leyendo las preferencias en cada
  petición; el servidor la valida con `parseLanguage` y resuelve la vista,
  el dossier, el informe final y la carrera en ese idioma. Cambiar el
  idioma en Ajustes vuelve a pedir la vista en el idioma nuevo, sin
  recargar la página. Sin migración de base de datos: el idioma viaja por
  petición y el español de las definiciones no se toca nunca.

## Añadir un idioma

1. Copia `packages/contracts/src/locales/es.ts` a
   `packages/contracts/src/locales/<codigo>.ts` (código ISO 639-1, p. ej.
   `de.ts`) y traduce **todas** sus cadenas. No dejes claves sin
   traducir a propósito: las que falten se verán en español por el
   fallback, pero el objetivo es un idioma completo. Copia también
   `cases-en.ts` a `cases-<codigo>.ts` y traduce las 704 claves de los
   casos (títulos, objetivos, lugares, NPC y hechos de los 13 casos).
2. Registra el idioma en `packages/contracts/src/i18n.ts`: añade su
   fichero al mapa `MESSAGES` y una entrada a `SUPPORTED_LANGUAGES`
   con su etiqueta nativa (p. ej. `{ id: 'de', label: 'Deutsch' }`).
   El selector de Ajustes lo recoge solo. Registra también el módulo de
   casos en `packages/contracts/src/locales/cases.ts`.
3. Comprueba con `pnpm check:i18n` (cada clave usada en el código existe
   en `es.ts`, sin duplicados) y `pnpm lint` (ESLint + `check:imports` +
   `check:i18n`). Comprueba además la cobertura de los locales y de los
   casos con los verificadores (mismo conjunto de claves que `es.ts`,
   placeholders idénticos, sin vacíos).
4. Añade o amplía el E2E `apps/web/src/e2e/i18n.spec.ts`: elegir el idioma
   nuevo muestra su traducción en la pantalla de juego y la preferencia
   persiste tras recargar.

## Qué NO traducir (todavía)

- **El contenido del juego que ya está traducido** (desde el lote
  `i18n-traduccion-2026-11-08`): la narración del motor, los textos de
  los casos (títulos, descripciones, hechos, entradas del dossier), los
  textos del informe final del motor, los rangos de carrera de la API y
  los datos de ejemplo del prototipo ya se resuelven en los tres idiomas
  por el mecanismo de arriba. Si añades un caso nuevo, añade sus claves
  a `cases-en.ts` y `cases-fr.ts` (y a la fuente de trabajo de los
  traductores, si la hay); si añades una cadena de motor, añade su clave
  `engine.*` a los tres locales.
- **Huecos que quedan en español por diseño**: los prompts LLM del
  generador (escriben casos en español por diseño) y del director y la
  conversación (el modelo responde en el idioma de la pregunta del
  jugador); los mensajes del validador (diagnóstico de importación); la
  selección de voz TTS; la cronología de las partidas cerradas y las
  repeticiones por idempotencia (quedan en el idioma de la primera
  petición); los países y lugares de los resultados oficiales de carrera
  ya guardados (la fila guarda solo nombres en español, sin ids).
- **No traduzcas nunca**: nombres propios de personas, ciudades y lugares,
  identificadores (`EV-03`, `HV-17`, `obj-detener`), ni la convención
  narrativa del Traductor A.C.M.E. (GDD SPEC-006): el idioma de juego no
  depende de la nacionalidad del NPC y la traducción no cambia pistas ni
  identidades.
- **No partas frases**: si una frase se compone de dos partes (p. ej.
  `Familiar — {nota}`), traduce cada parte como clave propia; nunca
  concatenes traducciones con `+` esperando que el orden valga en todos
  los idiomas.
- **No corrijas el español de paso**: si una cadena en español está mal o
  es confusa, anótala aparte; este lote no cambia textos visibles.

## Glosario de traducción (lote i18n-traduccion-2026-11-08)

Tono: novela negra ligera, juego de detectives (referencia: Carmen
Sandiego MS-DOS 1992). Nada de tono corporativo. En francés se tutea al
jugador (imperativos en «tu», como el «tú» español); en inglés el
imperativo es neutro. Las comillas se adaptan a cada idioma: español «»,
inglés " " (o ' ' dentro de una frase), francés « » con espacios. Los
nombres propios de personas, ciudades y lugares concretos (Lucía, Tomás,
Madrid, París, Instituto Horizonte) NO se traducen; los nombres
descriptivos de lugares genéricos (sala de embalaje, archivo de
conservación) SÍ. Los placeholders `{var}` se preservan EXACTOS (mismo
nombre, misma cantidad). «Recoger» (evidencia) es *Collect* / *Ramasser*,
distinto de «Recuperar» (objeto) que es *Recover* / *Récupérer*.

| Español | English | Français |
|---|---|---|
| expediente | case file | dossier |
| partida (run) | run | partie |
| detective | detective | détective |
| reloj (del caso) | clock | horloge |
| plazo | deadline | délai |
| prueba / evidencia | evidence | preuve |
| hallazgo | finding | découverte |
| orden (de detención / de acceso) | warrant | mandat |
| detención | arrest | arrestation |
| sospechoso | suspect | suspect |
| responsable / culpable | culprit | coupable |
| archivo | archive | archives |
| dossier | dossier | dossier |
| laboratorio (forense) | forensic lab(oratory) | laboratoire de criminalistique |
| terminal de inteligencia | intelligence terminal | terminal de renseignement |
| central de comunicaciones | communications center | centrale de communications |
| atlas | atlas | atlas |
| guardado | save | sauvegarde |
| informe final | final report | rapport final |
| carrera | career | carrière |
| rango | rank | grade |
| objetivo | objective | objectif |
| inspeccionar | inspect | inspecter |
| hablar con | talk to | parler à |
| solicitar (una orden) | request (a warrant) | demander (un mandat) |
| forzar el acceso | force entry | forcer l'accès |
| sobornar | bribe | soudoyer |
| suplantar | impersonate | se faire passer pour quelqu'un |
| acuse (de recibo) | acknowledgement | accusé de réception |
| solicitud | request | demande |
| análisis | analysis | analyse |
| consulta | query | demande |
| testigo | witness | témoin |
| manifiesto | manifest | manifeste |
| taquilla | locker | casier |
| A.C.M.E. | A.C.M.E. | A.C.M.E. |
| agencia de investigación internacional | international investigation agency | agence internationale d'enquête |

## Reglas para quien edite `es.ts`

- No dupliques claves y no cambies el texto visible sin motivo: los
  tests E2E comprueban los textos exactos.
- No metas aquí datos del caso (nombres de NPC, pruebas, ciudades): eso
  es contenido, no interfaz.
- Los locales son módulos TypeScript, no JSON: `tsc` no copia JSON al
  `dist` y la API importa `contracts/dist`.
