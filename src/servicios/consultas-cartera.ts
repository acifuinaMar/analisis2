import { Dinero } from "../dominio/dinero";
import { NombreEstado } from "../dominio/nombre-estado";
import { RepositorioCartera } from "../dominio/repositorio-cartera";
import { ClasificadorTramoMora, TramoMora } from "../dominio/tramo-mora";
import { ReconstructorCredito } from "./reconstructor-credito";

/**
 * Servicio de consulta de la cartera.
 *
 * Aqui viven las capacidades que el enunciado pide del asistente (6.3).
 * Las herramientas MCP son una envoltura delgada sobre este servicio, y
 * la API del E1 va a consumir lo mismo: una sola fuente de respuestas
 * para el chat y para las pantallas.
 *
 * Dos reglas que se respetan en todas las operaciones:
 *
 *  - La fecha de corte LLEGA COMO PARAMETRO. Ninguna consulta lee el
 *    reloj del sistema. Es el puerto Reloj del Proyecto 1, y con mora
 *    escalonada importa mas que nunca porque el tramo depende de la fecha.
 *  - Las cifras las pone el nucleo. Este servicio coordina y traduce, no
 *    calcula.
 */

/** Error de dominio con codigo estable, para la convencion uniforme. */
export class ErrorConsulta extends Error {

    constructor(
        public readonly codigo: string,
        mensaje: string
    ) {
        super(mensaje);
        this.name = "ErrorConsulta";
    }
}

export interface CuotaResumen {

    readonly numero: number;

    readonly fechaVencimiento: string;

    readonly monto: number;

    readonly capital: number;

    readonly interes: number;

    readonly estado: string;

    readonly diasAtraso: number;

}

export interface EstadoCredito {

    readonly idCredito: string;

    readonly idCliente: string;

    readonly nombreCliente: string;

    readonly fechaCorte: string;

    readonly estado: NombreEstado;

    readonly tramo: TramoMora;

    readonly reestructurado: boolean;

    readonly capitalDesembolsado: number;

    readonly saldoCapital: number;

    readonly diasAtraso: number;

    readonly cuotasPagadas: number;

    readonly cuotasVencidas: number;

    readonly proximaCuota?: CuotaResumen;

}

export interface DeudaCuota {

    readonly idCredito: string;

    readonly numeroCuota: number;

    readonly fechaCorte: string;

    readonly diasAtraso: number;

    readonly tramo: TramoMora;

    readonly gastos: number;

    readonly interesMoratorio: number;

    readonly interesCorriente: number;

    readonly capital: number;

    readonly totalExigible: number;

}

export class ConsultasCartera {

    private static readonly CLASIFICADOR = new ClasificadorTramoMora();

    constructor(
        private readonly repositorio: RepositorioCartera,
        private readonly reconstructor = new ReconstructorCredito()
    ) {}

    /**
     * Capacidad 1: consultar un credito.
     *
     * Devuelve estado, saldo, dias de atraso, tramo, cuotas pagadas y
     * vencidas, y la proxima cuota. Ejercita la consulta G-5.
     */
    public async consultarCredito(
        idCredito: string,
        fechaCorte: Date
    ): Promise<EstadoCredito> {

        const { credito, plan, registro } =
            await this.reconstruirCredito(idCredito);

        plan.actualizarEstado(fechaCorte);

        const cuotas = plan.obtenerCuotas();
        const diasAtraso = plan.diasAtrasoMaximo(fechaCorte);

        const cliente = await this.repositorio.obtenerCliente(
            registro.idCliente
        );

        const proxima = cuotas.find(cuota => !cuota.estaSaldada());

        return {
            idCredito: registro.idCredito,
            idCliente: registro.idCliente,
            nombreCliente: cliente?.nombreCompleto ?? "(desconocido)",
            fechaCorte: aTexto(fechaCorte),
            estado: credito.nombreEstado(),
            tramo: ConsultasCartera.CLASIFICADOR.clasificar(diasAtraso),
            reestructurado: registro.reestructurado,
            capitalDesembolsado: registro.capital.obtenerValor(),
            saldoCapital: credito.saldoCapital.obtenerValor(),
            diasAtraso,
            cuotasPagadas: cuotas.filter(c => c.estaSaldada()).length,
            cuotasVencidas: plan.cuotasExigibles(fechaCorte).length,
            proximaCuota: proxima && {
                numero: proxima.numero,
                fechaVencimiento: aTexto(proxima.fechaVencimiento),
                monto: proxima.monto.obtenerValor(),
                capital: proxima.capital.obtenerValor(),
                interes: proxima.interes.obtenerValor(),
                estado: proxima.obtenerEstado(),
                diasAtraso: proxima.diasAtraso(fechaCorte)
            }
        };
    }

    /**
     * Capacidad 2: calcular la deuda de una cuota.
     *
     * Devuelve el desglose completo —gastos, moratorio, interes corriente
     * y capital— que es lo que la pantalla de registro de pago debe
     * mostrar antes de recibir el dinero. Ejercita OP-1 y OP-2.
     */
    public async calcularDeudaDeCuota(
        idCredito: string,
        numeroCuota: number,
        fechaCorte: Date
    ): Promise<DeudaCuota> {

        const { plan } = await this.reconstruirCredito(idCredito);

        const cuota = plan.obtenerCuotas()
            .find(c => c.numero === numeroCuota);

        if (!cuota) {
            throw new ErrorConsulta(
                "CUOTA_INEXISTENTE",
                `El credito ${idCredito} no tiene una cuota ${numeroCuota}.`
            );
        }

        const deuda = plan.deudaDeCuota(numeroCuota, fechaCorte);
        const diasAtraso = cuota.diasAtraso(fechaCorte);

        return {
            idCredito,
            numeroCuota,
            fechaCorte: aTexto(fechaCorte),
            diasAtraso,
            tramo: ConsultasCartera.CLASIFICADOR.clasificar(diasAtraso),
            gastos: deuda.gastos.obtenerValor(),
            interesMoratorio: deuda.interesMoratorio.obtenerValor(),
            interesCorriente: deuda.interesCorriente.obtenerValor(),
            capital: deuda.capital.obtenerValor(),
            totalExigible: deuda.total().obtenerValor()
        };
    }

    // ------------------------------------------------------------------

    private async reconstruirCredito(idCredito: string) {

        const registro = await this.repositorio.obtenerCredito(idCredito);

        if (!registro) {
            throw new ErrorConsulta(
                "CREDITO_INEXISTENTE",
                `No existe el credito ${idCredito}.`
            );
        }

        const pagos = await this.repositorio.pagosDe(idCredito);

        return this.reconstructor.reconstruir(registro, pagos);
    }
}

/** Las fechas salen en AAAA-MM-DD, el mismo formato del paquete. */
function aTexto(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Evita que Dinero se filtre al borde: el contrato expone numeros. */
export function aMonto(dinero: Dinero): number {
    return dinero.obtenerValor();
}
