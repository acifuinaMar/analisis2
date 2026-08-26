export enum EstadoCuota {

    /** Sin ningun abono. */
    PENDIENTE = "pendiente",

    /**
     * Recibio un abono que no alcanzo a saldarla.
     *
     * "Un abono que no cubre toda la cuota vencida reduce la deuda pero no
     * regulariza el credito. Debe registrarse igual" (seccion 6.6.4).
     */
    PARCIAL = "parcial",

    /** Capital e interes saldados por completo. */
    PAGADA = "pagada"

}
