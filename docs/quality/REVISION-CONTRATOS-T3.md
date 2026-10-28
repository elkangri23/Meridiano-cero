# Revisión de contratos antes de publicar la rama

Fecha: 2026-10-28. Base de esta rama: fd19321; main observado: 6f43ba2. Revisión documental y comprobaciones locales, no auditoría de seguridad ni aceptación completa del juego.

## Correcciones aplicadas

| Hallazgo | Resolución |
|---|---|
| Listado de pendientes decía sesión 24h y SPEC-004 fijaba 8h | Unificar 8h para desarrollo; duración pública sigue por cerrar |
| Idempotencia por partida no cubría POST /runs antes de existir runId | Ámbito usuario+clave para creación; creación/vínculo de resultado atómicos |
| Cierre definitivo parecía impedir cargar un manual anterior | Cierre definitivo de la rama; restauración autorizada crea otra, sin borrar resultado oficial |
| Lote de 10 en contrato preliminar frente a 8 en IA | Unificar a ocho para el primer caso; sin truncamiento |
| Aclaración/imposibilidad podía ser 422 o outcome | Preview válido 200 discriminado; errores técnicos/validación separados |
| Backlog de esta base no corresponde al main más reciente | Delimitar la instantánea y exigir reconciliación manual antes de aceptar estados |

Las cuatro últimas correcciones ya se incorporaron al ampliar los anexos; esta revisión comprueba su coherencia. No se afirma ausencia absoluta de contradicciones por pasar un verificador de enlaces.

## Claridad suficiente y pendientes

[API](../specs/API-juego.md), [guardados](../specs/GUARDADOS.md), [conversaciones](../specs/CONVERSACIONES.md) y [proveedores](../specs/IA-proveedores.md) definen fronteras suficientes para implementar por tareas. No falta otra ronda de documentación general ni se necesitan más preguntas de producto para esos contratos.

Siguen pendientes datos/reglas concretas de cooperación/cobertura del fixture, mediciones de modelos/transportes y equilibrio numérico de carrera. Antes de integrar una política NPC hay que materializarla en el esquema del caso: el contrato no autoriza rellenar valores inventados en el código.

Antes de servicio público deben concretarse cuotas/retención, gestión de claves personales, cifrado/rotación y operación/restore. Esos pendientes ya tienen fase y no impiden programar las fronteras del primer caso.

## Mejoras útiles de coste bajo o medio

| Coste | Mejora siguiente | Qué resolvería |
|---|---|---|
| Bajo | Matriz de cobertura de los 68 subcasos con enlace a test y resultado | Separar escenarios previstos de evidencia, sin duplicar tests |
| Medio | Esquemas ejecutables únicos y OpenAPI generado desde ellos | Comprobar DTO y evitar deriva entre código, cliente y documentación |
| Medio | Reconciliar con main y revisar sesiones, migraciones y rutas existentes contra anexos | Evitar implementar dos variantes o aceptar marcas de completado sin evidencia |
| Medio | Políticas NPC del fixture como datos validados y simulados | Poder conectar conversación sin decisiones de equilibrio ocultas |
| Medio | Pruebas PostgreSQL de concurrencia/carga/primer resultado | Demostrar atomicidad e idempotencia que el mock no prueba |

Coste cualitativo, sin prometer fechas. Generar una segunda definición manual de esquemas o un framework genérico no es una mejora de bajo coste: mantener una sola fuente ejecutable.

## Límites de publicación

Commit y push publican esta rama; no integran main, no ejecutan una evaluación real ni cierran T3. Los 68 subcasos son previstos. Los tests de producto y del corpus tienen su evidencia en [T3-04](T3-04.md); no convertir un build parcial en CI global aprobada.
