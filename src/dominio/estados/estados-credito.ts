import { NombreEstado } from "../nombre-estado";
import { ClasificadorTramoMora } from "../tramo-mora";
import { EstadoBase, EstadoCredito, SituacionCredito } from "./estado-credito";

/**
 * Estados concretos del ciclo de vida (tabla 6.7.1).
 *
 * Viven en un solo modulo porque se referencian mutuamente: vigente pasa
 * a en_mora y en_mora regresa a vigente. Separarlos en archivos crearia
 * imports circulares sin ganar nada.
 *
 * Cada clase habilita UNICAMENTE las transiciones que la tabla permite.
 * Todo lo demas queda prohibido por herencia de EstadoBase.
 */

const clasificador = new ClasificadorTramoMora();

/**
 * Guarda de cancelacion (CP-04.1): el saldo llego a cero exacto Y no
 * quedan cuotas vencidas pendientes. El capital puede estar en cero y
 * seguir debiendose intereses o gastos vencidos; eso no es cancelado.
 */
function estaLiquidado(situacion: SituacionCredito): boolean {
    return situacion.saldoEnCero
        && situacion.cuotasVencidasPendientes === 0;
}

/** solicitado: aprobar o rechazar. Nunca recibir un pago (invariante 6.10). */
export class Solicitado extends EstadoBase {

    public readonly nombre = NombreEstado.SOLICITADO;

    public aprobar(): EstadoCredito {
        return new Aprobado();
    }

    public rechazar(): EstadoCredito {
        return new Rechazado();
    }
}

/** aprobado: se desembolsa, o el cliente desiste antes del desembolso. */
export class Aprobado extends EstadoBase {

    public readonly nombre = NombreEstado.APROBADO;

    public desembolsar(): EstadoCredito {
        return new Vigente();
    }

    public anular(): EstadoCredito {
        return new Anulado();
    }
}

/** vigente: al dia. Se deteriora si vence una cuota; se cancela al saldar. */
export class Vigente extends EstadoBase {

    public readonly nombre = NombreEstado.VIGENTE;

    public admitePagos(): boolean {
        return true;
    }

    public registrarPago(situacion: SituacionCredito): EstadoCredito {
        return this.evaluarAlCorte(situacion);
    }

    public evaluarAlCorte(situacion: SituacionCredito): EstadoCredito {

        if (estaLiquidado(situacion)) {
            return new Cancelado();
        }

        if (situacion.diasAtraso >= 1) {
            return new EnMora();
        }

        return this;
    }
}

/**
 * en_mora: el estado del credito atrasado.
 *
 * Es UN solo estado. Los tramos (Mora 1 a Vencido) no viven aqui: son una
 * clasificacion derivada de los dias de atraso (ver tramo-mora.ts).
 */
export class EnMora extends EstadoBase {

    public readonly nombre = NombreEstado.EN_MORA;

    public admitePagos(): boolean {
        return true;
    }

    public registrarPago(situacion: SituacionCredito): EstadoCredito {
        return this.evaluarAlCorte(situacion);
    }

    /**
     * CP-04.1: en_mora -> cancelado.
     *
     * La tabla 6.7.1 del Proyecto 1 no contemplaba esta transicion, pero
     * el escenario C de pago de mas (6.6.5) afirma que si el excedente
     * cancela todo el saldo el credito pasa a CANCELADO. Un credito en
     * mora que liquida su saldo no tenia a donde ir.
     *
     * La guarda son las dos condiciones juntas: saldo exactamente cero Y
     * sin cuotas vencidas pendientes.
     */
    public evaluarAlCorte(situacion: SituacionCredito): EstadoCredito {

        if (estaLiquidado(situacion)) {
            return new Cancelado();
        }

        // Regularizacion: pago TODO lo vencido y su atraso quedo en cero.
        if (situacion.diasAtraso === 0) {
            return new Vigente();
        }

        // Pago parcial: baja de tramo, pero sigue en mora.
        return this;
    }

    public reestructurar(): EstadoCredito {
        return new Reestructurado();
    }

    public declararIncobrable(diasAtraso: number): EstadoCredito {

        if (!clasificador.superaPlazoParaIncobrable(diasAtraso)) {
            throw new Error(
                `No se puede declarar incobrable con ${diasAtraso} dias de `
                + "atraso: la baja contable exige superar los 120 dias."
            );
        }

        return new Incobrable();
    }
}

/**
 * reestructurado: nuevas condiciones acordadas.
 *
 * Cura hacia vigente cuando el cliente PAGA estando al dia, no por el mero
 * paso del tiempo. La marca de reestructuracion no se borra: la lleva el
 * credito aparte y lo mantiene contando como cartera en riesgo (6.8).
 */
export class Reestructurado extends EstadoBase {

    public readonly nombre = NombreEstado.REESTRUCTURADO;

    public admitePagos(): boolean {
        return true;
    }

    public registrarPago(situacion: SituacionCredito): EstadoCredito {

        if (estaLiquidado(situacion)) {
            return new Cancelado();
        }

        if (situacion.diasAtraso >= 1) {
            return new EnMora();
        }

        return new Vigente();
    }

    public evaluarAlCorte(situacion: SituacionCredito): EstadoCredito {

        if (situacion.diasAtraso >= 1) {
            return new EnMora();
        }

        return this;
    }
}

/** Estados terminales: no admiten ningun evento. */
abstract class EstadoTerminal extends EstadoBase {

    public esTerminal(): boolean {
        return true;
    }
}

export class Cancelado extends EstadoTerminal {
    public readonly nombre = NombreEstado.CANCELADO;
}

export class Rechazado extends EstadoTerminal {
    public readonly nombre = NombreEstado.RECHAZADO;
}

export class Anulado extends EstadoTerminal {
    public readonly nombre = NombreEstado.ANULADO;
}

/**
 * incobrable: baja CONTABLE, no perdon.
 *
 * El credito salio de la cartera y su gestion se terceriza. Si el cliente
 * paga despues, eso se registra como recuperacion de incobrable en cuenta
 * separada: el credito NO regresa. Por eso aqui no hay camino de vuelta.
 */
export class Incobrable extends EstadoTerminal {
    public readonly nombre = NombreEstado.INCOBRABLE;
}
