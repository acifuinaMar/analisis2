import { Credito } from "./credito";
import { Cuota } from "./cuota";
import { Pago } from "./pago";
import { AplicacionPago } from "./aplicacion-pago";
import { Dinero } from "./dinero";
import { RubrosAdeudados } from "./rubros-adeudados";
import { TransicionInvalida } from "./estados/estado-credito";
import { EstrategiaCalculo } from "../estrategias/estrategia-calculo";
import {
    PoliticaAdelanto,
    AmortizacionACapital
} from "../estrategias/politica-adelanto";
import { CalculadoraMora } from "../servicios/calculadora-mora";
import { PrelacionPago } from "../servicios/prelacion-pago";

/**
 * Experto de informacion del modulo de calculo financiero (GRASP).
 *
 * Concentra el plan, sus cuotas y el credito, asi que le toca coordinar el
 * registro de un pago. Coordinar, no calcular: la mora la calcula
 * CalculadoraMora, el orden lo decide la cadena de prelacion, el destino
 * del excedente lo resuelve la politica de adelanto y el estado lo decide
 * el propio estado del credito.
 *
 * Todas esas piezas llegan por constructor, no se crean aqui adentro
 * (Inversion de Dependencias).
 */
export class PlanAmortizacion {

    private cuotas: Cuota[] = [];

    constructor(

        private readonly credito: Credito,

        private readonly estrategia: EstrategiaCalculo,

        private readonly calculadoraMora: CalculadoraMora =
            new CalculadoraMora(credito.politica),

        private readonly prelacion: PrelacionPago = new PrelacionPago(),

        private readonly politicaAdelanto: PoliticaAdelanto =
            new AmortizacionACapital()

    ) {}

    public generarPlan(): Cuota[] {
        this.cuotas = this.estrategia.generarPlan(this.credito);
        this.recalcularSaldo();
        return this.obtenerCuotas();
    }

    // ------------------------------------------------------------------
    // Registro de pagos (6.6)
    // ------------------------------------------------------------------

    /**
     * Aplica un pago a la fecha de corte indicada.
     *
     * 1. Identifica las cuotas exigibles, de la mas antigua a la mas nueva.
     * 2. Arma los rubros adeudados, calculando la mora cuota por cuota.
     * 3. Delega el ORDEN a la cadena de prelacion.
     * 4. Imputa lo aplicado a las cuotas.
     * 5. Coloca el excedente segun la politica de adelanto.
     * 6. Recalcula el saldo y actualiza el estado del credito.
     */
    public aplicarPago(pago: Pago, fechaCorte: Date): AplicacionPago {

        // El estado decide si admite pagos; aqui solo se le pregunta antes
        // de tocar nada, para no dejar cuotas a medio modificar.
        if (!this.credito.admitePagos()) {
            throw new TransicionInvalida(
                this.credito.nombreEstado(),
                "registrarPago"
            );
        }

        const exigibles = this.cuotasExigibles(fechaCorte);

        const deuda = this.calcularDeuda(exigibles, fechaCorte);

        const aplicacion = this.prelacion.aplicar(pago.monto, deuda);

        this.imputar(exigibles, aplicacion);

        if (aplicacion.hayExcedente()) {
            this.politicaAdelanto.aplicar(
                this.cuotasNoSaldadas(),
                aplicacion.excedente
            );
        }

        this.recalcularSaldo();
        this.actualizarEstado(fechaCorte);

        return aplicacion;
    }

    /**
     * El saldo no se sobrescribe: se deriva de acumular lo amortizado
     * (regla de mayor, seccion 6.9). Asi cualquier cifra se puede
     * reconstruir y auditar meses despues.
     */
    public recalcularSaldo(): void {

        const amortizado = this.cuotas.reduce(
            (total, cuota) => total.sumar(cuota.capitalPagado()),
            Dinero.cero(this.credito.monto.obtenerMoneda())
        );

        this.credito.actualizarSaldo(this.credito.monto.restar(amortizado));
    }

    /**
     * Delega la transicion al estado actual del credito (patron State).
     * Aqui no se decide a que estado pasar: solo se le entrega la
     * situacion y el estado responde.
     */
    public actualizarEstado(fechaCorte: Date): void {

        this.credito.evaluarAlCorte({
            saldoEnCero: this.credito.saldoCapital.esCero(),
            diasAtraso: this.diasAtrasoMaximo(fechaCorte)
        });
    }

    // ------------------------------------------------------------------
    // Consultas
    // ------------------------------------------------------------------

    public obtenerCuotas(): Cuota[] {
        return [...this.cuotas];
    }

    /** Atraso de la cuota mas antigua sin saldar: el que clasifica (6.5). */
    public diasAtrasoMaximo(fechaCorte: Date): number {

        return this.cuotas.reduce(
            (maximo, cuota) => Math.max(maximo, cuota.diasAtraso(fechaCorte)),
            0
        );
    }

    /** Vencidas y no saldadas, de la mas antigua a la mas nueva. */
    public cuotasExigibles(fechaCorte: Date): Cuota[] {
        return this.cuotas
            .filter(cuota => cuota.estaVencida(fechaCorte))
            .sort((a, b) => a.numero - b.numero);
    }

    // ------------------------------------------------------------------
    // Reglas internas
    // ------------------------------------------------------------------

    private cuotasNoSaldadas(): Cuota[] {
        return this.cuotas
            .filter(cuota => !cuota.estaSaldada())
            .sort((a, b) => a.numero - b.numero);
    }

    /**
     * Arma los rubros adeudados (6.6.1).
     *
     * La mora se calcula CUOTA POR CUOTA, sobre su propio capital en mora
     * y sus propios dias de atraso: "con dos cuotas vencidas hay dos
     * calculos de moratorio, no uno sobre la suma" (seccion 6.5).
     */
    private calcularDeuda(
        exigibles: Cuota[],
        fechaCorte: Date
    ): RubrosAdeudados {

        const moneda = this.credito.monto.obtenerMoneda();

        let moratorio = Dinero.cero(moneda);
        let corriente = Dinero.cero(moneda);
        let capital = Dinero.cero(moneda);

        for (const cuota of exigibles) {

            moratorio = moratorio.sumar(
                this.calculadoraMora.calcular(
                    cuota.capitalPendiente(),
                    cuota.diasAtraso(fechaCorte)
                )
            );

            corriente = corriente.sumar(cuota.interesPendiente());
            capital = capital.sumar(cuota.capitalPendiente());
        }

        return new RubrosAdeudados(
            // Los gastos por servicios efectivamente prestados los define
            // la politica; en el caso de referencia no hay ninguno.
            Dinero.cero(moneda),
            moratorio,
            corriente,
            capital
        );
    }

    /**
     * Reparte lo aplicado entre las cuotas, de la mas antigua a la mas
     * nueva. La mora no se imputa a la cuota: es un ingreso aparte y no
     * reduce ni capital ni interes pactado.
     */
    private imputar(exigibles: Cuota[], aplicacion: AplicacionPago): void {

        let interes = aplicacion.interesCorriente;
        let capital = aplicacion.capital;

        for (const cuota of exigibles) {

            const aInteres = Dinero.minimo(interes, cuota.interesPendiente());
            const aCapital = Dinero.minimo(capital, cuota.capitalPendiente());

            cuota.abonar(aCapital, aInteres);

            interes = interes.restar(aInteres);
            capital = capital.restar(aCapital);
        }
    }
}
