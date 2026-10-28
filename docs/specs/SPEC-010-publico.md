# SPEC-010 Instancia pública y consumo

Estado: detallada propuesta; parámetros finales bloquean T7-01, no fases locales.
Fuentes: TAD §1/9/10/13/14/18/19 y decisión del usuario de juego público gratuito.

## Experiencia pública

Visitante se registra, inicia sesión, crea detective y juega sin instalar nada ni aportar endpoint o clave. FreeLLMAPI es proveedor inicial previsto, pendiente de verificar protocolo, condiciones y cuotas. El administrador asume inicialmente el consumo; no se implementan pagos.

Identidad única por usuario; email solo si recuperación/operación lo requieren y se informa al jugador. Definir normalización de identificador y protección contra enumeración en SPEC-004. Registro privado configurable; público exige autenticación antes de generar/jugar.

## Proveedores y cuotas

Configuración de instalación por administrador. Endpoints arbitrarios de jugadores deshabilitados por defecto. Cambio de proveedor sin reescribir motor ni casos existentes. Antes de habilitar cada modelo comprobar capacidades y evaluación de calidad; no inferir compatibilidad por nombre comercial.

ProviderUsage registra usuario, función, modelo, tokens observados/estimados, latencia, errores y coste estimado. No conservar por defecto conversaciones en logs técnicos. Un proveedor sin tarifa verificable se controla por peticiones/tokens, sin inventar coste monetario.

Aplicar cuota antes de invocar: por usuario, IP para abuso, función, modelo, concurrencia y presupuesto global. Reservar presupuesto de generación antes de encolar y reconciliar consumo; evitar que trabajos simultáneos superen el límite. Distinguir rate limit de presupuesto diario y de tiempo máximo por tarea.

Números finales dependen de cuota/latencia del endpoint y recursos VPS: T7-01 debe medir y registrar valores. Ningún lanzamiento con límites infinitos, placeholders o corte global desactivado. Permitir cancelar generación, pausar nuevas solicitudes y activar corte de emergencia. Mensajes de límite explican cuándo puede reintentarse sin sugerir comprar tokens.

## Cuentas y privacidad

Recuperación con token de un uso, caducidad corta documentada, mensajes genéricos y revocación de sesiones. Proveedor de correo solo tras configuración explícita; no simular que se envió email. En local, recuperación administrativa documentada sin enviar mensajes externos automáticamente.

Informar qué datos se envían a IA, para qué y a qué proveedores. Minimizar PII en prompts y separar contenido del juego de identidad de cuenta. Definir retención por clase de dato (cuenta, partida, conversaciones, consumo y logs) antes de público; exportación y borrado efectivos con tratamiento de backups documentado.

Política pública y condiciones requieren revisión específica antes de publicación; no generar una promesa de cumplimiento legal no verificada. No es necesario registrar datos personales que no contribuyen al juego o a la operación.

## Operación y lanzamiento

Monitorizar disponibilidad, latencia, cola, fallos de proveedor, denegaciones, consumo reservado/real y espacio de DB. Alertas verificadas mediante incidente de prueba; no basta escribir logs. Acceso administrativo mínimo y trazado.

Despliegue de staging antes de público. Ensayar registro, juego completo, límite, proveedor caído, restauración y borrado/exportación. Revisar categorías OWASP y controles ASVS aplicables pendientes; corregir críticos/altos. Apertura pública es un hito explícito, no efecto de docker compose up.

## Aceptación

ACC-020/022/025/027/028/033. T7-01 fija parámetros; T7-02 implementa cuentas/privacidad; T7-03 cuotas/telemetría; T7-04 revisión y staging. Registro de salida incluye valores reales, proveedor probado, backups y responsable de incidentes.

## Claves personales opcionales confirmadas

DEC-019 establece para la primera versión pública proveedor común del administrador y conexión personal opcional por usuario. La experiencia sin claves sigue disponible. El usuario puede elegir otro proveedor habilitado y aportar su propia clave; esto no habilita endpoints arbitrarios ni comparte credenciales con otras cuentas.

Aplicar [contrato de proveedores](IA-proveedores.md): resolución explícita, cifrado y aislamiento de claves, consumo separado, límites de recursos también con claves propias y ausencia de fallback silencioso entre conexiones. T7-02 debe incluir configuración/cambio/borrado de credenciales personales antes de declarar entregado ese alcance.
