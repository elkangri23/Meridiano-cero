import type { CaseDefinition } from '@meridiano/case-schema';

/**
 * Expediente generado de ejemplo (T4-08): «El contrato de las facturas
 * falsas», un fraude en Madrid, Barcelona y Valencia. No es contenido real del juego:
 * es el caso sintético que usan los tests del motor para ejercer la vía
 * genérica (mechanics + texts) de punta a punta, con la misma forma que el
 * astrolabio (dos objetos recogibles, un análisis, cinco consultas, un
 * tema de conversación con relación, dos combinaciones de orden, acceso por
 * orden y recuperación del objeto). Valida con el validador v1.5.
 * Una localización por ciudad: el motor aterriza siempre en la primera
 * accesible de la ciudad de destino, así que una segunda localización en la
 * misma ciudad sería inalcanzable. El generador respeta esa regla.
 */
export const generadoFraudeDefinition: CaseDefinition = {
  id: 'generado-fraude-facturas',
  schemaVersion: 1,
  engineCompatibility: 1,
  contentVersion: 1,
  seed: 7,
  contentMode: 'generated',
  difficulty: 'normal',
  explorationMode: 'guided',
  catalogVersion: '1.0',
  deadlineMinutes: 2880,
  solution: 'carmen',
  objectives: [
    { id: 'obj-detener', description: 'Detener a Carmen con orden válida', achieved: false },
    { id: 'obj-recuperar', description: 'Recuperar el contrato original', achieved: false },
  ],
  cities: [
    { id: 'madrid', name: 'Madrid', country: 'ES' },
    { id: 'barcelona', name: 'Barcelona', country: 'ES' },
    { id: 'valencia', name: 'Valencia', country: 'ES' },
  ],
  locations: [
    { id: 'MAD-OFIC', cityId: 'madrid', name: 'Oficina de contratación', description: 'Oficina de contratación de la empresa', accessible: true },
    { id: 'BCN-ARCH', cityId: 'barcelona', name: 'Archivo de facturación', description: 'Archivo de facturación de la empresa', accessible: true },
    { id: 'VLC-ALM', cityId: 'valencia', name: 'Almacén de custodia', description: 'Almacén de custodia de contratos', accessible: true },
  ],
  npcs: [
    { id: 'jorge', name: 'Jorge', cityId: 'madrid', knowledge: ['jorge-vio-facturas'], cooperation: 7, role: 'Administrativo', persona: 'Eres Jorge, administrativo de la oficina. Responde solo con lo que sabes por tu trabajo.' },
    { id: 'pablo', name: 'Pablo', cityId: 'barcelona', knowledge: ['registro-facturas'], cooperation: 5, role: 'Archivero', persona: 'Eres Pablo, archivero de facturación. Responde solo con lo que sabes por tu trabajo.' },
    { id: 'carmen', name: 'Carmen', cityId: 'valencia', knowledge: ['truth'], cooperation: 3, role: 'Directora financiera', persona: 'Eres Carmen, directora financiera. Puedes confirmar tu identidad, pero no vas a declarar sobre el fraude.' },
  ],
  facts: [
    'EV-01', 'EV-02', 'EV-03', 'EV-04', 'EV-05', 'EV-06', 'EV-07', 'EV-08', 'EV-09', 'EV-10', 'EV-11',
    'jorge-vio-facturas', 'registro-facturas', 'truth',
  ],
  evidence: [
    { id: 'EV-01', type: 'observation', origin: 'MAD-OFIC', minute: 0, admissible: true, relations: [] },
    { id: 'EV-02', type: 'object', origin: 'MAD-OFIC', minute: 0, admissible: true, relations: [] },
    { id: 'EV-03', type: 'analysis', origin: 'MAD-OFIC', minute: 0, admissible: true, relations: ['EV-02'] },
    { id: 'EV-04', type: 'record', origin: 'BCN-ARCH', minute: 0, admissible: true, relations: ['EV-03'] },
    { id: 'EV-05', type: 'record', origin: 'BCN-ARCH', minute: 0, admissible: true, relations: [] },
    { id: 'EV-06', type: 'object', origin: 'MAD-OFIC', minute: 0, admissible: true, relations: [] },
    { id: 'EV-07', type: 'record', origin: 'BCN-ARCH', minute: 0, admissible: true, relations: ['EV-06'] },
    { id: 'EV-08', type: 'record', origin: 'VLC-ALM', minute: 0, admissible: true, relations: ['EV-05', 'EV-07'] },
    { id: 'EV-09', type: 'testimony', origin: 'MAD-OFIC', minute: 0, admissible: true, relations: [] },
    { id: 'EV-10', type: 'record', origin: 'madrid', minute: 0, admissible: true, relations: [] },
    { id: 'EV-11', type: 'object', origin: 'VLC-ALM', minute: 0, admissible: true, relations: [] },
  ],
  rules: [],
  travelDurations: [
    { fromCityId: 'madrid', toCityId: 'barcelona', minutes: 120 },
    { fromCityId: 'barcelona', toCityId: 'madrid', minutes: 120 },
    { fromCityId: 'barcelona', toCityId: 'valencia', minutes: 90 },
    { fromCityId: 'valencia', toCityId: 'barcelona', minutes: 90 },
    { fromCityId: 'madrid', toCityId: 'valencia', minutes: 150 },
    { fromCityId: 'valencia', toCityId: 'madrid', minutes: 150 },
  ],
  scheduledResults: [],
  validationReport: {
    validatorVersion: '1.5.0',
    scenarios: ['structural'],
    errors: [],
    status: 'validated',
  },
  briefing: {
    speaker: 'Margaret Sullivan',
    title: 'El contrato de las facturas falsas',
    paragraphs: [
      'Un contrato de la empresa, en Madrid, ha aparecido con facturas que no cuadran. Eres detective de la agencia internacional A.C.M.E. y el caso es tuyo.',
      'Empiezas en la oficina de contratación de Madrid, donde se firmó el contrato. Habla con quien estaba allí, inspecciona la oficina y sigue el rastro: el caso puede llevarte a Barcelona y a Valencia si las pruebas te llevan hasta allí.',
      'Tu trabajo es averiguar quién falsificó las facturas, reunir pruebas que lo demuestren y recuperar el contrato original. Para detener a alguien necesitarás una orden válida. El reloj del caso marca tu plazo: cuando se agote, la investigación se cierra.',
    ],
  },
  catalogMeta: { crimeType: 'fraude', contentRating: 'familiar' },
  mechanics: {
    inspectables: [
      { locationId: 'MAD-OFIC', elementId: '', label: 'Inspeccionar la oficina', evidenceId: 'EV-01', reveals: ['barcelona'] },
      { locationId: 'MAD-OFIC', elementId: 'cajon', label: 'el cajón del escritorio', evidenceId: 'EV-02' },
      { locationId: 'MAD-OFIC', elementId: 'archivador', label: 'el archivador', evidenceId: 'EV-06' },
    ],
    queries: [
      { id: 'accesos-jorge', label: 'Consultar los accesos de Jorge', cityId: 'madrid', locationId: 'MAD-OFIC', evidenceId: 'EV-10', requires: [], delayMinutes: 30 },
      { id: 'registro-facturas', label: 'Consultar el registro de facturas', cityId: 'barcelona', locationId: 'BCN-ARCH', evidenceId: 'EV-04', requires: ['EV-03'], delayMinutes: 30 },
      { id: 'registro-envios', label: 'Consultar el registro de envíos', cityId: 'barcelona', locationId: 'BCN-ARCH', evidenceId: 'EV-05', requires: [], delayMinutes: 30, reveals: ['location:carmen'] },
      { id: 'firma-contrato', label: 'Consultar la firma del contrato', cityId: 'barcelona', locationId: 'BCN-ARCH', evidenceId: 'EV-07', requires: ['EV-06'], delayMinutes: 30 },
      { id: 'custodia-contrato', label: 'Consultar la custodia del contrato', cityId: 'valencia', locationId: 'VLC-ALM', evidenceId: 'EV-08', requires: ['EV-05', 'EV-07'], delayMinutes: 30 },
    ],
    analyses: [
      { inputEvidenceId: 'EV-02', resultEvidenceId: 'EV-03', delayMinutes: 90 },
    ],
    talkEvidence: [
      { npcId: 'jorge', topicId: 'facturas', label: 'Preguntar a Jorge por las facturas', evidenceId: 'EV-09', requiresRelation: true },
    ],
    suspects: [
      { id: 'carmen', cityId: 'valencia', locationId: 'VLC-ALM', knownFromEvidence: ['EV-04', 'EV-05', 'EV-07', 'EV-08'],
        warrantCombinations: [['EV-03', 'EV-04'], ['EV-06', 'EV-07', 'EV-08']], accessEvidenceIds: ['EV-05', 'EV-08'] },
    ],
    recovery: {
      objectId: 'contrato-original',
      label: 'Recuperar el contrato original',
      cityId: 'valencia',
      locationId: 'VLC-ALM',
      evidenceId: 'EV-11',
      requiresAccessWarrant: true,
    },
  },
  texts: {
    evidence: {
      'EV-01': 'La oficina muestra señales de una revisión apresurada de facturas.',
      'EV-02': 'En el cajón hay una factura rota, marcada con el código F-17.',
      'EV-03': 'El análisis confirma que la factura rota pertenece a la serie F-17.',
      'EV-04': 'El registro firmado asigna la serie F-17 a Carmen.',
      'EV-05': 'El registro de envíos muestra a Carmen firmando el traslado del contrato.',
      'EV-06': 'El archivador guarda una copia del contrato, con sello y firma verificables.',
      'EV-07': 'La firma del contrato coincide con la del registro de envíos.',
      'EV-08': 'Hay un asiento independiente de recepción del contrato por Carmen, en el almacén.',
      'EV-09': 'Jorge declara que Carmen revisó las facturas; no vio qué había dentro del sobre.',
      'EV-10': 'El registro muestra el acceso real de Jorge durante la preparación del envío.',
      'EV-11': 'El contrato original está recuperado.',
    },
    knowledge: {
      'jorge-vio-facturas': 'Vi a Carmen revisar las facturas, pero no vi qué había dentro del sobre.',
      'registro-facturas': 'Llevo el registro de facturas del archivo y puedo comprobar a quién se asignó cada serie.',
      truth: 'Soy Carmen, directora financiera de la empresa.',
    },
    greetings: {
      jorge: 'Soy Jorge, administrativo de la oficina. ¿En qué puedo ayudarte?',
      pablo: 'Soy Pablo, archivero de facturación. ¿Qué registro buscas?',
      carmen: 'Soy Carmen, directora financiera. Puedo confirmar mi identidad, pero no voy a declarar sobre el fraude.',
    },
    refusals: {
      carmen: 'No voy a declarar sobre el fraude.',
    },
  },
};
