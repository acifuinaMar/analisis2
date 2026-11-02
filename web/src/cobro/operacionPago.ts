import type { CanalPago } from "../api/contratos";

/**
 * Operación de pago idempotente (decisión del equipo, Fase 2).
 *
 * Una OPERACIÓN es un intento de cobro con datos fijos: crédito, monto,
 * fecha de operación y canal, más su clave de idempotencia `WEB-<uuid>`.
 *
 * Reglas:
 *  1. Reintentar el mismo pago reutiliza la MISMA clave con los MISMOS
 *     datos. La API reconoce la clave y no cobra dos veces (P1 6.10).
 *  2. Si cambian el crédito, el monto, la fecha o el canal, es OTRA
 *     operación: se descarta la vista previa y se usa una clave nueva.
 *  3. Si se pierde la respuesta de una confirmación, el resultado es
 *     INCIERTO: no se asume que falló. La operación queda pendiente y solo
 *     se puede reintentar con su clave y sus datos; nunca se genera una
 *     clave nueva para "volver a intentar".
 *  4. Una operación aplicada o reconocida como duplicada está cerrada: su
 *     clave no se reutiliza para un cobro nuevo.
 *
 * Este módulo no calcula montos: el monto lo escribe el asesor (o lo
 * precarga la API) y aquí solo se lee y se compara.
 */

export interface DatosPago {
    readonly idCredito: string;
    /** Quetzales con dos decimales, tal como se enviará a la API. */
    readonly monto: number;
    readonly fechaOperacion: string;
    readonly canal: CanalPago;
}

export type EstadoOperacion =
    /** Datos listos; nada se envió con confirmado: true. */
    | "borrador"
    /** La confirmación se envió y no hay respuesta todavía. */
    | "confirmando"
    /** La confirmación se envió y la respuesta se perdió. */
    | "incierta"
    /** La API aplicó el pago (201). */
    | "aplicada"
    /** La API reconoció la clave: el pago ya existía y no se volvió a cobrar. */
    | "duplicada";

export interface OperacionPago {
    readonly clave: string;
    readonly datos: DatosPago;
    readonly estado: EstadoOperacion;
}

/** Estados en los que el pago pudo haberse aplicado y aún no se sabe. */
export function estaPendiente(op: OperacionPago | null): boolean {
    return op !== null && (op.estado === "confirmando" || op.estado === "incierta");
}

/** Estados definitivos: la clave queda retirada. */
export function estaCerrada(op: OperacionPago | null): boolean {
    return op !== null && (op.estado === "aplicada" || op.estado === "duplicada");
}

// ----------------------------------------------------------------------
// Clave de idempotencia
// ----------------------------------------------------------------------

/**
 * UUID v4. `crypto.randomUUID` solo existe en contextos seguros (https o
 * localhost); al probar desde un teléfono en la red local no lo está, así
 * que se arma con `getRandomValues`, que sí está disponible.
 */
export function generarUuid(): string {
    if (typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6]! & 0x0f) | 0x40;
    b[8] = (b[8]! & 0x3f) | 0x80;
    const h = Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** "WEB-<uuid>": 40 caracteres, dentro del formato que exige la API. */
export function generarClave(): string {
    return `WEB-${generarUuid()}`;
}

export function nuevaOperacion(datos: DatosPago, clave: string = generarClave()): OperacionPago {
    return { clave, datos, estado: "borrador" };
}

// ----------------------------------------------------------------------
// Datos del pago
// ----------------------------------------------------------------------

/** Mismo crédito, monto, fecha y canal: es la misma operación. */
export function mismosDatos(a: DatosPago, b: DatosPago): boolean {
    return a.idCredito === b.idCredito
        && a.monto.toFixed(2) === b.monto.toFixed(2)
        && a.fechaOperacion === b.fechaOperacion
        && a.canal === b.canal;
}

/**
 * Lee el monto que escribió la persona: "1,234.56", "Q 1234.5", "950".
 * Devuelve null si no es un importe positivo con a lo sumo dos decimales.
 * No redondea: un tercer decimal se rechaza en vez de "arreglarse".
 */
export function leerMonto(texto: string): number | null {
    const limpio = texto.replace(/[Qq\s,]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(limpio)) {
        return null;
    }
    const valor = Number(limpio);
    return valor > 0 ? valor : null;
}

/**
 * Decide qué operación corresponde a los datos actuales del formulario.
 *
 *  - Sin operación, o con una cerrada: una nueva, con clave nueva.
 *  - Pendiente (confirmando / incierta): la MISMA, aunque el formulario
 *    cambie. Mientras no se sepa si se cobró, no se abre otra operación.
 *  - Borrador con los mismos datos: la misma (misma clave).
 *  - Borrador con datos distintos: otra operación, con clave nueva.
 */
export function operacionPara(actual: OperacionPago | null, datos: DatosPago): OperacionPago {
    if (actual === null || estaCerrada(actual)) {
        return nuevaOperacion(datos);
    }
    if (estaPendiente(actual)) {
        return actual;
    }
    return mismosDatos(actual.datos, datos) ? actual : nuevaOperacion(datos);
}

// ----------------------------------------------------------------------
// Persistencia mínima (sessionStorage)
// ----------------------------------------------------------------------

/**
 * Qué se guarda y por qué (documentado en web/README.md):
 *
 *   clave, idCredito, monto, fechaOperacion, canal, estado
 *
 * SOLO mientras una confirmación está pendiente (confirmando o incierta),
 * porque es el único caso en que, tras recargar la página, hay que
 * reintentar con EXACTAMENTE la misma clave y los mismos datos. El monto
 * es indispensable para eso. No se guarda el nombre del cliente, el DPI,
 * el teléfono, el desglose ni el saldo. Al cerrarse la operación (aplicada,
 * duplicada o descartada) la entrada se borra. sessionStorage vive solo en
 * esa pestaña y desaparece al cerrarla.
 */
export const CLAVE_ALMACEN = "cv.cobro.operacionPendiente";

interface Almacen {
    getItem(clave: string): string | null;
    setItem(clave: string, valor: string): void;
    removeItem(clave: string): void;
}

function almacen(): Almacen | null {
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

const CANALES: ReadonlyArray<CanalPago> = ["agencia", "campo", "transferencia"];

export function guardarPendiente(op: OperacionPago, destino: Almacen | null = almacen()): void {
    if (!destino) {
        return;
    }
    try {
        if (!estaPendiente(op)) {
            destino.removeItem(CLAVE_ALMACEN);
            return;
        }
        destino.setItem(CLAVE_ALMACEN, JSON.stringify({
            clave: op.clave,
            idCredito: op.datos.idCredito,
            monto: op.datos.monto,
            fechaOperacion: op.datos.fechaOperacion,
            canal: op.datos.canal,
            estado: op.estado
        }));
    } catch {
        // Sin almacenamiento la operación sigue en memoria.
    }
}

export function borrarPendiente(destino: Almacen | null = almacen()): void {
    try {
        destino?.removeItem(CLAVE_ALMACEN);
    } catch {
        // Nada que hacer.
    }
}

/**
 * Recupera una confirmación pendiente después de recargar. Siempre vuelve
 * como "incierta": si la página se recargó, la respuesta se perdió.
 */
export function leerPendiente(origen: Almacen | null = almacen()): OperacionPago | null {
    try {
        const texto = origen?.getItem(CLAVE_ALMACEN);
        if (!texto) {
            return null;
        }
        const d = JSON.parse(texto) as Record<string, unknown>;
        const valido = typeof d.clave === "string" && /^WEB-[0-9a-f-]{36}$/.test(d.clave)
            && typeof d.idCredito === "string"
            && typeof d.monto === "number" && d.monto > 0
            && typeof d.fechaOperacion === "string"
            && CANALES.includes(d.canal as CanalPago);
        if (!valido) {
            return null;
        }
        return {
            clave: d.clave as string,
            datos: {
                idCredito: d.idCredito as string,
                monto: d.monto as number,
                fechaOperacion: d.fechaOperacion as string,
                canal: d.canal as CanalPago
            },
            estado: "incierta"
        };
    } catch {
        return null;
    }
}
