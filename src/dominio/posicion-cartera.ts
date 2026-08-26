import { Dinero } from "./dinero";
import { EstadoCredito } from "./estado-credito";

/**
 * Foto de un credito a una fecha de corte, usada para medir la calidad
 * de la cartera (seccion 6.8).
 *
 * No es el credito completo: es la proyeccion minima que responde la
 * pregunta "este credito esta en riesgo?". Un cierre congela las cifras
 * del periodo (seccion 6.9), asi que trabajar sobre una foto inmutable
 * es lo que hace el calculo idempotente.
 *
 * Es el Information Expert de su propio riesgo: tiene los tres datos que
 * deciden la respuesta, asi que la respuesta vive aqui.
 */
export class PosicionCartera {

    /** Un credito entra en riesgo al superar este atraso (seccion 6.8). */
    private static readonly DIAS_PARA_RIESGO = 30;

    constructor(

        public readonly creditoId: string,

        public readonly saldoCapital: Dinero,

        public readonly diasAtraso: number,

        public readonly estado: EstadoCredito,

        /**
         * Marca permanente de reestructuracion.
         *
         * Ojo: NO es lo mismo que estado === REESTRUCTURADO. El estado
         * vuelve a VIGENTE cuando el cliente cumple su nuevo plan, pero
         * la marca no se borra: "la reestructuracion NO borra el pasado"
         * (seccion 6.7). Por eso son dos cosas distintas.
         */
        public readonly marcadoReestructurado: boolean = false

    ) {

        if (!Number.isInteger(diasAtraso)) {
            throw new Error("Los dias de atraso deben ser un numero entero.");
        }

        if (diasAtraso < 0) {
            throw new Error("Los dias de atraso no pueden ser negativos.");
        }
    }

    /**
     * Un credito declarado incobrable ya salio de la cartera (seccion 6.8);
     * uno cancelado tampoco tiene saldo que arriesgar.
     */
    public estaActiva(): boolean {
        return this.estado !== EstadoCredito.INCOBRABLE
            && this.estado !== EstadoCredito.CANCELADO;
    }

    /**
     * Entra en riesgo si supera los 30 dias de atraso O si fue
     * reestructurado, aunque este al dia.
     */
    public estaEnRiesgo(): boolean {

        if (!this.estaActiva()) {
            return false;
        }

        return this.diasAtraso > PosicionCartera.DIAS_PARA_RIESGO
            || this.marcadoReestructurado;
    }

    /** Devuelve una copia dada de baja; la original no se altera. */
    public comoIncobrable(): PosicionCartera {
        return new PosicionCartera(
            this.creditoId,
            this.saldoCapital,
            this.diasAtraso,
            EstadoCredito.INCOBRABLE,
            this.marcadoReestructurado
        );
    }
}
