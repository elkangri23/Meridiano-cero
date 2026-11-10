// Créditos y licencias: el contenido visible vive en `locales/*.ts` y aquí
// solo quedan las claves y los identificadores de licencia, en el mismo
// orden en que se enseñan. Traducir los créditos es traducir esas claves;
// la página no cambia. Las licencias son identificadores SPDX (o el nombre
// de la licencia del servicio) y no se traducen.
import type { LocaleKey } from '@meridiano/contracts';

/** Licencias permisivas aceptadas para distribuir el juego. */
export const PERMISSIVE_LICENSES = [
  'MIT',
  'Apache-2.0',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BlueOak-1.0.0',
  '0BSD',
] as const;

/** Copyleft a nivel de archivo, solo en la compilación: no contamina el juego. */
export const FILE_LEVEL_COPYLEFT_LICENSES = ['MPL-2.0'] as const;

export const KNOWN_LICENSES = [...PERMISSIVE_LICENSES, ...FILE_LEVEL_COPYLEFT_LICENSES] as const;

export interface DirectDependency {
  name: string;
  license: (typeof KNOWN_LICENSES)[number];
  useKey: LocaleKey;
}

/**
 * Dependencias directas del workspace (raíz, apps y paquetes), con la
 * licencia declarada por cada paquete. El inventario completo (274 paquetes
 * únicos, transitivas incluidas, con versiones) está en el registro de
 * distribución `docs/quality/T6-04-distribucion.md`.
 */
export const DIRECT_DEPENDENCIES: DirectDependency[] = [
  { name: 'React', license: 'MIT', useKey: 'credits.use.ui' },
  { name: 'react-dom', license: 'MIT', useKey: 'credits.use.ui' },
  { name: 'react-router-dom', license: 'MIT', useKey: 'credits.use.routing' },
  { name: 'Fastify', license: 'MIT', useKey: 'credits.use.http' },
  { name: 'pg', license: 'MIT', useKey: 'credits.use.db' },
  { name: 'Drizzle ORM', license: 'Apache-2.0', useKey: 'credits.use.orm' },
  { name: 'Drizzle Kit', license: 'MIT', useKey: 'credits.use.orm' },
  { name: 'argon2', license: 'MIT', useKey: 'credits.use.hashing' },
  { name: 'Vite', license: 'MIT', useKey: 'credits.use.build' },
  { name: 'lightningcss', license: 'MPL-2.0', useKey: 'credits.use.css' },
  { name: 'Vitest', license: 'MIT', useKey: 'credits.use.tests' },
  { name: 'Playwright', license: 'Apache-2.0', useKey: 'credits.use.e2e' },
  { name: 'TypeScript', license: 'Apache-2.0', useKey: 'credits.use.types' },
  { name: 'ESLint', license: 'MIT', useKey: 'credits.use.lint' },
  { name: 'dependency-cruiser', license: 'MIT', useKey: 'credits.use.lint' },
  { name: 'concurrently', license: 'MIT', useKey: 'credits.use.tasks' },
  { name: '@types/node', license: 'MIT', useKey: 'credits.use.types' },
];

export interface AssetRow {
  nameKey: LocaleKey;
  descriptionKey: LocaleKey;
  licenseKey: LocaleKey;
}

export const ASSETS: AssetRow[] = [
  { nameKey: 'credits.asset.portraits', descriptionKey: 'credits.asset.portraitsDesc', licenseKey: 'credits.license.original' },
  { nameKey: 'credits.asset.scenes', descriptionKey: 'credits.asset.scenesDesc', licenseKey: 'credits.license.original' },
  { nameKey: 'credits.asset.music', descriptionKey: 'credits.asset.musicDesc', licenseKey: 'credits.license.original' },
  { nameKey: 'credits.asset.fonts', descriptionKey: 'credits.asset.fontsDesc', licenseKey: 'credits.license.system' },
  { nameKey: 'credits.asset.icons', descriptionKey: 'credits.asset.iconsDesc', licenseKey: 'credits.license.original' },
];
