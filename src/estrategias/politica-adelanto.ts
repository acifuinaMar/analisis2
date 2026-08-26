import { Cuota } from "../dominio/cuota";
import { Dinero } from "../dominio/dinero";

/**
 * Que hacer con el excedente de un pago (seccion 6.6.5).
 *
 * "El excedente no es un regalo a la institucion: pertenece al cliente y
 * debe aplicarse a su favor." El enunciado plantea dos formas y pide
 * elegir y justificar una; el manejo del excedente es un Strategy.
 */
export interface PoliticaAdelanto {

    /** Aplica el excedente y devuelve lo que no logro colocar. */
    aplicar(cuotasFuturas: Cuota[], excedente: Dinero): Dinero;

    readonly nombre: string;

}

/**
 * POLITICA ELEGIDA (recomendada por el enunciado).
 *
 * El excedente abona directamente al CAPITAL de las cuotas futuras, sin
 * pagar sus intereses. El cliente termina pagando menos interes en total,
 * porque el interes se devenga sobre un saldo menor: "si no hay tiempo,
 * no hay interes".
 *
 * Se aplica de la cuota mas proxima a la mas lejana, lo que acorta el
 * plazo. Si el excedente cancela todo el saldo, el credito pasa a
 * CANCELADO y no se cobran los intereses de los meses que ya no
 * transcurriran.
 */
export class AmortizacionACapital implements PoliticaAdelanto {

    public readonly nombre = "Amortizacion a capital";

    public aplicar(cuotasFuturas: Cuota[], excedente: Dinero): Dinero {

        let disponible = excedente;

        for (const cuota of cuotasFuturas) {

            if (disponible.esCero()) {
                break;
            }

            const aCapital = Dinero.minimo(
                disponible,
                cuota.capitalPendiente()
            );

            cuota.abonar(aCapital, Dinero.cero());

            disponible = disponible.restar(aCapital);
        }

        return disponible;
    }
}

/**
 * POLITICA ALTERNATIVA (documentada, no la vigente).
 *
 * El excedente cubre cuotas futuras COMPLETAS a su vencimiento: primero
 * la 3, luego la 4, y asi. No cambia el interes total, pero deja al
 * cliente al dia por adelantado.
 *
 * Solo salda cuotas enteras: si el remanente no alcanza para una cuota
 * completa, se devuelve sin aplicar en lugar de dejarla a medias.
 */
export class PagoAnticipadoDeCuotas implements PoliticaAdelanto {

    public readonly nombre = "Pago anticipado de cuotas futuras";

    public aplicar(cuotasFuturas: Cuota[], excedente: Dinero): Dinero {

        let disponible = excedente;

        for (const cuota of cuotasFuturas) {

            const pendiente = cuota.totalPendiente();

            if (pendiente.esMayorQue(disponible)) {
                break;
            }

            cuota.abonar(
                cuota.capitalPendiente(),
                cuota.interesPendiente()
            );

            disponible = disponible.restar(pendiente);
        }

        return disponible;
    }
}
