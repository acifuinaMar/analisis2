/**
 * Formas de las respuestas de la API, tomadas de los tipos REALES del
 * servidor. Son `import type`: desaparecen al compilar, así que la
 * interfaz no carga ni una línea del backend, pero si el servidor cambia
 * un campo, `npm run build` falla aquí en vez de fallar en pantalla.
 *
 * Nada de esto se inventa: cada tipo es el que devuelve un endpoint de
 * src/api/app.ts.
 */
export type {
    CuotaResumen,
    DesglosePrelacion,
    DeudaCuota,
    EstadoCredito,
    ExplicacionMora,
    CuotaPorVencer,
    LineaMora,
    ProximosVencimientos,
    ResultadoPago,
    ResumenEstadoCredito
} from "../../../src/servicios/consultas-cartera";

export type { DeudaExigible } from "../../../src/servicios/cobro-credito";

export type {
    FilaPlan,
    FilaPlanCredito,
    PlanDeCredito,
    PlanSimulado,
    ResultadoDesembolso
} from "../../../src/servicios/originacion-credito";

export type { AsesorRegistrado } from "../../../src/dominio/repositorio-cartera";

/** GET /api/asesores (src/api/app.ts): el catálogo envuelto en un objeto. */
export interface RespuestaAsesores {
    readonly asesores: ReadonlyArray<import("../../../src/dominio/repositorio-cartera").AsesorRegistrado>;
}

/**
 * Respuesta 201 de POST /api/clientes (src/api/app.ts). El servidor arma
 * este objeto en la ruta, sin tipo exportado; se describe con sus campos.
 * A propósito no devuelve DPI ni teléfono.
 */
export interface ClienteDadoDeAlta {
    readonly idCliente: string;
    readonly nombreCompleto: string;
    readonly municipio: string;
}

/** Cuerpo de POST /api/clientes (ClienteEsquema, src/api/app.ts). */
export interface CuerpoAltaCliente {
    readonly idCliente: string;
    readonly nombreCompleto: string;
    readonly dpi: string;
    readonly telefono: string;
    readonly municipio: string;
    readonly fechaOperacion: string;
}

/** Cuerpo de POST /api/creditos/simulacion (SolicitudEsquema, src/api/app.ts). */
export interface CuerpoSimulacion {
    readonly capital: number;
    readonly plazoMeses: number;
    /** Decimal: 0.36 = 36 % nominal anual. */
    readonly tnaAnual: number;
    readonly fechaDesembolso: string;
}

/** Cuerpo de POST /api/creditos (DesembolsoEsquema, src/api/app.ts). */
export interface CuerpoDesembolso extends CuerpoSimulacion {
    readonly idCredito: string;
    readonly idCliente: string;
    readonly idAsesor: string;
}

export type {
    ClienteEncontrado,
    CreditoDelCliente,
    ResultadoBusquedaClientes
} from "../../../src/servicios/directorio-clientes";

/**
 * `detalle` de un rechazo MONTO_NO_EXACTO (src/servicios/consultas-cartera.ts,
 * registrarPago). Viaja dentro del error uniforme, por eso no tiene tipo
 * exportado en el servidor; se describe aquí con los mismos campos.
 */
export interface DetalleMontoNoExacto {
    readonly montoRecibido: number;
    readonly montoCorrecto: number;
    readonly diferencia: number;
    readonly desglosePrelacion: import("../../../src/servicios/consultas-cartera").DesglosePrelacion;
    readonly cuotasCubiertas: ReadonlyArray<number>;
}

/** Canales que acepta registrar_pago (RegistrarPagoEntrada, src/mcp/esquemas.ts). */
export type CanalPago = "agencia" | "campo" | "transferencia";

/** Cuerpo de POST /api/creditos/:id/pagos (RegistrarPagoEntrada sin idCredito). */
export interface CuerpoRegistrarPago {
    readonly monto: number;
    readonly claveIdempotencia: string;
    readonly fechaOperacion: string;
    readonly canal: CanalPago;
    readonly confirmado: boolean;
}
