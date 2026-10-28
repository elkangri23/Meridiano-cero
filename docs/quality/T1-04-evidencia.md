# T1-04 Comprobaciones y CI

Fecha: 2026-10-28. Estado: workflow implementado y comprobaciones locales; resultado final en FASE-1. No push ni ejecución GitHub remota autorizados/realizados.

## Workflow

GitHub Actions con contents:read, persist-credentials:false, pull_request/push main y ejecución manual. Checkout y setup-node fijados por SHA contrastado con sus tags oficiales. Ubuntu 24.04, Node 24.22.1 y pnpm 12.15.0 aislado; sin credenciales de producción.

Instalación congelada sin scripts arbitrarios de dependencias, tipos, ESLint/imports, formato de espacios/newline, unitarias, build, pruebas negativas de guardas, smoke, documentación, auditoría, secretos, DB e integración/persistencia. No se incorpora un formateador general ni se afirma canon de estilo por comprobar espacios.

Gitleaks v8.30.1 fijado a digest sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f. Escanea sin red en Docker sobre copia temporal de archivos versionados/versionables, no monta el worktree real ni credenciales ignoradas. Redacción total en salida. Incluye canario aleatorio genérico no funcional para comprobar que el detector bloquea; nunca se guarda en repositorio.

## Hallazgo de dependencias

pnpm audit informa 0 altas, 0 críticas y 1 moderada: esbuild transitivo de herramientas de desarrollo de Drizzle Kit, [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99). Afecta al servidor de desarrollo de esbuild; no al SQL ni al binario compilado del juego. No se ejecuta drizzle-kit studio/servidor esbuild ni se expone esa herramienta. No se altera una dependencia transitiva con override no probado.

Se mantiene visible, responsable: mantenimiento de tooling; revisar actualización compatible de Drizzle Kit antes de distribución/público, o si se habilita su servidor de desarrollo. No se excluye del informe ni se declara resuelta. El gate bloquea altos/críticos, como prescribe el plan. Auditoría es un servicio de metadatos públicos y no certifica diseño.

## Incidencias de verificación

La primera prueba negativa usó un identificador AWS con palabra sintética que no detectó el catálogo: no se contó como éxito. Se cambió a canario aleatorio de generic-api-key, sin credenciales reales, manteniendo la exigencia de código 1 y regla reconocida. Un intento del escáner falló al estar Docker reiniciándose: también se conserva como fallo operativo y no hallazgo de secreto.

La CI remota sigue sin ejecutarse porque no se ha hecho push. Los resultados locales y sus límites figuran en FASE-1. No se afirma conformidad ASVS global por tener workflow.
