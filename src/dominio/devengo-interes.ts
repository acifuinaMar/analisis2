import { Cuota } from "./cuota";
import { Dinero } from "./dinero";
import { ClasificadorTramoMora } from "./tramo-mora";

/**
 * Suspension del devengo de interes corriente (CP-04.2, P1 6.5).
 *
 * El Proyecto 1 enunciaba la regla —"al superar los 90 dias de atraso se
 * suspende el devengo de interes corriente"— pero nunca la cuantificaba ni
 * la probaba. Ningun caso de referencia la ejercitaba. Esta clase la hace
 * verificable.
 *
 * La logica contable: a partir del dia 91 se deja de reconocer como
 * INGRESO un interes que muy probablemente no se cobrara. No se perdona ni
 * se borra: se traslada a una CUENTA DE ORDEN, el interes en suspenso. Si
 * el credito se regulariza, el devengo se reactiva y lo acumulado se
 * reconoce en el periodo de la regularizacion.
 *
 * Ambas cifras son DERIVADAS de los dias de atraso vigentes, no campos
 * guardados. Por eso la reactivacion no necesita codigo propio: al bajar
 * el atraso, el mismo interes vuelve a clasificarse como ingreso. Es el
 * mismo criterio que con los tramos de mora: no guardar lo que se puede
 * calcular, para no crear una segunda fuente de verdad.
 */
export class DevengoInteres {

    private static readonly CLASIFICADOR = new ClasificadorTramoMora();

    /**
     * El devengo se suspende pasados los 90 dias de atraso de la cuota
     * mas antigua sin saldar.
     */
    public estaSuspendido(diasAtrasoMaximo: number): boolean {
        return DevengoInteres.CLASIFICADOR.suspendeDevengo(diasAtrasoMaximo);
    }

    /**
     * Interes corriente que SI se reconoce como ingreso a la fecha de
     * corte: el de las cuotas ya vencidas, mientras el credito devengue.
     */
    public ingresoPorInteresCorriente(
        cuotas: ReadonlyArray<Cuota>,
        fechaCorte: Date,
        diasAtrasoMaximo: number
    ): Dinero {

        if (this.estaSuspendido(diasAtrasoMaximo)) {
            return Dinero.cero();
        }

        return this.interesDevengadoPendiente(cuotas, fechaCorte);
    }

    /**
     * Interes corriente devengado que NO se reconoce como ingreso por
     * estar el credito en suspenso. Cuenta de orden: nunca es ingreso
     * mientras siga aqui.
     */
    public interesEnSuspenso(
        cuotas: ReadonlyArray<Cuota>,
        fechaCorte: Date,
        diasAtrasoMaximo: number
    ): Dinero {

        if (!this.estaSuspendido(diasAtrasoMaximo)) {
            return Dinero.cero();
        }

        return this.interesDevengadoPendiente(cuotas, fechaCorte);
    }

    /**
     * Lo que se reconoceria como ingreso si el credito se regularizara en
     * este momento. Sirve al cierre para reportar el efecto de una
     * regularizacion antes de que ocurra.
     */
    public reconocerAlRegularizar(
        cuotas: ReadonlyArray<Cuota>,
        fechaCorte: Date,
        diasAtrasoMaximo: number
    ): Dinero {
        return this.interesEnSuspenso(cuotas, fechaCorte, diasAtrasoMaximo);
    }

    /**
     * Interes de las cuotas ya vencidas que todavia no se ha cobrado.
     * El interes de una cuota que aun no vence no se ha devengado, y el ya
     * cobrado dejo de ser devengo pendiente para ser ingreso realizado.
     */
    private interesDevengadoPendiente(
        cuotas: ReadonlyArray<Cuota>,
        fechaCorte: Date
    ): Dinero {

        return cuotas
            .filter(cuota => cuota.fechaVencimiento.getTime() <= fechaCorte.getTime())
            .reduce(
                (total, cuota) => total.sumar(cuota.interesPendiente()),
                Dinero.cero()
            );
    }
}
