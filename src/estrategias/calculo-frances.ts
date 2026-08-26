import { Credito } from "../dominio/credito";
import { Cuota } from "../dominio/cuota";
import { Dinero } from "../dominio/dinero";
import { EstrategiaCalculo } from "./estrategia-calculo";

/**
 * Estrategia de amortizacion francesa de cuota fija (seccion 6.4).
 *
 * Toda la acumulacion de saldo ocurre en Dinero (centavos enteros), por lo
 * que el invariante "suma de amortizaciones = capital desembolsado" y
 * "saldo final = 0.00" se cumplen por construccion, sin correcciones.
 */
export class CalculoFrances implements EstrategiaCalculo {

    public generarPlan(credito: Credito): Cuota[] {

        const cuotas: Cuota[] = [];

        let saldo = credito.monto;

        const tasaMensual = credito.tasaAnual / 12;
        const plazo = credito.plazoMeses;

        const cuotaFija = this.calcularCuotaFija(
            credito.monto,
            tasaMensual,
            plazo
        );

        const fecha = new Date();

        for (let numero = 1; numero <= plazo; numero++) {

            const interes = saldo.multiplicar(tasaMensual);

            let capital = cuotaFija.restar(interes);
            let montoCuota = cuotaFija;

            // Ajuste de cuadre obligatorio (6.4): en la ultima cuota la
            // amortizacion es TODO el saldo restante, y la cuota se recalcula.
            if (numero === plazo) {
                capital = saldo;
                montoCuota = capital.sumar(interes);
            }

            saldo = saldo.restar(capital);

            cuotas.push(
                new Cuota(
                    numero,
                    montoCuota,
                    capital,
                    interes,
                    new Date(fecha)
                )
            );

            fecha.setMonth(fecha.getMonth() + 1);
        }

        return cuotas;
    }

    /**
     *            i * (1 + i)^n
     *  cuota = P * ---------------
     *            (1 + i)^n - 1
     *
     *  Caso especial: si i = 0 la formula se indetermina, y la cuota
     *  es simplemente P / n (seccion 6.4).
     */
    private calcularCuotaFija(
        principal: Dinero,
        tasaMensual: number,
        plazo: number
    ): Dinero {

        if (tasaMensual === 0) {
            return principal.dividir(plazo);
        }

        const factor =
            tasaMensual /
            (1 - Math.pow(1 + tasaMensual, -plazo));

        return principal.multiplicar(factor);
    }
}
