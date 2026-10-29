/**
 * Validación de fechas de corte en texto AAAA-MM-DD.
 *
 * La interfaz NUNCA lee el reloj para calcular (sección 7.3 del
 * enunciado): la fecha de corte la elige la persona y viaja a la API, que
 * se la pasa al núcleo. Aquí solo se comprueba que el texto sea una fecha
 * real del calendario antes de enviarlo.
 */

const PATRON = /^(\d{4})-(\d{2})-(\d{2})$/;

export function esFechaValida(texto: string): boolean {
    const partes = PATRON.exec(texto);
    if (!partes) {
        return false;
    }
    const anio = Number(partes[1]);
    const mes = Number(partes[2]);
    const dia = Number(partes[3]);
    // Se construye con componentes locales (no UTC) y se comprueba que
    // el calendario no la haya "corrido": 2026-02-30 no existe.
    const fecha = new Date(anio, mes - 1, dia);
    return fecha.getFullYear() === anio
        && fecha.getMonth() === mes - 1
        && fecha.getDate() === dia;
}

/** "2026-10-31" -> "2026-10": el periodo que pide el cierre mensual. */
export function periodoDe(fechaCorte: string): string {
    return fechaCorte.slice(0, 7);
}

/** Fecha con la que abre la interfaz si no se configuró otra. */
export const FECHA_CORTE_POR_OMISION = "2026-10-31";

/**
 * Elige la fecha inicial: la configurada si es válida; si no, la del
 * guion del video. Nunca la del reloj.
 */
export function fechaCorteInicial(configurada: string | undefined): string {
    return configurada && esFechaValida(configurada)
        ? configurada
        : FECHA_CORTE_POR_OMISION;
}
