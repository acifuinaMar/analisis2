import { Dinero } from "../dinero";
import {
    BaseConteoMora,
    DesgloseMora,
    PoliticaMora,
    aplicarTope,
    validarDiasAtraso
} from "./politica-mora";

/**
 * Politica moratoria PLANA: una sola TNA para cualquier atraso.
 *
 * Es la del Proyecto 1 (24 % nominal anual, Actual/360) y SE CONSERVA. Los
 * creditos otorgados antes del 1 de octubre de 2026 siguen calculandose con
 * ella, porque un credito se calcula con la politica vigente a su fecha de
 * otorgamiento aunque la politica cambie despues (P1, 6.3.1).
 *
 *   interes = capital_en_mora x (TNA / base) x dias
 */
export class PoliticaMoraPlana implements PoliticaMora {

    constructor(

        public readonly version: string,

        public readonly tnaMoratoria: number,

        private readonly baseConteo: BaseConteoMora = BaseConteoMora.ACTUAL_360

    ) {

        if (!Number.isFinite(tnaMoratoria) || tnaMoratoria < 0) {
            throw new Error("La TNA moratoria debe ser un numero no negativo.");
        }

        if (version.trim() === "") {
            throw new Error("La politica debe indicar su version.");
        }
    }

    public tasaDiaria(): number {
        return this.tnaMoratoria / this.baseConteo;
    }

    public calcular(capitalEnMora: Dinero, diasAtraso: number): Dinero {

        validarDiasAtraso(diasAtraso);

        if (diasAtraso === 0) {
            return Dinero.cero(capitalEnMora.obtenerMoneda());
        }

        const moratorio = capitalEnMora.multiplicar(
            this.tasaDiaria() * diasAtraso
        );

        return aplicarTope(moratorio, capitalEnMora);
    }

    /**
     * Una sola linea: la politica plana cobra la misma tasa todos los
     * dias, asi que no hay tramos que recorrer.
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

        const monto =
            capitalEnMora.obtenerValor() * this.tasaDiaria() * diasAtraso;

        return {
            versionPolitica: this.version,
            capitalEnMora,
            diasAtraso,
            lineas: [{
                tramo: "plana",
                diasEnTramo: diasAtraso,
                tnaMoratoria: this.tnaMoratoria,
                tasaDiaria: this.tasaDiaria(),
                montoSinRedondear: monto
            }],
            sumaSinRedondear: monto,
            total
        };
    }
}
