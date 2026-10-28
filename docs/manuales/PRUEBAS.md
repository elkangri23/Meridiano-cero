# Pruebas y evidencia

Actualizado: 2026-10-28. Existen Vitest, controles de tipos/lint/imports, evaluación IA con doble y verificador documental. Última suite de producto: 157 pruebas correctas, doce archivos; corpus v2: 17 escenarios con mock. Evidencia en [T3-04](../quality/T3-04.md). La integración registra doce errores de lint, siete de imports y 22 avisos de formato heredados; [detalle](../quality/INTEGRACION-T3-04.md). No se han ejecutado E2E del juego, evaluación real ni una auditoría completa OWASP.
Catálogo: [40 escenarios de aceptación](../quality/ACEPTACION.md).

## Pirámide de comprobaciones

Motor puro: la mayor cobertura de reglas y bordes, sin DB, navegador ni IA. Entradas inmutables, reloj exacto, evidencias, órdenes, resultados, lotes y replay.

Integración: PostgreSQL real de pruebas, migraciones, permisos, transacciones, concurrencia e idempotencia. No usar DB personal ni borrar volúmenes ajenos. Crear entorno aislado por ejecución.

Contrato de proveedores: transporte y esquemas con dobles deterministas; errores, cancelaciones y presupuestos. No efectuar llamadas pagadas desde CI por defecto.

Navegador: fixture completo por dos rutas, reanudación, teclado, foco, confirmaciones y errores. Revisiones manuales de accesibilidad y experiencia complementan Playwright.

IA real: corpus y modelo/versión registrados. Evaluar hechos autorizados, spoilers, instrucciones hostiles, memoria y latencia. Mock aprobado no significa calidad real aprobada.

Seguridad: ownership/IDOR, campos secretos, XSS/SQL, SSRF, auth/CSRF, cuotas y fallos cerrados. Pruebas dinámicas solo sobre entorno autorizado, no contra destinos arbitrarios de Internet.

## Puertas

Fase 1 tipos/lint/imports/secretos y base; fase 2 reglas; fase 3 juego con modelo real; fase 4 generación y ficheros; fase 5 cobertura completa y accesibilidad; fase 6 instalación/restore; fase 7 operación y revisión OWASP. Véase ROADMAP para aceptación humana.

## Evidencia mínima

Fecha, revisión, runtime, configuración no secreta, escenario, comando/procedimiento, salida y conclusión limitada. Marcar no ejecutado cuando corresponda. Conservar fallos y correcciones relevantes. No usar un porcentaje de cobertura como sustituto de escenarios.

Cada requisito tiene al menos un escenario previsto; eso no prueba que cada cláusula esté verificada. Al ejecutar, registrar qué subcasos de la fila se comprobaron y cuáles siguen pendientes.

## Verificación documental disponible

Desde raíz: `python scripts/verify_docs.py`. Comprueba referencias, enlaces, cobertura seccional, dependencias y hashes de Word. No comprueba funcionamiento, semántica exhaustiva de GDD ni conformidad OWASP. No escribe archivos ni necesita red.
