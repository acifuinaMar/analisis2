import { Dinero } from "./dinero";
import { EstadoCredito } from "./estado-credito";
import { PoliticaCredito } from "./politica-credito";

export class Credito {

    private estado: EstadoCredito;

    constructor(

        public readonly id: string,

        public readonly monto: Dinero,

        public saldoCapital: Dinero,

        /**
         * Politica vigente al momento del otorgamiento. El credito se
         * calcula con ella aunque la politica cambie despues (6.3.1).
         */
        public readonly politica: PoliticaCredito,

        public readonly plazoMeses: number,

        /**
         * Fecha en que se entrego el capital. De aqui salen los
         * vencimientos del plan; el nucleo nunca la toma del sistema.
         */
        public readonly fechaDesembolso: Date

    ) {

        if (!Number.isInteger(plazoMeses) || plazoMeses <= 0) {
            throw new Error("El plazo debe ser un numero entero de meses mayor a cero.");
        }

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
