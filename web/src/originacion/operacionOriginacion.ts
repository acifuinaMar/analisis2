import { ErrorApi } from "../api/cliente";
import type {
    ClienteEncontrado,
    CuerpoAltaCliente,
    CuerpoDesembolso,
    CuerpoSimulacion,
    EstadoCredito,
    PlanDeCredito
} from "../api/contratos";

/**
 * Reglas de la originación (OP-3): alta de cliente → simulación → desembolso.
 *
 * El backend tiene DOS escrituras independientes (POST /api/clientes y
 * POST /api/creditos), sin transacción común ni clave de idempotencia. Lo
 * único que las protege de duplicarse es que los identificadores
 * (CL-NNNN, CV-AAAA-NNNN) son únicos en la base. De ahí salen las reglas:
 *
 *  1. Solo una respuesta 201 CONFIRMA una escritura.
 *  2. Sin respuesta (red, 5xx, tiempo agotado) la escritura es INCIERTA.
 *     No se reintenta sola y bloquea toda escritura que dependa de ella:
 *     con el alta incierta, el desembolso NUNCA se envía.
 *  3. Un 409 de duplicado en el PRIMER envío significa que el
 *     identificador ya estaba ocupado: es un rechazo. Después de un envío
 *     incierto, el mismo 409 no prueba nada (pudo ser nuestro envío
 *     anterior) y la escritura sigue INCIERTA.
 *  4. La verificación usa solo lecturas y tiene tres desenlaces:
 *       no_consta    nada con ese identificador: se permite un reintento
 *                    MANUAL. No puede duplicar: el identificador es único.
 *       conflicto    existe con otros datos visibles: este envío no lo
 *                    creó (el identificador no admite dos registros).
 *       coincidencia existe con los mismos datos visibles. SIGUE INCIERTA:
 *                    la API no muestra el DPI completo, el teléfono ni el
 *                    asesor, ni da un identificador de operación, así que
 *                    no hay forma de atribuir el registro a este envío.
 *
 * Nada de esto calcula montos: el capital, el plazo y la tasa los escribe
 * la persona; el plan y sus cifras los da el servidor.
 */

export type EstadoEscritura = "sin_enviar" | "enviando" | "confirmada" | "rechazada" | "incierta";

export type ResultadoVerificacion = "no_consta" | "conflicto" | "coincidencia";

// ----------------------------------------------------------------------
// Lectura de los campos (formato del contrato, no reglas de negocio)
// ----------------------------------------------------------------------

/** Formatos que exige src/api/app.ts; se validan antes de enviar. */
export const PATRON_ID_CLIENTE = /^CL-\d{4}$/;
export const PATRON_ID_CREDITO = /^CV-\d{4}-\d{4}$/;

export function normalizarId(texto: string): string {
    return texto.trim().toUpperCase();
}

/** "10,000.00" o "Q 10000" -> 10000. Positivo, a lo sumo dos decimales; no redondea. */
export function leerImporte(texto: string): number | null {
    const limpio = texto.replace(/[Qq\s,]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(limpio)) {
        return null;
    }
    const valor = Number(limpio);
    return valor > 0 ? valor : null;
}

/** Meses: entero positivo. Los límites (3 a 24) los valida el servidor. */
export function leerPlazo(texto: string): number | null {
    const limpio = texto.trim();
    return /^\d{1,3}$/.test(limpio) && Number(limpio) > 0 ? Number(limpio) : null;
}

/**
 * TNA escrita como porcentaje -> decimal para la API (decisión D3):
 * "36" -> 0.36, "36.5" -> 0.365.
 *
 * El punto decimal se corre sobre el TEXTO y no con una división, para que
 * el número enviado sea exactamente el que la persona escribió. Que la
 * tasa sea razonable lo decide el núcleo (PoliticaCredito).
 */
export function leerTna(texto: string): number | null {
    const limpio = texto.replace(/[%\s]/g, "").replace(",", ".");
    const partes = /^(\d{1,3})(?:\.(\d{1,4}))?$/.exec(limpio);
    if (!partes) {
        return null;
    }
    const entero = partes[1]!.padStart(3, "0");
    const decimales = partes[2] ?? "";
    const valor = Number(`${entero.slice(0, -2)}.${entero.slice(-2)}${decimales}`);
    return valor > 0 ? valor : null;
}

/** Decimal -> porcentaje para mostrar: 0.365 -> "36.5 %". */
export function tnaComoPorcentaje(tna: number): string {
    const texto = (tna * 100).toFixed(4).replace(/\.?0+$/, "");
    return `${texto} %`;
}

// ----------------------------------------------------------------------
// Datos de la solicitud
// ----------------------------------------------------------------------

export type DatosClienteNuevo = Omit<CuerpoAltaCliente, "fechaOperacion">;

export interface DatosCredito extends CuerpoSimulacion {
    readonly idCredito: string;
    readonly idAsesor: string;
}

export function mismaSimulacion(a: CuerpoSimulacion, b: CuerpoSimulacion): boolean {
    return a.capital.toFixed(2) === b.capital.toFixed(2)
        && a.plazoMeses === b.plazoMeses
        && a.tnaAnual.toFixed(6) === b.tnaAnual.toFixed(6)
        && a.fechaDesembolso === b.fechaDesembolso;
}

export function mismosDatosCredito(a: DatosCredito, b: DatosCredito): boolean {
    return mismaSimulacion(a, b) && a.idCredito === b.idCredito && a.idAsesor === b.idAsesor;
}

export function cuerpoDesembolso(idCliente: string, d: DatosCredito): CuerpoDesembolso {
    return {
        idCredito: d.idCredito,
        idCliente,
        idAsesor: d.idAsesor,
        capital: d.capital,
        plazoMeses: d.plazoMeses,
        tnaAnual: d.tnaAnual,
        fechaDesembolso: d.fechaDesembolso
    };
}

// ----------------------------------------------------------------------
// Clasificación de la respuesta de una escritura
// ----------------------------------------------------------------------

const DUPLICADOS = new Set(["CLIENTE_DUPLICADO", "DPI_DUPLICADO", "CREDITO_DUPLICADO"]);

/**
 * Qué significa el error de una escritura.
 *
 * @param envioPrevioIncierto si esta misma escritura ya se había enviado
 *        sin respuesta. Entonces un "duplicado" pudo ser nuestro envío.
 */
export function clasificarError(error: unknown, envioPrevioIncierto: boolean): "rechazada" | "incierta" {
    if (!(error instanceof ErrorApi)) {
        return "incierta";
    }
    if (error.estado === 0 || error.estado >= 500) {
        return "incierta";
    }
    if (DUPLICADOS.has(error.codigo) && envioPrevioIncierto) {
        return "incierta";
    }
    return "rechazada";
}

// ----------------------------------------------------------------------
// Verificación (solo lecturas)
// ----------------------------------------------------------------------

export interface ComparacionCampo {
    readonly campo: string;
    readonly enviado: string;
    readonly encontrado: string;
    readonly coincide: boolean;
}

export interface VerificacionAlta {
    readonly resultado: ResultadoVerificacion;
    readonly campos: ReadonlyArray<ComparacionCampo>;
}

/**
 * Compara lo que se quiso dar de alta con lo que devuelve
 * GET /api/clientes?buscar=<id>. Esa respuesta solo trae nombre, municipio
 * y los cuatro últimos caracteres del DPI: con eso se puede DESCARTAR que
 * sea nuestro (conflicto), nunca confirmarlo.
 *
 * `enviado` es null tras recargar la página: los datos personales no se
 * conservan, así que solo se sabe si el identificador existe.
 */
export function verificarAlta(
    idCliente: string,
    enviado: DatosClienteNuevo | null,
    resultados: ReadonlyArray<ClienteEncontrado>
): VerificacionAlta {
    const encontrado = resultados.find(c => c.idCliente === idCliente);
    if (!encontrado) {
        return { resultado: "no_consta", campos: [] };
    }
    if (!enviado) {
        return { resultado: "coincidencia", campos: [] };
    }
    const campos: ComparacionCampo[] = [
        comparar("Nombre", enviado.nombreCompleto.trim(), encontrado.nombreCompleto),
        comparar("Municipio", enviado.municipio.trim(), encontrado.municipio),
        comparar("DPI (últimos 4)", enviado.dpi.trim().slice(-4), encontrado.dpiTerminacion)
    ];
    return {
        resultado: campos.every(c => c.coincide) ? "coincidencia" : "conflicto",
        campos
    };
}

export interface VerificacionDesembolso {
    readonly resultado: ResultadoVerificacion;
    readonly campos: ReadonlyArray<ComparacionCampo>;
}

/**
 * Compara lo que se quiso desembolsar con GET /api/creditos/:id y su
 * plan. Se ven titular, capital, plazo, tasa y fecha; NO el asesor ni
 * quién lo creó. Por eso, aunque todo coincida, el resultado es
 * "coincidencia" (sigue incierto), nunca "confirmado".
 *
 * @param credito null si el servidor respondió CREDITO_INEXISTENTE.
 */
export function verificarDesembolso(
    enviado: CuerpoDesembolso,
    credito: EstadoCredito | null,
    plan: PlanDeCredito | null
): VerificacionDesembolso {
    if (!credito) {
        return { resultado: "no_consta", campos: [] };
    }
    const campos: ComparacionCampo[] = [
        comparar("Titular", enviado.idCliente, credito.idCliente),
        comparar("Capital", enviado.capital.toFixed(2), credito.capitalDesembolsado.toFixed(2))
    ];
    if (plan) {
        campos.push(
            comparar("Plazo (meses)", String(enviado.plazoMeses), String(plan.plazoMeses)),
            comparar("Tasa anual", tnaComoPorcentaje(enviado.tnaAnual), tnaComoPorcentaje(plan.tnaAnual)),
            comparar("Fecha de desembolso", enviado.fechaDesembolso, plan.fechaDesembolso)
        );
    }
    return {
        resultado: campos.every(c => c.coincide) ? "coincidencia" : "conflicto",
        campos
    };
}

function comparar(campo: string, enviado: string, encontrado: string): ComparacionCampo {
    return { campo, enviado, encontrado, coincide: enviado === encontrado };
}

// ----------------------------------------------------------------------
// Persistencia mínima (sessionStorage)
// ----------------------------------------------------------------------

/**
 * Se guarda SOLO mientras una escritura está enviándose o es incierta,
 * para no perderla al recargar y seguir bloqueando escrituras que
 * dependan de ella:
 *
 *   paso, estado, idCliente, idCredito, idAsesor, capital, plazoMeses,
 *   tnaAnual, fechaDesembolso
 *
 * Los términos del crédito son indispensables para verificar un
 * desembolso incierto después de recargar. NO se guardan el nombre, el
 * DPI, el teléfono ni el municipio: tras recargar, un alta incierta solo
 * puede verificarse por su identificador. Se borra al resolverse.
 */
export const CLAVE_ALMACEN_ORIGINACION = "cv.originacion.pendiente";

export interface OriginacionPendiente {
    readonly paso: "alta" | "desembolso";
    readonly estado: "enviando" | "incierta";
    readonly idCliente: string;
    readonly credito: DatosCredito;
}

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

export function guardarOriginacionPendiente(p: OriginacionPendiente, destino: Almacen | null = almacen()): void {
    try {
        destino?.setItem(CLAVE_ALMACEN_ORIGINACION, JSON.stringify({
            paso: p.paso,
            estado: p.estado,
            idCliente: p.idCliente,
            idCredito: p.credito.idCredito,
            idAsesor: p.credito.idAsesor,
            capital: p.credito.capital,
            plazoMeses: p.credito.plazoMeses,
            tnaAnual: p.credito.tnaAnual,
            fechaDesembolso: p.credito.fechaDesembolso
        }));
    } catch {
        // Sin almacenamiento, el bloqueo dura lo que la página abierta.
    }
}

export function borrarOriginacionPendiente(destino: Almacen | null = almacen()): void {
    try {
        destino?.removeItem(CLAVE_ALMACEN_ORIGINACION);
    } catch {
        // Nada que hacer.
    }
}

/** Tras recargar, lo que estaba "enviando" vuelve como "incierta". */
export function leerOriginacionPendiente(origen: Almacen | null = almacen()): OriginacionPendiente | null {
    try {
        const texto = origen?.getItem(CLAVE_ALMACEN_ORIGINACION);
        if (!texto) {
            return null;
        }
        const d = JSON.parse(texto) as Record<string, unknown>;
        const valido = (d.paso === "alta" || d.paso === "desembolso")
            && typeof d.idCliente === "string" && PATRON_ID_CLIENTE.test(d.idCliente)
            && typeof d.idCredito === "string" && PATRON_ID_CREDITO.test(d.idCredito)
            && typeof d.idAsesor === "string"
            && typeof d.capital === "number" && typeof d.plazoMeses === "number"
            && typeof d.tnaAnual === "number" && typeof d.fechaDesembolso === "string";
        if (!valido) {
            return null;
        }
        return {
            paso: d.paso as "alta" | "desembolso",
            estado: "incierta",
            idCliente: d.idCliente as string,
            credito: {
                idCredito: d.idCredito as string,
                idAsesor: d.idAsesor as string,
                capital: d.capital as number,
                plazoMeses: d.plazoMeses as number,
                tnaAnual: d.tnaAnual as number,
                fechaDesembolso: d.fechaDesembolso as string
            }
        };
    } catch {
        return null;
    }
}
