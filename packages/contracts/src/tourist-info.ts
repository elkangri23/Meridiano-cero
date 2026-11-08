// Información turística y cultural determinista de las ciudades admitidas
// (GDD §5, REQ-G05-03/04): destinos separados de los escenarios
// investigables, sin pruebas nuevas. Los textos son datos de contenido del
// catálogo —como los textos de hechos de `fact-texts.ts`—, no cadenas de
// interfaz: el resumen en español vive en `TOURIST_INFO` y su traducción
// en las claves `engine.tourist.<ciudad>` de `locales/es.ts` (con sus pares
// en `en.ts`/`fr.ts`). Solo hechos generales y lugares conocidos; nada
// inventado ni rutas reales fuera del catálogo.

import type { GeographicCity } from './geography-catalog.js';
import { resolveMessage } from './i18n.js';
import type { Language } from './preferences.js';

export interface TouristInfo {
  /** Resumen histórico y geográfico en una o dos frases. */
  summary: string;
  /** Lugares conocidos de la ciudad, sin orden de importancia. */
  landmarks: string[];
}

export const TOURIST_INFO: Record<string, TouristInfo> = {
  madrid: {
    summary: 'Capital de España, en el centro de la península ibérica. Ciudad de museos y de la corte: el Prado, el Palacio Real y la Plaza Mayor marcan su centro histórico.',
    landmarks: ['Museo del Prado', 'Plaza Mayor', 'Palacio Real'],
  },
  barcelona: {
    summary: 'Capital de Cataluña y puerto del Mediterráneo. La ciudad del modernismo de Gaudí, entre el mar y la sierra de Collserola.',
    landmarks: ['Sagrada Familia', 'Park Güell', 'La Rambla'],
  },
  valencia: {
    summary: 'Puerto del Mediterráneo y capital de su huerta. La Lonja gótica convive con la Ciudad de las Artes y las Ciencias, junto al antiguo cauce del Turia.',
    landmarks: ['Ciudad de las Artes y las Ciencias', 'Lonja de la Seda', 'Mercado Central'],
  },
  sevilla: {
    summary: 'Capital de Andalucía, a orillas del Guadalquivir. La Giralda y el Alcázar presiden un casco histórico de origen romano, islámico y cristiano.',
    landmarks: ['La Giralda', 'Real Alcázar', 'Plaza de España'],
  },
  bilbao: {
    summary: 'Capital de Bizkaia, en la ría del Nervión. Ciudad industrial reconvertida en referente cultural con el Museo Guggenheim junto a la ría.',
    landmarks: ['Museo Guggenheim', 'Casco Viejo', 'Ría del Nervión'],
  },
  malaga: {
    summary: 'Puerto de la Costa del Sol y ciudad natal de Picasso. La Alcazaba domina el puerto desde el monte Gibralfaro, junto a la catedral.',
    landmarks: ['Alcazaba', 'Museo Picasso', 'Catedral de Málaga'],
  },
  zaragoza: {
    summary: 'Capital de Aragón, a orillas del Ebro. La basílica del Pilar y La Seo comparten la plaza del Pilar, centro de la ciudad romana de Caesaraugusta.',
    landmarks: ['Basílica del Pilar', 'La Seo', 'Palacio de la Aljafería'],
  },
  paris: {
    summary: 'Capital de Francia, a orillas del Sena. La Torre Eiffel, el Louvre y Notre-Dame marcan una ciudad que fue capital del arte y de la diplomacia europea.',
    landmarks: ['Torre Eiffel', 'Museo del Louvre', 'Catedral de Notre-Dame'],
  },
  lisboa: {
    summary: 'Capital de Portugal, en la desembocadura del Tajo. Ciudad de colinas y tranvías, puerto de los descubrimientos: Belém guarda la torre y el monasterio de los Jerónimos.',
    landmarks: ['Torre de Belém', 'Monasterio de los Jerónimos', 'Castillo de San Jorge'],
  },
};

/** Información turística de una ciudad admitida, o undefined si no está en
 * el catálogo: la web y la API nunca inventan una ciudad fuera de él. El
 * resumen se resuelve en el idioma pedido (`engine.tourist.<ciudad>`); los
 * lugares son nombres propios y no se traducen. */
export function touristInfoFor(cityId: string, language: Language = 'es'): TouristInfo | undefined {
  const info = TOURIST_INFO[cityId];
  if (!info) return undefined;
  return { summary: resolveMessage(language, 'engine.tourist.' + cityId), landmarks: [...info.landmarks] };
}

/** Nombre del lugar sintético donde se está al visitar una ciudad que no es
 * del expediente: no es un escenario investigable, solo el punto de llegada. */
export function visitLocationName(city: GeographicCity, language: Language = 'es'): string {
  return resolveMessage(language, 'engine.tourist.visit', { city: city.name });
}

/** Id sintético del lugar de visita de una ciudad fuera del expediente. El
 * motor lo pone como `position.locationId` al viajar allí; la API lo
 * proyecta con la información turística, sin buscarlo en la definición. */
export function visitLocationId(cityId: string): string {
  return 'visit:' + cityId;
}

/** Ciudad de un lugar sintético de visita, o undefined si no lo es. */
export function visitCityId(locationId: string): string | undefined {
  return locationId.startsWith('visit:') ? locationId.slice('visit:'.length) : undefined;
}
