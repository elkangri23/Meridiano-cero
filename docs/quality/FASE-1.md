# Fase 1: entrega técnica local

Fecha: 2026-10-28. Estado: base técnica implementada; revisión humana del hito y primera ejecución CI remota pendientes. Usuario autorizó commits, integración en main y continuar Docker/T1. No push, publicación ni despliegue público.

## Entregado

- T1-01: contratos de base previamente integrados.
- T1-02: workspace recuperado de instantánea íntegra e integrado como 31ecba8.
- T1-03: PostgreSQL/Compose aislado, SQL/semilla/roles, configuración cerrada, readiness y sesión local persistente.
- T1-04: workflow fijado por SHA, controles locales de tipos/lint/imports/formato, dependencias y secretos.

Fuente de detalle: [T1-03](T1-03-evidencia.md) y [T1-04](T1-04-evidencia.md).
[Arranque real de base](../manuales/BASE-LOCAL.md).

## Comprobaciones registradas

| Tipo | Comando/procedimiento | Resultado |
|---|---|---|
| Tipos | pnpm typecheck | Contratos, API y web correctos |
| Unitarias / HTTP aislado | pnpm test | 26/26; configuración y HTTP, no reglas de juego |
| Integración PostgreSQL | pnpm test:integration | 10/10 después de recuperar Docker; incluye concurrencia y esquema futuro |
| Persistencia / infraestructura | pnpm verify:persistence | Contenedor recreado conserva perfil y sesión; health 200 / ready 503 con DB detenida, bajo 5 s |
| Límites de arquitectura | pnpm lint; pnpm verify:guards | Sin ciclos/violaciones; contratos e imports negativos detectados |
| Build | pnpm build | API/contratos y web compilados |
| HTTP real | pnpm smoke | Página/TSX y proxy web/API en loopback, sin navegador |
| Formato limitado | pnpm check:format | Espacios y newline; artefactos generados Drizzle exentos solo del newline final |
| Secretos | pnpm security:secrets --verify-detector | Sin hallazgos; canario genérico aleatorio detectado |
| Dependencias | pnpm security:dependencies | Cero altas/críticas; una moderada de tooling, registrada |
| Documental | python3 scripts/verify_docs.py | IDs/enlaces/grafo y hashes de Word intactos |
| Migración / generación | Drizzle generate tras registrar custom | Sin deriva del esquema |
| CI remota | GitHub Actions | NO EJECUTADA: sin push |
| Revisión manual del juego / E2E navegador | No aplicable aún | NO EJECUTADA: no hay juego |

Los reintentos fallidos por archivado externo del worktree, reinicio de Docker y canario inicial no reconocido se conservan en evidencias; no se cuentan como resultados favorables. El detector final exige tanto código de salida 1 como regla de secreto reconocida.

## Seguridad y datos

Datos sintéticos, proyecto Docker meridiano-cero-t1-test, puerto 15433 y volumen propio. No se borran datos ni contenedores ajenos. Configuración y credenciales generadas fuera de Git; el escáner no las monta. Roles de API/migración distintos; API no puede crear tablas. Contraseñas públicas aún no implementadas.

Aviso moderado abierto: esbuild transitivo de Drizzle Kit, GHSA-67mh-4wv8-2f99. No se usa su servidor/studio; revisar actualización compatible antes de distribuir o habilitarlo. Sin override no probado ni supresión del informe. Ninguna certificación OWASP o conformidad ASVS completa afirmada.

## Continuidad

La siguiente fase es T2 (motor puro), no iniciada en esta entrega. El generador, IA, partidas, registro público, backups completos y despliegue siguen sus fases. El worktree conserva configuración sintética ignorada; no se traslada ningún secreto a main. Los comandos de primera puesta en marcha generan credenciales nuevas por checkout.
