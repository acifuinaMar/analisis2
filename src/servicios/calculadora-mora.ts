import { Dinero } from "../dominio/dinero";

export class CalculadoraMora {

    private static readonly TASA_MORATORIA_ANUAL = 0.24;
    private static readonly BASE_DIAS = 360;

    public calcular(
        capitalEnMora: Dinero,
        diasAtraso: number
    ): Dinero {

        if (diasAtraso <= 0) {
            return Dinero.cero();
        }

        const tasaDiaria =
            CalculadoraMora.TASA_MORATORIA_ANUAL /
            CalculadoraMora.BASE_DIAS;

        return Dinero.desde(

            capitalEnMora.obtenerValor() *
            tasaDiaria *
            diasAtraso

        );

    }

}