# Validación del equipo y sus personalidades

Fecha: 27 de octubre de 2026. Proyecto: Meridiano-cero. HEAD del proyecto:
66f7f5a; esta entrega no crea commits ni modifica el estado del backlog.
Harness local parte de 2910cd8d061d982f8242188e58e0950726ae2941 con los ajustes
de instalación documentados y el ajuste de instrucciones de esta entrega.

## Alcance comprobado

| Comprobación | Resultado |
|---|---|
| config check oficial | Configuración válida con nueve roles; avisos esperados de ruta compartida |
| sync-profiles.py --check | Acuerdo común y ficha completa incorporados a cada rol |
| verify-team.mjs | Nueve perfiles; 69 muestras de rutas con un único escritor; documentos comunes/secretos sin permiso de escritura |
| Política | assisted, land manual, dos trabajadores máximos, una instancia por rol, sin delegaciones/seguimientos automáticos |
| Integridad documental | Referencias y enlaces válidos; 107 requisitos, 39 tareas/épicas, 12 specs, 10 ADR, 40 ACC y 15 SEC conservados; originales íntegros |
| Construcción de Harness | Correcta tras incorporar instrucciones de planner/reviewer |
| TypeScript y ESLint de Harness | Correctos |
| Regresiones de personalidad | Dos aprobadas: planner inicial/reintento conserva perfil y borradores; reviewer recibe perfil, diff y contrato de salida |
| Regresión del reloj de espera | Aprobada: un salto simulado de Date.now no agota antes de tiempo una espera real |
| Recorridos afectados en ejecución secuencial | 22 escenarios aprobados de outer-loop, políticas, personalidades y reloj |

Las muestras de scope usan checkScope de Harness, no un imitador del algoritmo.
Se comprueba también que buildTaskPrompt conserva el acuerdo y la ficha íntegros.
Son pruebas de configuración y transporte de instrucciones, no una demostración
de que un modelo concreto seguirá siempre todas las instrucciones.

## Resultado de la batería general

Última ejecución completa, con dos procesos de prueba: 493 aprobadas, 2 fallidas
y 2 omitidas, de 497. Las dos fallidas agotaron el tiempo del hook de preparación
o limpieza, no una aserción de personalidad:

- weekly-pacing en burst-and-resume: timeout de afterEach.
- conflicto con marcadores en outer-loop: timeout de beforeEach.

Ambas se repitieron aisladamente con sus aserciones originales y pasaron.
No se ha aumentado ningún timeout ni se ha relajado una aserción para obtener
ese resultado. La ejecución completa no fue totalmente verde: conservar esta
limitación y no presentarla como una pasada limpia de toda la batería.

Antes de la corrección del helper, otras ejecuciones mostraron más esperas
prematuras. El helper ahora usa performance.now en lugar de hora de sistema;
su regresión fuerza un salto horario. No se ha modificado el reloj del equipo,
el reloj de juego ni el motor de producto. La causa de los dos timeouts de hooks
restantes no se declara resuelta por haber pasado una repetición aislada.

## Comandos ejecutados

En Ubuntu, desde la raíz del proyecto:

```text
python3 scripts/harness/sync-profiles.py
python3 scripts/harness/sync-profiles.py --check
python3 scripts/verify_docs.py
bash scripts/harness/verify-wsl.sh exec tsx --conditions=source /mnt/c/Users/amoles/Documents/Codex/Meridiano-cero/scripts/harness/verify-team.mjs
bash scripts/harness/verify-wsl.sh build
bash scripts/harness/verify-wsl.sh typecheck
bash scripts/harness/verify-wsl.sh lint
bash scripts/harness/verify-wsl.sh exec vitest run --maxWorkers=2
bash scripts/harness/verify-wsl.sh exec vitest run tests/e2e/role-instructions.test.ts --maxWorkers=1
bash scripts/harness/verify-wsl.sh exec vitest run tests/helpers/wait-clock.test.ts tests/e2e/role-instructions.test.ts tests/e2e/outer-loop.test.ts tests/e2e/policy.test.ts --maxWorkers=1
bash scripts/harness/verify-wsl.sh exec vitest run tests/e2e/burst-and-resume.test.ts --testNamePattern=weekly-pacing --maxWorkers=1
bash scripts/harness/verify-wsl.sh exec vitest run tests/e2e/outer-loop.test.ts --testNamePattern=markers --maxWorkers=1
```

Desde PowerShell: scripts/harness.ps1 config check y git diff --check.
No se ha hecho llamada a FreeLLMAPI en esta entrega. Los escenarios de ejecución
usan adaptadores simulados y repositorios temporales, no el videojuego.

## Límites y siguiente uso

Los nueve roles comparten ruta FreeLLMAPI/modelo auto; sesiones separadas no
equivalen a modelos independientes. Arquitecto, seguridad y revisor son readonly;
seguridad no es un segundo pase automático de Harness. Los scopes validan cambios
del repositorio, no son un aislamiento completo del sistema operativo.

El siguiente uso real requiere revisión humana y guardado manual de la
configuración/perfiles en Git para que estén en los worktrees, y nuevas sesiones
de Harness si había alguna abierta. No se han aprobado ni empezado tareas del
backlog, ni probado un modelo real con las nuevas personalidades. La configuración
no demuestra funcionamiento del juego, calidad narrativa, accesibilidad u OWASP.
