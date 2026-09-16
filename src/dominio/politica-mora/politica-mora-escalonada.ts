import { Dinero } from "../dinero";
import { TramoMora } from "../tramo-mora";
import {
    BaseConteoMora,
    PoliticaMora,
    aplicarTope,
    validarDiasAtraso
} from "./politica-mora";

/**
 * Un tramo de la tabla de la politica escalonada (CP-01, seccion 7.2).
 * Los limites son inclusivos en ambos extremos.
 */
export interface TramoTasa {

    readonly tramo: TramoMora;

    readonly desde: number;

    readonly hasta: number;

    /** TNA moratoria del tramo, en decimal. 0.18 = 18 % anual. */
    readonly tnaMoratoria: number;

}

/**
 * Politica moratoria ESCALONADA por tramo de atraso (CP-01).
 *
 * El comite resolvio distinguir el descuido del deterioro: cada tramo tiene
 * su propia tasa, y cada dia se cobra a la tasa del tramo al que ESE dia
 * pertenece.
 *
 * REGLA CENTRAL (7.3): tramos RECORRIDOS, no tramo actual. Una cuota con 45
 * dias de atraso no estuvo 45 dias en Mora 2: estuvo 30 en Mora 1 y lleva
 * 15 en Mora 2.
 *
 *   interes = SUMA  capital_en_mora x tasa_diaria(tramo) x dias_en_tramo
 *           tramos recorridos
 *
 *   dias_en_tramo(d, ini, fin) = max(0, min(d, fin) - ini + 1)
 */
export class PoliticaMoraEscalonada implements PoliticaMora {

    private readonly tramos: ReadonlyArray<TramoTasa>;

    constructor(

        public readonly version: string,

        tramos: ReadonlyArray<TramoTasa>,

        private readonly baseConteo: BaseConteoMora = BaseConteoMora.ACTUAL_360

    ) {

        if (version.trim() === "") {
            throw new Error("La politica debe indicar su version.");
        }

        if (tramos.length === 0) {
            throw new Error("La politica escalonada requiere al menos un tramo.");
        }

        this.tramos = [...tramos].sort((a, b) => a.desde - b.desde);

        this.validarContinuidad();
    }

    public tasaDiaria(tramo: TramoTasa): number {
        return tramo.tnaMoratoria / this.baseConteo;
    }

    /** Dias que la cuota paso dentro de este tramo (7.3). */
    public diasEnTramo(diasAtraso: number, tramo: TramoTasa): number {
        return Math.max(
            0,
            Math.min(diasAtraso, tramo.hasta) - tramo.desde + 1
        );
    }

    public calcular(capitalEnMora: Dinero, diasAtraso: number): Dinero {

        validarDiasAtraso(diasAtraso);

        if (diasAtraso === 0) {
            return Dinero.cero(capitalEnMora.obtenerMoneda());
        }

        // El acumulado se lleva SIN redondear. El redondeo ocurre una sola
        // vez, al cerrar el calculo de la cuota vencida (7.3): redondear
        // tramo por tramo daria Q18.15 en vez de Q18.14 en el caso M-2, y
        // ese centavo por cuota es un descuadre contable real.
        let acumuladoSinRedondear = 0;

        for (const tramo of this.tramos) {

            const dias = this.diasEnTramo(diasAtraso, tramo);

            if (dias === 0) {
                continue;
            }

            acumuladoSinRedondear +=
                capitalEnMora.obtenerValor()
                * this.tasaDiaria(tramo)
                * dias;
        }

        // Dinero.desde aplica el unico redondeo, medio hacia arriba.
        const moratorio = Dinero.desde(
            acumuladoSinRedondear,
            capitalEnMora.obtenerMoneda()
        );

        return aplicarTope(moratorio, capitalEnMora);
    }

    /**
     * Los tramos deben encadenarse sin huecos ni traslapes. Un hueco haria
     * que unos dias no se cobraran; un traslape los cobraria dos veces.
     */
    private validarContinuidad(): void {

        if (this.tramos[0].desde !== 1) {
            throw new Error("El primer tramo debe empezar en el dia 1.");
        }

        for (let i = 0; i < this.tramos.length; i++) {

            const tramo = this.tramos[i];

            if (tramo.hasta < tramo.desde) {
                throw new Error(
                    `El tramo ${tramo.tramo} tiene un rango invalido.`
                );
            }

            if (!Number.isFinite(tramo.tnaMoratoria) || tramo.tnaMoratoria < 0) {
                throw new Error(
                    `La TNA del tramo ${tramo.tramo} debe ser no negativa.`
                );
            }

            const siguiente = this.tramos[i + 1];

            if (siguiente && siguiente.desde !== tramo.hasta + 1) {
                throw new Error(
                    `Los tramos ${tramo.tramo} y ${siguiente.tramo} no se `
                    + "encadenan: debe haber continuidad sin huecos ni traslapes."
                );
            }
        }
    }
}
