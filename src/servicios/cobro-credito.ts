import type { RepositorioCartera } from "../dominio/repositorio-cartera";
import { ErrorConsulta } from "./consultas-cartera";
import { ReconstructorCredito } from "./reconstructor-credito";

/**
 * Deuda exigible de un credito a una fecha (E1 · pantalla "Registro de
 * pago").
 *
 * El Anexo A del enunciado lo dice sin rodeos: "su sistema calcula los
 * montos: no los escriba usted". La pantalla necesita preguntarle al
 * sistema cuanto hay que cobrar ANTES de pagar. Este servicio es de solo
 * lectura y usa las mismas llamadas del nucleo que registrarPago
 * (cuotasExigibles y calcularTotalAdeudado), asi que el monto que ofrece
 * es, por construccion, el que registrarPago acepta como exacto.
 *
 * No decide si el pago es admisible: esa autoridad es de registrarPago
 * (incobrable, ya pagada, monto no exacto). Aqui solo se informa la cifra.
 */
export interface DeudaExigible {
    readonly idCredito: string;
    readonly fechaCorte: string;
    /** Numeros de las cuotas vencidas que el pago cubriria. */
    readonly cuotasExigibles: ReadonlyArray<number>;
    readonly desglosePrelacion: {
        readonly gastos: number;
        readonly interesMoratorio: number;
        readonly interesCorriente: number;
        readonly capital: number;
        readonly total: number;
    };
    /** Igual a desglosePrelacion.total; es el monto exacto a recibir. */
    readonly montoExacto: number;
}

export class CobroCredito {

    constructor(
        private readonly repositorio: RepositorioCartera,
        private readonly reconstructor: ReconstructorCredito =
            new ReconstructorCredito()
    ) {}

    public async deudaExigible(
        idCredito: string,
        fechaCorte: Date
    ): Promise<DeudaExigible> {

        const registro = await this.repositorio.obtenerCredito(idCredito);

        if (!registro) {
            throw new ErrorConsulta(
                "CREDITO_INEXISTENTE",
                `El credito ${idCredito} no existe.`
            );
        }

        const { plan } = this.reconstructor.reconstruir(
            registro,
            await this.repositorio.pagosDe(idCredito)
        );

        plan.actualizarEstado(fechaCorte);

        const exigibles = plan.cuotasExigibles(fechaCorte);
        const deuda = plan.calcularTotalAdeudado(fechaCorte);

        const total = deuda.total().obtenerValor();

        return {
            idCredito,
            fechaCorte: aTexto(fechaCorte),
            cuotasExigibles: exigibles.map(c => c.numero),
            desglosePrelacion: {
                gastos: deuda.gastos.obtenerValor(),
                interesMoratorio: deuda.interesMoratorio.obtenerValor(),
                interesCorriente: deuda.interesCorriente.obtenerValor(),
                capital: deuda.capital.obtenerValor(),
                total
            },
            montoExacto: total
        };
    }
}

function aTexto(fecha: Date): string {

    const dos = (n: number) => String(n).padStart(2, "0");

    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}
