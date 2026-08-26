import { differenceInCalendarDays } from "date-fns";

import { Dinero } from "./dinero";
import { EstadoCuota } from "./estado-cuota";

/**
 * Una cuota del plan de amortizacion.
 *
 * Lleva lo pactado (capital e interes segun la tabla) y lo efectivamente
 * abonado. Sin esa segunda parte no habria donde registrar un pago
 * parcial: un abono de Q213.88 sobre Q725.76 de capital no cabe en un
 * estado que solo distingue pendiente de pagada (seccion 6.6.4).
 */
export class Cuota {

    private capitalAbonado: Dinero;

    private interesAbonado: Dinero;

    constructor(

        public readonly numero: number,

        public readonly monto: Dinero,

        public readonly capital: Dinero,

        public readonly interes: Dinero,

        public readonly fechaVencimiento: Date

    ) {
        this.capitalAbonado = Dinero.cero(capital.obtenerMoneda());
        this.interesAbonado = Dinero.cero(interes.obtenerMoneda());
    }

    // ------------------------------------------------------------------
    // Abonos
    // ------------------------------------------------------------------

    /**
     * Registra un abono. Nunca acepta mas de lo pendiente: el excedente
     * es responsabilidad de quien llama, no de la cuota.
     */
    public abonar(capital: Dinero, interes: Dinero): void {

        if (capital.esMayorQue(this.capitalPendiente())) {
            throw new Error(
                `La cuota ${this.numero} no admite un abono a capital `
                + `mayor a su saldo pendiente.`
            );
        }

        if (interes.esMayorQue(this.interesPendiente())) {
            throw new Error(
                `La cuota ${this.numero} no admite un abono a interes `
                + `mayor a su saldo pendiente.`
            );
        }

        this.capitalAbonado = this.capitalAbonado.sumar(capital);
        this.interesAbonado = this.interesAbonado.sumar(interes);
    }

    // ------------------------------------------------------------------
    // Consultas de saldo
    // ------------------------------------------------------------------

    public capitalPagado(): Dinero {
        return this.capitalAbonado;
    }

    public interesPagado(): Dinero {
        return this.interesAbonado;
    }

    public capitalPendiente(): Dinero {
        return this.capital.restar(this.capitalAbonado);
    }

    public interesPendiente(): Dinero {
        return this.interes.restar(this.interesAbonado);
    }

    public totalPendiente(): Dinero {
        return this.capitalPendiente().sumar(this.interesPendiente());
    }

    // ------------------------------------------------------------------
    // Estado: DERIVADO de los abonos, no guardado aparte
    // ------------------------------------------------------------------

    /**
     * El estado se calcula desde los abonos. Guardarlo como campo crearia
     * una segunda fuente de verdad que puede divergir de los montos.
     */
    public obtenerEstado(): EstadoCuota {

        if (this.totalPendiente().esCero()) {
            return EstadoCuota.PAGADA;
        }

        if (this.capitalAbonado.esCero() && this.interesAbonado.esCero()) {
            return EstadoCuota.PENDIENTE;
        }

        return EstadoCuota.PARCIAL;
    }

    public estaSaldada(): boolean {
        return this.obtenerEstado() === EstadoCuota.PAGADA;
    }

    public estaPendiente(): boolean {
        return !this.estaSaldada();
    }

    // ------------------------------------------------------------------
    // Vencimiento y atraso
    // ------------------------------------------------------------------

    /** Ya vencio y todavia debe algo a la fecha de corte. */
    public estaVencida(fechaCorte: Date): boolean {
        return !this.estaSaldada()
            && this.diasAtraso(fechaCorte) >= 1;
    }

    /**
     * Dias calendario entre el vencimiento y la fecha de corte
     * (seccion 6.5). Una cuota saldada no acumula atraso.
     */
    public diasAtraso(fechaCorte: Date): number {

        if (this.estaSaldada()) {
            return 0;
        }

        const dias = differenceInCalendarDays(
            fechaCorte,
            this.fechaVencimiento
        );

        return Math.max(0, dias);
    }
}
