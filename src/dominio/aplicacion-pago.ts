import { Dinero } from "./dinero";

/**
 * Resultado de aplicar un pago: cuanto se imputo a cada rubro y cuanto
 * quedo como excedente (seccion 6.6).
 *
 * Es un Objeto de Valor inmutable. Deja registrado a que correspondio cada
 * quetzal recibido, que es lo que exige la regla de cargos justificados:
 * el modelo de Pago debe poder demostrar a que corresponde cada cargo
 * (seccion 6.3.1).
 */
export class AplicacionPago {

    constructor(

        public readonly gastos: Dinero,

        public readonly interesMoratorio: Dinero,

        public readonly interesCorriente: Dinero,

        public readonly capital: Dinero,

        public readonly excedente: Dinero

    ) {}

    /** Lo efectivamente imputado a deuda, sin contar el excedente. */
    public totalAplicado(): Dinero {
        return this.gastos
            .sumar(this.interesMoratorio)
            .sumar(this.interesCorriente)
            .sumar(this.capital);
    }

    /**
     * Todo lo recibido: lo aplicado mas el excedente.
     * Debe coincidir siempre con el monto del pago; nada se pierde.
     */
    public totalRecibido(): Dinero {
        return this.totalAplicado().sumar(this.excedente);
    }

    public hayExcedente(): boolean {
        return !this.excedente.esCero();
    }
}
