# SPEC-007 Generación, simulación e intercambio

Estado: detallada propuesta; cerrar antes de fase 4. Fuentes: GDD §3–5,16–18; TAD §8/9/13.
ADR-004/006/009. ACC-001/017/023/027/029/034.

## Parámetros y pipeline

Entrada: tipo de delito o aleatorio, dificultad, exploración, duración corta/media/larga, región o aleatorio y Familiar/General. SORPRÉNDEME selecciona valores admitidos y los muestra sin revelar trama. Todos los casos ocurren en el presente. Historia antigua puede ser objeto de investigación, no viaje a época histórica.

Estados de definición: draft → validating → validated o rejected. Solo validated y guardado íntegro permite crear CaseRun. Borradores y reportes secretos nunca se exponen como caso jugable.

Pipeline:
1. Fijar delito, objetivos, verdad y motivaciones.
2. Seleccionar geografía desde catálogo verificable, no aceptar ciudades inventadas.
3. Definir NPC, conocimiento, relaciones y cronología.
4. Construir lugares investigables y grafo de pistas con rutas alternativas.
5. Fijar pruebas, resultados de laboratorio/registros, tiempos y eventos.
6. Normalizar JSON declarativo y validar estructura/referencias.
7. Ejecutar coherencia determinista y revisión semántica independiente.
8. Simular rutas, errores y presupuestos temporales.
9. Persistir versión/hash/reporte y publicar metadatos jugables.

No generar contenido probatorio adicional durante la partida. Si falta un dato necesario, rechazar antes de jugar; no pedir a otro modelo que improvise la respuesta en ejecución.

## Puertas duras y semánticas

Duras: IDs únicos/referencias, tipos y límites, objetivos alcanzables, acceso legal o consecuencias definidas, pruebas admisibles suficientes, varios caminos, eventos ordenables, tiempo suficiente con retrasos previstos y sin softlocks. Comprobar que cierre/informe puede calcularse sin inferencia del modelo.

Semánticas: plausibilidad de delito, motivaciones, relaciones, geografía, tono y conocimiento individual. Modelo revisor produce hallazgos referidos a IDs; no basta «caso correcto». Un veredicto IA favorable no ignora fallo duro.

Simulación: mínimo dos rutas de éxito con pruebas decisivas independientes, un cierre parcial, uno no resuelto y, si aplica detención, una ruta errónea. Repetir con retrasos máximos y cooperación reducida. No afirmar garantía exhaustiva para todo texto posible: validar rutas y bloquear acciones fuera del vocabulario.

Calibración de dificultad/duración real exige sesiones de juego. Duración objetivo no se obtiene convirtiendo minutos reales en reloj interno de manera directa.

## Worker y cola

Jobs persistentes en PostgreSQL. Estados queued, running, succeeded, failed, cancelled. Reclamo atómico con lease y heartbeat; al expirar, recuperar de forma idempotente desde último checkpoint validado. Clave de deduplicación por solicitud de generación. Un resultado final se publica una sola vez.

Valores iniciales propuestos: un job de generación concurrente por instalación local; tres intentos completos por solicitud; dos recuperaciones de transporte por etapa como máximo. Presupuesto de tokens/tiempo validado antes de empezar y reducido en cada etapa. Configurables por administrador con límite global; no reintentos infinitos.

Cancelación: marcar intención persistente, abortar próxima operación segura, conservar diagnóstico mínimo y no publicar definición. No prometer reintegro de consumo ya realizado. Reintentar caso rechazado crea nuevo intento registrado.

## Intercambio

Formato previsto: un documento JSON UTF-8 con formatVersion=1, definition, catalogSnapshot de destinos usados y metadatos de procedencia/licencia. Sin ejecutables, operadores abiertos, assets remotos descargados automáticamente ni código de validación proporcionado por el archivo.

Límites iniciales: 2 MiB por archivo, profundidad JSON 32, 20 ciudades investigables, 100 localizaciones, 100 NPC y 1.000 evidencias. Son límites de seguridad de importación propuestos; ajustar mediante pruebas y cambio de spec, no según deseo del modelo.

Importar: comprobar tamaño antes de parsear, estructura, operadores, referencias, versión, hash y validaciones/simulaciones. No confiar en validated del archivo. Si referencia contenido geográfico no verificable, rechazar con explicación. Persistir solo tras aprobación; nunca alterar definición existente por colisión de ID.

Exportar: dueño autorizado confirma que contiene solución. Aviso de spoilers; no revelar datos personales de partidas, claves o conversaciones. El exportador no es proyección normal. Hash no es firma ni garantía de autoría. Versiones futuras se rechazan; migraciones futuras explícitas.

## Aceptación

T4-01 a T4-06. Probar caso bueno, insoluble, referencia rota, geografía inventada, tono no permitido, presupuesto agotado, reinicio durante etapa, lease vencido, cancelación, importación maliciosa y exportación autorizada. Todos los fallos deben impedir jugar y dejar estado operativo recuperable.

## Bordes y funcionamiento ante fallos

El [contrato de resiliencia](RESILIENCIA.md) y el [plan de observabilidad y residencia de datos](OBSERVABILIDAD-Y-DATOS.md) desarrollan las condiciones de fallo y medidas aplicables. El [catálogo de bordes](../quality/BORDES-EJECUCION.md) asigna pruebas y tareas por fase. Son contratos propuestos pendientes de implementación y verificación.

## Reutilización parcial del validador 1.1

T2 incorpora comprobaciones de tipos/referencias y aplica los límites de 20 ciudades, 100 lugares, 100 NPC y 1.000 evidencias antes de recorrerlos. Las demás listas se acotan internamente a 2.048 y los textos a 16.384 caracteres; rechazar, nunca truncar. No existe importador activo: tamaño bruto, profundidad JSON, operadores, geografía, simulación, publicación y jobs siguen pendientes. El reporte incluido por el archivo no concede aprobación y la revisión IA no sustituye los controles deterministas. [Evidencia](../quality/T2-validacion-expedientes.md).
