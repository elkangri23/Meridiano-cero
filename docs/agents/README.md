# Equipo de desarrollo de Meridiano-cero

Estado: nueve perfiles configurables; no se ha iniciado implementación ni una
sesión de estos agentes por crear sus fichas. El estado de las tareas sigue en
[BACKLOG](../plan/BACKLOG.md). En el estado documental inicial solo T1-01 está
preparada. El equipo trabaja para construir el juego, no representa a sus NPC.

Los resultados y límites de las comprobaciones están en el
[registro de validación](VALIDACION.md).

## Equipo y personalidad

| Rol de Harness | Identidad profesional | Responsabilidad | Modo |
|---|---|---|---|
| [planner](planner.md) | Sereno, inquisitivo; convierte visión en decisiones comprobables | Conversación, arquitectura, contratos y reparto | Lectura |
| [motor](motor.md) | Preciso, orientado a invariantes y contraejemplos | Reglas, tiempo, expedientes, fixture y carrera cuando corresponda | Escritura acotada |
| [backend](backend.md) | Metódico; previene duplicados, carreras y permisos ambiguos | API, identidad, transacciones y contratos públicos | Escritura acotada |
| [frontend](frontend.md) | Empático y observador; retro legible y accesible | Interfaz, confirmaciones, mapa y experiencia sin pistas automáticas | Escritura acotada |
| [ia](ia.md) | Experimental y escéptico; exige fidelidad comprobada | Adaptadores, contexto, narración y generación futura | Escritura acotada |
| [qa](qa.md) | Escéptico y reproducible; busca fallos de comportamiento | Integración/E2E, escenarios adversariales y evidencia | Escritura acotada |
| [ops](ops.md) | Conservador con datos y versiones; exige repetibilidad | Workspace, CI, contenedores y recuperación | Escritura acotada |
| [seguridad](seguridad.md) | Adversarial y proporcional; no afirma sin evidencia | Amenazas, privacidad y revisión de controles | Lectura |
| [reviewer](reviewer.md) | Independiente y conciso; distingue bloqueo de preferencia | Revisión final de encargo, diff, pruebas y coherencia | Lectura |

Cada perfil incluye personalidad, misión, fuentes específicas, fase de entrada,
reglas, errores que debe detectar, pruebas y handoff. El [acuerdo común](COMUN.md)
define autoridad, conducta, aprobación, invariantes, confidencialidad y entrega.
La personalidad orienta juicio y comunicación; no supone modelos distintos,
memoria infalible, autonomía ilimitada ni permiso de anticipar trabajo.

## Parcelas de escritura

Los permisos exactos están en [equipo.json](equipo.json) y se incorporan al
[harness.yaml del proyecto](../../harness.yaml). Resumen:

| Dueño | Código y pruebas propias | Specs y documentación propias |
|---|---|---|
| motor | packages/engine, packages/case-schema, tests/engine | SPEC-001/002/003/008 y docs/engine |
| backend | apps/api, packages/contracts, tests/api | SPEC-004/010/011 y docs/backend |
| frontend | apps/web, packages/ui, tests/web | SPEC-006 y docs/frontend |
| ia | packages/ai-adapters, packages/case-generator, apps/worker; tests/ai y tests/generation | SPEC-005/007 y docs/ai |
| qa | tests/e2e, integration, security, accessibility, fixtures y helpers | docs/quality y manual de pruebas |
| ops | Manifiestos/configuración global enumerados, infra, scripts dev/ci/db/backup y workflows | SPEC-009/012, docs/operations y manuales de desarrollo/instalación/operación |

Estas rutas son un reparto propuesto para la ejecución: no crean paquetes,
no cambian por sí mismas los contratos de arquitectura y no autorizan a iniciar
fases futuras. La estructura definitiva se cierra por tarea. Si necesita otro
nombre o archivo, el usuario revisa la parcela antes de asignar el cambio.

No hay permiso general para packages/**, tests/** o docs/**. Los tests unitarios
colocados dentro de un módulo corresponden a su dueño; QA escribe pruebas
transversales independientes. Backend define contratos públicos consumibles;
motor posee el esquema secreto. Frontend e IA proponen cambios al contrato, pero
no lo editan simultáneamente. IA escribe worker solo desde fase 4; ops prepara
su despliegue, no su lógica. Motor escribe la carrera solo tras calibración.

Los roles de lectura tienen parcela de escritura vacía y denegación `**`.
Los escritores tienen denegaciones de credenciales, originales, configuración
del equipo, Harness y datos internos del orquestador. Los workflows siguen siendo
rutas protegidas. Las reglas de scope de Harness comprueban cambios del repositorio
y pueden revertir cambios fuera de ámbito: no son un aislamiento del sistema
operativo ni una garantía técnica de que no se lea un archivo. Las instrucciones
prohíben inspeccionar secretos y alterar otros proyectos o instalaciones.

## Contratos compartidos y decisiones

Un cambio que cruza parcelas se divide y ordena por dependencias. El arquitecto
acuerda contrato/versión/error; el dueño lo entrega; los consumidores se adaptan
en tareas aprobadas; QA prueba el conjunto. No resolver el solapamiento dando
acceso global a todos. Un desacuerdo se eleva con fuentes y alternativas.

BASELINE, backlog, ADR, requisitos, catálogo de aceptación, README general y
documentos comunes no son propiedad automática de todos. Los cambios globales
requieren un encargo documental específico. Seguridad y arquitecto aportan
propuestas revisables; su condición readonly no les permite persistirlas. QA
puede guardar evidencia en quality, pero no inventar ACC ni aceptar un hito.
La edición de SPEC-011 pertenece al backend para el encargo aprobado; el
especialista de seguridad revisa y propone sin convertirse en implementador.

## Aprobación, concurrencia y modelos

Se conservan `autonomy: assisted`, `land: manual`, el límite de dos trabajadores
y una instancia por rol. No se han habilitado delegaciones o follow-ups del lead.
Hay nueve especialistas disponibles, no nueve trabajos ni llamadas simultáneas.
El paralelismo solo existe entre tareas aprobadas con dependencias satisfechas.
Las sesiones de revisión y la capacidad del proveedor también consumen recursos.

Todos usan `freellmapi` con `model: auto`. Seguridad/reviewer tienen
`independent_of` con los seis escritores, pero comparten ruta/modelo. Las
advertencias de misma ruta son esperadas: se separan sesiones y responsabilidades,
no se promete una segunda familia de modelos ni una auditoría externa.

Harness llama automáticamente a `reviewer` en su recorrido de revisión. La
existencia de `seguridad` no añade por sí sola un segundo pase obligatorio: se
consulta expresamente en su sesión y sus hallazgos se incorporan a la revisión.
El planificador estándar propone tareas para escritores; no debe cambiar un rol
readonly a write para colar una tarea de implementación o de revisión.

El proveedor del equipo no modifica [DEC-002](../plan/BASELINE.md): el juego
empieza con Ollama y dobles de CI. Tampoco el SQLite de Harness cambia PostgreSQL
del producto. Son sistemas distintos con credenciales y ciclos de validación
separados.

## Qué verá cada agente

`instructions` de cada rol contiene el acuerdo común completo seguido de su
perfil completo. No se limita a una frase o a un enlace que el modelo quizá no
abra. [AGENTS.md](../../AGENTS.md) permite descubrir el mismo acuerdo desde otras
herramientas, pero fuera de Harness no crea roles ni impone su scope técnicamente.

La copia local de Harness tiene además un ajuste acotado en planning y
task-prompts: sus recorridos automáticos de planificación y revisión omitían
las instrucciones propias del planner/reviewer. `patch-role-instructions.py`
las antepone al prompt de operación, conservando readonly, JSON estructurado,
reintentos y comprobaciones del orquestador. Incluye una regresión simulada de
planificación/reintento sin implementar borradores y otra de revisión con diff.
El mismo ajuste endurece únicamente las esperas del helper de pruebas: usa un
reloj monotónico en lugar de Date.now, con una regresión de salto de hora. No
amplía timeouts ni cambia reglas, pruebas de aceptación o reloj del videojuego.
Después de actualizar Harness hay que revisar ese ajuste antes de aplicarlo de
nuevo; el script rechaza una estructura de código inesperada.

El usuario puede seleccionar el rol en la interfaz de Harness para conversar
con él. Una tarea de escritura seguirá necesitando aprobación. Una conversación
con el arquitecto o el revisor no les concede permisos de implementación.

## Mantener y validar perfiles

Fuente de verdad: COMUN.md, las nueve fichas y equipo.json. Cambiar un perfil
requiere actualizar su copia incorporada a Harness. Desde Ubuntu, en el proyecto:

```text
python3 scripts/harness/sync-profiles.py
python3 scripts/harness/sync-profiles.py --check
python3 scripts/verify_docs.py
```

La comprobación adicional de parcelas y prompts usa el runtime instalado de
Harness, sin llamadas al proveedor. Desde PowerShell:

```powershell
wsl -d Ubuntu-20.04 -- bash /mnt/c/Users/amoles/Documents/Codex/Meridiano-cero/scripts/harness/verify-wsl.sh exec tsx --conditions=source /mnt/c/Users/amoles/Documents/Codex/Meridiano-cero/scripts/harness/verify-team.mjs
```

Comprueba las nueve instrucciones completas, 69 muestras de parcelas con un
solo dueño, archivos compartidos/protegidos sin escritor y conservación de
aprobación humana. Es una verificación de esta configuración, no una prueba
exhaustiva de todos los patrones glob ni una evaluación de comportamiento del
modelo real.

Desde PowerShell, la validación oficial de Harness:

```powershell
.\scripts\harness.ps1 config check
```

El sincronizador usa biblioteca estándar, no instala dependencias y solo
actualiza roles y la protección de perfiles. Conserva proveedor, modelo, límites
y política. `--check` no escribe ni inicia agentes. No editar únicamente la
copia de instrucciones dentro de YAML: quedaría desincronizada.

Los perfiles y AGENTS.md están protegidos frente a cambios de los propios
trabajadores. Ninguna credencial se incluye en ellos. Si hay agentes trabajando,
guarda sus cambios y usa stop antes de cambiar su configuración; cierra y abre
Harness para comenzar nuevas sesiones con las instrucciones actualizadas. No
presupongas que una conversación ya iniciada olvidará las instrucciones anteriores.

Antes de la primera implementación, revisa y guarda manualmente en Git la
configuración, AGENTS.md y los perfiles. Los worktrees parten de commits: no
copies a mano archivos privados ni supongas que incluirán archivos sin seguimiento.
Esta preparación no hace commits, push ni merge por el usuario.

## Primer encargo adecuado

Cerrar T1-01: backend propone sesión local, API y configuración pública segura;
ops versiones/configuración/migraciones y arranque reproducible; seguridad revisa
las amenazas y el bypass local; planner presenta decisiones pendientes al usuario;
QA define evidencia de salida; reviewer revisa el conjunto. Eso no autoriza a
crear código del motor, UI completa, generación o despliegue público. Las
versiones de herramientas de WSL son evidencia de entorno, no contrato definitivo
de distribución del producto.

## Fuentes de estas personalidades

[Baseline](../plan/BASELINE.md), [roadmap](../plan/ROADMAP.md),
[backlog](../plan/BACKLOG.md), [tareas](../plan/TAREAS.md),
[requisitos](../plan/REQUISITOS.md), [arquitectura](../architecture/ARQUITECTURA.md),
[glosario](../architecture/GLOSARIO.md), [specs](../specs/README.md),
[ADR](../adr/README.md), [aceptación](../quality/ACEPTACION.md) y
[seguridad](../security/OWASP.md). Se conserva el estado de todos los requisitos,
decisiones y pruebas de producto: crear perfiles no los implementa ni verifica.
