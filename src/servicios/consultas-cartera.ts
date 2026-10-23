import {
    addDays,
    differenceInCalendarDays,
    endOfMonth
} from "date-fns";

import { Credito } from "../dominio/credito";
import { Dinero } from "../dominio/dinero";
import { PlanAmortizacion } from "../dominio/plan-amortizacion";
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
        mensaje: string,
        /**
         * Datos que el llamador necesita para reaccionar, no solo para
         * leer. Un rechazo por monto no exacto debe poder decir CUAL es
         * el monto correcto, y el asistente tiene que poder tomarlo de un
         * campo en vez de sacarlo del texto del mensaje.
         */
        public readonly detalle?: Record<string, unknown>
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

export type TipoCierre = "diario" | "mensual";

/**
 * Recuperaciones desglosadas por concepto, en el orden de la prelacion
 * (P1 6.6.2): primero gastos, luego mora, luego interes corriente y al
 * final capital.
 *
 * El excedente va aparte porque no lo coloca la prelacion sino la
 * politica de adelanto, que lo abona al capital de cuotas futuras sin
 * pagar sus intereses (P1 6.6.5). Es recuperacion de capital, pero de
 * otra naturaleza, y el cierre debe poder distinguirlas.
 *
 * Las cinco lineas suman siempre el total recibido: nada se pierde.
 */
export interface RecuperacionesPorConcepto {

    readonly gastos: number;

    readonly interesMoratorio: number;

    readonly interesCorriente: number;

    readonly capital: number;

    readonly excedenteACapital: number;

    readonly total: number;

}

export interface MovimientoCierre {

    readonly cantidad: number;

    readonly monto: number;

}

export interface Cierre {

    /** CIE-2026-10-31 para el diario, CIE-2026-10 para el mensual. */
    readonly id: string;

    readonly tipo: TipoCierre;

    readonly desde: string;

    readonly hasta: string;

    readonly desembolsos: MovimientoCierre;

    readonly pagos: MovimientoCierre;

    readonly recuperaciones: RecuperacionesPorConcepto;

    /**
     * Flujo neto del periodo: lo recuperado menos lo desembolsado.
     *
     * Es el unico campo que puede ser NEGATIVO, y por eso no es un
     * Dinero: un importe nunca es negativo, pero un flujo si. Negativo
     * significa que se presto mas de lo que entro, que es lo normal en un
     * mes de crecimiento.
     */
    readonly flujoNeto: number;

}

/** Como se reparte un pago entre los rubros (prelacion, P1 6.6.2). */
export interface DesglosePrelacion {

    readonly gastos: number;

    readonly interesMoratorio: number;

    readonly interesCorriente: number;

    readonly capital: number;

    readonly total: number;

}

/** Foto corta del credito, para contrastar antes y despues del pago. */
export interface ResumenEstadoCredito {

    readonly estado: NombreEstado;

    readonly tramo: TramoMora;

    readonly diasAtraso: number;

    readonly saldoCapital: number;

    readonly cuotasVencidas: number;

}

export interface ResultadoPago {

    /**
     * Falso cuando la llamada fue una VISTA PREVIA: se calculo el
     * desglose y no se toco nada. Es el paso de aprobacion humana.
     */
    readonly aplicado: boolean;

    /**
     * Verdadero cuando la clave ya se habia registrado. No es un error:
     * es la idempotencia funcionando (P1 6.10), y el saldo no se movio.
     */
    readonly duplicado: boolean;

    readonly idCredito: string;

    readonly nombreCliente: string;

    readonly fechaOperacion: string;

    readonly claveIdempotencia: string;

    readonly montoRecibido: number;

    /** Cuotas exigibles que el pago cubre, de la mas antigua a la nueva. */
    readonly cuotasCubiertas: ReadonlyArray<number>;

    readonly desglosePrelacion: DesglosePrelacion;

    readonly estadoAntes: ResumenEstadoCredito;

    /** Solo cuando el pago se aplico de verdad. */
    readonly estadoDespues?: ResumenEstadoCredito;

    readonly mensaje: string;

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

    /**
     * Capacidad 7a: consultar el cierre de un dia.
     *
     * Ejercita G-3: "Dame el cierre del 31 de octubre de 2026."
     */
    public async consultarCierreDiario(fecha: Date): Promise<Cierre> {

        return this.armarCierre(
            "diario",
            `CIE-${aTexto(fecha)}`,
            fecha,
            fecha
        );
    }

    /**
     * Capacidad 7b: consultar el cierre de un mes.
     *
     * Ejercita G-2: "Dame el cierre mensual de octubre de 2026:
     * desembolsos y recuperaciones por concepto."
     *
     * El periodo llega como AAAA-MM. El ultimo dia se calcula con
     * date-fns y no a mano, por la misma razon que el resto del nucleo:
     * la aritmetica de fechas nativa se equivoca en los fines de mes.
     */
    public async consultarCierreMensual(periodo: string): Promise<Cierre> {

        if (!/^\d{4}-\d{2}$/.test(periodo)) {
            throw new ErrorConsulta(
                "PERIODO_INVALIDO",
                `El periodo ${periodo} debe venir en formato AAAA-MM.`
            );
        }

        const [anio, mes] = periodo.split("-").map(Number);

        if (mes < 1 || mes > 12) {
            throw new ErrorConsulta(
                "PERIODO_INVALIDO",
                `El mes ${mes} no existe.`
            );
        }

        const primero = new Date(anio, mes - 1, 1);

        return this.armarCierre(
            "mensual",
            `CIE-${periodo}`,
            primero,
            endOfMonth(primero)
        );
    }

    /**
     * Arma el cierre de un rango de fechas, ambos extremos incluidos.
     *
     * IDEMPOTENTE por construccion (P1 6.9): no acumula ni escribe nada,
     * reconstruye el periodo a partir de la bitacora de eventos. Pedir el
     * mismo cierre dos veces da el mismo resultado y no duplica
     * movimientos, que es justo lo que el enunciado exige del cierre.
     *
     * Las recuperaciones salen del desglose con que la prelacion imputo
     * cada pago en su momento, no de volver a repartir los montos ahora:
     * la mora de un pago de julio se calculo en julio.
     */
    private async armarCierre(
        tipo: TipoCierre,
        id: string,
        desde: Date,
        hasta: Date
    ): Promise<Cierre> {

        const cartera = await this.recorrerCartera(hasta);

        let desembolsado = Dinero.cero();
        let cuantosDesembolsos = 0;

        let gastos = Dinero.cero();
        let mora = Dinero.cero();
        let corriente = Dinero.cero();
        let capital = Dinero.cero();
        let excedente = Dinero.cero();
        let recibido = Dinero.cero();
        let cuantosPagos = 0;

        for (const credito of cartera) {

            const { registro, aplicaciones } = credito.vivo;

            if (enRango(registro.fechaDesembolso, desde, hasta)) {
                cuantosDesembolsos++;
                desembolsado = desembolsado.sumar(registro.capital);
            }

            for (const { pago, aplicacion } of aplicaciones) {

                if (!enRango(pago.fecha, desde, hasta)) {
                    continue;
                }

                cuantosPagos++;
                recibido = recibido.sumar(pago.monto);

                gastos = gastos.sumar(aplicacion.gastos);
                mora = mora.sumar(aplicacion.interesMoratorio);
                corriente = corriente.sumar(aplicacion.interesCorriente);
                capital = capital.sumar(aplicacion.capital);
                excedente = excedente.sumar(aplicacion.excedente);
            }
        }

        return {
            id,
            tipo,
            desde: aTexto(desde),
            hasta: aTexto(hasta),
            desembolsos: {
                cantidad: cuantosDesembolsos,
                monto: desembolsado.obtenerValor()
            },
            pagos: {
                cantidad: cuantosPagos,
                monto: recibido.obtenerValor()
            },
            recuperaciones: {
                gastos: gastos.obtenerValor(),
                interesMoratorio: mora.obtenerValor(),
                interesCorriente: corriente.obtenerValor(),
                capital: capital.obtenerValor(),
                excedenteACapital: excedente.obtenerValor(),
                total: recibido.obtenerValor()
            },
            // Dinero modela un IMPORTE, que nunca es negativo, y aqui
            // hace falta una magnitud con SIGNO: en un mes de crecimiento
            // se presta mas de lo que entra. La resta se hace sobre
            // centavos enteros, que son exactos, y solo al final se pasa a
            // quetzales para el contrato.
            flujoNeto:
                (recibido.obtenerCentavos()
                    - desembolsado.obtenerCentavos()) / 100
        };
    }

    /**
     * Capacidad 8: registrar un pago. LA UNICA SENSIBLE.
     *
     * Aplica la prelacion y la idempotencia del Proyecto 1. Ejercita OP-1,
     * OP-2, OP-4, OP-5 y OP-6.
     *
     * APROBACION HUMANA. Con `confirmado` en falso —el valor por
     * omision— no toca nada: calcula el desglose y lo devuelve como vista
     * previa. El asistente lo muestra, la persona aprueba, y solo
     * entonces se vuelve a llamar con `confirmado` en verdadero. El paso
     * no es un adorno: es lo que impide que el modelo mueva dinero por su
     * cuenta.
     *
     * MONTO EXACTO. El monto debe ser el total adeudado de TODAS las
     * cuotas exigibles al corte, porque es sobre ese total que opera la
     * cadena de prelacion (P1 6.6.2). Pagarlo exacto deja el credito sin
     * cuotas vencidas y lo regulariza a VIGENTE, que es la poscondicion
     * del escenario de pago exacto (P1 6.6.3). Un monto distinto se
     * rechaza diciendo cual es el correcto.
     *
     * No se aceptan pagos parciales por esta via a proposito. El nucleo
     * sabe aplicarlos (P1 6.6.4), pero un parcial es una decision de
     * negocio que el asesor toma en ventanilla con el cliente delante, no
     * algo que convenga delegar a un chat.
     */
    public async registrarPago(
        idCredito: string,
        monto: number,
        claveIdempotencia: string,
        fechaOperacion: Date,
        canal: string,
        confirmado: boolean
    ): Promise<ResultadoPago> {

        const { credito, plan, registro } =
            await this.reconstruirCredito(idCredito);

        plan.actualizarEstado(fechaOperacion);

        const cliente = await this.repositorio.obtenerCliente(
            registro.idCliente
        );

        const nombreCliente = cliente?.nombreCompleto ?? "(desconocido)";

        const antes = this.resumirEstado(credito, plan, fechaOperacion);

        // --- Idempotencia PRIMERO (OP-4) -------------------------------
        //
        // Antes de validar cualquier regla de negocio. Una clave repetida
        // significa que esa operacion ya se registro, y el reintento debe
        // devolver ese mismo desenlace SIN IMPORTAR como haya cambiado la
        // cartera desde entonces: para eso existe la clave.
        //
        // Ponerlo despues de las validaciones rompia justo el caso que
        // importa. Al reintentar el pago que ya se aplico, el credito ya
        // no tiene cuotas vencidas, asi que el reintento moria con un
        // "no hay deuda exigible" en vez del "ya estaba registrado, no se
        // volvio a cobrar" que el reintento necesita oir.
        const yaRegistrado = (await this.repositorio.listarPagos())
            .find(pago => pago.claveIdempotencia === claveIdempotencia);

        if (yaRegistrado) {
            return {
                aplicado: false,
                duplicado: true,
                idCredito,
                nombreCliente,
                fechaOperacion: aTexto(fechaOperacion),
                claveIdempotencia,
                montoRecibido: yaRegistrado.monto.obtenerValor(),
                // En ESTA llamada no se imputo nada: el desglose va en
                // cero y sin cuotas, que es exactamente lo que ocurrio.
                cuotasCubiertas: [],
                desglosePrelacion: {
                    gastos: 0,
                    interesMoratorio: 0,
                    interesCorriente: 0,
                    capital: 0,
                    total: 0
                },
                estadoAntes: antes,
                mensaje:
                    `La clave ${claveIdempotencia} ya se habia registrado `
                    + `el ${aTexto(yaRegistrado.fecha)} por `
                    + `Q${yaRegistrado.monto.obtenerValor().toFixed(2)} `
                    + `(credito ${yaRegistrado.idCredito}, canal `
                    + `${yaRegistrado.canal}). El pago NO se volvio a `
                    + "aplicar y el saldo no se movio."
            };
        }

        // --- Rechazo 1: el credito es incobrable (OP-6) -----------------
        //
        // Se rechaza tanto si ya se declaro la baja como si el atraso ya
        // supera los 120 dias y la baja esta pendiente.
        //
        // Lo segundo es deliberado. Declarar incobrable es una decision
        // contable y el nucleo nunca la toma solo (P1 6.7), asi que un
        // credito de 130 dias sigue en estado EN_MORA y tecnicamente
        // admite pagos. Pero cobrarle por la via normal lo mantendria en
        // la cartera cuando las reglas exigen darlo de baja, y
        // clasificaria el dinero como recuperacion corriente en vez de
        // RECUPERACION DE INCOBRABLE, que va en cuenta separada y la
        // gestiona la casa de cobro (P1 6.7). Ante esa duda, una
        // herramienta automatica no cobra: avisa.
        const superaPlazo = ConsultasCartera.CLASIFICADOR
            .superaPlazoParaIncobrable(antes.diasAtraso);

        if (antes.estado === NombreEstado.INCOBRABLE || superaPlazo) {

            const yaDeclarado = antes.estado === NombreEstado.INCOBRABLE;

            throw new ErrorConsulta(
                "CREDITO_INCOBRABLE",
                yaDeclarado
                    ? `El credito ${idCredito} esta declarado incobrable: `
                        + "su cobro va por la casa de cobro externa y se "
                        + "registra como recuperacion de incobrable, en "
                        + "cuenta separada."
                    : `El credito ${idCredito} lleva ${antes.diasAtraso} `
                        + "dias de atraso y supera los 120 que obligan a "
                        + "la baja contable. No se puede recibir un pago "
                        + "corriente mientras la baja este pendiente.",
                {
                    diasAtraso: antes.diasAtraso,
                    estado: antes.estado,
                    bajaPendiente: !yaDeclarado
                }
            );
        }

        // --- Rechazo 2: no hay nada exigible ---------------------------
        const exigibles = plan.cuotasExigibles(fechaOperacion);

        if (exigibles.length === 0) {
            throw new ErrorConsulta(
                "CUOTA_YA_PAGADA",
                `El credito ${idCredito} no tiene cuotas vencidas al `
                + `${aTexto(fechaOperacion)}: no hay deuda exigible que `
                + "pagar.",
                { cuotasVencidas: 0 }
            );
        }

        const deuda = plan.calcularTotalAdeudado(fechaOperacion);

        const desglose: DesglosePrelacion = {
            gastos: deuda.gastos.obtenerValor(),
            interesMoratorio: deuda.interesMoratorio.obtenerValor(),
            interesCorriente: deuda.interesCorriente.obtenerValor(),
            capital: deuda.capital.obtenerValor(),
            total: deuda.total().obtenerValor()
        };

        const cuotasCubiertas = exigibles.map(cuota => cuota.numero);

        // --- Rechazo 3: el monto no es exacto (OP-5) -------------------
        //
        // La comparacion se hace sobre centavos enteros. Comparar
        // decimales con === es justamente el error que el Proyecto 1
        // corrigio al representar el dinero en centavos.
        const recibido = Dinero.desde(monto);

        if (recibido.obtenerCentavos() !== deuda.total().obtenerCentavos()) {
            throw new ErrorConsulta(
                "MONTO_NO_EXACTO",
                `El monto Q${monto.toFixed(2)} no corresponde a la deuda `
                + `del credito ${idCredito} al `
                + `${aTexto(fechaOperacion)}. El monto correcto es `
                + `Q${desglose.total.toFixed(2)}.`,
                {
                    montoRecibido: recibido.obtenerValor(),
                    montoCorrecto: desglose.total,
                    diferencia:
                        (recibido.obtenerCentavos()
                            - deuda.total().obtenerCentavos()) / 100,
                    desglosePrelacion: desglose,
                    cuotasCubiertas
                }
            );
        }

        const comun = {
            idCredito,
            nombreCliente,
            fechaOperacion: aTexto(fechaOperacion),
            claveIdempotencia,
            montoRecibido: recibido.obtenerValor(),
            cuotasCubiertas,
            desglosePrelacion: desglose,
            estadoAntes: antes
        };

        // --- Vista previa: aqui se detiene si nadie aprobo (OP-1) ------
        if (!confirmado) {
            return {
                ...comun,
                aplicado: false,
                duplicado: false,
                mensaje:
                    `Vista previa. Q${desglose.total.toFixed(2)} saldaria `
                    + `${cuotasCubiertas.length} cuota(s) vencida(s) del `
                    + `credito ${idCredito} y lo regularizaria. Requiere `
                    + "aprobacion humana: vuelva a llamar con confirmado "
                    + "en verdadero para aplicarlo."
            };
        }

        // --- Registro del evento, idempotente por clave (OP-4) --------
        const resultado = await this.repositorio.registrarPago({
            claveIdempotencia,
            idCredito,
            fecha: fechaOperacion,
            monto: recibido,
            canal
        });

        // Red de seguridad: la comprobacion de arriba ya filtro las
        // claves repetidas, pero el puerto vuelve a verificarlo al
        // escribir. Si dos llamadas con la misma clave entran a la vez,
        // la segunda llega aqui y tampoco cobra dos veces.
        if (resultado.duplicado) {
            return {
                ...comun,
                aplicado: false,
                duplicado: true,
                mensaje:
                    `La clave ${claveIdempotencia} ya se habia registrado `
                    + `el ${aTexto(resultado.pago.fecha)} por `
                    + `Q${resultado.pago.monto.obtenerValor().toFixed(2)}. `
                    + "El pago NO se volvio a aplicar y el saldo no se "
                    + "movio."
            };
        }

        // El estado posterior se lee de una reconstruccion NUEVA, que ya
        // incluye el evento recien registrado. No se parchea el plan que
        // quedo en memoria: la cartera se deriva de los eventos, siempre.
        const despues = await this.reconstruirCredito(idCredito);
        despues.plan.actualizarEstado(fechaOperacion);

        return {
            ...comun,
            aplicado: true,
            duplicado: false,
            estadoDespues: this.resumirEstado(
                despues.credito,
                despues.plan,
                fechaOperacion
            ),
            mensaje:
                `Pago de Q${desglose.total.toFixed(2)} aplicado al credito `
                + `${idCredito}. Saldo ${cuotasCubiertas.length} cuota(s) `
                + "vencida(s)."
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

    private resumirEstado(
        credito: Credito,
        plan: PlanAmortizacion,
        fechaCorte: Date
    ): ResumenEstadoCredito {

        const diasAtraso = plan.diasAtrasoMaximo(fechaCorte);

        return {
            estado: credito.nombreEstado(),
            tramo: ConsultasCartera.CLASIFICADOR.clasificar(diasAtraso),
            diasAtraso,
            saldoCapital: credito.saldoCapital.obtenerValor(),
            cuotasVencidas: plan.cuotasExigibles(fechaCorte).length
        };
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

/**
 * Si una fecha cae dentro del rango, con ambos extremos incluidos.
 *
 * Se compara por dias calendario y no por milisegundos: un pago del 31 de
 * octubre pertenece al cierre de octubre sin importar la hora.
 */
function enRango(fecha: Date, desde: Date, hasta: Date): boolean {
    return differenceInCalendarDays(fecha, desde) >= 0
        && differenceInCalendarDays(hasta, fecha) >= 0;
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
