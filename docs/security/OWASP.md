# Matriz inicial OWASP

Estado de todos los controles: DISEÑADO / NO IMPLEMENTADO / NO VERIFICADO. Fecha de consulta: 2026-10-27. No es certificación ni evaluación ASVS completa.

Fuentes oficiales: [Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/), [ASVS](https://asvs.owasp.org/) y [catálogo fijado ASVS 5.0.0](https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json). Los identificadores se contrastaron con el catálogo oficial, no con la numeración de ASVS 4. Los controles de proyecto complementan ASVS y no se presentan como requisitos textuales del estándar.

## Cobertura de riesgos

| Categoría 2025 | Controles del proyecto | Pruebas |
|---|---|---|
| A01 Broken Access Control | SEC-01/02/03 | ACC-015/022 |
| A02 Security Misconfiguration | SEC-09 y configuración segura de SPEC-011 | ACC-024/039 |
| A03 Software Supply Chain Failures | SEC-12 | ACC-025 |
| A04 Cryptographic Failures | SEC-08/09; ampliar criptografía al cerrar auth | ACC-020/024 |
| A05 Injection | SEC-04/05/06 | ACC-016/021/023 |
| A06 Insecure Design | Modelo TH-01–12, SEC-07/11 | ACC-013/027 |
| A07 Authentication Failures | SEC-08 | ACC-020 |
| A08 Software or Data Integrity Failures | SEC-06/12/13 | ACC-023/025 |
| A09 Security Logging & Alerting Failures | SEC-10/15 | ACC-028 |
| A10 Mishandling of Exceptional Conditions | SEC-14 | ACC-018 |

## Controles verificables

| ID | Control específico del proyecto | ASVS 5.0.0 relacionado | Tarea responsable | Evidencia necesaria |
|---|---|---|---|---|
| SEC-01 | Ownership comprobado en servidor para leer, mutar y exportar | v5.0.0-8.2.2; v5.0.0-8.3.1 | T3-02 | ACC-015 con dos usuarios y permisos revocados |
| SEC-02 | PlayerView explícita, DTO sin solución ni campos privados | v5.0.0-8.2.3 | T3-02 | Centinelas secretos ausentes en todas las respuestas |
| SEC-03 | Egreso por allowlist y validación de destino efectivo; privado distinto de público | v5.0.0-1.3.6; v5.0.0-13.2.4 | T3-01; E7-01 | ACC-022 incluidas redirecciones y DNS |
| SEC-04 | Instrucciones NPC/importadas como datos; modelo no ejecuta herramientas generales | Extensión de proyecto para IA | T3-04 | ACC-016 con corpus adversarial y revisión de contradicciones |
| SEC-05 | Texto sin HTML arbitrario y SQL parametrizado | v5.0.0-1.2.1; v5.0.0-1.2.4 | T3-02 | ACC-021 en campos y queries reales |
| SEC-06 | JSON declarativo validado, límites y sin operadores ejecutables | v5.0.0-1.5.2; v5.0.0-2.2.1 | E4-01 | ACC-023; errores no persisten datos parciales |
| SEC-07 | Validación contextual del motor y transacción contra reintentos/carreras | v5.0.0-2.2.2; transacción como control de proyecto | T3-02 | ACC-013 con escrituras concurrentes y misma clave/otra carga |
| SEC-08 | Sesiones backend, tokens impredecibles y rotación; auth mantenida | v5.0.0-7.2.1; v5.0.0-7.2.3; v5.0.0-7.2.4 | T1-01; E7-01 | ACC-020; ampliar mapa para contraseña/cookies/recuperación |
| SEC-09 | Acceso mínimo a secretos; nunca frontend/Git/logs; cifrado mantenido si se guardan claves | v5.0.0-13.3.2; configuración del proyecto | T1-03 | ACC-024; ampliar controles criptográficos antes de guardar claves de usuario |
| SEC-10 | Eventos de seguridad y errores registrados con redacción y sin inyección | v5.0.0-16.3.2; v5.0.0-16.3.4; v5.0.0-16.4.1 | E7-01 | ACC-028 y muestras redactadas |
| SEC-11 | Límites por usuario y globales documentados y aplicados antes de invocar IA | v5.0.0-2.1.3; ejecución de cuotas como control de proyecto | E4-01; E7-01 | ACC-027 |
| SEC-12 | Lockfile, revisión, privilegios mínimos CI, auditoría e integridad de distribución | Control de proyecto para A03/A08; selección ASVS adicional pendiente | T1-04; E6-01 | ACC-025 y manifiesto de versiones/licencias |
| SEC-13 | Hash/versiones y revalidación de definiciones importadas | v5.0.0-1.5.2; integridad de expediente como control de proyecto | E4-01 | ACC-023; hash no tratado como firma de autor |
| SEC-14 | Error público redactado, fallo cerrado y degradación sin duplicar acción | v5.0.0-16.5.1; v5.0.0-16.5.2; v5.0.0-16.5.3 | T3-02; T3-04 | ACC-018: proveedor y DB fallan en puntos distintos |
| SEC-15 | Logs protegidos/alertas fuera del servicio; backup/restauración como control operativo adicional | v5.0.0-16.4.3; recuperación de proyecto | E6-01; E7-01 | ACC-026/028 con restauración y alerta recibida |

Las referencias ASVS identifican ámbitos relacionados, no equivalencia completa entre una fila y todos los requisitos citados. Por ejemplo, SEC-08 no cubre por sí solo toda autenticación y SEC-09 no demuestra todos los controles criptográficos.

## Exclusiones iniciales justificadas

| Requisito | Motivo | Revisión |
|---|---|---|
| v5.0.0-1.2.6 | No hay LDAP | Reabrir si se añade autenticación LDAP |
| v5.0.0-1.2.7 | No hay consultas XPath | Reabrir si se introduce XML consultable |
| v5.0.0-1.2.8 | No se procesa LaTeX | Reabrir si se permite renderizado LaTeX |

No excluir autenticación, TLS, cifrado, SSRF o importaciones por no estar implementados aún. Antes de fase 7 revisar catálogo completo y justificar cualquier otra exclusión. Cada fila deberá pasar a IMPLEMENTADA y después VERIFICADA con revisión, entorno, prueba y evidencia; actualmente ninguna tiene ese estado.
