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

Abrir http://127.0.0.1:5173. La raíz muestra el archivo real de la sesión, con filtros y páginas. Entrar en desarrollo local solicita sesión explícita cuando LOCAL_DEV_AUTH_ENABLED=true; la creación de partidas requiere selección y botón explícitos y no inicia todavía la investigación. La API escucha en 127.0.0.1:3000. GET /api/v1/health devuelve proceso vivo; GET /api/v1/ready exige DB y migraciones exactas.

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

## Persistencia inicial T3-02

El único esquema registrado en Drizzle es src/database/schema.ts; db:migrate consume apps/api/migrations mediante su ledger y comprueba hashes. src/db es un árbol histórico no activo: no aplicar sus SQL manualmente ni mezclar su tabla migrations con base_migrations. Las migraciones nuevas añaden partidas y claves de creación; no requieren borrar el volumen ni recrear perfiles.

El servicio nuevo es interno; la existencia de tablas no habilita rutas de juego o guardados en el navegador. [Evidencia](../quality/T3-02-persistencia.md). Para ensayos aislados se reserva el puerto loopback 15434 además del 15433 habitual de pruebas; la base local de uso sigue en 15432. No reutilizar un proyecto/volumen de prueba ajeno para aplicar migraciones nuevas. Configuración y credenciales permanecen fuera de Git.

## Probar catálogo e inicio por API

Entrega posterior a la persistencia interna: ya están registrados catálogo, detalle, creación y lectura de partidas iniciales. Ejecutar setup, PostgreSQL, db:migrate y API según los pasos anteriores. La UI consume sesión y listado propio; también ofrece catálogo/creación recuperable; lectura inicial permanece en API, sin investigación conectada. Ejemplo PowerShell para el entorno local de desarrollo autorizado, con API en 3000 y Origin configurado en 5173:

~~~powershell
$meridianoApi = 'http://127.0.0.1:3000/api/v1'
$meridianoLogin = Invoke-RestMethod -Method Post -Uri "$meridianoApi/auth/local-session" -Headers @{ Origin='http://127.0.0.1:5173' } -ContentType 'application/json' -Body '{}' -SessionVariable meridianoCookies
$meridianoHeaders = @{ Origin='http://127.0.0.1:5173'; 'X-CSRF-Token'=$meridianoLogin.csrfToken }
Invoke-RestMethod -Uri "$meridianoApi/cases" -WebSession $meridianoCookies
$meridianoIntent = @{ caseId='astrolabio-tres-ciudades'; idempotencyKey=[guid]::NewGuid().ToString() } | ConvertTo-Json
$meridianoRun = Invoke-RestMethod -Method Post -Uri "$meridianoApi/runs" -WebSession $meridianoCookies -Headers $meridianoHeaders -ContentType 'application/json' -Body $meridianoIntent
Invoke-RestMethod -Uri "$meridianoApi/runs/$($meridianoRun.runId)" -WebSession $meridianoCookies
~~~

Si se pierde la respuesta de creación, reutilizar meridianoIntent con la misma clave; no generar otra. Las cookies permanecen en la sesión HTTP y CSRF en memoria, sin copiar claves a archivos. Adaptar los puertos al entorno configurado, nunca habilitar bootstrap local en un VPS público.

Esta entrega solo inicia/recupera estado inicial: canSave/canLoad=false, sin acciones ni guardados disponibles. Un estado incompatible responde 503 sin modificarlo. No es todavía una investigación jugable. [Alcance y pruebas](../quality/T3-02-http-inicial.md).

## Límites y diagnóstico local de resiliencia

La admisión de producto tiene 32 peticiones en curso por instancia; al saturarse responde 503 con Retry-After sin una segunda cola HTTP. PostgreSQL tiene cinco conexiones y hasta 25 esperas; un exceso se rechaza. Readiness comparte trabajo entre probes y no abre otro si venció su watchdog mientras sigue una query. Los timeouts nativos de conexión/query/statement siguen activos; el watchdog no demuestra cancelación SQL.

El proceso real emite JSON request.completed en stdout por allowlist. No incluye URL, cuerpos, cookies, CSRF, claves o SQL. Contadores e histogramas locales tienen dimensiones fijas y separan health/readiness de solicitudes de producto; todavía no calculan un SLO de tráfico elegible. Si el stream falla o no drena, descarta sin cola creciente. El contador de descarte no acredita entrega remota y la rotación/retención del supervisor debe configurarse antes de distribución/público; no existe un collector obligatorio.

SIGINT/SIGTERM comparten una parada: draining cierra readiness/admisión; Fastify drena y su onClose cierra el pool una sola vez. Presupuesto inicial de 10 segundos; al agotarse o fallar cierre se fuerza salida. Una escritura interrumpida queda potencialmente incierta: recuperar la misma intención, sin afirmar rollback. El presupuesto se ha probado en unidad; falta el ensayo completo con proceso/supervisor/IA en vuelo. [Auditoría y pendientes](../quality/AUDITORIA-7962014.md).

Las rutas de juego comprueban también compatibilidad de esquema: no basta con mirar readiness desde fuera. Crear/leer partida valida el ledger dentro de la transacción y mantiene el lock de migración compartido; el migrador usa el mismo lock exclusivo. Una versión desconocida o checksum distinto bloquea el juego con 503 y conserva los datos. No ejecutar SQL de migración histórica a mano para forzar compatibilidad.

## Archivo web conectado

Con DB/migraciones y API/Vite activos, abrir la raíz del puerto web. Sin sesión no se carga ninguna partida ni se autentica automáticamente. En build de desarrollo se ofrece Entrar en desarrollo local; requiere backend habilitado y Origin igual al puerto Vite configurado. Si se cambia a 5174, PUBLIC_ORIGIN debe coincidir antes de arrancar API.

El archivo permite Todas/Activas/Cerradas, Anterior/Siguiente y Actualizar. El título procede del catálogo público y la fecha es operativa, no tiempo del caso. Página vacía no indica fallo; error no se presenta como guardado o cierre completados. Cerrar sesión oculta perfil/lista y solo confirma al recibir respuesta; si falla, reintentar el cierre. No se guardan CSRF o estado de partidas en localStorage/sessionStorage. Solo la referencia mínima de creación por cuenta se conserva en sessionStorage.

Nueva partida permite seleccionar caso y crear; investigación, guardados, login público o configuración IA siguen sin conectar a esta pantalla. /prototype mantiene la muestra separada. [Evidencia y límites](../quality/T3-03-archivo-conectado.md).

## Crear partida desde web

Entrar con la sesión local habilitada, elegir un expediente disponible y activar Crear partida. Se conserva una referencia antes de enviar; si storage está bloqueado no se envía una intención nueva. Solo la consulta de registro confirmado muestra éxito. Actualizar obtiene el listado actual; no hay todavía entrada a investigación/progreso.

Si el resultado es incierto, conservar la pestaña o recargarla: Comprobar creación no reenvía, Reintentar misma creación reutiliza clave y caso. Un no encontrado no prueba rollback. No limpiar manualmente la referencia ni crear con otra clave para resolver un timeout. Preparar otra creación solo aparece tras confirmación. Cerrar sesión elimina la referencia de esa cuenta sin cancelar necesariamente una creación ya enviada; al volver, revisar el archivo.

SessionStorage es de pestaña/origen: no promete recuperación por clave tras cerrar la pestaña. No contiene CSRF, cookies o texto privado. [Evidencia del ensayo con pérdida de acuse y recarga](../quality/T3-creacion-web-recuperable.md).


## Consultar una partida inicial

Desde una fila del archivo, Consultar solicita la ficha real a la API. Muestra ubicación pública, descripción y reloj/plazo; no ejecuta acciones ni avanza minutos. Cerrar ficha vuelve al archivo y Cancelar consulta de ficha descarta la lectura pendiente.

Actualmente se admiten solo partidas sin progreso. Si no puede abrirse, no se restaura ni se crea automáticamente otra partida: actualiza el archivo para comprobar la sesión/disponibilidad. La investigación y los guardados siguen pendientes. [Alcance y verificación](../quality/T3-ficha-inicial-conectada.md).
