/** Título de un expediente para mostrar: algunos títulos generados traen
 * ya el prefijo «Expediente:» y la interfaz lo añade de nuevo al
 * mostrarlo («Expediente: Expediente: cuaderno desaparecido»). */
export function displayCaseTitle(title: string): string {
  return title.replace(/^expediente:\s*/i, '');
}

/** Referencia corta y distintiva de un expediente para el selector: varios
 * generados se titulan igual («Informe inicial») y sin ella no se
 * distinguen. Un generado se reconoce por sus últimos 8 caracteres
 * (`generado-21d02570` → `21d02570`); el resto enseña su id entero. */
export function shortCaseRef(caseId: string): string {
  return caseId.startsWith('generado-') ? caseId.slice(-8) : caseId;
}
