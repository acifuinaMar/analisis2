import { Dinero } from "./dinero";

export class Cuota {

    constructor(

        public readonly numero: number,

        public readonly capital: Dinero,

        public readonly interes: Dinero,

        public readonly fechaVencimiento: Date,
        //String para empezar, podria cambiarse a Enum 
        public estado: string = "pendiente"

    ) {}

    public marcarPagada(): void {
        this.estado = "pagada";
    }

    public estaPendiente(): boolean {
        return this.estado === "pendiente";
    }

    public estaPagada(): boolean {
        return this.estado === "pagada";
    }

}