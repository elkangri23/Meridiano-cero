# Avisos y atribuciones — Meridiano Cero

## Licencia

Este proyecto se distribuye bajo licencia **AGPL-3.0-only** (GNU Affero General Public License v3.0).  
Consulta el archivo [LICENSE](./LICENSE) para los términos completos.

Los créditos también se muestran dentro del juego, en la página «Créditos y licencias» (ruta `/creditos`, enlazada desde el pie del archivo).

## Créditos

### Creador original

- **Antonio Moles** — arquitectura, diseño y desarrollo inicial (2026)

Ver [AUTHORS.md](./AUTHORS.md) para la lista de autores y colaboradores.

### Dependencias y librerías

Dependencias directas del workspace. El inventario completo (274 entradas, 270 paquetes únicos, transitivas incluidas, con versiones) está en el registro de distribución [docs/quality/T6-04-distribucion.md](./docs/quality/T6-04-distribucion.md).

| Proyecto | Licencia | Uso |
|----------|----------|-----|
| React | MIT | Frontend UI |
| react-dom | MIT | Frontend UI |
| react-router-dom | MIT | Rutas de la web |
| Fastify | MIT | API HTTP |
| pg | MIT | Acceso a PostgreSQL |
| Drizzle ORM | Apache-2.0 | ORM y migraciones |
| Drizzle Kit | MIT | Migraciones |
| argon2 | MIT | Hash de contraseñas |
| Vite | MIT | Bundler y dev server |
| lightningcss | MPL-2.0 | Procesado de CSS en la compilación |
| Vitest | MIT | Framework de pruebas |
| @playwright/test | Apache-2.0 | Pruebas E2E |
| TypeScript | Apache-2.0 | Tipos y compilación |
| ESLint | MIT | Análisis estático |
| @eslint/js | MIT | Análisis estático |
| typescript-eslint | MIT | Análisis estático |
| dependency-cruiser | MIT | Análisis estático de imports |
| concurrently | MIT | Ejecución de tareas en paralelo |
| @types/node | MIT | Tipos de TypeScript |
| @types/react | MIT | Tipos de TypeScript |
| @types/react-dom | MIT | Tipos de TypeScript |
| @types/pg | MIT | Tipos de TypeScript |

Ninguna dependencia es GPL, AGPL, LGPL ni propietaria. La única licencia de copyleft es MPL-2.0 (lightningcss, solo en la compilación, a nivel de archivo): no exige compartir el código del juego ni impide distribuirlo.

### Servicios y herramientas externas (no son dependencias npm)

| Proyecto | Licencia | Uso |
|----------|----------|-----|
| PostgreSQL | PostgreSQL License | Base de datos (servicio externo) |
| pnpm | MIT | Gestor de paquetes |
| Ollama | MIT | Inferencia local de IA (servicio externo, opcional) |

### Fuentes y assets

- **Tipografía**: fuentes del sistema (ui-monospace, Consolas, system-ui); sin fuentes externas ni descargas.
- **Iconografía**: Texto ASCII/Unicode estándar.
- **Arte pixel**: generado proceduralmente (SVG en línea, determinista por semilla, sin assets externos).
- **Música**: sintetizada con WebAudio en el propio juego, sin archivos de audio ni copyright de terceros.
- **Voz (TTS)**: voces del sistema o del navegador mediante speechSynthesis; sin archivos de audio ni servicios de terceros.

### Inspiración

Este proyecto se inspira en la experiencia clásica de *Carmen Sandiego* y en la estética de terminales MS-DOS. No se reutilizan elementos protegidos por derechos de autor de dichos productos.

## Atribución de contribuciones

Los colaboradores conservan los derechos que correspondan sobre sus aportaciones bajo las condiciones de la licencia AGPL-3.0-only. Las contribuciones se aceptan bajo los términos de [CONTRIBUTING.md](./CONTRIBUTING.md).

## Marcas comerciales

"Meridiano Cero", "A.C.M.E." y logos asociados son nombres provisionales, pendientes de confirmación antes de publicar; no hay ninguna marca registrada. No se garantiza que forks o distribuciones independientes mantengan la misma identidad visual.
