# Panel de Administración y Dashboard de Meridiano-cero

* **Author:** Antonio Moles
* **Date:** 2026-11-12

## Overview

Meridiano-cero necesita un panel de administración y un dashboard integrados en la aplicación web existente, bajo la ruta `/admin/*`, accesible solo para usuarios con rol `admin` o `superadmin`. El panel debe ser dinámico e interactivo, mostrar de un vistazo el estado y las métricas más importantes, y seguir el diseño visual de la web actual.

El objetivo no es tener un panel de números decorativos, sino una herramienta operativa que permita entender cómo evoluciona el producto, cómo se comportan los jugadores, qué está pasando en la infraestructura y qué acciones administrativas son necesarias. El punto de partida es `design_draft.md` y los borradores actuales en `apps/api/src/admin/` (`middleware.ts`, `routes.ts`, `queries.ts`), que todavía no están integrados ni completos.

## Analysis

### Fortalezas y valor potencial
- **Visión unificada**: concentrar métricas de uso, gestión de usuarios, auditoría y estado técnico en un solo lugar reduce la dependencia de acceso directo a contenedores, base de datos o consultas manuales.
- **Jerarquía de roles útil**: diferenciar `superadmin` (control total, incluida la gestión de otros administradores) y `admin` (operación diaria sin poder crear ni gestionar administradores) encaja con un uso real de delegación controlada.
- **Métricas orientadas a decisiones**: priorizar retención, tiempo medio de sesión, frecuencia de juego, evolución y puntos de abandono puede aportar información más útil que contadores aislados.
- **Gestión operativa rápida**: acciones como revocar sesiones, reenviar correos de verificación, ajustar cuotas o cerrar partidas desde la interfaz pueden ahorrar tiempo si se diseñan con flujos claros y confirmaciones adecuadas.

### Riesgos, contradicciones y puntos débiles

1. **Superficie de ataque muy amplia**  
   El panel concentrará acciones sensibles (gestión de usuarios, cuotas, reinicio de servicios, descarga de backups, anonimización de cuentas, acceso a logs y métricas). Cada endpoint nuevo aumenta el riesgo. Los borradores actuales de `middleware.ts`, `routes.ts` y `queries.ts` no son suficientes: hay referencias sin definir, lógica de sesión incompleta, handlers de marcador de posición y consultas sin ejecutar. Integrarlos tal cual introduciría fallos de seguridad y de funcionamiento.

2. **Autorización y bootstrap del primer superadmin**  
   Se ha decidido que el primer `superadmin` se crea desde programación/código y que un `superadmin` puede crear otros `superadmin`. Falta definir el mecanismo exacto (migración, seed, script de administración, comando CLI) y cómo evitar que ese mecanismo quede expuesto o se ejecute accidentalmente en producción. También falta definir si un `superadmin` puede degradarse o revocarse a sí mismo y qué pasa si queda un solo `superadmin`.

3. **Reinicio de servicios desde la web**  
   “Reset” se ha aclarado como reiniciar servicios cuando se quedan colgados, no restaurar backups. Aun así, es ambiguo: ¿reiniciar el proceso de la API, un contenedor concreto, un worker, o un conjunto de servicios? Reiniciar mal puede cortar sesiones activas, interrumpir partidas, dejar trabajos a medias o ocultar la causa real del fallo. La interfaz necesita microcopy muy específico (qué se va a reiniciar, impacto esperado, quién puede hacerlo, confirmación y resultado visible).

4. **Descarga de backups**  
   Se ha descartado restaurar backups desde el panel, lo cual reduce riesgo. Pero descargar backups sigue siendo sensible: pueden contener datos de usuarios, partidas y otra información privada. Hay que definir quién puede descargarlos (`superadmin` solo o también `admin`), cómo se registra la descarga en auditoría, desde dónde se sirve el archivo y cómo se evita exponer rutas o credenciales de almacenamiento.

5. **Anonimización (derecho al olvido) mal definida**  
   Se ha decidido anonimizar en lugar de borrar. Falta un inventario concreto de tablas y campos afectados: perfiles, sesiones, partidas (`runs`), estado del motor, registros de operaciones, uso de IA, conexiones de IA, perfiles de detective, logs de auditoría, correos/tokens y cualquier referencia en texto. También hay que decidir qué se conserva por integridad operativa o legal, cómo se evita reidentificar a la persona, y cómo encaja esto con la regla existente de que las partidas no se borran desde la app.

6. **Métricas sin instrumentación previa**  
   Varias métricas pedidas dependen de datos que puede que no se estén registrando hoy: tiempo medio de conexión, evolución temporal, retención, embudos de abandono, mapas de calor de exploración, tiempos caído/disponibilidad, estado de servicios y logs centralizados. “No lo sé” sobre el seguimiento actual es una señal de riesgo: sin instrumentación y modelo de datos, el dashboard solo podrá mostrar lo que ya existe o inventar aproximaciones poco fiables.

7. **Complejidad de alcance**  
   El alcance combina administración de negocio, observabilidad técnica, calidad de IA, cumplimiento y ajustes de juego. Es demasiado para un solo paso. Mezclar tareas de alto riesgo (reinicios, descargas de backups, anonimización) con tareas de bajo riesgo (ver métricas, filtrar, reenviar correos) dificulta el diseño, las pruebas y la revisión de seguridad.

8. **Experiencia de uso del panel**  
   Se pide que la gestión sea fácil, con microcopy, filtros, gráficos ampliables y vista rápida. Esto exige priorizar: qué ve un administrador en la primera pantalla, qué acciones son frecuentes, qué confirmaciones son necesarias y cómo evitar formularios o flujos largos. Un dashboard dinámico sin jerarquía clara puede ser tan confuso como una tabla de números.

9. **Auditoría incompleta o poco confiable**  
   Si el panel permite acciones sensibles, cada acción debe dejar rastro: quién la hizo, cuándo, sobre qué objeto, con qué resultado y, cuando aplique, con estado anterior/posterior. Permitir que el cliente envíe el identificador del administrador (como plantea el borrador actual) debilita la auditoría. También hay que decidir retención de logs, acceso a ellos y cómo distinguir eventos de sistema frente a acciones humanas.

10. **Calidad de IA dentro del panel**  
   El sandbox de prompts y el marcado de respuestas problemáticas (“alucinaciones”) son tareas administrativas/técnicas útiles, pero no son lo mismo que operar usuarios o infra. Requieren límites: acceso a modelos, coste, datos que se pueden probar, almacenamiento de ejemplos y separación entre pruebas y producción.

## Goals vs. Non-Goals

### In-Scope Goals
- **Jerarquía de roles**
  - `superadmin`: control total, puede crear y gestionar otros `admin` y `superadmin`.
  - `admin`: tareas operativas permitidas; no puede crear ni gestionar administradores.
  - Creación inicial del primer `superadmin` desde programación/código (mecanismo controlado).
- **Dashboard dinámico e interactivo**
  - Vista de un vistazo del estado general y métricas clave.
  - Filtros y gráficos ampliables.
  - Diseño coherente con el estilo actual de la web.
  - Microcopy claro en flujos y acciones.
- **Métricas de valor**
  - Retención, tiempo medio de conexión/sesión, frecuencia de juego y evolución en el tiempo.
  - Actividad de partidas y uso de IA (tokens, latencia, errores, consumo por proveedor/modelo) cuando haya datos disponibles.
  - Indicadores de estado de servicios, contenedores y disponibilidad cuando la infraestructura exponga esa información.
- **Gestión de usuarios y cuentas**
  - Listado y consulta de usuarios/cuentas creadas.
  - Cambio de roles (según permisos), revocación de sesiones, desactivación/gestión de estado cuando proceda.
  - Reenvío de correos de verificación a usuarios registrados pero no validados.
- **Gestión operativa del juego**
  - Ajuste de cuotas de IA y cierre de partidas.
  - Ajustes de parámetros globales de dificultad y activación/desactivación de tipos de casos (si el modelo de juego lo permite sin despliegue).
- **Auditoría**
  - Registro y consulta de acciones administrativas y eventos relevantes.
  - Paginación, filtros (fecha/tipo/actor/objeto) y vista de detalle.
- **Infraestructura y operación**
  - Visualización del estado de salud de servicios/contenedores y logs disponibles.
  - Visualización del estado de backups y descarga de backups (sin restauración desde el panel).
  - Reinicio de servicios cuando estén colgados, con confirmación y microcopy explícito del impacto.
- **Cumplimiento y datos**
  - Anonimización de datos de usuario (derecho al olvido) con trazabilidad administrativa adecuada.
  - Exportación de expediente/datos de usuario cuando se defina el alcance exacto.
- **Calidad de IA (tarea administrativa)**
  - Entorno de pruebas de prompts (sandbox) y marcado/revisión de conversaciones o respuestas problemáticas.

### Out-of-Scope Non-Goals (por ahora)
- **Restaurar backups desde el panel web**: se mantiene fuera por riesgo operativo; solo visualización y descarga.
- **Alertas externas automáticas** (Discord/Slack/Telegram, etc.): no se incluyen en esta fase.
- **Herramienta genérica tipo Grafana/Prometheus**: el panel debe centrarse en el dominio de Meridiano-cero.
- **Edición SQL directa o edición arbitraria de datos sin validación de dominio**.
- **Acceso para usuarios no administradores** o sin autenticación.
- **Métricas/visualizaciones sin datos fuente** (p. ej. mapas de calor o embudos completos) hasta confirmar instrumentación y modelo de datos; pueden quedar como fase posterior o con alcance reducido.

## Alternatives Weighed

- **Construir el panel dentro de la web actual (`/admin/*`) con API propia**: opción base. Reutiliza autenticación, estilo y despliegue existentes, pero obliga a definir bien permisos, auditoría y límites de seguridad.
- **Usar herramientas externas (Grafana/Prometheus/Adminer/phpMyAdmin)**: rechazado como solución principal porque no modelan el dominio del juego, separan la operación en varias herramientas y no cubren acciones de negocio/administración específicas.
- **Panel separado en otro subdominio/aplicación**: posible, pero añade complejidad de despliegue, sesión compartida, CORS y mantenimiento; no parece necesario como primer paso.
- **Flujo operativo por runbooks/scripts/SSH para acciones de alto riesgo** (restaurar backups, reinicios profundos): preferible para operaciones destructivas o ambiguas. Se mantiene esta alternativa para restauración; el reinicio desde panel solo debería cubrir casos acotados y bien definidos.
- **Implementación por fases (pilotos)**: alternativa recomendada frente a entregar todo junto.
  - *Piloto A (menor riesgo)*: acceso admin, dashboard básico, métricas disponibles, gestión de usuarios/roles/sesiones, reenvío de verificación, auditoría y consultas operativas seguras.
  - *Piloto B (riesgo medio/alto)*: descargas de backups, reinicios de servicios acotados, anonimización/exportación, ajustes de juego y herramientas de calidad de IA, cada uno con diseño y pruebas específicas.

## Key Decisions & Staging for Next Steps

### Decisiones recogidas
- Panel integrado en `/admin/*`, dinámico, interactivo y con el mismo diseño de la web.
- Roles: `superadmin` y `admin`; el `superadmin` puede crear otros `superadmin`/`admin`, el `admin` no puede gestionar administradores.
- El primer `superadmin` se crea desde programación/código.
- Reinicio = reiniciar servicios cuando estén colgados (no restaurar datos).
- Backups: ver estado y descargar; no restaurar desde el panel.
- Derecho al olvido: anonimizar datos.
- Reenvío de correos de verificación para cuentas no validadas.
- Alertas externas inteligentes fuera de esta fase.
- Sandbox de IA y marcado de respuestas problemáticas son tareas administrativas.

### Preguntas abiertas que deben cerrarse antes de redactar el diseño formal
- ¿Qué servicios concretos se pueden reiniciar desde el panel y con qué mecanismo (Docker API, systemd, endpoint interno, script controlado)?
- ¿Qué tablas/campos se anonimizan exactamente y cuáles se conservan por auditoría o integridad?
- ¿Qué eventos y métricas ya existen en base de datos/logs y cuáles requieren nueva instrumentación?
- ¿Cómo se crea y protege el bootstrap del primer `superadmin` en desarrollo y producción?
- ¿Qué acciones puede hacer `admin` y cuáles quedan reservadas a `superadmin` (matriz de permisos)?
- ¿Dónde se almacenan los backups y cómo se autoriza/registrar su descarga?
- ¿Qué límites tendrá el sandbox de IA (modelos, coste, datos de prueba, acceso a conversaciones reales)?

### Próximos pasos sugeridos
1. **Definir matriz de permisos y riesgos** (`admin` vs `superadmin`) para cada acción sensible.
2. **Inventariar datos disponibles**: tablas, campos, logs y eventos existentes que soporten métricas, auditoría y estado de servicios.
3. **Acotar un MVP (Piloto A)** con acciones seguras y métricas basadas en datos reales.
4. **Diseñar por separado las operaciones sensibles** (reinicio, descarga de backup, anonimización, exportación) con confirmaciones, microcopy, auditoría y pruebas.
5. **Formalizar el documento de diseño** (`/egm-draft`) cuando se cierren las preguntas abiertas y se priorice el alcance inicial.
