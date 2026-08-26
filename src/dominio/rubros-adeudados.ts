import { Dinero } from "./dinero";

/**
 * Los cuatro conceptos que puede adeudar una cuota vencida (seccion 6.6.1).
 * El orden de declaracion es el orden de prelacion (seccion 6.6.2).
 */
export enum Rubro {

    GASTOS = "gastos",

    INTERES_MORATORIO = "interesMoratorio",

    INTERES_CORRIENTE = "interesCorriente",

    CAPITAL = "capital"

}

/**
 * Lo que se adeuda de una cuota vencida, desglosado por rubro (6.6.1).
 *
 * Es un Objeto de Valor: no tiene identidad ni cambia. Se arma una vez a
 * la fecha de corte y se le entrega a la prelacion.
 */
export class RubrosAdeudados {

    constructor(

        /** Cargos por servicios efectivamente prestados. */
        public readonly gastos: Dinero,

        /** Capital en mora x tasa moratoria diaria x dias de atraso. */
        public readonly interesMoratorio: Dinero,

        /** Interes de la cuota segun la tabla de amortizacion. */
        public readonly interesCorriente: Dinero,

        /** Amortizacion de la cuota segun la tabla. */
        public readonly capital: Dinero

    ) {}

    public obtener(rubro: Rubro): Dinero {

        switch (rubro) {
            case Rubro.GASTOS:
                return this.gastos;
            case Rubro.INTERES_MORATORIO:
                return this.interesMoratorio;
            case Rubro.INTERES_CORRIENTE:
                return this.interesCorriente;
            case Rubro.CAPITAL:
                return this.capital;
        }
    }

    /** Total adeudado de la cuota vencida. */
    public total(): Dinero {
        return this.gastos
            .sumar(this.interesMoratorio)
            .sumar(this.interesCorriente)
            .sumar(this.capital);
    }

    public static ninguno(): RubrosAdeudados {
        return new RubrosAdeudados(
            Dinero.cero(),
            Dinero.cero(),
            Dinero.cero(),
            Dinero.cero()
        );
    }
}
