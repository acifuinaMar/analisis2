import { Dinero } from "./dinero";

export class Pago {

    constructor(

        public readonly monto: Dinero,

        public readonly fecha: Date,

        public readonly medioPago: string,

        public readonly referencia?: string

    ) {}

}