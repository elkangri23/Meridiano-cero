# Contrato de proveedores y selección de IA

Estado: contrato de implementación tras DEC-018/019, confirmado el 2026-10-28. Amplía SPEC-005, SPEC-009, SPEC-010 y SPEC-011. No declara adaptadores aún no implementados ni cierra T3-04.

## Entornos y alcance

| Entorno | Selección prevista | Quién configura |
|---|---|---|
| Equipo de casa | Ollama | Propietario de la instalación |
| Trabajo | FreeLLMAPI | Operador del entorno |
| Instalación descargada de GitHub | Proveedor preferido y endpoint personalizado | Administrador/propietario de esa instalación |
| VPS, sin claves personales | FreeLLMAPI u otro proveedor predeterminado | Administrador |
| VPS, con claves personales opcionales | Otro proveedor admitido y elegido por el usuario | Usuario propietario de las claves, dentro del catálogo del VPS |

Ollama no es requisito del trabajo, del VPS ni del contrato genérico. Su falta de disponibilidad no bloquea el desarrollo de adaptadores, configuración y pruebas con dobles. La evaluación real exige acceso a algún proveedor elegido, no necesariamente Ollama.

Objetivos de adaptación: Ollama, LM Studio, FreeLLMAPI, OpenAI, Anthropic/Claude y endpoints personalizados. No se afirma que compartan protocolo. Un endpoint personalizado se asocia a un adaptador/protocolo comprobado; una URL por sí sola no hace compatible cualquier motor. Otras integraciones se añaden implementando el mismo contrato.

## Separación de responsabilidades

El motor recibe acciones estructuradas y nunca credenciales ni nombres comerciales. Web presenta configuración pública y resultados autorizados; no implementa SDKs de proveedores ni ejecuta solicitudes directas al modelo. El servidor selecciona la conexión, construye contexto mínimo y llama a un adaptador.

AiProvider ya proporciona una frontera común de solicitud/respuesta en apps/api/src/ai/provider.ts. El código contiene adaptador Ollama y doble en API; el main concurrente añadió también packages/ai-adapters con otra interfaz/fábrica. Esta última no es consumida por la API. Falta consolidar ambas fronteras y aplicar catálogo, configuración, seguridad de destinos, credenciales y adaptadores externos antes de conectarla. El nuevo paquete no acredita soporte de los proveedores enumerados por sus nombres.

Las funciones de dominio siguen siendo interpretación, conversación, narración y, en fase 4, generación/revisión. Los adaptadores transportan y normalizan; los servicios aplican permisos, presupuesto y validación factual.

## Configuración lógica a implementar

| Campo | Regla |
|---|---|
| connectionId | Generado en servidor; referencia una configuración autorizada |
| scope | Instalación o cuenta; cuenta solo accesible por su propietario |
| adapterId | Protocolo implementado y habilitado, no deducido del nombre del modelo |
| baseUrl | Normalizada y validada según la política del entorno |
| model | Modelo explícito, comprobado antes de aprobar su uso |
| credentialRef | Referencia privada del servidor; nunca una clave incluida en respuestas |
| roles | Funciones de dominio que pueden usar esa conexión |
| limits | Timeout, contexto, salida, concurrencia y presupuesto admitidos |
| capabilities | Capacidades comprobadas del adaptador/modelo, sin inventarlas por marca |

Son campos lógicos del contrato, no columnas o variables ya existentes. El esquema SQL y DTO se cierran en la tarea de implementación. No duplicar esta configuración mediante condiciones por entorno dispersas en los controladores.

En T3 se implementan los roles necesarios para el primer caso. Generador/revisor no exigen servicios ni modelos vacíos ahora. El límite de contexto efectivo se verifica por modelo; no heredar 8192 de la implementación Ollama como capacidad universal.

## Resolución en el VPS

1. Usuario autenticado sin selección personal: usar la configuración predeterminada del administrador.
2. Usuario que ha seleccionado una conexión personal válida: usar exclusivamente esa conexión y su credencial.
3. Conexión ajena, borrada o deshabilitada: rechazar; nunca resolver por un ownerId enviado por el cliente.
4. Clave personal inválida, cuota agotada o proveedor caído: informar con error normalizado y aplicar aclaración/respaldo factual según la operación.
5. No cambiar silenciosamente de una conexión personal al proveedor común ni usar otra clave. El usuario puede elegir expresamente volver al proveedor predeterminado.

La elección de proveedor no cambia los hechos de un expediente ni resultados ya ejecutados. Un fallo al narrar conserva la acción confirmada. No mezclar respuestas de proveedores para completar una ejecución parcialmente fallida.

## Endpoints y credenciales

En una instalación propia, el administrador puede configurar endpoints personalizados y servicios locales según política explícita. La excepción loopback del adaptador Ollama actual es específica de ese transporte, no una limitación del contrato común.

En el VPS, aportar una clave personal no autoriza URLs arbitrarias. El administrador habilita proveedores y destinos; las cuentas seleccionan de ese catálogo. Endpoints personalizados públicos requieren habilitación y validación administrativa. Rechazar metadata, loopback/red privada no autorizada, credenciales en URL y redirecciones no permitidas; comprobar resolución DNS y destino antes de conexión.

Las claves se introducen por un formulario autenticado sobre HTTPS y se envían al backend; no se guardan en localStorage, no se recuperan posteriormente en claro desde la API y no entran en prompts, logs ni exportaciones de casos. Respuestas de configuración muestran identificador, proveedor, modelo y si existe credencial, sin devolverla.

Guardar credenciales personales cifradas en servidor con clave maestra separada de la DB y mecanismo mantenido, sin criptografía propia. Cambio y borrado exigen ownership y protección CSRF; el borrado impide usos posteriores. Definir retención de backups y revocación en SPEC-009/010 antes de habilitarlo.

El administrador configura su proveedor; no necesita una pantalla para ver claves personales. El servidor procesa secretos para efectuar llamadas, por lo que no se promete opacidad frente al operador de infraestructura. La información de privacidad explicará qué contenido recibe cada proveedor.

## Cuotas y operación

El proveedor común utiliza el presupuesto del administrador. La conexión personal usa la cuenta del proveedor del usuario; la app no implementa pagos ni promete gratuidad de proveedores externos.

Ambos modos conservan límites de concurrencia, tamaños, rate limit y consumo de recursos del VPS. Las claves propias no permiten eludir controles del servicio. Registrar uso por usuario/conexión/función, separando consumo observado, estimado y desconocido. No registrar secretos ni conversaciones completas por defecto.

## Aceptación que deberá demostrarse

- Cambiar de adaptador deja intactos motor, expediente y validación factual.
- Casa y trabajo se configuran sin modificar código de juego.
- Usuario sin claves juega con el proveedor común.
- Dos usuarios con claves personales no comparten conexión, credenciales ni respuestas.
- IDs de configuración ajena no autorizan su uso, lectura, cambio o borrado.
- Un error personal no provoca llamadas ni cargos en otra conexión.
- Claves no aparecen en bundles, DTO de lectura, logs, prompts, exportaciones o mensajes de error.
- Endpoints personalizados cumplen la política local o pública correspondiente.
- Timeout, cancelación y salida inválida producen los mismos resultados de dominio en todos los adaptadores.
- Un modelo real supera evaluación del primer caso; conexión y mocks no acreditan calidad.

Tareas: T3-01/T3-04 cierran selección y contratos del primer caso; T6-01/T6-04 cubren configuración y distribución independientes; T7-01/T7-02/T7-03 cubren catálogo público, claves personales y cuotas. Las decisiones de producto ya están confirmadas; solo se solicita URL/modelo real cuando sea necesario para una prueba de transporte concreta.
