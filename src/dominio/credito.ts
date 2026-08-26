import { Dinero } from "./dinero";
import { NombreEstado } from "./nombre-estado";
import { PoliticaCredito } from "./politica-credito";
import { EstadoCredito, SituacionCredito } from "./estados/estado-credito";
import { Vigente } from "./estados/estados-credito";

export class Credito {

    /**
     * Estado actual como OBJETO, no como enum. El credito delega en el las
     * transiciones; no hay ningun setter que permita saltar a un estado
     * arbitrario (patron State, seccion 6.7).
     */
    private estado: EstadoCredito;

    /**
     * Marca permanente de reestructuracion.
     *
     * "La reestructuracion NO borra el pasado": el estado puede volver a
     * vigente, pero el credito sigue contando como cartera en riesgo (6.8).
     * Por eso la marca es un dato aparte del estado.
     */
    private reestructuradoAlgunaVez = false;

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
        public readonly fechaDesembolso: Date,

        estadoInicial: EstadoCredito = new Vigente()

    ) {

        if (!Number.isInteger(plazoMeses) || plazoMeses <= 0) {
            throw new Error("El plazo debe ser un numero entero de meses mayor a cero.");
        }

        this.estado = estadoInicial;
    }

    // ------------------------------------------------------------------
    // Eventos del ciclo de vida: se delegan al estado actual
    // ------------------------------------------------------------------

    public aprobar(): void {
        this.estado = this.estado.aprobar();
    }

    public rechazar(): void {
        this.estado = this.estado.rechazar();
    }

    public desembolsar(): void {
        this.estado = this.estado.desembolsar();
    }

    public anular(): void {
        this.estado = this.estado.anular();
    }

    public registrarPago(situacion: SituacionCredito): void {
        this.estado = this.estado.registrarPago(situacion);
    }

    public evaluarAlCorte(situacion: SituacionCredito): void {
        this.estado = this.estado.evaluarAlCorte(situacion);
    }

    public reestructurar(): void {
        this.estado = this.estado.reestructurar();
        this.reestructuradoAlgunaVez = true;
    }

    public declararIncobrable(diasAtraso: number): void {
        this.estado = this.estado.declararIncobrable(diasAtraso);
    }

    // ------------------------------------------------------------------
    // Consultas
    // ------------------------------------------------------------------

    public obtenerEstado(): EstadoCredito {
        return this.estado;
    }

    public nombreEstado(): NombreEstado {
        return this.estado.nombre;
    }

    public admitePagos(): boolean {
        return this.estado.admitePagos();
    }

    public estaMarcadoReestructurado(): boolean {
        return this.reestructuradoAlgunaVez;
    }

    public estaCancelado(): boolean {
        return this.estado.nombre === NombreEstado.CANCELADO;
    }

    public estaEnMora(): boolean {
        return this.estado.nombre === NombreEstado.EN_MORA;
    }

    public actualizarSaldo(nuevoSaldo: Dinero): void {
        this.saldoCapital = nuevoSaldo;
    }
}
