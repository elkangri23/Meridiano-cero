# Tareas detalladas de implementación

## T3-06

Contratos: SPEC-002/004/008/011, [resiliencia](../specs/RESILIENCIA.md). Cerrar consulta autenticada por clave, respuesta histórica reautorizada, retención/tombstones y recuperación sin guardar tokens en web. Consolidar esquema activo antes de añadir constraints. Implementar unicidad y atomicidad para operaciones, saves y primer resultado, incluida revocación concurrente.

Salida: escenarios asignados en [catálogo](../quality/BORDES-EJECUCION.md) con dos conexiones PostgreSQL y barreras antes/después de commit; demostrar cero duplicados y ausencia de informe secreto en replay tras carga. Probar tanto pérdida de respuesta como commit ambiguo. Evidencia separa unidad e integración real; no cerrar con mocks de repositorio.

## T3-07

Contratos: SPEC-004/006 y anexos API/guardados/resiliencia. Implementar estados idle, preview, confirming, awaiting_result, uncertain, refreshing, unauthenticated y degraded como estados de UI, sin trasladar reglas de dominio al cliente. Cada transición define controles habilitados, foco, anuncio accesible y conservación de intención. Cambiar cuenta borra estado privado previo; cambiar rama invalida respuestas antiguas.

Salida: E2E de doble envío, offline/recarga, reconexión, respuestas invertidas, logout y storage bloqueado; comprobación manual de teclado, IME, zoom y ventanas recuperables. No exigir arrastre para operar. Adjuntar comportamiento observado y diferencias entre prueba automatizada y revisión humana.

## T3-08

Contratos: SPEC-005/009/011 y [observabilidad/datos](../specs/OBSERVABILIDAD-Y-DATOS.md). Consolidar transporte consumido y política de retry/deadline/abort. Implementar límites de respuesta, breaker acotado, fallback, queries/probes finitos y apagado idempotente. Añadir eventos JSON por allowlist, correlación y métricas locales sin secretos; no activar serialización indiscriminada de requests.

Salida: proveedor doble que cuelga/trunca/ignora abort, PostgreSQL lento, señales repetidas y collector caído no generan trabajo ilimitado; centinelas privados ausentes en todos los sumideros. Medir latencias y presupuesto de apagado. Evaluación real de modelo sigue separada; no se acredita por el doble.

## T4-07

Contratos: SPEC-007/010 y resiliencia. Diseñar CAS/fencing y terminales, checkpoint versionado, límites de cola/admisión, reserva y conciliación de consumo desconocido. Fijar política de duplicados JSON y límites de parseo/simulación. Validar independencia real de rutas. No añadir un segundo sistema de colas por defecto.

Salida: dos workers reales con barreras reproducen lease vencido, cancelación/publicación, muerte tras checkpoint y corte global. Solo una publicación, reserva conciliable y ningún envío nuevo tras corte. Importaciones hostiles sintéticas rechazadas sin fetch ni cambios al expediente previo. Ensayo de equidad con dos usuarios y saturación documentada.

## T5-07

Contratos: SPEC-001/002/006/008. Ampliar corpus de propiedades con semillas reproducibles y límites del reloj/grafo/lotes; comprobar carrera versionada y consecuencias plausibles. Detectar cualquier ambigüedad de reglas antes de codificar expectativas nuevas. Verificar UI con nombres/textos largos, traducción faltante, RTL, TTS, audio bloqueado y rama restaurada.

Salida: invariantes del catálogo demostrados con motor puro, integración cuando afecte persistencia y revisión manual accesible. Cada ruta fallida tiene un contraejemplo mínimo. No usar número de tests como sustituto de cobertura de reglas ni afirmar comprensión exhaustiva de lenguaje natural.

## T6-05

Contratos: SPEC-009/011 y resiliencia. Fijar objetivos de recuperación medibles, inventario de backup y versiones compatibles. Ensayar disco lleno, migración interrumpida, backup corrupto, clave ausente y restauración anterior a operaciones confirmadas. Añadir modo de recuperación sin egreso y comprobaciones previas a reapertura.

Salida: runbook ejecutado en destino aislado, partida/manual/oficial recuperados, reintento previo sin duplicación, jobs conciliados, RPO/RTO medidos y pérdida eventual explicitada. Conservar evidencia de restauración fallida segura. No tocar instalación WSL, volúmenes originales ni secretos reales.

## T7-05

Contratos: SPEC-010/011 y observabilidad. Calibrar presupuestos, SLO y alertas con carga sintética declarada (usuarios, tamaño de partida, mezcla de acciones y duración). Separar cuota legítima de saturación global, disponibilidad del juego de IA y cero tráfico de éxito. Comprobar corte antes de cada envío, incluso retry.

Salida: paneles y alertas probados en canal configurado, con deduplicación, recuperación y caída del propio exportador. Registrar umbrales elegidos, latencias, capacidad máxima segura y responsable de incidentes. No prometer SLA por resultados locales ni enviar notificaciones a terceros sin autorización/configuración.

## T7-06

Contratos: SPEC-009/010/011 y observabilidad/datos. Completar ficha de residencia/retención por proveedor con evidencia vigente, revisar política de privacidad y fijar plazos por clase. Implementar exportación consistente, borrado concurrente, registro mínimo de supresiones y keyVersion/rotación. Diferenciar eliminación activa de expiración en backups.

Salida: dos cuentas sintéticas demuestran aislamiento; borrar durante generación impide recreación; restore aplica supresiones antes de egreso; rotación mantiene lectura autorizada sin filtrar claves; pérdida de clave deja partidas accesibles y conexiones marcadas. Revisión jurídica/políticas externas no se sustituye por pruebas técnicas.

El [backlog](BACKLOG.md) es la fuente de estado, dependencias y entregable. Este documento concreta pasos y criterio de salida por tarea, sin duplicar estados. Requisitos se heredan de la [matriz](REQUISITOS.md). La implementación y las dependencias vigentes se consultan en el backlog y el [estado consolidado](ESTADO.md); ninguna tarea se considera terminada por existir esta descripción.

T1-01 cierra la base; E4-01/E5-01/E6-01/E7-01 revisan y cierran la spec de su fase antes de sus tareas T. Son gates de preparación, no sustitutos del hito completo. Usar [plantilla de evidencia](../templates/evidencia.md) al ejecutar.

## T1-01

Contratos: SPEC-004/009/011; ADR-008/010.

Inventariar runtimes/Docker/Ollama disponibles sin instalar ni abrir puertos. Fijar versiones mantenidas, esquema de configuración, sesión local y contrato de errores.

Salida comprobable: Entregar specs cerradas para base y prueba prevista de arranque que rechace APP_MODE public con bypass de desarrollo.

Entrega documental y calibración de referencia: [evidencia de T1-01](../quality/T1-01-evidencia.md). Las pruebas reales de arranque/DB corresponden a T1-03, no se sustituyen por esta entrega.

## T1-02

Contratos: SPEC-012; ADR-001/002.

Crear workspace con web/API y contratos consumidos, tsconfig strict, lint/imports y comandos de desarrollo coherentes. Inicializar Git sin publicar ni borrar cambios.

Salida comprobable: Revisión de imports sin ciclos y ausencia de paquetes vacíos; comando de tipos debe detectar un contrato incompatible.

Entrega y comandos ejecutados: [evidencia de T1-02](../quality/T1-02-evidencia.md).

## T1-03

Contratos: SPEC-009/011; ADR-004/008.

Crear migración mínima de identidad/configuración, conexión DB, Compose con volumen y readiness. Validar configuración al inicio.

Salida comprobable: Crear dato de prueba, reiniciar sin destruir volumen y recuperarlo; arranque con secreto ausente falla de forma segura.

## T1-04

Contratos: SPEC-011/012; ADR-010.

Añadir workflow con permisos mínimos, lockfile congelado, tipos/lint/tests/imports y análisis de secretos/dependencias. Documentar equivalente local.

Salida comprobable: Ejecutar comprobaciones reales y registrar resultados; inyectar fallo controlado en copia temporal para comprobar que el gate lo detecta.

## T2-01

Contratos: SPEC-001/002; ADR-003/005.

Definir esquemas separados de definición/partida/proyección, vocabulario de condiciones y validación estructural/contextual.

Salida comprobable: Fixtures negativos: referencias rotas, números fuera de rango, operador desconocido, versión futura y campo secreto en proyección.

## T2-02

Contratos: SPEC-003; ADR-009.

Convertir trama, lugares, pruebas y reglas del caso fijo en definición versionada. No usar IA para completar huecos del fixture.

Salida comprobable: Guiones A/B con evidencia de la otra ruta ausente; reportar referencias y presupuesto temporal previsto.

## T2-03

Contratos: SPEC-001/002; ADR-003.

Resolver inspección/recogida/conversación autorizada y cursor de lote. Separar lectura de evidencia, posesión y testimonio.

Salida comprobable: Lote que descubre y continúa, luego falla; conserva pasos previos y no cobra omitidos; cancelar y reanudar no duplican.

## T2-04

Contratos: SPEC-001; ADR-005.

Implementar avance de tiempo, eventos estables y viajes reproducibles; solicitudes maduran por reloj interno.

Salida comprobable: Casos minuto anterior/exacto/posterior al plazo, dos eventos simultáneos, retraso reintentado y espera real sin efectos.

## T2-05

Contratos: SPEC-001/003; ADR-003.

Implementar reglas de suficiencia, localización/orden, intervención, recuperación y cierre; producir informe solo cerrado.

Salida comprobable: Orden a Tomás con indicios veraces, denegación insuficiente, culpable detenido sin recuperación y cierre con objetivos distintos.

## T2-06

Contratos: SPEC-001/003; ADR-005.

Ejecutar rutas A/B y negativas sin adaptador ni navegador; comparar costes y hash original.

Salida comprobable: Demostrar que ambas rutas acaban bajo plazo con retraso máximo y que el informe refleja omisiones reales.

## T3-01

Contratos: SPEC-004/005/006; ADR-006/007.

Implementar la revisión de contratos [API](../specs/API-juego.md), [guardados](../specs/GUARDADOS.md) y [conversaciones](../specs/CONVERSACIONES.md); evaluar el proveedor real disponible según DEC-018, sin exigir Ollama en el trabajo; cerrar wireframes/foco y datos de política del fixture.

Salida comprobable: Cerrar límites de contexto/timeout tras medición y conjunto adversarial antes de acoplar UI e IA.

## T3-02

Contratos: SPEC-004/011; ADR-007.

Persistir transiciones con ownership, revisión del agregado y branchId, ledger de idempotencia, autoguardado, diez manuales, restauración y registro oficial externo a snapshots. Implementar PlayerViewDto explícito y recuperación de operaciones según los anexos. La narración de eventos confirmados sucede después del commit; selección de diálogo previa revalidada, sin HTTP externo bajo bloqueos SQL.

Salida comprobable: Dos pestañas disputan versión, dos usuarios disputan runId, reintento tras timeout devuelve resultado único; pruebas CSRF.

## T3-03

Contratos: SPEC-006; ADR-003.

Construir interfaz del fixture, ventanas movibles/minimizables desde el primer caso, herramientas, guardados y estados de interpretación/confirmación/recuperación. Aplicar foco, modo móvil y preferencias separadas de snapshots según SPEC-006. Un panel no ejecuta reglas por su cuenta.

Salida comprobable: Completar flujo con teclado; visualizar pendientes, cierre y errores sin pistas automáticas ni secretos en DOM.

## T3-04

Contratos: SPEC-005; ADR-006.

Integrar proveedor mediante contrato común y doble de CI; Ollama en casa y FreeLLMAPI en trabajo/VPS según DEC-018. Contexto autorizado por NPC y plantillas factuales para resultados no justificables. Avance parcial y pendientes registrados en [evidencia T3-04](../quality/T3-04.md); estado vigente en BACKLOG.

Salida comprobable: Instrucciones hostiles, negación de NPC, referencia contextual, modelo caído e intento de inventar evidencia producen salida segura.

## T3-05

Contratos: SPEC-003/006; ADR-006.

Ejecutar juego completo con modelo real; reiniciar entre etapas y reanudar sin avanzar tiempo externo.

Salida comprobable: Registrar ambas rutas, experiencia y limitaciones del hito; no dar generación ni arte final por entregados.

## T4-01

Contratos: SPEC-007; ADR-006.

Implementar etapas de creación con entradas/salidas estructuradas y checkpoints sin publicar borradores.

Salida comprobable: Fallo de una etapa deja reporte y permite reintento acotado; creación de partida denegada hasta validación/persistencia.

## T4-02

Contratos: SPEC-007/011; ADR-009.

Validar estructura, referencias, conocimientos, cronología, tono y catálogo geográfico; separar revisión semántica.

Salida comprobable: Introducir errores por categoría y comprobar rechazo específico; aprobación del modelo no ignora un fallo duro.

## T4-03

Contratos: SPEC-007; ADR-005.

Explorar rutas declaradas, presupuesto, cooperación y retrasos; identificar dependencias compartidas de pistas.

Salida comprobable: Caso con una sola ruta o con bloqueo temporal se rechaza; reporte conserva guiones reproducibles.

## T4-04

Contratos: SPEC-007/010; ADR-004.

Crear worker y tabla jobs con lease/heartbeat, presupuesto reservado y publicación única.

Salida comprobable: Dos workers, reinicio durante etapa, lease vencido y cancelación no duplican caso ni gasto reservado.

## T4-05

Contratos: SPEC-007/011; ADR-009.

Implementar importación sin código/URLs y exportación consciente por dueño; volver a validar.

Salida comprobable: Rechazar exceso tamaño/profundidad, colisiones y versiones futuras; export no incluye conversaciones ni claves.

## T4-06

Contratos: SPEC-005/007; ADR-006.

Probar adaptadores Ollama/LM Studio/compatibles y añadir nativos previstos con contratos verificados; medir corpus de generación.

Salida comprobable: Registrar proveedor/modelo y rechazo de modelos insuficientes; no afirmar soporte de uno no ensayado.

## T5-01

Contratos: SPEC-007; ADR-006.

Completar delitos/parámetros y selección aleatoria reproducible; calibrar duración y dificultad con sesiones.

Salida comprobable: Familiar y General respetan exclusiones en caso y narración, con fallos explícitos para combinaciones no válidas.

## T5-02

Contratos: SPEC-006/007; ADR-005.

Definir catálogo inicial con fuentes verificables, tiempos y destinos culturales; integrar mapa/buscador accesible.

Salida comprobable: Viaje equivocado consume tiempo sin pista inventada; atlas gratis y ciudad no cubierta con mensaje honesto.

## T5-03

Contratos: SPEC-005/006; ADR-006.

Completar cinco compañeros, contactos/canales y gestiones de laboratorio/inteligencia según expediente.

Salida comprobable: Reanudar conserva trato y memoria; no hay consejo de culpabilidad; respuestas tardías maduran durante viaje.

## T5-04

Contratos: SPEC-008; ADR-007.

Realizar playtest para fijar fórmulas/rangos; implementar perfil, carrera, irregularidades y archivo/repetición.

Salida comprobable: Eventos de recompensa únicos, sanción plausible, recuperación de reputación y varias partidas aisladas.

## T5-05

Contratos: SPEC-006/009; ADR-008.

Crear/inventariar arte/música/fuentes originales, TTS, preferencias e idiomas; revisar teclado/lector/contraste.

Salida comprobable: Todas las pistas tienen equivalentes accesibles; sin sonido/color obligatorio ni bloqueo por ventana fuera de pantalla.

## T5-06

Contratos: SPEC-001 a SPEC-012; ADR-010.

Recorrer cada requisito y subcláusula, registrar escenarios y evidencia pendiente; corregir huecos antes de declarar v1 funcional.

Salida comprobable: La auditoría no acepta una fila compuesta por comprobar solo una parte; revisión con usuario.

## T6-01

Contratos: SPEC-009; ADR-008.

Empaquetar imágenes/Compose, bootstrap de un uso y configuración por modo sin depender del repo de desarrollo.

Salida comprobable: Instalación limpia con proveedor propio; datos persisten, DB no expuesta y setup no deja credenciales por defecto.

## T6-02

Contratos: SPEC-009; ADR-004.

Ensayar actualización con migración controlada y compatibilidad; redactar comandos con salidas reales.

Salida comprobable: Actualizar una copia con partidas activas y comparar estado/definición; documentar cuándo requiere restauración.

## T6-03

Contratos: SPEC-009; ADR-004.

Implementar copia consistente y recuperación en instancia separada; proteger secretos por canal distinto.

Salida comprobable: Restaurar y jugar guardado; medir RPO/RTO y registrar versión/fecha de backup, no solo archivo generado.

## T6-04

Contratos: SPEC-009; ADR-008.

Confirmar nombre/atribución, avisos AGPL, créditos y licencias de dependencias/assets; probar aislamiento del creador.

Salida comprobable: Distribución con manuales ejecutados sin cuenta central ni llamadas obligatorias al VPS creador.

## T7-01

Contratos: SPEC-010; ADR-006/010.

Comprobar protocolo/condiciones/cuotas del endpoint público y capacidad VPS; fijar límites y retención.

Salida comprobable: No quedan placeholders de coste/concurrencia/tiempo; pruebas de presupuesto global bajo carga limitada.

## T7-02

Contratos: SPEC-004/010; ADR-010.

Implementar registro/recuperación pública, sesiones y flujos de datos personales con políticas revisadas.

Salida comprobable: Sin enumeración; tokens un uso; revocación; exportación/borrado propios y juego sin API del usuario.

## T7-03

Contratos: SPEC-010/011; ADR-010.

Aplicar cuotas/reservas, corte de emergencia y alertas redacted; ensayar proveedor/DB caídos.

Salida comprobable: No nuevas llamadas tras corte; alerta recibida y recuperación sin abrir permisos ni perder transacciones.

## T7-04

Contratos: SPEC-010/011; ADR-010.

Staging completo, análisis dinámico autorizado y revisión manual de controles OWASP; resolver hallazgos bloqueantes.

Salida comprobable: Registro F7 incluye restore, presupuesto, privacidad, autoría y prueba real de alta/juego; apertura explícita revisada.
