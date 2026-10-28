# Cómo usar Harness en Meridiano-cero

Guía de la instalación actual, revisada el 27 de octubre de 2026. Harness coordina
agentes para desarrollar el proyecto; el videojuego todavía no está implementado.
Esta guía no inicia agentes, aprueba tareas ni hace commits por ti.

## 1. Qué puedes hacer ahora

Preparar un encargo acotado, pedir al arquitecto que lo divida en borradores,
revisar cada tarea, aprobarla, seguir el trabajo en ramas separadas, comprobar
resultados y aceptar los cambios manualmente.

El equipo tiene nueve roles y permite hasta dos trabajadores simultáneos.
Los perfiles están en [el mapa del equipo](../agents/README.md). Todos usan
FreeLLMAPI/modelo auto; sus instrucciones y sesiones están diferenciadas.

**La forma más controlable de empezar es un archivo de petición y el comando
plan. No empieces pegando todo el backlog en el chat ni aprobando todas las tareas.**

## 2. Dónde escribir cada cosa

| Lugar | Cómo reconocerlo | Qué escribir |
|---|---|---|
| Terminal PowerShell de VS Code | Prompt parecido a `PS C:\...>` | Comandos que empiezan por `.\scripts\harness.ps1`, Git y el acceso al proyecto |
| Interfaz de Harness | Panel de agentes y cuadro de entrada | Mensajes y comandos con `/`, como `/tasks` o `/review T-001` |
| Editor de VS Code | Archivo Markdown abierto | El texto de una petición o la revisión manual de documentos |

Los bloques de esta guía indican su contexto. No pegues un comando PowerShell
en el chat de Harness ni añadas `/` a un comando de PowerShell. Los comandos de
ejecución se muestran para cuando tú decidas usarlos; leerlos no los ejecuta.

## 3. Antes del primer trabajo real: guardar la preparación en Git

Los worktrees son copias de trabajo en ramas separadas que parten de commits.
Un archivo sin seguimiento en tu carpeta principal no aparece automáticamente
en ellas. La configuración y las personalidades se han preparado sin hacer un
commit automático.

En PowerShell:

```powershell
Set-Location 'C:\Users\amoles\Documents\Codex\Meridiano-cero'
git status --short
git diff
```

Revisa también los archivos nuevos: `git diff` no muestra su contenido todavía.
Puedes abrirlos en VS Code. Incluye la configuración, los perfiles y las guías
que quieras conservar. No añadas secretos o archivos privados de Windows/WSL.
Los registros y worktrees internos de Harness están ignorados por Git.

Una selección explícita de la preparación actual, después de revisarla:

```powershell
git add -- .gitignore AGENTS.md harness.yaml .harness/checks.yaml docs/agents docs/README.md docs/manuales/HARNESS.md docs/manuales/README.md scripts/harness.ps1 scripts/harness
git diff --cached --stat
git diff --cached
```

**Solo si lo preparado es lo que quieres guardar**, crea tú el commit:

```powershell
git commit -m "Configura Harness y el equipo de Meridiano-cero"
```

Esto guarda localmente. No hace push ni publica nada. Si alguno de los archivos
ya estaba guardado, Git no duplica cambios. Si tienes otros cambios pendientes,
revísalos por separado; no uses reset o borrados para conseguir una carpeta limpia.

## 4. Abrir Harness: rutina de cada sesión

Mantén abierto o activo en Windows el servidor de FreeLLMAPI que utilizas con
Claude. Después, en la terminal PowerShell de VS Code:

```powershell
Set-Location 'C:\Users\amoles\Documents\Codex\Meridiano-cero'
.\scripts\harness\connect-private-relay.ps1
.\scripts\harness.ps1 config check
.\scripts\harness.ps1 doctor
.\scripts\harness.ps1
```

Qué hace cada paso:

1. Sitúa la terminal en el proyecto correcto.
2. Prepara el puente privado entre Ubuntu y el servidor local de Windows. Reutiliza
   el proceso si ya existe y actualiza la URL privada de WSL cuando corresponde.
3. Comprueba la configuración del equipo y las pruebas definidas.
4. Comprueba instalación, configuración y presencia de autenticación.
5. Abre la interfaz. Puede iniciar el servicio de Harness; si hay trabajo aprobado
   de una sesión anterior, revisa su estado, no presupongas que todo está detenido.

`doctor` puede mostrar avisos de que los revisores comparten ruta con los
trabajadores. Es lo esperado con FreeLLMAPI auto. Que detecte un token no prueba
por sí solo que el proveedor responda en ese momento.

No necesitas abrir Ubuntu aparte para este flujo: el lanzador lo utiliza.
Repite el comando del puente tras reiniciar Windows/WSL o cambiar sus direcciones.

## 5. Orientarte en la pantalla

Dentro de Harness:

| Comando o tecla | Para qué sirve |
|---|---|
| `/help` | Ver la ayuda de la interfaz |
| `/agents` | Ver agentes y lo que está haciendo cada uno |
| `/tasks` | Ver tareas y estados |
| `/board` | Ver el tablero compartido |
| `/panes` | Ver sesiones en paneles |
| Tab / Mayús+Tab | Cambiar la selección entre equipo y agentes |
| `/switch backend` | Seleccionar expresamente un rol |
| `/switch team` | Volver al equipo |
| `/zoom` | Ampliar el agente seleccionado |
| Esc | Cerrar una vista o limpiar la entrada |
| `/usage` | Ver información disponible de uso y límites |
| `/report` | Ver el informe de trabajo y consumo registrado |

Los importes o cuotas desconocidos no equivalen a cero. Los costes estimados
por Claude no son una factura verificada de FreeLLMAPI.

### Qué significa hablar con un agente en esta versión

La interfaz instalada no ofrece un chat exploratorio independiente con planner:
seleccionarlo y escribir redirige el mensaje al equipo. Los mensajes al equipo
pueden convertirse en trabajo, no son solo conversación sin efectos.

Escribir a un trabajador seleccionado puede crear una tarea aprobada o enviar
instrucciones a su tarea actual. El modo assisted mantiene una aprobación adicional
antes de su primera implementación, pero no lo confundas con una libreta privada.

El reviewer automático tampoco tiene un chat libre desde su selector: informa
de que revisará al terminar las comprobaciones. Seguridad no constituye un
segundo pase automático por existir su perfil. No cambies esos roles a escritura
para conseguir una conversación.

Para explorar decisiones sin arrancar trabajo, puedes acordar el alcance en
este chat de Codex o escribirlo primero en un documento. Después usa `plan`:
sí llama al arquitecto configurado, pide una propuesta estructurada y conserva
las tareas en borrador hasta que tú apruebes.

## 6. Tu primer encargo: T1-01, sin saltar fases

La primera tarea preparada del [backlog](../plan/BACKLOG.md) es T1-01: cerrar los
contratos de base antes de crear la aplicación. No es implementar todo el juego.
El detalle está en [TAREAS](../plan/TAREAS.md).

En VS Code, crea y guarda `docs/plan/PETICION-HARNESS.md`. Puedes empezar por:

```markdown
# Petición: preparar T1-01 de Meridiano-cero

Lee AGENTS.md, docs/plan/BASELINE.md, ROADMAP.md, BACKLOG.md y TAREAS.md.
Consulta SPEC-004, SPEC-009, SPEC-011 y los ADR aplicables.

Quiero cerrar los contratos de base de T1-01: sesión local limitada a loopback,
API v1, configuración, versiones soportadas, migraciones y rechazo del bypass
local en modo público. No implementes todavía la aplicación.

Primero identifica decisiones cerradas, propuestas y mediciones pendientes.
Propón tareas documentales pequeñas para backend y ops, con archivos concretos,
dependencias, criterios de salida y pruebas previstas. Respeta sus parcelas.
Si una decisión cambia comportamiento o alcance, déjala para mi revisión.

No crees tareas de frontend completo, motor, generador o despliegue público.
No cambies reglas del juego ni proveedor de producto por usar FreeLLMAPI aquí.
No modifiques Harness, credenciales, red, perfiles ni datos de otros proyectos.

Devuelve un plan revisable. No apruebes tareas ni ejecutes implementación.
```

Este texto pide un plan; no autoriza a los trabajadores a ejecutar las tareas
que proponga. El planificador solo asigna tareas de su grafo a roles escritores;
las decisiones humanas y revisiones de seguridad deben quedar explícitas en el
plan, sin convertir roles readonly en implementadores.

No existe todavía ese archivo por leer esta guía: créalo y adapta el encargo a
lo que realmente quieres hacer. El nombre es una propuesta para tu petición.

## 7. Pedir el plan y revisar los borradores

Puedes hacerlo dentro de Harness:

```text
/plan docs/plan/PETICION-HARNESS.md
```

O desde una segunda terminal PowerShell situada en el mismo proyecto:

```powershell
.\scripts\harness.ps1 plan docs/plan/PETICION-HARNESS.md
.\scripts\harness.ps1 task list
```

Elige una de las dos vías para pedir el plan. No ejecutes ambas por rutina:
podrían crear dos propuestas. Planificar consume una llamada al proveedor y
puede hacer un reintento de validación; no ejecuta los borradores.

Harness asignará IDs como T-001 y T-002. **Son IDs del orquestador, diferentes de
T1-01, T1-02, etc. del backlog del videojuego.** Relaciona cada tarea con su ID
de producto en la descripción. Los números de esta guía son ejemplos: usa los
que aparezcan en tu sesión.

Para inspeccionar una tarea:

```powershell
.\scripts\harness.ps1 task show T-001
```

Antes de aprobar, comprueba:

- Qué problema resuelve, qué archivos tocará y quién es su dueño.
- Que las dependencias estén satisfechas y no adelante una fase futura.
- Que los criterios sean observables y las pruebas existan o estén previstas
  con honestidad; un comando futuro no es una prueba pasada.
- Que no incluya cambios de reglas, permisos, dependencias o secretos no acordados.
- Que no agrupe en una sola tarea archivos de varios especialistas sin resolver
  su reparto. Si nadie puede escribir todo el conjunto, divide o revisa el plan.

Si la propuesta no sirve, no la apruebes. Guarda una petición corregida y cancela
los borradores descartados antes de generar otro plan:

```powershell
.\scripts\harness.ps1 task cancel T-001
```

Cancelar un borrador no crea un commit ni ejecuta su implementación. Si la tarea
ya estaba trabajando, cancelarla detiene su ejecución; revisa su estado y cambios.

## 8. Aprobar y empezar, tarea a tarea

La vía más explícita es PowerShell:

```powershell
.\scripts\harness.ps1 approve T-001
.\scripts\harness.ps1 run --task T-001
```

`approve T-001` saca ese borrador hacia la cola. `run --task` limita el planificador
a esa tarea. Si el servicio ya estaba ejecutándose, una aprobación puede permitir
que despache trabajo: no supongas que aprobar nunca puede empezar nada.

Con `autonomy: assisted`, la primera implementación puede solicitar además una
aprobación A-n. Mira el contexto y el motivo en el estado antes de concederla:

```powershell
.\scripts\harness.ps1 status
.\scripts\harness.ps1 approve A-1
```

T-n identifica trabajo; A-n identifica una autorización concreta. A-1 es solo
un ejemplo, no el permiso universal para todas las tareas.

Dentro de la interfaz existen `/approve T-001` y `/approve A-1`. Ten presente
que **aprobar una tarea con `/approve` también arranca el planificador** en esta
versión. `/task` crea una tarea aprobada y lo arranca; no sirve para crear un
borrador sin efectos. Para eso usa PowerShell sin `--approve`:

```powershell
.\scripts\harness.ps1 task add "Revisar contrato de sesión local de T1-01" --role backend --files docs/specs/SPEC-004-api.md --acceptance "Distingue modo local y público sin credenciales universales"
```

Ese ejemplo crea un borrador nuevo: úsalo como alternativa al plan, no además
del mismo encargo duplicado. Evita `approve --all`, `/approve all` o `--approve`
al crear tareas mientras estás aprendiendo el flujo.

## 9. Seguir el trabajo y entender las esperas

Dentro de Harness usa `/agents`, `/tasks`, `/board`, `/panes` y `/review T-001`.
Desde otra terminal:

```powershell
.\scripts\harness.ps1 status
.\scripts\harness.ps1 task show T-001
```

| Estado | Qué debes entender |
|---|---|
| DRAFT | Borrador pendiente de tu aprobación |
| QUEUED | En cola; puede esperar una aprobación, dependencia, capacidad o límite |
| RUNNING | Trabajador ejecutando la tarea |
| GATING | Comprobaciones independientes del cambio |
| REPAIRING | Intento acotado de corregir un fallo |
| REVIEWING | Revisión automática del diff |
| PR_READY | Lista para tu revisión y aceptación; no significa que exista una PR en GitHub |
| MERGED | Integrada en harness/integration; aún puede no estar en main |
| PAUSED | Pausada por límite o intervención; consulta la causa |
| NEEDS_HUMAN | Necesita que revises un bloqueo; no reintentar a ciegas |

Una tarea dependiente espera a que su requisito esté integrado. Dos trabajadores
solo pueden avanzar a la vez si sus tareas están aprobadas y son independientes.
No es necesario que los nueve roles estén ocupados para que el sistema funcione.

Si limitaste una sesión con `run --task T-001`, recuerda ejecutar después `run`
sin ese filtro cuando quieras habilitar el resto de tareas ya aprobadas.

## 10. Revisar, pedir corrección e integrar

Primero consulta las pruebas y el diff. Desde PowerShell:

```powershell
.\scripts\harness.ps1 review T-001 --diff
```

Dentro de Harness equivalen a consultar `/review T-001` y `/diff T-001`.
Comprueba que los archivos y resultados coinciden con el alcance. El revisor
automático aporta hallazgos; no sustituye tu decisión de aceptación.

Si necesitas correcciones, desde PowerShell:

```powershell
.\scripts\harness.ps1 review T-001 --reject -m "Aclara cómo se rechaza el bypass local al arrancar en modo público y añade el criterio comprobable."
```

Ese ejemplo devuelve la tarea al circuito de corrección y puede dar lugar a
otro intento de trabajo. Dentro de Harness, `/reject comentario` actúa sobre la
tarea seleccionada: comprueba la selección antes de enviarlo.

Solo cuando estés conforme:

```powershell
.\scripts\harness.ps1 review T-001 --accept
```

O dentro de Harness:

```text
/accept T-001
```

**Esta aceptación hace un merge real en harness/integration**, con sus controles.
No es solo una marca de revisión. Puede desbloquear tareas dependientes ya
aprobadas. Tu main sigue separado por `land: manual`.

## 11. Llevar el conjunto a main

Cuando quieras incorporar el trabajo integrado, revisa primero el conjunto en
PowerShell:

```powershell
git status --short
git log --oneline main..harness/integration
git diff --stat main...harness/integration
git diff main...harness/integration
```

La rama de integración aparece cuando Harness la necesita. Si todavía no existe,
es normal que esos comandos de comparación no funcionen.

Cuando estés conforme y no haya cambios locales pendientes que lo impidan:

```powershell
.\scripts\harness.ps1 land
```

`land` modifica main: entrega lo integrado, no necesariamente una única tarea.
Según el estado de las ramas puede avanzar main o crear un merge. No hace push
a GitHub. Si hay conflictos o la base está sucia, revisa el bloqueo; no borres
cambios para forzarlo. Publicar o desplegar sigue siendo una decisión distinta.

## 12. Pausar, salir y detener

| Lo que quieres | Dentro de Harness | Efecto |
|---|---|---|
| Pausar todo conservando trabajo | `/pause all` | Pide pausa; puede necesitar alcanzar un punto seguro |
| Continuar lo pausado | `/resume all` | Reactiva el trabajo elegible |
| Cerrar solo la pantalla | `/quit` o Ctrl+C | Los agentes pueden seguir trabajando |
| Detener agentes y servicio | `/stop` | Detiene la ejecución de Harness |

Para terminar tu jornada de forma explícita, desde una segunda terminal:

```powershell
.\scripts\harness.ps1 stop
.\scripts\harness\stop-windows-relay.ps1
```

Primero detén Harness; después el puente. Detener el puente por sí solo corta
la conexión al proveedor, no detiene a los trabajadores. El servidor FreeLLMAPI
de Windows queda intacto. Al volver a abrir Harness revisa el estado: no promete
continuar una tarea cancelada como si solo hubiera quedado pausada.

## 13. Si algo no funciona

| Síntoma | Qué comprobar |
|---|---|
| FreeLLMAPI no responde | Servidor activo en Windows y connect-private-relay.ps1 ejecutado de nuevo |
| doctor dice que hay token pero la llamada falla | La presencia de token no verifica disponibilidad; revisa puente, proveedor y mensaje de error sin publicar secretos |
| No veo los perfiles nuevos | Detén y reabre Harness con sesiones nuevas; verifica sincronización y configuración |
| No se puede escribir en un archivo | Parcela, protección o encargo incorrectos; no desactives los controles para salir del paso |
| Tarea en cola | Mira aprobaciones A-n, dependencias integradas, filtro de run, trabajadores y límites |
| Una tarea llega a NEEDS_HUMAN | Inspecciona task show/review, corrige la causa y decide si procede reencolar; no aumentes intentos por rutina |
| land no puede continuar | Revisa cambios locales/conflictos sin resetear ni borrar archivos |
| Aviso de misma ruta | Esperado mientras todos usen FreeLLMAPI auto; no implica revisores de modelos distintos |
| Comando pnpm del videojuego no existe | La aplicación todavía no está implementada; los manuales de producto contienen comandos objetivo |

Diagnósticos locales, sin llamada al modelo:

```powershell
.\scripts\harness.ps1 config check
.\scripts\harness.ps1 doctor
wsl -d Ubuntu-20.04 -- python3 /mnt/c/Users/amoles/Documents/Codex/Meridiano-cero/scripts/harness/sync-profiles.py --check
wsl -d Ubuntu-20.04 -- python3 /mnt/c/Users/amoles/Documents/Codex/Meridiano-cero/scripts/harness/diagnose-provider-network.py
```

No uses `/setup` ni `setup --upgrade` como reparación genérica: pueden reescribir
la configuración personalizada. No reinstales herramientas o cambies la red por
un error de autenticación. El [registro de validación](../agents/VALIDACION.md)
recoge las comprobaciones y límites actuales de Harness.

## 14. Qué comprueba hoy y qué falta antes de programar

Los controles de la tarea definidos actualmente comprueban documentación y
espacios del diff. No prueban el videojuego. Antes de aprobar tareas de código,
hay que incorporar comprobaciones reales de tipos, reglas, integración y/o UI
según el alcance; no des por cubierta una función porque el agente diga que pasa.

Todavía no se ha realizado un ciclo real completo del equipo sobre una tarea del
backlog. La conexión al proveedor y las pruebas simuladas no sustituyen ese ensayo.
Empieza por T1-01 y una entrega pequeña, revisable y documental.

Los scopes de Harness validan cambios del repositorio; no son un aislamiento
completo del equipo. No pegues claves en mensajes ni concedas permisos genéricos
si un agente pide acceso fuera de su encargo.

## 15. Resumen de una sesión

1. FreeLLMAPI activo en Windows; PowerShell en Meridiano-cero.
2. Preparar puente, validar configuración y abrir Harness.
3. Escribir una petición pequeña y ejecutar `plan archivo.md` una sola vez.
4. Leer borradores, decisiones y criterios; aprobar solo lo que aceptas ejecutar.
5. Revisar cualquier A-n, seguir el trabajo y sus comprobaciones.
6. Leer diff y resultados; devolver para corrección o aceptar en integración.
7. Revisar el conjunto y usar land cuando quieras modificar main.
8. Detener Harness y después el puente al terminar.

Más detalle: [equipo y personalidades](../agents/README.md),
[instalación y puente](../../scripts/harness/README.md),
[backlog](../plan/BACKLOG.md) y [criterios del juego](../quality/ACEPTACION.md).
