import { addMonths } from "date-fns";

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

        // addMonths de date-fns respeta el fin de mes: al 31 de enero
        // le suma un mes y devuelve el 28 de febrero, no el 3 de marzo.
        // El enunciado prohibe usar Date nativo para aritmetica de dias.

        let saldo = credito.monto;

        const tasaMensual = credito.politica.tasaMensual();
        const plazo = credito.plazoMeses;

        const cuotaFija = this.calcularCuotaFija(
            credito.monto,
            tasaMensual,
            plazo
        );

        // La fecha entra como dato del credito. El nucleo nunca lee
        // el reloj del sistema (criterio de aceptacion del E4).
        //
        // La PRIMERA cuota vence un mes DESPUES del desembolso, no el
        // mismo dia: en una amortizacion francesa el primer pago cierra
        // el primer periodo de devengo, y un credito entregado hoy no
        // tiene cuota exigible hoy.
        //
        // El paquete canonico del Proyecto Final lo confirma: de sus 228
        // pagos, 200 caen exactamente en desembolso + k meses con k >= 1,
        // y ninguno en la fecha del desembolso. Los pagos puntuales traen
        // el monto exacto de la cuota, sin un centavo de mora.
        let fecha = addMonths(credito.fechaDesembolso, 1);

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

            fecha = addMonths(fecha, 1);
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
