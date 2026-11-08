export interface GlossaryTerm {
  term: string;
  definition: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  { term: 'Caso', definition: 'Misterio a investigar, con dos rutas posibles de investigación.' },
  { term: 'Partida (run)', definition: 'Instancia de un caso para un usuario.' },
  { term: 'Detective', definition: 'El jugador; único por partida.' },
  { term: 'Reloj interno', definition: 'Tiempo del caso, no el reloj de pared. Gobierna plazos y costes.' },
  { term: 'Plazo', definition: 'Límite de tiempo del caso. Al vencer, no se aplican efectos terminales ni el resto del lote.' },
  { term: 'Evidencia', definition: 'Prueba física o testimonial recogida durante la investigación.' },
  { term: 'NPC / contacto', definition: 'Personaje con el que se puede hablar; la revelación depende de conocimiento, tema y cooperación.' },
  { term: 'Laboratorio', definition: 'Servicio de análisis de evidencias con coste de tiempo.' },
  { term: 'Mandamiento / orden', definition: 'Autorización para una acción con admisibilidad y costes.' },
  { term: 'Lote (secuencia)', definition: 'Agrupación de acciones con pausa, continuación confirmada y cancelación.' },
  { term: 'Autoguardado', definition: 'Guardado automático continuo.' },
  { term: 'Guardado manual', definition: 'Hasta 10 por partida; permite regresar a un punto anterior.' },
  { term: 'Primer resultado oficial', definition: 'Primer cierre de caso que cuenta para carrera y reputación.' },
  { term: 'Carrera / reputación', definition: 'Progreso del detective; idempotente, sin duplicación por repeticiones.' },
  { term: 'Archivo', definition: 'Listado de partidas propias con filtros y paginación.' },
  { term: 'Localizador de creación', definition: 'Mecanismo para recuperar una creación perdida por conexión sin duplicar partida.' },
];

export const REGLES: string[] = [
  'Una partida tiene un único usuario propietario y un detective jugador. Sin multijuego.',
  'El primer resultado oficial de un caso cuenta para carrera y reputación; las cargas y repeticiones posteriores son práctica y no reemplazan el resultado ni duplican recompensas.',
  'El reloj es interno del caso; nunca se usa el reloj de pared para decidir.',
  'El plazo gana en caso de empate con una acción.',
  'Las órdenes ambiguas piden aclaración antes de actuar; no se elige una interpretación ni se ejecuta parcialmente.',
  'La detención no cierra el caso por sí misma.',
  'No se filtra la verdad antes del informe final.',
  'Ningún compañero sugiere la siguiente pista.',
  'Las pruebas excluyentes de cada ruta se mantienen sin inyectar conocimiento.',
  'Hasta 10 guardados manuales por partida, además del autoguardado; no se borran automáticamente al alcanzar el límite.',
  'Cargar un guardado manual permite regresar a un punto anterior del mismo caso y probar otras decisiones.',
  'Los lotes admiten pausa, continuación confirmada y cancelación; el plazo interrumpe sin aplicar el resto ni efecto terminal.',
];

export const COSTES: string[] = [
  'Viajar tiene coste de tiempo (seeded, determinista por semilla).',
  'Consultas al laboratorio tienen coste de tiempo.',
  'Comunicaciones al equipo: envío gratuito, acuse a +30 del reloj interno.',
  'Laboratorio programado: +90 al reloj interno.',
  'Consultas paralelas: +30 al reloj interno.',
  'El plazo interrumpe el lote sin aplicar el resto ni efecto terminal; reanudar no repite el prefijo ya aplicado.',
];

export const FAQ: FaqItem[] = [
  { question: '¿Puedo jugar el mismo caso varias veces?', answer: 'Sí. El primer resultado es el oficial; las repeticiones son práctica y no duplican recompensas.' },
  { question: '¿Puedo volver atrás en una partida?', answer: 'Sí, cargando un guardado manual anterior. No sustituye el primer resultado oficial.' },
  { question: '¿Qué pasa si se me cae la conexión al crear una partida?', answer: 'La creación es recuperable: reintenta con la misma clave. Un 404 puede ser provisional y nunca autoriza una nueva clave.' },
  { question: '¿El sistema me da pistas?', answer: 'No. Los errores operativos se muestran sin sugerir pistas ni valorar tu investigación.' },
  { question: '¿Cómo se decide el culpable?', answer: 'Tú analizas las evidencias. El motor no consulta la solución para conceder órdenes.' },
  { question: '¿Qué son los lotes?', answer: 'Agrupaciones de acciones con pausa, continuación confirmada y cancelación. El plazo interrumpe sin aplicar el resto.' },
  { question: '¿Cuántos guardados manuales puedo tener?', answer: '10 por partida, además del autoguardado.' },
  { question: '¿Funciona sin internet?', answer: 'El motor es puro y no requiere red; la IA y la persistencia requieren conexión.' },
  { question: '¿Qué proveedores de IA soporta?', answer: 'Ollama (doméstico), FreeLLMAPI (trabajo/VPS) y endpoints configurables en instalaciones propias. El contrato es independiente del proveedor.' },
  { question: '¿Hay multijuego?', answer: 'No. Cada partida pertenece a un único usuario.' },
];
