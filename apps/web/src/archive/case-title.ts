/** Título de un expediente para mostrar: algunos títulos generados traen
 * ya el prefijo «Expediente:» y la interfaz lo añade de nuevo al
 * mostrarlo («Expediente: Expediente: cuaderno desaparecido»). */
export function displayCaseTitle(title: string): string {
  return title.replace(/^expediente:\s*/i, '');
}
