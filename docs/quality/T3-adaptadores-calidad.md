# Calidad del paquete alternativo de IA

Fecha: 2026-10-29. Referencia: commit 7962014ec7031c3694f2378d3983a5e488499239; SPEC-005/012 e IA-proveedores; T1-04/T3-04. Continuación en worktree, sin commit, merge, push ni despliegue.

## Cambios

Se sustituye el cast any de fábrica por configuración comprobada, defaults y topes explícitos. Se valida también constructor/factory directa; no hay red durante construcción ni descarga de modelos. Se rechazan campos desconocidos, tipos coaccionados, valores fuera de rango y URLs con credenciales/path/query/fragmento; no se confunde eso con protección SSRF pública completa.

El doble deja de usar Math.random, Date.now, esperas artificiales, conteos de tokens inventados y selección del primer destino. Propone solo una oferta con intención/objetivo explícitos y coincidencia única; si no, pide aclaración con params vacíos/confianza cero y sin tipo de acción ejecutable. No inventa factIds ni cambia cooperación. Valida estructura/referencias reales para validateCase; no ofrece capacidad de generación y una invocación de generateCase devuelve rechazo, no un caso vacío validated.

Se corrige el payload del transporte: ahora es el JSON interpretado y comprobado, antes se devolvía el sobre Ollama. Validación de objeto/acción/parámetros/confianza/narración/conversación; JSON sin prosa envolvente; sobre done estricto. Forma inválida no reintenta. Cancelación e invalidez tienen errores diferenciados, sin echo de contenido privado. No se leen cuerpos HTTP de error para incluirlos en respuesta. Las causas preservadas son internas, nunca DTO/log público.

Conteos ausentes o inválidos no se convierten en cero y no se calcula total con datos parciales. Latencias operativas monotónicas. Timeout nativo y cancelación se combinan y el timer se conserva hasta finalizar lectura. El contrato payload admite null para errores que ya lo devolvían en ejecución. InterpretActionInput comparte la proyección pública, eliminando campos privados de pendientes.

Se separan validación de configuración y forma de salida en módulos utilizados y se mantiene complejidad máxima diez. No se añade dependencia externa, no se excluyen fuentes ni se rebajan umbrales. Los tests del paquete se incorporan a Vitest general.

## Verificación

- pnpm test: 321 pruebas correctas en 24 archivos, incluidas 37 nuevas de configuración, doble y transporte alternativo con fetch sintético. Repetición focal de esas 37 tras ajustar capacidades: correcta.
- Tipos y build completos correctos; build focal final de ai-adapters correcto. ESLint de todo el paquete sin errores, con umbral diez y sin any.
- Revisión global: queda un error de sintaxis del componente heredado RetroScreen, sin consumidor y sin cambio en esta entrega. Las tres infracciones anteriores del paquete IA se corrigen. Check de imports mantiene dos aristas engine→crypto (fuente/dist); no se rebajan reglas para ocultarlas.
- Escaneo por patrones sin hallazgos. La primera ejecución de smoke bajo sandbox falló con EACCES en una conexión 127.0.0.1; repetición autorizada de loopback correcta: página, TSX y proxy web/API comprobados por HTTP real.
- verify_docs.py: 79 Markdown, IDs/referencias/grafo válidos, hashes de DOCX originales intactos. Es integridad documental, no prueba de producto o ASVS.

No se repite PostgreSQL en esta continuación porque no cambia la persistencia ni se conecta ai-adapters a API. Las 37 pruebas PostgreSQL del registro anterior siguen siendo evidencia histórica separada, no pruebas nuevas de esta entrega. No se arrancó ningún contenedor para este cambio.

## Límites y continuación

Paquete alternativo no consumido por la API, sin activar proveedor ni cambiar configuración del usuario. No se declara T3-04 completa. El adaptador y servicios activos de apps/api conservan sus pruebas independientes; este cambio no los sustituye.

La salida estructural no acredita autorización de hechos, conocimiento NPC ni solvencia de casos. El tipo genérico del llamador tampoco valida un esquema en ejecución. Hace falta unificar con codecs factuales y política común antes de conectar: destino SSRF/DNS/redirecciones autorizado por entorno, límite de bytes, presupuesto global/consumo, cupos, deadline independiente y retención de trabajo que ignore abort. No se atribuyen esas garantías al transporte alternativo por compartir nombre con el adaptador activo.

El mock es un intérprete sintético limitado, no un modelo real ni un certificado de calidad. Sin Ollama/FreeLLMAPI real, credenciales, descargas, E2E, restore o despliegue en esta continuación. Motor v4 y expediente original permanecen sin cambio. Calidad global y fases abiertas se conservan; el componente RetroScreen heredado no se conecta por usar datos privados.
