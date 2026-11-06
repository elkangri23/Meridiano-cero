/**
 * Arte de escena por localización (lote 1 de jugabilidad): cada lugar del
 * caso tiene su propio fondo pixel-art en el lenguaje del rediseño (negro,
 * azul #0000aa, dorado #ffff55, teal #00aaaa, cielo #55ffff). Antes todas las
 * localizaciones compartían el mismo motivo genérico y viajar no se notaba.
 * El arte es decorativo: no inventa contenido del caso, solo ilustra el tipo
 * de lugar que la definición ya nombra (sala de embalaje, archivo de
 * conservación, almacén de depósito). Las localizaciones desconocidas usan
 * el arte de Madrid como respaldo.
 */

export type SceneArtId = 'madrid-sala' | 'paris-archivo' | 'lisboa-almacen';

export function locationArtId(locationId: string): SceneArtId {
  if (locationId === 'PAR-ARCH') return 'paris-archivo';
  if (locationId === 'LIS-ALM') return 'lisboa-almacen';
  return 'madrid-sala';
}

/** Sala de embalaje del Instituto Horizonte (Madrid): ventana con skyline,
 * mesa y caja. Es el motivo genérico que antes se usaba en todas partes. */
function MadridPackingArt() {
  return <svg viewBox="0 0 320 160" shapeRendering="crispEdges" focusable="false">
    <rect width="320" height="160" fill="#555555" />
    <path d="M0 0H8V120H0ZM312 0H320V120H312Z" fill="#aaaaaa" />
    <rect y="116" width="320" height="44" fill="#aa5500" />
    <path d="M0 116H320V120H0ZM0 136H320V140H0ZM0 156H320V160H0ZM64 120H68V136H64ZM192 120H196V136H192ZM128 140H132V156H128ZM256 140H260V156H256Z" fill="#000000" />
    <rect x="28" y="16" width="104" height="84" fill="#000000" />
    <rect x="32" y="20" width="96" height="76" fill="#aaaaaa" />
    <rect x="36" y="24" width="88" height="68" fill="#55ffff" />
    <path d="M36 72H48V60H60V68H76V52H88V64H104V56H116V72H124V92H36Z" fill="#00aaaa" />
    <path d="M76 24H80V92H76ZM36 48H124V52H36Z" fill="#000000" />
    <rect x="224" y="24" width="64" height="48" fill="#000000" />
    <rect x="228" y="28" width="56" height="40" fill="#aa5500" />
    <rect x="232" y="32" width="48" height="32" fill="#0000aa" />
    <path d="M232 56H240V48H248V40H256V48H264V56H280V64H232Z" fill="#00aaaa" />
    <path d="M176 0H180V24H176ZM168 24H188V28H168ZM164 28H192V32H164Z" fill="#000000" />
    <rect x="164" y="32" width="28" height="4" fill="#ffff55" />
    <rect x="56" y="112" width="212" height="8" fill="#ffff55" />
    <rect x="56" y="120" width="212" height="8" fill="#000000" />
    <path d="M64 128H72V152H64ZM252 128H260V152H252Z" fill="#aaaaaa" />
    <rect x="100" y="76" width="80" height="36" fill="#aa5500" />
    <path d="M100 76H180V80H100ZM100 92H180V96H100ZM100 108H180V112H100Z" fill="#000000" />
    <path d="M108 76H116V112H108ZM164 76H172V112H164Z" fill="#aaaaaa" />
    <rect x="204" y="104" width="32" height="8" fill="#ffffff" />
    <rect x="208" y="100" width="12" height="4" fill="#ffffff" />
    <rect x="208" y="108" width="24" height="4" fill="#aaaaaa" />
  </svg>;
}

/** Archivo de conservación (París): estanterías con cajas de archivo y
 * legajos a los lados, ventana con tejados al centro y mesa con papeles y
 * lámpara. */
function ParisArchiveArt() {
  return <svg viewBox="0 0 320 160" shapeRendering="crispEdges" focusable="false">
    <rect width="320" height="160" fill="#555555" />
    <rect y="116" width="320" height="44" fill="#aa5500" />
    <path d="M0 116H320V120H0ZM0 136H320V140H0ZM0 156H320V160H0ZM64 120H68V136H64ZM192 120H196V136H192ZM128 140H132V156H128ZM256 140H260V156H256Z" fill="#000000" />
    {/* Estantería izquierda: cajas de archivo. */}
    <rect x="8" y="8" width="96" height="108" fill="#000000" />
    <rect x="12" y="12" width="88" height="100" fill="#aa5500" />
    <path d="M12 40H100V44H12ZM12 72H100V76H12Z" fill="#000000" />
    <rect x="16" y="16" width="20" height="24" fill="#00aaaa" />
    <rect x="40" y="16" width="20" height="24" fill="#0000aa" />
    <rect x="64" y="16" width="20" height="24" fill="#ffff55" />
    <rect x="16" y="48" width="20" height="24" fill="#aaaaaa" />
    <rect x="40" y="48" width="20" height="24" fill="#00aaaa" />
    <rect x="64" y="48" width="20" height="24" fill="#0000aa" />
    <rect x="16" y="80" width="20" height="24" fill="#ffff55" />
    <rect x="40" y="80" width="20" height="24" fill="#aaaaaa" />
    <rect x="64" y="80" width="20" height="24" fill="#00aaaa" />
    {/* Estantería derecha: legajos verticales. */}
    <rect x="216" y="8" width="96" height="108" fill="#000000" />
    <rect x="220" y="12" width="88" height="100" fill="#aa5500" />
    <path d="M220 40H308V44H220ZM220 72H308V76H220Z" fill="#000000" />
    <path d="M224 16H230V40H224ZM232 16H238V40H232ZM240 16H246V40H240ZM248 16H254V40H248ZM256 16H262V40H256ZM264 16H270V40H264ZM272 16H278V40H272ZM280 16H286V40H280ZM288 16H294V40H288ZM296 16H302V40H296Z" fill="#ffffff" />
    <path d="M224 48H230V72H224ZM232 48H238V72H232ZM240 48H246V72H240ZM248 48H254V72H248ZM256 48H262V72H256ZM264 48H270V72H264ZM272 48H278V72H272ZM280 48H286V72H280ZM288 48H294V72H288ZM296 48H302V72H296Z" fill="#00aaaa" />
    <path d="M224 80H230V104H224ZM232 80H238V104H232ZM240 80H246V104H240ZM248 80H254V104H248ZM256 80H262V104H256ZM264 80H270V104H264ZM272 80H278V104H272ZM280 80H286V104H280ZM288 80H294V104H288ZM296 80H302V104H296Z" fill="#aaaaaa" />
    {/* Ventana central con tejados. */}
    <rect x="120" y="12" width="80" height="56" fill="#000000" />
    <rect x="124" y="16" width="72" height="48" fill="#55ffff" />
    <path d="M124 48H136V40H148V32H160V40H172V48H184V36H196V48H196V64H124Z" fill="#00aaaa" />
    <path d="M152 16H156V32H152ZM148 32H160V36H148Z" fill="#000000" />
    <path d="M160 16H164V64H160ZM124 40H196V44H124Z" fill="#000000" />
    {/* Mesa con papeles y lámpara. */}
    <rect x="108" y="104" width="104" height="8" fill="#ffff55" />
    <rect x="108" y="112" width="104" height="4" fill="#000000" />
    <path d="M116 116H124V152H116ZM188 116H196V152H188Z" fill="#aaaaaa" />
    <rect x="124" y="96" width="28" height="8" fill="#ffffff" />
    <rect x="128" y="92" width="20" height="4" fill="#ffffff" />
    <rect x="128" y="100" width="16" height="4" fill="#aaaaaa" />
    <rect x="160" y="92" width="24" height="12" fill="#ffffff" />
    <path d="M172 92H176V84H172ZM164 80H184V84H164Z" fill="#000000" />
    <rect x="160" y="76" width="24" height="4" fill="#ffff55" />
  </svg>;
}

/** Almacén de depósito (Lisboa): rejilla de taquillas de custodia en la
 * pared, lámpara colgante y una caja grande en primer plano. */
function LisbonDepositArt() {
  return <svg viewBox="0 0 320 160" shapeRendering="crispEdges" focusable="false">
    <rect width="320" height="160" fill="#555555" />
    <rect y="116" width="320" height="44" fill="#aa5500" />
    <path d="M0 116H320V120H0ZM0 136H320V140H0ZM0 156H320V160H0ZM64 120H68V136H64ZM192 120H196V136H192ZM128 140H132V156H128ZM256 140H260V156H256Z" fill="#000000" />
    {/* Rejilla de taquillas: 5 columnas x 3 filas. */}
    <rect x="12" y="8" width="296" height="100" fill="#000000" />
    <rect x="16" y="12" width="52" height="28" fill="#0000aa" />
    <rect x="72" y="12" width="52" height="28" fill="#00aaaa" />
    <rect x="128" y="12" width="52" height="28" fill="#aaaaaa" />
    <rect x="184" y="12" width="52" height="28" fill="#0000aa" />
    <rect x="240" y="12" width="52" height="28" fill="#aa5500" />
    <rect x="16" y="44" width="52" height="28" fill="#00aaaa" />
    <rect x="72" y="44" width="52" height="28" fill="#aaaaaa" />
    <rect x="128" y="44" width="52" height="28" fill="#0000aa" />
    <rect x="184" y="44" width="52" height="28" fill="#aa5500" />
    <rect x="240" y="44" width="52" height="28" fill="#00aaaa" />
    <rect x="16" y="76" width="52" height="28" fill="#aaaaaa" />
    <rect x="72" y="76" width="52" height="28" fill="#0000aa" />
    <rect x="128" y="76" width="52" height="28" fill="#aa5500" />
    <rect x="184" y="76" width="52" height="28" fill="#00aaaa" />
    <rect x="240" y="76" width="52" height="28" fill="#aaaaaa" />
    <path d="M60 24H68V28H60ZM124 24H132V28H124ZM180 24H188V28H180ZM236 24H244V28H236ZM292 24H300V28H292ZM60 56H68V60H60ZM124 56H132V60H124ZM180 56H188V60H180ZM236 56H244V60H236ZM292 56H300V60H292ZM60 88H68V92H60ZM124 88H132V92H124ZM180 88H188V92H180ZM236 88H244V92H236ZM292 88H300V92H292Z" fill="#ffff55" />
    {/* Lámpara colgante. */}
    <path d="M158 0H162V20H158Z" fill="#000000" />
    <path d="M148 20H172V28H148Z" fill="#ffff55" />
    <rect x="152" y="28" width="16" height="4" fill="#ffffff" />
    {/* Caja grande en primer plano. */}
    <rect x="40" y="84" width="88" height="32" fill="#aa5500" />
    <path d="M40 84H128V88H40ZM40 100H128V104H40ZM40 112H128V116H40Z" fill="#000000" />
    <path d="M48 84H56V116H48ZM112 84H120V116H112Z" fill="#aaaaaa" />
    <rect x="196" y="100" width="40" height="16" fill="#000000" />
    <rect x="200" y="104" width="32" height="8" fill="#00aaaa" />
    <rect x="244" y="96" width="32" height="20" fill="#aaaaaa" />
    <path d="M244 96H276V100H244ZM244 112H276V116H244Z" fill="#000000" />
  </svg>;
}

export function SceneArt({ locationId }: { locationId: string }) {
  const art = locationArtId(locationId);
  return <div className="game-scene-art" data-testid="scene-art" data-location={locationId} aria-hidden="true">
    {art === 'paris-archivo' ? <ParisArchiveArt /> : art === 'lisboa-almacen' ? <LisbonDepositArt /> : <MadridPackingArt />}
  </div>;
}
