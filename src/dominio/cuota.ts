import { Dinero } from "./dinero";
import { EstadoCuota } from "./estado-cuota";

export class Cuota {

    constructor(

        public readonly numero: number,

        public readonly monto: Dinero,

        public readonly capital: Dinero,

        public readonly interes: Dinero,

        public readonly fechaVencimiento: Date,
        
        public estado: EstadoCuota = EstadoCuota.PENDIENTE

    ) {}

    public marcarPagada(): void {
        this.estado = EstadoCuota.PAGADA;
    }

    public estaPendiente(): boolean {
        return this.estado === EstadoCuota.PENDIENTE;
    }

    public estaPagada(): boolean {
        return this.estado === EstadoCuota.PAGADA;
    }

}