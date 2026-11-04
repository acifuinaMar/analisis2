/**
 * Formato de PRESENTACIÓN.
 *
 * Regla del enunciado (E1): "ninguna cifra mostrada se calcula en la
 * interfaz". Estas funciones no suman, no restan, no redondean montos ni
 * derivan indicadores: reciben la cifra que entregó la API y solo deciden
 * cómo se escribe. Si alguna vez hace falta una operación aritmética
 * sobre un monto, esa operación va al núcleo, no aquí.
 */

const QUETZALES = new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

/**
 * 8542.15 -> "Q 8,542.15" (como en el prototipo).
 *
 * La API entrega los montos en quetzales con dos decimales exactos,
 * porque el núcleo trabaja en centavos enteros. Aquí no se redondea:
 * Intl solo agrega separadores de miles.
 */
export function formatoQuetzales(monto: number): string {
    if (!Number.isFinite(monto)) {
        return "—";
    }
    const signo = monto < 0 ? "−" : "";
    return `${signo}Q ${QUETZALES.format(Math.abs(monto))}`;
}

/**
 * Proporción entre 0 y 1, tal como la entrega la API -> "6.06%".
 *
 * Es el mismo número escrito en base 100 para leerlo; no es un cálculo
 * de indicador.
 */
export function formatoPorcentaje(proporcion: number, decimales = 2): string {
    if (!Number.isFinite(proporcion)) {
        return "—";
    }
    return new Intl.NumberFormat("es-GT", {
        style: "percent",
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales
    }).format(proporcion).replace(/\s/g, "");
}

const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
] as const;

/**
 * "2026-10-25" -> "25/10/2026".
 *
 * Se trabaja sobre el TEXTO y no con `new Date(texto)`: esa forma lo
 * interpreta como UTC y en Guatemala (UTC-6) retrocede un día. El núcleo
 * evita el mismo error por la misma razón (aFechaCorte en src/mcp).
 */
export function formatoFecha(iso: string): string {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!partes) {
        return iso;
    }
    const [, anio, mes, dia] = partes;
    return `${dia}/${mes}/${anio}`;
}

/** "2026-10-31" -> "31 de octubre de 2026". */
export function formatoFechaLarga(iso: string): string {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!partes) {
        return iso;
    }
    const [, anio, mes, dia] = partes;
    const nombre = MESES[Number(mes) - 1];
    return nombre ? `${Number(dia)} de ${nombre} de ${anio}` : iso;
}

/** "2026-10" -> "Octubre 2026". */
export function formatoPeriodo(periodo: string): string {
    const partes = /^(\d{4})-(\d{2})$/.exec(periodo);
    if (!partes) {
        return periodo;
    }
    const nombre = MESES[Number(partes[2]) - 1];
    if (!nombre) {
        return periodo;
    }
    return `${nombre[0]!.toUpperCase()}${nombre.slice(1)} ${partes[1]}`;
}

/** Iniciales para el avatar: "Gerencia" -> "GE", "Ana Ruiz" -> "AR". */
export function iniciales(nombre: string): string {
    const palabras = nombre.trim().split(/\s+/).filter(Boolean);
    if (palabras.length === 0) {
        return "?";
    }
    if (palabras.length === 1) {
        return palabras[0]!.slice(0, 2).toUpperCase();
    }
    return (palabras[0]![0]! + palabras[1]![0]!).toUpperCase();
}
