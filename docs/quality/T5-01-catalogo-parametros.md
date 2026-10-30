# T5-01: catálogo de parámetros y validación Familiar/General

Fecha: 2026-10-30. Rama: main. Estado: completada.

## Alcance

Catálogo centralizado de parámetros para generación de casos, con validación de combinaciones y separación de modos de contenido (Familiar = fixed, General = generated).

## Entregable

`packages/case-schema/src/catalog.ts` con:
- `ALLOWED_REGIONS`: 8 regiones verificables (aleatorio + 7 ciudades reales).
- `ALLOWED_CRIME_TYPES`: 9 tipos de delito (incluido aleatorio).
- `DIFFICULTY_BUDGET`: presupuesto de tiempo por dificultad (300/480/600 minutos).
- `DIFFICULTY_DURATION`: duración sugerida por dificultad.
- `INVALID_COMBINATIONS`: rechazo de hard+short y normal+short.
- `validateCatalogParams`: validador de parámetros con errores desglosados por campo.
- `getBudgetForParams` / `getSuggestedDuration`: helpers de cálculo.

## Verificaciones ejecutadas

| Comprobación | Resultado | Límite |
|---|---|---|
| `npx vitest packages/case-schema/src/catalog.test.ts` | 11/11 correctas | Solo pruebas del paquete |
| Parámetros válidos | Pasa | Sin coerciones |
| Tipo de delito inválido | Rechazado | No inventa tipos |
| Región inválida | Rechazada | Solo regiones verificables |
| Combinación hard+short | Rechazada | Límite de duración |
| Combinación normal+short | Rechazada | Límite de duración |
| Modo de contenido premium | Rechazado | Solo fixed/generated |
| getBudgetForParams | 300/480/600 correctos | Sin redondeo inventado |
| getSuggestedDuration | short/medium/long correctos | Consistente con SPEC-007 |

## Límites

- El catálogo es una capa de validación; no genera contenido ni decide rutas.
- Las regiones son nombres de ciudades reales, no datos culturales detallados (T5-02).
- No se ha medido el impacto de más texto en dificultad (ACC-029).
- Sin pruebas de integración con el generador (pendiente de T4-01/T4-02).

## Próximos pasos

T5-02: catálogo geográfico verificable, viajes, atlas y modos de exploración.