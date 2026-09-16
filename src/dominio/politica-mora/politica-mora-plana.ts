import { Dinero } from "../dinero";
import {
    BaseConteoMora,
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

        private readonly tnaMoratoria: number,

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
}
