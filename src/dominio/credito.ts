import { Dinero } from "./dinero";
import { EstadoCredito } from "./estado-credito";

export class Credito {

    private estado: EstadoCredito;

    constructor(

        public readonly id: string,

        public readonly monto: Dinero,

        public saldoCapital: Dinero,

        public readonly tasaAnual: number,
        
    ) {
        this.estado = EstadoCredito.VIGENTE;
    }

    public obtenerEstado(): EstadoCredito {
        return this.estado;
    }

    public actualizarEstado(nuevoEstado: EstadoCredito): void {
        this.estado = nuevoEstado;
    }

    public actualizarSaldo(nuevoSaldo: Dinero): void {
        this.saldoCapital = nuevoSaldo;
    }

    public estaCancelado(): boolean {
        return this.estado === EstadoCredito.CANCELADO;
    }

    public estaEnMora(): boolean {
        return this.estado === EstadoCredito.EN_MORA;
    }
}