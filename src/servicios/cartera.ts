import { Dinero } from "../dominio/dinero";
import { PosicionCartera } from "../dominio/posicion-cartera";
import { ClasificadorTramoMora, TramoMora } from "../dominio/tramo-mora";

/**
 * Resultado de medir la cartera a una fecha de corte.
 *
 * El enunciado es explicito: "el porcentaje de cartera en riesgo nunca se
 * reporta solo: debe ir acompaniado de cuanto se dio por incobrable en el
 * periodo" (seccion 6.8). Por eso el reporte lleva las dos cifras juntas
 * y no se puede leer una sin la otra.
 */
/**
 * Categoria con la que un credito entra a la cartera en riesgo (CP-04.3).
 *
 * Son los cuatro tramos de mora mas una quinta: el credito reestructurado
 * que esta al dia. Ese no tiene atraso, pero entra igual porque "la
 * reestructuracion NO borra el pasado" (P1 6.7).
 */
export enum CategoriaRiesgo {

    MORA_1 = "mora_1",

    MORA_2 = "mora_2",

    MORA_3 = "mora_3",

    VENCIDO = "vencido",

    REESTRUCTURADO_AL_DIA = "reestructurado_al_dia"

}

/** Una fila del desglose que consume el tablero gerencial. */
export interface FilaDesglose {

    readonly categoria: CategoriaRiesgo;

    readonly creditos: number;

    readonly saldo: Dinero;

    /** Proporcion sobre la cartera activa, entre 0 y 1. */
    readonly porcentaje: number;

}

export interface ReporteCartera {

    readonly carteraActiva: Dinero;

    readonly montoEnRiesgo: Dinero;

    readonly porcentajeEnRiesgo: number;

    readonly dadoPorIncobrable: Dinero;

    /**
     * Cartera en MORA: todo credito con al menos un dia de atraso.
     * Es un indicador distinto del de riesgo y mide otra cosa. Mostrarlos
     * sin identificar cual es lleva al comite a decidir sobre el numero
     * equivocado (seccion 7.8).
     */
    readonly carteraEnMora: Dinero;

    readonly porcentajeEnMora: number;

    /** Desglose de la cartera en riesgo por tramo (CP-04.3). */
    readonly desglosePorTramo: ReadonlyArray<FilaDesglose>;

}

/**
 * Calidad de la cartera (seccion 6.8).
 *
 * Es inmutable: declarar un credito incobrable devuelve una cartera nueva
 * en vez de mutar la actual, de modo que la foto del corte anterior sigue
 * siendo reproducible.
 */
export class Cartera {

    private static readonly CLASIFICADOR = new ClasificadorTramoMora();

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

        return this.proporcionSobreActiva(this.montoEnRiesgo());
    }

    /**
     * Cartera en MORA: todo credito activo con al menos un dia de atraso.
     *
     * No es lo mismo que la cartera en riesgo. La mora es un indicador
     * OPERATIVO —quien no pago a tiempo— y la de riesgo es ESTRATEGICO
     * —quien probablemente no pague—. Sobre la cartera de referencia dan
     * 21.75 % y 7.00 % respectivamente: ambos correctos, midiendo cosas
     * distintas (seccion 7.8).
     */
    public carteraEnMora(): Dinero {
        return this.sumarSaldos(
            this.posiciones.filter(
                posicion => posicion.estaActiva() && posicion.diasAtraso >= 1
            )
        );
    }

    public porcentajeEnMora(): number {
        return this.proporcionSobreActiva(this.carteraEnMora());
    }

    /**
     * Desglose de la cartera en riesgo por tramo (CP-04.3).
     *
     * El tablero gerencial CONSUME este desglose; no lo recalcula. Si lo
     * recalculara en la interfaz habria dos fuentes de verdad para la
     * misma cifra, y dos fuentes de verdad siempre divergen.
     */
    public desglosePorTramo(): ReadonlyArray<FilaDesglose> {

        const categorias = [
            CategoriaRiesgo.MORA_1,
            CategoriaRiesgo.MORA_2,
            CategoriaRiesgo.MORA_3,
            CategoriaRiesgo.VENCIDO,
            CategoriaRiesgo.REESTRUCTURADO_AL_DIA
        ];

        return categorias.map(categoria => {

            const delTramo = this.posiciones.filter(
                posicion => posicion.estaEnRiesgo()
                    && this.categoriaDe(posicion) === categoria
            );

            const saldo = this.sumarSaldos(delTramo);

            return {
                categoria,
                creditos: delTramo.length,
                saldo,
                porcentaje: this.proporcionSobreActiva(saldo)
            };
        });
    }

    /**
     * En que categoria de riesgo cae una posicion.
     *
     * Un credito entra a riesgo por superar los 30 dias O por estar
     * reestructurado. Si tiene atraso, manda su tramo; si esta al dia y
     * entro solo por la marca, va a su propia categoria.
     */
    private categoriaDe(posicion: PosicionCartera): CategoriaRiesgo {

        const tramo = Cartera.CLASIFICADOR.clasificar(posicion.diasAtraso);

        switch (tramo) {
            case TramoMora.MORA_1:
                return CategoriaRiesgo.MORA_1;
            case TramoMora.MORA_2:
                return CategoriaRiesgo.MORA_2;
            case TramoMora.MORA_3:
                return CategoriaRiesgo.MORA_3;
            case TramoMora.VENCIDO:
                return CategoriaRiesgo.VENCIDO;
            case TramoMora.AL_DIA:
                return CategoriaRiesgo.REESTRUCTURADO_AL_DIA;
        }
    }

    private proporcionSobreActiva(monto: Dinero): number {

        const activa = this.carteraActiva();

        if (activa.esCero()) {
            return 0;
        }

        return monto.obtenerCentavos() / activa.obtenerCentavos();
    }

    public generarReporte(): ReporteCartera {
        return {
            carteraActiva: this.carteraActiva(),
            montoEnRiesgo: this.montoEnRiesgo(),
            porcentajeEnRiesgo: this.porcentajeEnRiesgo(),
            dadoPorIncobrable: this.dadoPorIncobrable(),
            carteraEnMora: this.carteraEnMora(),
            porcentajeEnMora: this.porcentajeEnMora(),
            desglosePorTramo: this.desglosePorTramo()
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
