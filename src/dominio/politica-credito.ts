/**
 * Base de conteo de dias para el calculo de mora (seccion 6.3).
 * La institucion declara cual usa; cambiarla cambia el resultado.
 */
export enum BaseConteo {

    ACTUAL_360 = 360,

    ACTUAL_365 = 365

}

/**
 * Politica de credito vigente: tasas y convenciones de conteo.
 *
 * Seccion 6.3.1: "la tasa es un parametro de la politica de credito
 * -- versionado, con validacion de razonabilidad y con autor y fecha --
 * nunca una constante en el codigo".
 *
 * Un credito se calcula con la politica vigente en su fecha de otorgamiento,
 * aunque la politica cambie despues. Por eso la politica es inmutable y
 * cada credito guarda una referencia a la suya.
 *
 * Todas las tasas se expresan como TNA (tasa nominal anual) en decimal:
 * 0.36 = 36% anual. La tasa mensual es proporcional, TNA / 12 (seccion 6.3).
 */
export class PoliticaCredito {

    /**
     * Guarda de razonabilidad.
     *
     * En Guatemala NO existe un tope legal general de tasas: se pactan
     * libremente (art. 42, Decreto 19-2002). Este limite NO pretende ser
     * ese tope legal. Es una defensa contra el error de captura mas comun
     * del dominio: escribir 36 queriendo decir 36% (0.36). Sin esta guarda,
     * ese dedazo produce un plan de amortizacion absurdo en silencio.
     *
     * La usura si es delito (art. 276 del Codigo Penal), pero se juzga por
     * desproporcion frente a la prestacion, no por un numero fijo: eso es
     * criterio del comite de credito, no una constante de programa.
     */
    private static readonly TASA_ANUAL_MAXIMA_RAZONABLE = 2.0;

    constructor(

        public readonly version: string,

        /** TNA corriente, en decimal. */
        public readonly tasaAnual: number,

        /** TNA moratoria, en decimal. */
        public readonly tasaMoratoriaAnual: number,

        public readonly baseConteo: BaseConteo,

        public readonly autor: string,

        public readonly fechaVigencia: Date

    ) {

        this.validarTasa(tasaAnual, "corriente");
        this.validarTasa(tasaMoratoriaAnual, "moratoria");

        if (version.trim() === "") {
            throw new Error("La politica debe indicar su version.");
        }

        if (autor.trim() === "") {
            throw new Error("La politica debe indicar su autor.");
        }
    }

    /** Tasa periodica mensual, proporcional: i = TNA / 12 (seccion 6.3). */
    public tasaMensual(): number {
        return this.tasaAnual / 12;
    }

    /** Tasa moratoria diaria: TNA moratoria / base de conteo (seccion 6.3). */
    public tasaMoratoriaDiaria(): number {
        return this.tasaMoratoriaAnual / this.baseConteo;
    }

    /**
     * Descripcion legible para el documento y para la trazabilidad.
     * La seccion 6.3 advierte que "36% anual" no significa nada sin decir
     * si es nominal o efectiva y cual es la base de conteo.
     */
    public describir(): string {
        return `Politica ${this.version} · TNA corriente `
            + `${(this.tasaAnual * 100).toFixed(2)}% · TNA moratoria `
            + `${(this.tasaMoratoriaAnual * 100).toFixed(2)}% · base Actual/`
            + `${this.baseConteo} · ${this.autor} · `
            + this.fechaVigencia.toISOString().slice(0, 10);
    }

    private validarTasa(tasa: number, nombre: string): void {

        if (!Number.isFinite(tasa)) {
            throw new Error(`La tasa ${nombre} debe ser un numero valido.`);
        }

        if (tasa < 0) {
            throw new Error(`La tasa ${nombre} no puede ser negativa.`);
        }

        if (tasa > PoliticaCredito.TASA_ANUAL_MAXIMA_RAZONABLE) {
            throw new Error(
                `La tasa ${nombre} (${tasa}) no supera la validacion de `
                + `razonabilidad. Recuerde expresarla en decimal: `
                + `0.36 equivale a 36% anual.`
            );
        }
    }
}
