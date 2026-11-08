# Contribuir con traducciones (i18n)

Meridiano-cero es un proyecto abierto y su interfaz está preparada para
traducirse. Hoy solo está traducida al español; cualquier idioma nuevo es
copiar un fichero, traducir sus cadenas y registrarlo. Este documento
explica cómo hacerlo y cómo se comprueba.

## Cómo funciona el sistema

- Los textos de la interfaz viven en `packages/contracts/src/locales/`:
  `es.ts` es el idioma de referencia (completo), `en.ts` y `fr.ts` existen
  pero vacíos a propósito: todo lo que no traducen cae al español.
- Las claves son planas con prefijo de sección: `common.*` (palabras
  compartidas), `settings.*` (Ajustes), `game.*` (pantalla de juego),
  `archive.*` (archivo), `auth.*` (registro/acceso), `labels.*`
  (etiquetas: delitos, dificultades, tipos de evidencia…),
  `windows.*` (títulos de ventana), `team.*` (roles y peticiones del
  equipo), `profile.*`, `career.*`, `generation.*`, `glossary.*`,
  `prototype.*`, `initialRun.*` (ficha inicial) y `newRun.*`.
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

## Añadir un idioma

1. Copia `packages/contracts/src/locales/es.ts` a
   `packages/contracts/src/locales/<codigo>.ts` (código ISO 639-1, p. ej.
   `de.ts`) y traduce **todas** sus cadenas. No dejes claves sin
   traducir a propósito: las que falten se verán en español por el
   fallback, pero el objetivo es un idioma completo.
2. Registra el idioma en `packages/contracts/src/i18n.ts`: añade su
   fichero al mapa `MESSAGES` y una entrada a `SUPPORTED_LANGUAGES`
   con su etiqueta nativa (p. ej. `{ id: 'de', label: 'Deutsch' }`).
   El selector de Ajustes lo recoge solo.
3. Comprueba con `pnpm check:i18n` (cada clave usada en el código existe
   en `es.ts`, sin duplicados) y `pnpm lint` (ESLint + `check:imports` +
   `check:i18n`).
4. Añade o amplía el E2E `apps/web/src/e2e/i18n.spec.ts`: elegir el idioma
   nuevo muestra su traducción en la pantalla de juego y la preferencia
   persiste tras recargar.

## Qué NO traducir (todavía)

- **El contenido del juego no es interfaz**: la narración del motor
  (`packages/engine`, `packages/case-schema`: respuestas del equipo,
  terminal de inteligencia, textos de viaje, hallazgos, saludos y
  negativas de los NPC), los textos de los casos (títulos, descripciones,
  hechos, entradas del dossier) y los textos del informe final que vienen
  del motor siguen en español en su sitio. Tienen hueco previsto
  (`engine.*` y `cases.*` en los locales) pero son otro lote: traducirlos
  exige decidir cómo viaja el idioma hasta el motor y los casos, no solo
  copiar cadenas.
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

## Reglas para quien edite `es.ts`

- No dupliques claves y no cambies el texto visible sin motivo: los
  tests E2E comprueban los textos exactos.
- No metas aquí datos del caso (nombres de NPC, pruebas, ciudades): eso
  es contenido, no interfaz.
- Los locales son módulos TypeScript, no JSON: `tsc` no copia JSON al
  `dist` y la API importa `contracts/dist`.
