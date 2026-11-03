/**
 * Etiquetas legibles para los valores del núcleo.
 *
 * El núcleo devuelve códigos estables (`en_mora`, `mora_2`); la persona
 * necesita leerlos. Esto es solo un diccionario: no reclasifica ni decide
 * nada. El tramo lo calcula el núcleo; aquí solo se le pone nombre.
 *
 * Microcopy del P2 (docs/proyecto2/E3/cifras-del-nucleo.md): "Mora 2" no
 * le dice nada a Marta, así que se muestra con su explicación.
 */

export type Variante = "neutro" | "exito" | "alerta" | "peligro" | "info" | "marca";

/** Códigos de TramoMora (src/dominio/tramo-mora.ts). */
const TRAMOS: Record<string, { corto: string; explicacion: string; variante: Variante }> = {
    al_dia: { corto: "Al día", explicacion: "sin cuotas vencidas", variante: "exito" },
    mora_1: { corto: "Mora 1", explicacion: "1 a 30 días de atraso", variante: "alerta" },
    mora_2: { corto: "Mora 2", explicacion: "lleva más de un mes de atraso", variante: "peligro" },
    mora_3: { corto: "Mora 3", explicacion: "lleva más de dos meses de atraso", variante: "peligro" },
    vencido: { corto: "Vencido", explicacion: "más de 90 días de atraso", variante: "peligro" }
};

/** Códigos de NombreEstado (src/dominio/nombre-estado.ts). */
const ESTADOS: Record<string, { etiqueta: string; variante: Variante }> = {
    solicitado: { etiqueta: "Solicitado", variante: "info" },
    aprobado: { etiqueta: "Aprobado", variante: "info" },
    vigente: { etiqueta: "Vigente", variante: "exito" },
    en_mora: { etiqueta: "En mora", variante: "peligro" },
    reestructurado: { etiqueta: "Reestructurado", variante: "alerta" },
    cancelado: { etiqueta: "Cancelado", variante: "neutro" },
    rechazado: { etiqueta: "Rechazado", variante: "neutro" },
    anulado: { etiqueta: "Anulado", variante: "neutro" },
    incobrable: { etiqueta: "Incobrable", variante: "peligro" }
};

export function etiquetaTramo(codigo: string): string {
    return TRAMOS[codigo]?.corto ?? codigo;
}

/** "mora_2" -> "Mora 2 · lleva más de un mes de atraso". */
export function etiquetaTramoConExplicacion(codigo: string): string {
    const t = TRAMOS[codigo];
    return t ? `${t.corto} · ${t.explicacion}` : codigo;
}

export function varianteTramo(codigo: string): Variante {
    return TRAMOS[codigo]?.variante ?? "neutro";
}

export function etiquetaEstado(codigo: string): string {
    return ESTADOS[codigo]?.etiqueta ?? codigo;
}

export function varianteEstado(codigo: string): Variante {
    return ESTADOS[codigo]?.variante ?? "neutro";
}

/** Canales que acepta registrar_pago (src/mcp/esquemas.ts). */
export const CANALES_PAGO = [
    { valor: "campo", etiqueta: "Efectivo en visita de campo" },
    { valor: "agencia", etiqueta: "Efectivo en agencia" },
    { valor: "transferencia", etiqueta: "Transferencia" }
] as const;

/**
 * "Cuota" o "Cuotas" según cuántas sean (decisión D5 del equipo).
 * [3] -> "Cuota N.º 3"; [1, 2] -> "Cuotas N.º 1, 2".
 */
export function rotuloCuotas(numeros: ReadonlyArray<number>, mayuscula = true): string {
    const palabra = numeros.length === 1 ? "cuota" : "cuotas";
    const inicial = mayuscula ? palabra[0]!.toUpperCase() + palabra.slice(1) : palabra;
    return numeros.length === 0 ? inicial : `${inicial} N.º ${numeros.join(", ")}`;
}

/** "Cuota que cubre" / "Cuotas que cubre". */
export function etiquetaCuotasQueCubre(cantidad: number): string {
    return cantidad === 1 ? "Cuota que cubre" : "Cuotas que cubre";
}

/**
 * Categorías del desglose de la cartera en riesgo (CategoriaRiesgo,
 * src/servicios/cartera.ts): los cuatro tramos de mora más el crédito
 * reestructurado que está al día. Solo se les pone nombre.
 */
export function etiquetaCategoriaRiesgo(codigo: string): string {
    return codigo === "reestructurado_al_dia" ? "Reestructurado al día" : etiquetaTramo(codigo);
}

/** "1 crédito" / "3 créditos". */
export function cantidadCreditos(n: number): string {
    return `${n} ${n === 1 ? "crédito" : "créditos"}`;
}

/** "1 cuota vencida" / "2 cuotas vencidas". */
export function cantidadCuotasVencidas(n: number): string {
    return `${n} ${n === 1 ? "cuota vencida" : "cuotas vencidas"}`;
}
