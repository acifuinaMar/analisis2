import { Dinero } from "./dinero";

export class Credito {

    constructor(

        public readonly id: string,

        public readonly monto: Dinero,

        public saldoCapital: Dinero,

        public readonly tasaAnual: number,
        //lo cambiaremos más adelante, pero ahorita solo es para el E4... so it´s okay
        public estado: string

    ) {}

    public actualizarEstado(nuevoEstado: string): void {
        this.estado = nuevoEstado;
    }

    public actualizarSaldo(nuevoSaldo: Dinero): void {
        this.saldoCapital = nuevoSaldo;
    }

    public estaCancelado(): boolean {
        return this.estado === "cancelado";
    }

    public estaEnMora(): boolean {
        return this.estado === "en_mora";
    }
}