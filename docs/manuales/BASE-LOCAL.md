# Base local de fase 1

Estado: implementación de T1-02/03/04; no juego completo. Contratos de referencia: SPEC-004/009/011. Resultados y limitaciones en las evidencias de T1.

## Requisitos y alcance

Node 24.22.1 y pnpm 12.15.0, Docker Desktop en modo Linux. No mezclar node_modules de Windows y WSL: instalar por plataforma. No se modificaron instalaciones globales ni WSL para esta entrega. El worker, motor y proveedores IA siguen fuera de esta fase.

## Primera puesta en marcha

Desde el worktree o checkout ya integrado:

```text
pnpm install --frozen-lockfile --ignore-scripts
pnpm setup:local
docker compose up -d --wait
pnpm db:migrate
pnpm dev
```

Abrir http://127.0.0.1:5173. La pantalla base comprueba HTTP; no crea todavía detective ni partida. La API escucha en 127.0.0.1:3000. GET /api/v1/health devuelve proceso vivo; GET /api/v1/ready exige DB y migraciones exactas.

setup:local crea .env y .local-secrets con contraseñas aleatorias. No imprime ni sobrescribe secretos existentes. Si hay configuración previa, revisar/conservar, no borrar para repetir un comando. .env.example solo es una plantilla sin credenciales. No ejecutar docker compose config para compartir su salida junto a archivos privados.

En POSIX, el directorio de secretos es 0700, .env 0600 y los ficheros de secreto montados son legibles por postgres dentro de Docker; el directorio protege su acceso en host. En Windows respetan además las ACL heredadas del perfil. No compartir la carpeta de configuración.

## Persistencia y migraciones

DB: postgres:18.6 con digest fijo. Solo 127.0.0.1:15432, volumen del proyecto meridiano-cero-dev. No borrar volúmenes ni cambiar major para resolver un error.

Migración: comando explícito, SQL revisable generado por Drizzle y migración adicional de permisos/semilla. Ledger con hash, transacción y bloqueo; no se ejecuta al consultar ready o arrancar API. El dueño migra; meridiano_app solo puede consultar perfil y administrar sesiones, sin crear tablas. DATABASE_MIGRATION_URL nunca se usa como conexión normal de API.

Si DB no responde: health continúa y ready devuelve 503. Si configuración es insegura: el servidor falla antes de escuchar. Si existe un esquema futuro o hash incompatible: detener y revisar versión, no modificar ledger a mano.

## Sesión local

LOCAL_DEV_AUTH_ENABLED=true solo con APP_MODE=development, API_HOST=127.0.0.1 y PUBLIC_ORIGIN exacto de loopback. La base rechaza self-hosted/public como capacidades aún no implementadas.

POST /api/v1/auth/local-session requiere Origin exacto y JSON {}. Devuelve perfil mínimo y CSRF; autenticación solo en cookie HttpOnly, nunca token de sesión en JSON. GET /api/v1/me requiere cookie. POST /api/v1/auth/logout requiere Origin y CSRF para sesión activa. Caducidad absoluta de ocho horas; rotación revoca cookie anterior. Logout repetido es idempotente.

No confiar en Host ni X-Forwarded-* para habilitar bypass. Sin registro, contraseñas ni privilegios de administrador. Las cookies development son HTTP solo porque se limitan a 127.0.0.1; no trasladar esa excepción a público.

## Comprobaciones

```text
pnpm typecheck
pnpm lint
pnpm check:format
pnpm test
pnpm build
pnpm verify:guards
pnpm smoke
pnpm security:dependencies
pnpm security:secrets --verify-detector
python3 scripts/verify_docs.py
```

Formato comprueba espacios finales/newline; no es un formateador exhaustivo. Guardas crean y retiran archivos negativos: detener watchers antes. Smoke es HTTP real y proxy Vite, no interacción E2E de navegador.

Gitleaks requiere Docker activo; escanea sin red una copia de archivos versionables con salida redactada y no copia .env ni secretos ignorados. El canario aleatorio no funcional comprueba el detector y se destruye con la copia temporal. No es auditoría completa del historial Git ni de archivos privados.

## Integración aislada

Crear una sola vez configuración de prueba:

```text
pnpm setup:local --test
docker compose --env-file .env.integration -p meridiano-cero-t1-test up -d --wait
pnpm test:integration
pnpm verify:persistence
docker compose --env-file .env.integration -p meridiano-cero-t1-test down
```

La suite exige puerto 15433, usuario meridiano_app y DB meridiano en loopback. Usa otro proyecto/volumen y datos sintéticos. No apuntarla a producción. verify:persistence detiene/recrea solo ese contenedor y comprueba perfil/sesión; mantiene el volumen. down detiene sin eliminar datos. Para repetir, conservar .env.integration y omitir setup.

## Incidencias y límites

Docker puede estar iniciándose: esperar estado running y repetir up --wait antes de tests. Fallos de daemon/DB no son pruebas aprobadas. Un detector que no puede ejecutarse bloquea el control; no se trata como ausencia de secretos.

Audit conocido: una moderada de esbuild transitivo de Drizzle Kit, sin altas/críticas en la consulta registrada. No ejecutar su servidor/studio; actualizar tooling compatible antes de distribución o habilitar esa función. No está resuelta ni oculta por un override.

La CI está definida, pero no se ha hecho push ni ejecutado remotamente. El hito acredita base técnica local; no conformidad ASVS global, IA, motor ni accesibilidad completa del juego.
