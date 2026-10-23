import { addDays, differenceInCalendarDays } from "date-fns";

import { Dinero } from "../dominio/dinero";
import { NombreEstado } from "../dominio/nombre-estado";
import { RepositorioCartera } from "../dominio/repositorio-cartera";
import { ClasificadorTramoMora, TramoMora } from "../dominio/tramo-mora";
import {
    CatalogoPoliticasMora
} from "../dominio/politica-mora/catalogo-politicas";
import { PosicionCartera } from "../dominio/posicion-cartera";
import { Cartera } from "./cartera";
import {
    CreditoVivo,
    ReconstructorCredito
} from "./reconstructor-credito";

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

export interface LineaMora {

    readonly tramo: string;

    readonly dias: number;

    readonly tnaMoratoria: string;

    readonly tasaDiaria: number;

    readonly monto: number;

}

export interface ExplicacionMora {

    readonly idCredito: string;

    readonly numeroCuota: number;

    readonly fechaCorte: string;

    readonly politica: string;

    readonly capitalEnMora: number;

    readonly diasAtraso: number;

    readonly tramo: TramoMora;

    readonly tramosRecorridos: ReadonlyArray<LineaMora>;

    /** Suma de los montos ya redondeados, para contrastarla con el total. */
    readonly sumaDeTramosRedondeados: number;

    readonly total: number;

    /**
     * Verdadero cuando la suma de las lineas redondeadas difiere del
     * total. La pantalla debe explicarlo, no disimularlo.
     */
    readonly hayDiferenciaPorRedondeo: boolean;

}

/**
 * Una linea del listado de creditos en mora.
 *
 * El enunciado pide "creditos con dias, tramo y saldo" (6.3). Se agregan
 * el cliente y el estado porque un listado de cobranza sin nombre no se
 * puede trabajar, y porque un credito ya declarado incobrable no se cobra
 * igual que uno en Mora 3.
 */
export interface CreditoEnMora {

    readonly idCredito: string;

    readonly idCliente: string;

    readonly nombreCliente: string;

    readonly diasAtraso: number;

    readonly tramo: TramoMora;

    readonly estado: NombreEstado;

    /** La marca no se borra aunque el credito vuelva a vigente (P1 6.7). */
    readonly reestructurado: boolean;

    readonly saldoCapital: number;

    readonly cuotasVencidas: number;

}

export interface ListadoCreditosEnMora {

    readonly fechaCorte: string;

    /** El tramo por el que se filtro, o null si se pidieron todos. */
    readonly tramoFiltrado: TramoMora | null;

    readonly cantidad: number;

    readonly saldoCapitalTotal: number;

    readonly creditos: ReadonlyArray<CreditoEnMora>;

}

/**
 * Un credito de la cartera ya reconstruido y clasificado a la fecha de
 * corte. Es el insumo comun de las capacidades que miran la cartera
 * entera.
 */
interface CreditoAlCorte {

    readonly vivo: CreditoVivo;

    readonly diasAtraso: number;

    readonly tramo: TramoMora;

    /**
     * Foto del credito para medir la calidad de la cartera (P1 6.8). Se
     * arma en el recorrido y no en cada capacidad para que "cartera
     * activa" tenga una sola definicion, la del dominio.
     */
    readonly posicion: PosicionCartera;

}

/** Una cuota que esta por vencer dentro de la ventana consultada. */
export interface CuotaPorVencer {

    readonly idCredito: string;

    readonly idCliente: string;

    readonly nombreCliente: string;

    readonly numeroCuota: number;

    readonly fechaVencimiento: string;

    readonly diasParaVencer: number;

    /** Monto programado de la cuota en el plan. */
    readonly montoCuota: number;

    /**
     * Lo que realmente falta cobrar de esa cuota. Normalmente es igual al
     * monto programado, pero puede ser menor si un excedente anterior ya
     * abono a su capital (P1 6.6.5).
     */
    readonly montoPendiente: number;

}

export interface ProximosVencimientos {

    readonly fechaCorte: string;

    readonly ventanaDias: number;

    /** Ultimo dia incluido en la ventana. */
    readonly hasta: string;

    readonly cantidadCuotas: number;

    readonly creditosInvolucrados: number;

    /** Suma de lo pendiente: el efectivo que se espera recibir. */
    readonly montoTotal: number;

    readonly cuotas: ReadonlyArray<CuotaPorVencer>;

}

/** Una fila del desglose de la cartera en riesgo por tramo (P2 7.8). */
export interface FilaRiesgo {

    readonly categoria: string;

    readonly creditos: number;

    readonly saldo: number;

    /** Proporcion sobre la cartera activa, entre 0 y 1. */
    readonly porcentaje: number;

}

export interface EstadoCartera {

    readonly fechaCorte: string;

    readonly creditosActivos: number;

    readonly carteraActiva: number;

    readonly carteraEnMora: number;

    readonly porcentajeEnMora: number;

    readonly montoEnRiesgo: number;

    readonly porcentajeEnRiesgo: number;

    readonly dadoPorIncobrable: number;

    /**
     * Creditos que ya superan los 120 dias y todavia no se han dado de
     * baja (P1 6.7).
     *
     * Va en el reporte porque declarar incobrable MEJORA el porcentaje en
     * riesgo sin haber cobrado nada: el credito malo sale de las dos
     * sumas (P1 6.8). Si el gerente no ve cuanto esta pendiente de dar de
     * baja, no puede leer el indicador.
     */
    readonly candidatosAIncobrable: number;

    readonly saldoCandidatosAIncobrable: number;

    readonly desglosePorTramo: ReadonlyArray<FilaRiesgo>;

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

    /**
     * Capacidad 3: explicar una mora.
     *
     * Devuelve el capital en mora y el desglose por tramo recorrido, con
     * los dias y la tasa de cada uno. Ejercita G-5 y G-7.
     *
     * El enunciado describe bien el problema de diseno: si solo dice
     * "Mora: Q50.80" el cliente no puede verificar nada; si muestra la
     * formula completa, no se entiende. Por eso se devuelven las lineas
     * Y la diferencia por redondeo, para que la pantalla pueda explicarla.
     */
    public async explicarMora(
        idCredito: string,
        numeroCuota: number,
        fechaCorte: Date
    ): Promise<ExplicacionMora> {

        const { plan, registro } = await this.reconstruirCredito(idCredito);

        const cuota = plan.obtenerCuotas()
            .find(c => c.numero === numeroCuota);

        if (!cuota) {
            throw new ErrorConsulta(
                "CUOTA_INEXISTENTE",
                `El credito ${idCredito} no tiene una cuota ${numeroCuota}.`
            );
        }

        const politica = CatalogoPoliticasMora
            .vigente()
            .resolver(registro.fechaDesembolso);

        const diasAtraso = cuota.diasAtraso(fechaCorte);

        const desglose = politica.explicar(
            cuota.capitalPendiente(),
            diasAtraso
        );

        const lineas: LineaMora[] = desglose.lineas.map(linea => ({
            tramo: linea.tramo,
            dias: linea.diasEnTramo,
            tnaMoratoria: `${(linea.tnaMoratoria * 100).toFixed(0)} %`,
            tasaDiaria: Number(linea.tasaDiaria.toFixed(9)),
            monto: redondear(linea.montoSinRedondear)
        }));

        const sumaRedondeada = redondear(
            lineas.reduce((total, l) => total + l.monto, 0)
        );

        const total = desglose.total.obtenerValor();

        return {
            idCredito,
            numeroCuota,
            fechaCorte: aTexto(fechaCorte),
            politica: desglose.versionPolitica,
            capitalEnMora: desglose.capitalEnMora.obtenerValor(),
            diasAtraso,
            tramo: ConsultasCartera.CLASIFICADOR.clasificar(diasAtraso),
            tramosRecorridos: lineas,
            sumaDeTramosRedondeados: sumaRedondeada,
            total,
            hayDiferenciaPorRedondeo: sumaRedondeada !== total
        };
    }

    /**
     * Capacidad 4: listar creditos en mora.
     *
     * Devuelve cada credito con sus dias de atraso, su tramo y su saldo,
     * filtrable por tramo. Ejercita G-4: "Lista los creditos en Mora 3 al
     * 31 de octubre de 2026, con sus dias de atraso y su saldo."
     *
     * Sin filtro devuelve todo lo que tenga atraso. El orden es de mayor a
     * menor atraso porque es el orden en que cobranza trabaja la lista.
     */
    public async listarCreditosEnMora(
        fechaCorte: Date,
        tramo?: TramoMora
    ): Promise<ListadoCreditosEnMora> {

        const cartera = await this.recorrerCartera(fechaCorte);

        const enMora = cartera.filter(
            credito => tramo
                ? credito.tramo === tramo
                : credito.diasAtraso > 0
        );

        enMora.sort(
            (a, b) => b.diasAtraso - a.diasAtraso
                || a.vivo.registro.idCredito.localeCompare(
                    b.vivo.registro.idCredito
                )
        );

        const creditos: CreditoEnMora[] = [];

        // El total se acumula en Dinero y no en numeros sueltos: sumar 75
        // decimales en punto flotante es justamente el error que el
        // Proyecto 1 corrigio al representar el dinero en centavos.
        let saldoTotal = Dinero.cero();

        for (const credito of enMora) {

            const { registro, plan } = credito.vivo;

            const cliente = await this.repositorio.obtenerCliente(
                registro.idCliente
            );

            const saldo = credito.vivo.credito.saldoCapital;
            saldoTotal = saldoTotal.sumar(saldo);

            creditos.push({
                idCredito: registro.idCredito,
                idCliente: registro.idCliente,
                nombreCliente: cliente?.nombreCompleto ?? "(desconocido)",
                diasAtraso: credito.diasAtraso,
                tramo: credito.tramo,
                estado: credito.vivo.credito.nombreEstado(),
                reestructurado: registro.reestructurado,
                saldoCapital: saldo.obtenerValor(),
                cuotasVencidas: plan.cuotasExigibles(fechaCorte).length
            });
        }

        return {
            fechaCorte: aTexto(fechaCorte),
            tramoFiltrado: tramo ?? null,
            cantidad: creditos.length,
            saldoCapitalTotal: saldoTotal.obtenerValor(),
            creditos
        };
    }

    /**
     * Capacidad 5: ver proximos vencimientos.
     *
     * Devuelve las cuotas que vencen dentro de una ventana de dias, con
     * el total de cuotas y de monto. Ejercita G-6: "¿Que cuotas vencen en
     * los proximos 7 dias desde el 31 de octubre de 2026? ¿Y en los
     * proximos 30?"
     *
     * La ventana es (corte, corte + dias]: deja fuera la cuota que vence
     * el dia del corte, porque esa ya es exigible hoy y pertenece al
     * cobro del dia, no a lo que viene. Tambien deja fuera los creditos
     * cancelados e incobrables: no tienen vencimientos que atender.
     */
    public async proximosVencimientos(
        fechaCorte: Date,
        ventanaDias: number
    ): Promise<ProximosVencimientos> {

        if (!Number.isInteger(ventanaDias) || ventanaDias < 1) {
            throw new ErrorConsulta(
                "VENTANA_INVALIDA",
                "La ventana de dias debe ser un entero mayor o igual a 1."
            );
        }

        const hasta = addDays(fechaCorte, ventanaDias);

        const cartera = await this.recorrerCartera(fechaCorte);

        const cuotas: CuotaPorVencer[] = [];
        const creditos = new Set<string>();

        let total = Dinero.cero();

        for (const credito of cartera) {

            if (!credito.posicion.estaActiva()) {
                continue;
            }

            const { registro, plan } = credito.vivo;

            let cliente: string | undefined;

            for (const cuota of plan.obtenerCuotas()) {

                if (cuota.estaSaldada()) {
                    continue;
                }

                const dias = differenceInCalendarDays(
                    cuota.fechaVencimiento,
                    fechaCorte
                );

                if (dias < 1 || dias > ventanaDias) {
                    continue;
                }

                if (cliente === undefined) {
                    cliente = (
                        await this.repositorio.obtenerCliente(
                            registro.idCliente
                        )
                    )?.nombreCompleto ?? "(desconocido)";
                }

                const pendiente = cuota.totalPendiente();
                total = total.sumar(pendiente);

                creditos.add(registro.idCredito);

                cuotas.push({
                    idCredito: registro.idCredito,
                    idCliente: registro.idCliente,
                    nombreCliente: cliente,
                    numeroCuota: cuota.numero,
                    fechaVencimiento: aTexto(cuota.fechaVencimiento),
                    diasParaVencer: dias,
                    montoCuota: cuota.monto.obtenerValor(),
                    montoPendiente: pendiente.obtenerValor()
                });
            }
        }

        // Del vencimiento mas proximo al mas lejano: es el orden en que
        // el asesor llama a los clientes.
        cuotas.sort(
            (a, b) => a.diasParaVencer - b.diasParaVencer
                || a.idCredito.localeCompare(b.idCredito)
        );

        return {
            fechaCorte: aTexto(fechaCorte),
            ventanaDias,
            hasta: aTexto(hasta),
            cantidadCuotas: cuotas.length,
            creditosInvolucrados: creditos.size,
            montoTotal: total.obtenerValor(),
            cuotas
        };
    }

    /**
     * Capacidad 6: consultar la cartera.
     *
     * Devuelve cartera activa, en mora, en riesgo con su desglose por
     * tramo, y lo dado por incobrable. Ejercita G-1: "¿Como esta la
     * cartera al 31 de octubre de 2026?"
     *
     * No calcula nada: arma las posiciones y deja que Cartera (P1 6.8,
     * P2 7.8) produzca el reporte. El tablero gerencial CONSUME este
     * desglose; si lo recalculara habria dos fuentes de verdad para la
     * misma cifra, y dos fuentes de verdad siempre divergen.
     *
     * Mora y riesgo son indicadores DISTINTOS y se devuelven por
     * separado: la mora es operativa —quien no pago a tiempo— y el riesgo
     * es estrategico —quien probablemente no pague—. Rotularlos igual es
     * el error que el P2 clasifica como catastrofico.
     */
    public async consultarCartera(
        fechaCorte: Date
    ): Promise<EstadoCartera> {

        const cartera = await this.recorrerCartera(fechaCorte);

        const posiciones = cartera.map(credito => credito.posicion);

        const reporte = new Cartera(posiciones).generarReporte();

        const candidatos = posiciones.filter(
            posicion => posicion.estaActiva()
                && ConsultasCartera.CLASIFICADOR
                    .superaPlazoParaIncobrable(posicion.diasAtraso)
        );

        let saldoCandidatos = Dinero.cero();
        for (const posicion of candidatos) {
            saldoCandidatos = saldoCandidatos.sumar(posicion.saldoCapital);
        }

        return {
            fechaCorte: aTexto(fechaCorte),
            creditosActivos: posiciones
                .filter(posicion => posicion.estaActiva()).length,
            carteraActiva: reporte.carteraActiva.obtenerValor(),
            carteraEnMora: reporte.carteraEnMora.obtenerValor(),
            porcentajeEnMora: reporte.porcentajeEnMora,
            montoEnRiesgo: reporte.montoEnRiesgo.obtenerValor(),
            porcentajeEnRiesgo: reporte.porcentajeEnRiesgo,
            dadoPorIncobrable: reporte.dadoPorIncobrable.obtenerValor(),
            candidatosAIncobrable: candidatos.length,
            saldoCandidatosAIncobrable: saldoCandidatos.obtenerValor(),
            desglosePorTramo: reporte.desglosePorTramo.map(fila => ({
                categoria: fila.categoria,
                creditos: fila.creditos,
                saldo: fila.saldo.obtenerValor(),
                porcentaje: fila.porcentaje
            }))
        };
    }

    // ------------------------------------------------------------------

    /**
     * Recorre la cartera completa reconstruyendo cada credito a la fecha
     * de corte.
     *
     * Las capacidades que miran la cartera entera —listar en mora,
     * proximos vencimientos, tablero gerencial— comparten este recorrido.
     * Vive aqui una sola vez porque reconstruir un credito no es gratis:
     * duplicar el recorrido daria dos versiones que tarde o temprano se
     * desfasan, y entonces el tablero y su detalle dejarian de cuadrar.
     *
     * El estado se actualiza al corte ANTES de clasificar, porque el
     * tramo es una clasificacion derivada de los dias de atraso y no un
     * campo guardado (P1 6.5).
     */
    private async recorrerCartera(
        fechaCorte: Date
    ): Promise<CreditoAlCorte[]> {

        const registros = await this.repositorio.listarCreditos();

        const alCorte: CreditoAlCorte[] = [];

        for (const registro of registros) {

            const pagos = await this.repositorio.pagosDe(
                registro.idCredito
            );

            const vivo = this.reconstructor.reconstruir(registro, pagos);

            vivo.plan.actualizarEstado(fechaCorte);

            const diasAtraso = vivo.plan.diasAtrasoMaximo(fechaCorte);

            alCorte.push({
                vivo,
                diasAtraso,
                tramo: ConsultasCartera.CLASIFICADOR.clasificar(diasAtraso),
                posicion: new PosicionCartera(
                    registro.idCredito,
                    vivo.credito.saldoCapital,
                    diasAtraso,
                    vivo.credito.nombreEstado(),
                    registro.reestructurado
                )
            });
        }

        return alCorte;
    }

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

function redondear(valor: number): number {
    return Math.round(Number(valor.toPrecision(12)) * 100) / 100;
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
