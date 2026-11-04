import { Dinero } from "../dinero";
import {
    BaseConteoMora,
    DesgloseMora,
    PoliticaMora,
    aplicarTope,
    validarDiasAtraso
} from "./politica-mora";
import { TramoTasa } from "./politica-mora-escalonada";

/**
 * Politica moratoria RETROACTIVA. NO ADOPTADA por el comite.
 *
 * Aplica la tasa del tramo ACTUAL a TODOS los dias de atraso, en vez de
 * cobrar cada dia a la tasa de su propio tramo. Con 100 dias de atraso da
 * Q72.58 contra los Q50.80 de la escalonada (seccion 7.4).
 *
 * Existe por dos razones, ambas de diseno y no de negocio:
 *
 * 1. Sustitucion de Liskov: es una tercera implementacion del mismo puerto
 *    que debe poder intercambiarse con las otras dos sin romper ningun
 *    invariante del motor. La misma bateria de pruebas de contrato corre
 *    contra las tres.
 *
 * 2. Abierto/cerrado: agregar esta politica no obligo a tocar el motor de
 *    calculo. Si hubiera hecho falta, el principio no se cumplia.
 */
export class PoliticaMoraRetroactiva implements PoliticaMora {

    private readonly tramos: ReadonlyArray<TramoTasa>;

    constructor(

        public readonly version: string,

        tramos: ReadonlyArray<TramoTasa>,

        private readonly baseConteo: BaseConteoMora = BaseConteoMora.ACTUAL_360

    ) {
        this.tramos = [...tramos].sort((a, b) => a.desde - b.desde);
    }

    public calcular(capitalEnMora: Dinero, diasAtraso: number): Dinero {

        validarDiasAtraso(diasAtraso);

        if (diasAtraso === 0) {
            return Dinero.cero(capitalEnMora.obtenerMoneda());
        }

        const tramoActual = this.tramoDe(diasAtraso);

        const diasCobrables = Math.min(
            diasAtraso,
            this.tramos[this.tramos.length - 1].hasta
        );

        const moratorio = capitalEnMora.multiplicar(
            (tramoActual.tnaMoratoria / this.baseConteo) * diasCobrables
        );

        return aplicarTope(moratorio, capitalEnMora);
    }

    /**
     * Una sola linea: aplica la tasa del tramo actual a todos los dias,
     * que es precisamente lo que la hace distinta de la escalonada.
     */
    public explicar(
        capitalEnMora: Dinero,
        diasAtraso: number
    ): DesgloseMora {

        validarDiasAtraso(diasAtraso);

        const total = this.calcular(capitalEnMora, diasAtraso);

        if (diasAtraso === 0) {
            return {
                versionPolitica: this.version,
                capitalEnMora,
                diasAtraso,
                lineas: [],
                sumaSinRedondear: 0,
                total
            };
        }

        const tramo = this.tramoDe(diasAtraso);
        const tasaDiaria = tramo.tnaMoratoria / this.baseConteo;

        const dias = Math.min(
            diasAtraso,
            this.tramos[this.tramos.length - 1].hasta
        );

        const monto = capitalEnMora.obtenerValor() * tasaDiaria * dias;

        return {
            versionPolitica: this.version,
            capitalEnMora,
            diasAtraso,
            lineas: [{
                tramo: tramo.tramo,
                diasEnTramo: dias,
                tnaMoratoria: tramo.tnaMoratoria,
                tasaDiaria,
                montoSinRedondear: monto
            }],
            sumaSinRedondear: monto,
            total
        };
    }

    /** El tramo en que cae el atraso; mas alla del ultimo, el ultimo. */
    private tramoDe(diasAtraso: number): TramoTasa {

        const encontrado = this.tramos.find(
            t => diasAtraso >= t.desde && diasAtraso <= t.hasta
        );

        return encontrado ?? this.tramos[this.tramos.length - 1];
    }
}
