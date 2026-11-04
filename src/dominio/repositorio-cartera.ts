import { Dinero } from "./dinero";

/**
 * PUERTO del repositorio de cartera.
 *
 * El nucleo calcula; este puerto dice de donde salen los datos sobre los
 * que calcula. Las herramientas MCP dependen de esta interfaz y no de
 * Postgres ni de archivos: cambiar el origen no las obliga a cambiar.
 *
 * Es la misma leccion del Proyecto 1 aplicada otra vez. Alli el error fue
 * inyectar una tasa donde debia inyectarse un calculo; aqui se inyecta el
 * origen de los datos en vez de cablearlo.
 *
 * Lo que devuelve son HECHOS REGISTRADOS —lo que ocurrio—, no estado
 * calculado. El estado de un credito (saldo, tramo, cuotas vencidas) lo
 * reconstruye el nucleo reproduciendo sus pagos, tal como establece el
 * paquete canonico: "la cartera se reconstruye reproduciendo estos
 * eventos".
 */

/** Un cliente dado de alta. */
export interface ClienteRegistrado {

    readonly idCliente: string;

    readonly nombreCompleto: string;

    readonly dpi: string;

    readonly telefono: string;

    readonly municipio: string;

    readonly fechaAlta: Date;

}

/** Un credito desembolsado, tal como quedo registrado. */
export interface CreditoRegistrado {

    readonly idCredito: string;

    readonly idCliente: string;

    readonly idAsesor: string;

    /** Fecha de otorgamiento. Decide que politica de mora le aplica. */
    readonly fechaDesembolso: Date;

    readonly capital: Dinero;

    readonly plazoMeses: number;

    /** TNA corriente en decimal: 0.36 = 36 % anual. */
    readonly tnaAnual: number;

    /**
     * Marca permanente de reestructuracion. No es el estado: un credito
     * reestructurado puede volver a vigente, pero la marca no se borra y
     * lo mantiene contando como cartera en riesgo (P1 6.7).
     */
    readonly reestructurado: boolean;

}

/** Un pago recibido, con su clave de idempotencia. */
export interface PagoRegistrado {

    /**
     * Identifica la operacion, no el pago. Reintentar con la misma clave
     * no vuelve a cobrar (invariante P1 6.10).
     */
    readonly claveIdempotencia: string;

    readonly idCredito: string;

    readonly fecha: Date;

    readonly monto: Dinero;

    readonly canal: string;

}

/**
 * Resultado de intentar registrar un pago.
 *
 * `duplicado` no es un error: significa que esa clave ya se habia
 * registrado antes y el saldo no se movio. Es la idempotencia funcionando,
 * y el llamador debe poder distinguirla de un alta real.
 */
export interface ResultadoRegistroPago {

    readonly registrado: boolean;

    readonly duplicado: boolean;

    readonly pago: PagoRegistrado;

}

export interface AsesorRegistrado {

    readonly idAsesor: string;

    readonly nombreCompleto: string;

}

/**
 * Error del repositorio con codigo estable.
 *
 * Los adaptadores lo lanzan cuando una escritura viola una regla de
 * integridad (duplicado, referencia inexistente). Es el repositorio quien
 * lo decide —y no la capa HTTP— porque la unicidad y las referencias son
 * invariantes de los datos, no del transporte.
 */
export type CodigoErrorRepositorio =
    | "CLIENTE_DUPLICADO"
    | "DPI_DUPLICADO"
    | "CREDITO_DUPLICADO"
    | "CLIENTE_INEXISTENTE"
    | "ASESOR_INEXISTENTE";

export class ErrorRepositorio extends Error {

    constructor(
        public readonly codigo: CodigoErrorRepositorio,
        mensaje: string
    ) {
        super(mensaje);
        this.name = "ErrorRepositorio";
    }
}

export interface RepositorioCartera {

    listarCreditos(): Promise<CreditoRegistrado[]>;

    obtenerCredito(idCredito: string): Promise<CreditoRegistrado | undefined>;

    obtenerCliente(idCliente: string): Promise<ClienteRegistrado | undefined>;

    /** Pagos de un credito, en orden cronologico. */
    pagosDe(idCredito: string): Promise<PagoRegistrado[]>;

    /** Todos los pagos de la cartera, para los cierres por periodo. */
    listarPagos(): Promise<PagoRegistrado[]>;

    /**
     * Registra un pago. Debe ser idempotente por clave: si la clave ya
     * existe, devuelve el pago anterior sin alterar nada.
     */
    registrarPago(pago: PagoRegistrado): Promise<ResultadoRegistroPago>;

    /**
     * Todos los clientes en UNA consulta. Existe para que los listados
     * (morosos, vencimientos) no pidan el cliente credito por credito:
     * contra una base remota cada viaje de red cuenta.
     */
    listarClientes(): Promise<ClienteRegistrado[]>;

    /** Asesores de credito (catalogo del paquete). */
    listarAsesores(): Promise<AsesorRegistrado[]>;

    /**
     * Da de alta un cliente. Lanza ErrorRepositorio si el id o el DPI ya
     * existen.
     */
    registrarCliente(cliente: ClienteRegistrado): Promise<void>;

    /**
     * Registra un desembolso. Lanza ErrorRepositorio si el credito ya
     * existe o si el cliente o el asesor no existen.
     */
    registrarCredito(credito: CreditoRegistrado): Promise<void>;

}
