import { Credito } from "../dominio/credito";
import { Dinero } from "../dominio/dinero";
import { PlanAmortizacion } from "../dominio/plan-amortizacion";
import { BaseConteo, PoliticaCredito } from "../dominio/politica-credito";
import {
    ClienteRegistrado,
    CreditoRegistrado,
    RepositorioCartera
} from "../dominio/repositorio-cartera";
import { CalculoFrances } from "../estrategias/calculo-frances";
import { ErrorConsulta } from "./consultas-cartera";
import { ReconstructorCredito } from "./reconstructor-credito";

/**
 * Originacion de creditos y planes de amortizacion (E1 · pantallas
 * "Solicitud de credito" y "Plan de amortizacion").
 *
 * No calcula nada propio: toda cifra del plan sale de PlanAmortizacion y
 * CalculoFrances, el mismo nucleo del Proyecto 1. Aqui solo se (1)
 * validan los limites de negocio de la solicitud, (2) se arma el plan y
 * (3) se persiste a traves del puerto RepositorioCartera.
 *
 * Los saldos de cada fila del plan se derivan restando capitales con
 * Dinero (centavos enteros): son exactos y los entrega la API, para que
 * la interfaz no calcule ninguna cifra.
 */

/** Limites del producto (P1 seccion 2 y manual MAN-PRODUCTO-01). */
export const LIMITES_PRODUCTO = {
    capitalMinimo: 1000,
    capitalMaximo: 25000,
    plazoMinimoMeses: 3,
    plazoMaximoMeses: 24
} as const;

export interface FilaPlan {
    readonly numero: number;
    readonly fechaVencimiento: string;
    readonly saldoInicial: number;
    readonly cuota: number;
    readonly interes: number;
    readonly capital: number;
    readonly saldoFinal: number;
}

export interface PlanSimulado {
    readonly capital: number;
    readonly plazoMeses: number;
    readonly tnaAnual: number;
    readonly fechaDesembolso: string;
    readonly cuotas: ReadonlyArray<FilaPlan>;
    readonly totales: {
        readonly cuotas: number;
        readonly intereses: number;
        readonly capital: number;
    };
}

export interface FilaPlanCredito extends FilaPlan {
    readonly capitalPagado: number;
    readonly interesPagado: number;
    readonly estado: "pendiente" | "parcial" | "pagada";
    readonly vencida: boolean;
    readonly diasAtraso: number;
}

export interface PlanDeCredito {
    readonly idCredito: string;
    readonly fechaCorte: string;
    readonly capital: number;
    readonly plazoMeses: number;
    readonly tnaAnual: number;
    readonly fechaDesembolso: string;
    readonly cuotas: ReadonlyArray<FilaPlanCredito>;
}

export interface EntradaSimulacion {
    readonly capital: number;
    readonly plazoMeses: number;
    readonly tnaAnual: number;
    readonly fechaDesembolso: Date;
}

export interface DatosCliente {
    readonly idCliente: string;
    readonly nombreCompleto: string;
    readonly dpi: string;
    readonly telefono: string;
    readonly municipio: string;
    readonly fechaAlta: Date;
}

export interface DatosDesembolso extends EntradaSimulacion {
    readonly idCredito: string;
    readonly idCliente: string;
    readonly idAsesor: string;
}

export interface ResultadoDesembolso {
    readonly idCredito: string;
    readonly idCliente: string;
    readonly idAsesor: string;
    readonly plan: PlanSimulado;
}

export class OriginacionCredito {

    constructor(
        private readonly repositorio: RepositorioCartera,
        private readonly reconstructor: ReconstructorCredito =
            new ReconstructorCredito()
    ) {}

    /**
     * Plan de amortizacion de una solicitud, SIN guardar nada. Es lo que
     * se muestra antes de confirmar el desembolso (OP-3).
     */
    public simularPlan(entrada: EntradaSimulacion): PlanSimulado {

        this.validarSolicitud(entrada);

        const { credito, plan } = this.armarPlan(
            "SIMULACION",
            entrada.capital,
            entrada.plazoMeses,
            entrada.tnaAnual,
            entrada.fechaDesembolso
        );

        const cuotas = this.filasDelPlan(credito, plan);

        const total = (campo: "cuota" | "interes" | "capital") =>
            cuotas.reduce(
                (acc, f) => acc.sumar(Dinero.desde(f[campo])),
                Dinero.cero()
            ).obtenerValor();

        return {
            capital: entrada.capital,
            plazoMeses: entrada.plazoMeses,
            tnaAnual: entrada.tnaAnual,
            fechaDesembolso: aTexto(entrada.fechaDesembolso),
            cuotas,
            totales: {
                cuotas: total("cuota"),
                intereses: total("interes"),
                capital: total("capital")
            }
        };
    }

    /** Plan de un credito existente, con el avance de pagos a la fecha. */
    public async obtenerPlan(
        idCredito: string,
        fechaCorte: Date
    ): Promise<PlanDeCredito> {

        const registro = await this.repositorio.obtenerCredito(idCredito);

        if (!registro) {
            throw new ErrorConsulta(
                "CREDITO_INEXISTENTE",
                `El credito ${idCredito} no existe.`
            );
        }

        const vivo = this.reconstructor.reconstruir(
            registro,
            await this.repositorio.pagosDe(idCredito)
        );

        const base = this.filasDelPlan(vivo.credito, vivo.plan);
        const cuotas = vivo.plan.obtenerCuotas();

        return {
            idCredito,
            fechaCorte: aTexto(fechaCorte),
            capital: registro.capital.obtenerValor(),
            plazoMeses: registro.plazoMeses,
            tnaAnual: registro.tnaAnual,
            fechaDesembolso: aTexto(registro.fechaDesembolso),
            cuotas: base.map((fila, i) => {

                const cuota = cuotas[i]!;

                return {
                    ...fila,
                    capitalPagado: cuota.capitalPagado().obtenerValor(),
                    interesPagado: cuota.interesPagado().obtenerValor(),
                    estado: cuota.obtenerEstado(),
                    vencida: cuota.estaVencida(fechaCorte),
                    diasAtraso: cuota.diasAtraso(fechaCorte)
                };
            })
        };
    }

    public async registrarCliente(datos: DatosCliente): Promise<ClienteRegistrado> {

        for (const [campo, valor] of [
            ["nombreCompleto", datos.nombreCompleto],
            ["dpi", datos.dpi],
            ["telefono", datos.telefono],
            ["municipio", datos.municipio]
        ] as const) {
            if (valor.trim() === "") {
                throw new ErrorConsulta(
                    "DATOS_INVALIDOS",
                    `El campo ${campo} es obligatorio.`
                );
            }
        }

        const cliente: ClienteRegistrado = {
            idCliente: datos.idCliente,
            nombreCompleto: datos.nombreCompleto.trim(),
            dpi: datos.dpi.trim(),
            telefono: datos.telefono.trim(),
            municipio: datos.municipio.trim(),
            fechaAlta: datos.fechaAlta
        };

        await this.repositorio.registrarCliente(cliente);

        return cliente;
    }

    /**
     * Desembolsa un credito: valida, persiste y devuelve el plan. El plan
     * devuelto es el mismo que luego entregara obtenerPlan (sin pagos).
     */
    public async desembolsarCredito(
        datos: DatosDesembolso
    ): Promise<ResultadoDesembolso> {

        // Valida y arma el plan ANTES de escribir: si la solicitud es
        // invalida no se guarda nada.
        const plan = this.simularPlan(datos);

        const registro: CreditoRegistrado = {
            idCredito: datos.idCredito,
            idCliente: datos.idCliente,
            idAsesor: datos.idAsesor,
            fechaDesembolso: datos.fechaDesembolso,
            capital: Dinero.desde(datos.capital),
            plazoMeses: datos.plazoMeses,
            tnaAnual: datos.tnaAnual,
            reestructurado: false
        };

        await this.repositorio.registrarCredito(registro);

        return {
            idCredito: datos.idCredito,
            idCliente: datos.idCliente,
            idAsesor: datos.idAsesor,
            plan
        };
    }

    // ------------------------------------------------------------------

    private validarSolicitud(e: EntradaSimulacion): void {

        const enCentavos = Math.abs(e.capital * 100 - Math.round(e.capital * 100));

        if (!Number.isFinite(e.capital) || enCentavos > 1e-6) {
            throw new ErrorConsulta(
                "CAPITAL_FUERA_DE_RANGO",
                "El capital debe ser un importe en quetzales con a lo "
                + "sumo dos decimales."
            );
        }

        if (
            e.capital < LIMITES_PRODUCTO.capitalMinimo
            || e.capital > LIMITES_PRODUCTO.capitalMaximo
        ) {
            throw new ErrorConsulta(
                "CAPITAL_FUERA_DE_RANGO",
                `El capital debe estar entre Q${LIMITES_PRODUCTO.capitalMinimo}`
                + ` y Q${LIMITES_PRODUCTO.capitalMaximo}.`,
                { minimo: LIMITES_PRODUCTO.capitalMinimo, maximo: LIMITES_PRODUCTO.capitalMaximo }
            );
        }

        if (
            !Number.isInteger(e.plazoMeses)
            || e.plazoMeses < LIMITES_PRODUCTO.plazoMinimoMeses
            || e.plazoMeses > LIMITES_PRODUCTO.plazoMaximoMeses
        ) {
            throw new ErrorConsulta(
                "PLAZO_FUERA_DE_RANGO",
                `El plazo debe ser un numero entero de meses entre `
                + `${LIMITES_PRODUCTO.plazoMinimoMeses} y `
                + `${LIMITES_PRODUCTO.plazoMaximoMeses}.`,
                { minimo: LIMITES_PRODUCTO.plazoMinimoMeses, maximo: LIMITES_PRODUCTO.plazoMaximoMeses }
            );
        }

        if (!(e.tnaAnual > 0)) {
            throw new ErrorConsulta(
                "TASA_INVALIDA",
                "La tasa nominal anual debe ser mayor que cero "
                + "(exprese 36 % como 0.36)."
            );
        }
    }

    private armarPlan(
        id: string,
        capital: number,
        plazoMeses: number,
        tnaAnual: number,
        fechaDesembolso: Date
    ): { credito: Credito; plan: PlanAmortizacion } {

        let politica: PoliticaCredito;

        try {
            // La validacion de razonabilidad de la tasa vive en el nucleo.
            politica = new PoliticaCredito(
                `SOLICITUD-${id}`,
                tnaAnual,
                0.24,
                BaseConteo.ACTUAL_360,
                "Originacion",
                fechaDesembolso
            );
        } catch (error) {
            throw new ErrorConsulta(
                "TASA_INVALIDA",
                error instanceof Error ? error.message : String(error)
            );
        }

        const monto = Dinero.desde(capital);

        const credito = new Credito(
            id, monto, monto, politica, plazoMeses, fechaDesembolso
        );

        const plan = new PlanAmortizacion(credito, new CalculoFrances());
        plan.generarPlan();

        return { credito, plan };
    }

    private filasDelPlan(credito: Credito, plan: PlanAmortizacion): FilaPlan[] {

        let saldo = credito.monto;

        return plan.obtenerCuotas().map(cuota => {

            const saldoInicial = saldo;
            saldo = saldo.restar(cuota.capital);

            return {
                numero: cuota.numero,
                fechaVencimiento: aTexto(cuota.fechaVencimiento),
                saldoInicial: saldoInicial.obtenerValor(),
                cuota: cuota.monto.obtenerValor(),
                interes: cuota.interes.obtenerValor(),
                capital: cuota.capital.obtenerValor(),
                saldoFinal: saldo.obtenerValor()
            };
        });
    }
}

/** Date local -> AAAA-MM-DD, sin pasar por UTC. */
function aTexto(fecha: Date): string {

    const dos = (n: number) => String(n).padStart(2, "0");

    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}
