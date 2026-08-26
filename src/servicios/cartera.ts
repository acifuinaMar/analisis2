import { Dinero } from "../dominio/dinero";
import { PosicionCartera } from "../dominio/posicion-cartera";

/**
 * Resultado de medir la cartera a una fecha de corte.
 *
 * El enunciado es explicito: "el porcentaje de cartera en riesgo nunca se
 * reporta solo: debe ir acompaniado de cuanto se dio por incobrable en el
 * periodo" (seccion 6.8). Por eso el reporte lleva las dos cifras juntas
 * y no se puede leer una sin la otra.
 */
export interface ReporteCartera {

    readonly carteraActiva: Dinero;

    readonly montoEnRiesgo: Dinero;

    readonly porcentajeEnRiesgo: number;

    readonly dadoPorIncobrable: Dinero;

}

/**
 * Calidad de la cartera (seccion 6.8).
 *
 * Es inmutable: declarar un credito incobrable devuelve una cartera nueva
 * en vez de mutar la actual, de modo que la foto del corte anterior sigue
 * siendo reproducible.
 */
export class Cartera {

    private readonly posiciones: ReadonlyArray<PosicionCartera>;

    constructor(posiciones: ReadonlyArray<PosicionCartera>) {
        this.posiciones = [...posiciones];
    }

    /**
     * Base de comparacion: solo creditos activos. Los declarados
     * incobrables ya salieron de la cartera y NO entran.
     */
    public carteraActiva(): Dinero {
        return this.sumarSaldos(
            this.posiciones.filter(posicion => posicion.estaActiva())
        );
    }

    /**
     * Saldo de capital COMPLETO de cada credito en riesgo, no solo la
     * cuota vencida: si el cliente dejo de pagar, todo su saldo esta en
     * riesgo. No se cuentan intereses.
     */
    public montoEnRiesgo(): Dinero {
        return this.sumarSaldos(
            this.posiciones.filter(posicion => posicion.estaEnRiesgo())
        );
    }

    /** Saldo que ya se dio de baja contable. */
    public dadoPorIncobrable(): Dinero {
        return this.sumarSaldos(
            this.posiciones.filter(posicion => !posicion.estaActiva())
        );
    }

    /**
     * Cartera en riesgo como proporcion entre 0 y 1 (invariante 6.10).
     *
     * La division se hace sobre centavos enteros, que son exactos, y no
     * sobre importes fraccionarios.
     */
    public porcentajeEnRiesgo(): number {

        const activa = this.carteraActiva();

        // Sin cartera activa no hay riesgo que medir: evita dividir entre cero.
        if (activa.esCero()) {
            return 0;
        }

        return this.montoEnRiesgo().obtenerCentavos()
            / activa.obtenerCentavos();
    }

    public generarReporte(): ReporteCartera {
        return {
            carteraActiva: this.carteraActiva(),
            montoEnRiesgo: this.montoEnRiesgo(),
            porcentajeEnRiesgo: this.porcentajeEnRiesgo(),
            dadoPorIncobrable: this.dadoPorIncobrable()
        };
    }

    /**
     * Da de baja un credito y devuelve una cartera NUEVA.
     *
     * Esta operacion es la "trampa" de la seccion 6.8: el indicador mejora
     * sin haber cobrado nada, porque el credito malo sale de las dos sumas.
     * Por eso el reporte obliga a mostrar tambien lo dado por incobrable.
     */
    public declararIncobrable(creditoId: string): Cartera {

        if (!this.posiciones.some(p => p.creditoId === creditoId)) {
            throw new Error(`El credito ${creditoId} no existe en la cartera.`);
        }

        return new Cartera(
            this.posiciones.map(posicion =>
                posicion.creditoId === creditoId
                    ? posicion.comoIncobrable()
                    : posicion
            )
        );
    }

    public obtenerPosiciones(): PosicionCartera[] {
        return [...this.posiciones];
    }

    private sumarSaldos(
        posiciones: ReadonlyArray<PosicionCartera>
    ): Dinero {
        return posiciones.reduce(
            (total, posicion) => total.sumar(posicion.saldoCapital),
            Dinero.cero()
        );
    }
}
