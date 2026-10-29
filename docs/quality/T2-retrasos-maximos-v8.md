# T2-04/06: retrasos máximos y aceptación temporal del caso v8

Fecha: 2026-10-29. Estándares: commit 7962014ec7031c3694f2378d3983a5e488499239; SPEC-001/002/003, ADR-005 y ACC-007/008/009/017. Continuación en worktree, posterior a c4a86cd; sin nuevo commit, merge, push o despliegue.

## Discrepancia corregida

La fórmula anterior activaba cinco residuos, pero solo producía 15/21/27/33/39 minutos. El incremento lineal por índice impedía además dos máximos consecutivos. Las simulaciones anteriores no acreditaban el escenario +45/+45 de SPEC-003.

V8 combina seed e índice persistido mediante aritmética de 32 bits sin estado global. Un resultado de 0–99 activa retraso con cinco valores nominales; los retrasos enteros cubren 15 a 45. Es una política de juego, no una construcción criptográfica o de autenticación. No usa reloj real ni Math.random y no añade dependencia externa. La frecuencia por partida no se garantiza exactamente 5%; la muestra determinista comprobada verifica una banda nominal, no independencia estadística ni seguridad del generador.

## Caso y versión

EngineVersion=8, formato de definición sigue 1. No se modifican travelDurations, fixture, seed original 42 ni su hash. Como cambia la política temporal, seed=42 pasa de 482/512 en v7 a 455/485 en v8; la igualdad de semilla no promete igualdad entre motores distintos. No se reinterpreta progreso antiguo.

API crea v8 y reconoce inicios v1–v7 por igualdad completa en su forma histórica, sin actualizar filas. V7 conserva tripCount=0; v1–v6 no reciben ese campo. Progreso viejo se conserva/rechaza. No hay migración de guardados ni acciones HTTP nuevas.

## Evidencia de rutas

Una búsqueda técnica acotada identificó seed sintética 14194: seededDelay(14194,0)=45 y seededDelay(14194,1)=45. Las pruebas ejecutan acciones reales del motor, sin mock de retraso, catálogo de tiempos aumentado ni pistas introducidas directamente en CaseRun.

Ruta A sin evidencias exclusivas B termina en 545 minutos; B sin exclusivas A, en 575. Los casos base seeds 1/42 terminan en 455/485. Las mismas variantes se completan con lotes admitidos y acciones individuales, coincidiendo hechos, procedencia, posesión, órdenes y desenlace. Sus revisiones/ordinales de control siguen siendo propios de cada secuencia, sin forzar igualdad artificial.

Otros dos escenarios fijan deadline=545/575: la recuperación empata y no se aplica, resultado partial con detención correcta. Otros dos reducen cooperación de Lucía a cero: hablar no revela EV-09 y ambas rutas materiales se completan con +45/+45. Son variantes sintéticas no publicadas; el original permanece intacto.

ACC-008/009 quedan verificados en el nivel motor para estos recorridos/costes. El nivel E2E y aceptación de hito siguen pendientes. El catálogo de aceptación se actualiza para no declarar erróneamente todos los niveles no ejecutados ni presentarlos todos como aprobados.

## Verificación

- pnpm test: 407 pruebas correctas en 27 archivos. Once escenarios adicionales respecto a v7: máximos individuales/agrupados, rango/frecuencia nominal, rechazo de progreso v7, plazo exacto y cooperación reducida.
- pnpm lint e imports globales correctos, sin relajar reglas: 135 módulos y 346 relaciones sin infracciones. Motor puro y complejidad máxima diez conservados.
- pnpm typecheck y pnpm build completos correctos. No nuevas dependencias.
- pnpm test:integration: 38 pruebas correctas en cuatro archivos, PostgreSQL/HTTP real en proyecto aislado meridiano-cero-t3-persistence-test, puerto 15434. Creación v8 y lectura de inicios v1–v7 sin reescritura; progreso antiguo preservado/rechazado.
- Smoke real web/TSX/proxy API correcto y escaneo por patrones sin hallazgos. No acredita E2E de investigación, proveedor real o auditoría exhaustiva.
- scripts/verify_docs.py: 84 Markdown, referencias/grafo válidos y hashes de DOCX originales intactos. Integridad documental, no certificación de producto/ASVS.
- El checker de formato sigue fallando en nueve archivos heredados; se corrige únicamente newline del test del reloj modificado, sin reescribir SQL antiguo ni rebajar el checker.

Se detuvo solo el contenedor sintético de este proyecto conservando volumen; base preexistente 15433 y WSL sin cambios. Avances v7/v8 permanecen posteriores al checkpoint c4a86cd y sin nuevos commits, merges ni push.

## Límites

La muestra de 65.536 semillas valida rango entero, extremos 15/45 y frecuencia observada en banda 4–6%; no es una prueba probabilística universal. Los previews se comparan entre una variante máxima y otra sin retraso y no revelan el sorteo.

No cierra T2/T3 ni certifica GDD/OWASP. Faltan otros tipos de lote, vocabulario NPC/solución, reglas genéricas y cierre de calidad; integración API de acciones/guardados, primer resultado oficial, UI y E2E siguen pendientes. No proveedor real, descargas, restauración o publicación. Originales Word, credenciales y WSL se conservan.
