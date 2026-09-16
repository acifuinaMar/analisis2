import { Dinero } from "./dinero";

/**
 * Gasto de gestion de cobro en campo (CP-02, seccion 7.5).
 *
 * Es la visita del asesor al domicilio o negocio del cliente moroso: un
 * servicio efectivamente prestado, condicion que exige el articulo 42 del
 * Decreto 19-2002 para poder cobrar una comision. Un cargo sin servicio
 * detras es ilegal, y por eso el gasto se ata a un hecho concreto y
 * fechado, no a un porcentaje.
 *
 * Reglas:
 *   - Q25.00 fijos por cuota vencida.
 *   - Se genera UNA SOLA VEZ, cuando la cuota alcanza 31 dias de atraso
 *     (entrada a Mora 2). En Mora 1 no se cobra: no hubo visita.
 *   - Pasar de Mora 2 a Mora 3 o a Vencido NO genera un gasto nuevo: es
 *     el mismo hecho, no uno distinto.
 *   - Reejecutar el cierre del mismo dia tampoco (invariante de
 *     idempotencia, P1 6.10).
 *
 * El registro de lo generado y lo abonado es un libro de movimientos, no
 * una bandera: el saldo del gasto se deriva de acumularlos, igual que el
 * saldo del credito (regla de mayor, P1 6.9). Asi el cierre se puede
 * reconstruir y auditar despues.
 */
export class GastoGestionCobro {

    /** Monto fijo por cuota vencida (politica institucional). */
    private static readonly MONTO_POR_CUOTA = 25.00;

    /** Dia en que la cuota entra a Mora 2 y se genera la visita. */
    private static readonly DIA_DE_GENERACION = 31;

    private readonly generados = new Map<string, Dinero>();

    private readonly abonados = new Map<string, Dinero>();

    public static montoPorCuota(): Dinero {
        return Dinero.desde(GastoGestionCobro.MONTO_POR_CUOTA);
    }

    public static diaDeGeneracion(): number {
        return GastoGestionCobro.DIA_DE_GENERACION;
    }

    /**
     * Evalua una cuota a la fecha de corte y genera el gasto si procede.
     *
     * IDEMPOTENTE: llamarla dos veces el mismo dia, o cien dias seguidos,
     * genera el gasto una sola vez. Devuelve lo que se genero en ESTA
     * llamada (cero si no procedia o si ya existia), para que el cierre
     * pueda reportar el movimiento del periodo.
     */
    public evaluarAlCorte(
        claveCuota: string,
        diasAtraso: number
    ): Dinero {

        if (!Number.isInteger(diasAtraso) || diasAtraso < 0) {
            throw new Error(
                "Los dias de atraso deben ser un entero no negativo."
            );
        }

        if (diasAtraso < GastoGestionCobro.DIA_DE_GENERACION) {
            return Dinero.cero();
        }

        if (this.generados.has(claveCuota)) {
            return Dinero.cero();
        }

        const monto = GastoGestionCobro.montoPorCuota();

        this.generados.set(claveCuota, monto);

        return monto;
    }

    /** Lo generado historicamente para esta cuota, este pagado o no. */
    public generadoPara(claveCuota: string): Dinero {
        return this.generados.get(claveCuota) ?? Dinero.cero();
    }

    public abonadoPara(claveCuota: string): Dinero {
        return this.abonados.get(claveCuota) ?? Dinero.cero();
    }

    /** Lo que la cuota todavia debe por concepto de gasto. */
    public pendientePara(claveCuota: string): Dinero {
        return this.generadoPara(claveCuota)
            .restar(this.abonadoPara(claveCuota));
    }

    /** Registra un abono al gasto. Nunca acepta mas de lo pendiente. */
    public abonar(claveCuota: string, monto: Dinero): void {

        if (monto.esMayorQue(this.pendientePara(claveCuota))) {
            throw new Error(
                `El abono al gasto de gestion de la cuota ${claveCuota} `
                + "excede su saldo pendiente."
            );
        }

        this.abonados.set(
            claveCuota,
            this.abonadoPara(claveCuota).sumar(monto)
        );
    }

    /** Total generado en la vida del credito, para el cierre. */
    public totalGenerado(): Dinero {
        return [...this.generados.values()].reduce(
            (total, monto) => total.sumar(monto),
            Dinero.cero()
        );
    }

    public cuotasConGasto(): number {
        return this.generados.size;
    }
}
