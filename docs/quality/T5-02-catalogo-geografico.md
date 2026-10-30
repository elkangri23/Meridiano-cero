# T5-02: catálogo geográfico verificable, viajes, atlas y modos de exploración

Fecha: 2026-10-30. Rama: main. Estado: completada.

## Alcance

Catálogo geográfico con ciudades reales, rutas de viaje verificables, atlas con coordenadas y modos de exploración (guided/free). Destinos culturales separados de pistas y buscador accesible.

## Entregable

`packages/case-schema/src/geography-catalog.ts` con:
- `GEOGRAPHIC_CATALOG`: 9 ciudades reales (España y Portugal) con coordenadas de atlas (0-100).
- `DEFAULT_TRAVEL_ROUTES`: 28 rutas bidireccionales con duraciones estimadas en minutos.
- `getCity`: búsqueda por ID.
- `getRoute`: búsqueda de ruta específica.
- `getReachableCities`: BFS para encontrar ciudades alcanzables desde una origen.
- `searchCities`: búsqueda por nombre, país o región.

## Verificaciones ejecutadas

| Comprobación | Resultado | Límite |
|---|---|---|
| `npx vitest packages/case-schema/src/geography-catalog.test.ts` | 11/11 correctas | Solo pruebas del paquete |
| Ciudades reales | Madrid, París, Lisboa, etc. | Sin datos inventados |
| Coordenadas en rango 0-100 | Todas válidas | Atlas escalado |
| Rutas simétricas | Madrid-París = París-Madrid | Sin asimetrías |
| Rutas duplicadas | Cero | Sin colisiones |
| Conectividad del grafo | 9/9 ciudades alcanzables desde Madrid | Grafo conexo |
| Búsqueda por nombre/país | Funciona | Búsqueda insensible a mayúsculas |
| Ruta inexistente | Devuelve undefined | Sin lanzar errores |

## Límites

- Las coordenadas son posiciones de atlas, no coordenadas geográficas reales.
- Las duraciones de viaje son estimaciones; no se usan como hechos del caso.
- No se incluye información cultural detallada de cada destino (pendiente de T5-03).
- Sin integración con el motor de viajes (usa `travelDurations` del expediente).

## Próximos pasos

T5-03: equipo recurrente, canales, archivos y consultas completos.