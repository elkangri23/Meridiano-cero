# Harness en Meridiano-cero

Herramientas instaladas en Ubuntu-20.04 (WSL), separadas de Windows:
`~/.local/share/meridiano-harness/`. Claude nativo: `~/.local/bin/claude`.
El lanzador prepara PATH y usa un estado de Harness exclusivo para este proyecto.

Las personalidades, fuentes y parcelas del equipo están en
[docs/agents](../../docs/agents/README.md). Hay nueve roles y se conserva el límite
de dos trabajadores simultáneos. Las instrucciones completas se incorporan a
harness.yaml mediante `sync-profiles.py`; no hace falta una llamada al proveedor
para sincronizarlas o validar su configuración.

Desde PowerShell, en la raíz del proyecto:

```powershell
.\scripts\harness\connect-private-relay.ps1
.\scripts\harness.ps1 config check
.\scripts\harness.ps1 doctor
.\scripts\harness.ps1
```

FreeLLMAPI usa una configuración privada en WSL, importada con autorización
desde los campos del proveedor de Windows. Está en
`~/.local/share/meridiano-harness/claude-config/settings.json`, con permisos 600.
El archivo original de Windows no se ha modificado. El diagnóstico reconoce la
presencia del token; esto no demuestra por sí solo que el proveedor responda.
No pegues secretos en Git ni en el chat.

La conexión está verificada: Claude dentro de WSL respondió `WSL_OK` mediante
FreeLLMAPI, desde una carpeta vacía y sin herramientas ni archivos del proyecto.
Claude estimó 0.00157 USD; no es una confirmación del coste cobrado por el gateway.

El servidor escucha solo en localhost:31415 de Windows. En la red NAT actual,
localhost de Ubuntu es un destino diferente. Se utiliza un puente TCP en el
puerto 31416, ligado exclusivamente a la interfaz privada de WSL en Windows.
Solo acepta como origen la IP actual de Ubuntu y reenvía a 127.0.0.1:31415.
No escucha en 0.0.0.0 ni en la dirección de la red local. No inspecciona ni
registra contenidos de las peticiones o respuestas. No requiere cambiar el
firewall ni reiniciar WSL. FreeLLMAPI debe seguir ejecutándose en Windows.

Ejecuta `connect-private-relay.ps1` de forma explícita tras reiniciar Windows o
WSL, o si cambian las direcciones privadas. Reutiliza el proceso existente cuando
es válido y actualiza solo la URL de la configuración privada de Ubuntu. Conserva
una copia anterior con permisos 600; los tokens no se cambian. Los lanzadores
habituales de Harness no inician el puente ni modifican la configuración.

Para detener el puente:

```powershell
.\scripts\harness\stop-windows-relay.ps1
```

El proceso se inicia oculto, no como servicio de Windows. Su PID y los registros
sin contenido de tráfico están en `.harness/runs/windows-relay/`, ignorado por Git.
La prueba `probe-relay-boundary.cjs` comprueba que un origen diferente de Ubuntu
se rechaza. La raíz HTTP respondió 200 desde Ubuntu, y la llamada mínima de Claude
confirmó autenticación, formato de respuesta y recorrido completo del puente.

Se probó `networkingMode=mirrored` con autorización, pero dejó WSL sin interfaz
de red; se restauró la configuración anterior y se verificó de nuevo Internet.
No activar ese modo de nuevo sin resolver su incompatibilidad en el equipo.

## Versiones verificadas el 27 de octubre de 2026

- Ubuntu 20.04.6: paquetes disponibles actualizados, sin paquetes retenidos.
  Se ha actualizado dentro de esta distribución; no se ha migrado a otra LTS.
- Node 24.22.1 LTS, npm 12.2.1 y pnpm general 12.15.0, todos de Linux.
- Git 2.50.1 desde git-core/ppa, Claude Code nativo 2.1.311.
- Harness: commit `2910cd8d061d982f8242188e58e0950726ae2941`, con ajustes locales.
  Su instalación conserva pnpm 10.17.0, indicado por su packageManager.

Los ajustes locales reconocen `ANTHROPIC_AUTH_TOKEN` en la configuración privada
y fijan `better-sqlite3` 12.4.1 en storage y CLI. Esta versión funciona con Node
24 y las bibliotecas de Ubuntu 20.04; el binario de la 13.0.3 exige una glibc más
reciente. No actualizar dependencias de Harness a ciegas. Tras un cambio de
Node, recompilar y volver a ejecutar sus comprobaciones.

Verificación previa a la ampliación de personalidades: compilación, tipos y estilo correctos; batería funcional con
492 pruebas aprobadas y 2 omitidas. Las cuatro pruebas añadidas de detección
comprueban token configurado, ausencia/JSON inválido, tipos inválidos y clave
por entorno, sin devolver secretos. Worktree temporal de Meridiano-cero y
verificación documental correctos, sin commits ni merges.

La validación posterior de los nueve perfiles y los ajustes de planificación/
revisión está en [el registro del equipo](../../docs/agents/VALIDACION.md),
incluidos los resultados completos y las limitaciones de las repeticiones.

## Flujo con aprobación humana

1. En la interfaz, selecciona `planner` con Tab para conversar con el arquitecto
   en modo lectura. Acordad primero un hito pequeño del backlog.
2. Usa `/plan` para preparar tareas. Alternativamente, `plan <archivo>` planifica
   un documento acotado. Estas llamadas usan el proveedor cuando esté conectado.
3. Examina las tareas antes de aprobarlas. `approve T-001` aprueba esa tarea;
   el modo `assisted` puede pedir además una aprobación `A-n` para ejecutarla.
   Evita `approve --all` si hay decisiones pendientes.
4. `run` inicia el trabajo aprobado. Hay hasta dos trabajadores en worktrees.
   Las tareas dependientes esperan a que se integren sus requisitos previos.
5. `review T-001` muestra las evidencias; `review T-001 --accept` acepta y fusiona
   esa tarea en `harness/integration`. Esta es una decisión humana.
6. `land` entrega a `main` solo cuando tú lo ordenas. No hay push ni merge remoto
   como parte de esta instalación. Revisa el diff y las pruebas antes de usarlo.
7. `stop` detiene el servicio y los agentes; cerrar la interfaz no los detiene.

`harness.yaml` fija `autonomy: assisted` y `land: manual`. Las delegaciones
automáticas y los seguimientos del lead están desactivados: el paralelismo sale
de las tareas que apruebes del plan. El revisor tiene sesión propia, pero comparte
proveedor y modelo con los trabajadores; no es una segunda opinión de otro modelo.

Los controles actuales comprueban integridad documental y espacios en el diff.
No prueban el videojuego ni los controles de seguridad. Cada fase de código debe
añadir pruebas reales a `.harness/checks.yaml` antes de aprobar su implementación.

Antes del primer trabajo real, revisa y guarda la configuración en un commit
manual para que también esté presente en los worktrees. Aún no se ha creado ese
commit ni se ha implementado ninguna tarea del videojuego.

## Comprobaciones de instalación

`prepare-wsl.sh` instala dependencias y compila la copia existente de Harness.
`verify-wsl.sh` ejecuta sus comprobaciones oficiales sin cuota de proveedor.
`smoke-worktree.sh` comprueba un worktree temporal del HEAD de este proyecto,
valida su documentación y lo retira sin modificar HEAD ni crear commits.

`diagnose-provider-network.py` comprueba DNS/TCP/TLS sin enviar credenciales ni
peticiones a la API. `smoke-provider-wsl.py` sí consume una petición al proveedor:
usar solo con autorización. Se ejecuta desde una carpeta vacía, sin herramientas,
sin persistir sesión ni enviar contexto del proyecto.

En una nueva terminal Ubuntu puedes usar `harness-meridiano` como acceso directo
al mismo proyecto. `finish-shell-wsl.py` prepara ese comando y el PATH Linux.
