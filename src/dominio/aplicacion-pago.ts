import { Dinero } from "./dinero";

export class AplicacionPago {

    constructor(

        public readonly gastos: Dinero,

        public readonly interesMoratorio: Dinero,

        public readonly interesCorriente: Dinero,

        public readonly capital: Dinero,

        public readonly excedente: Dinero

    ) {}

}