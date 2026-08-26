import { Dinero } from "../dominio/dinero";
import { AplicacionPago } from "../dominio/aplicacion-pago";
import { Rubro, RubrosAdeudados } from "../dominio/rubros-adeudados";
import {
    EslabonPrelacion,
    EslabonGastos,
    EslabonInteresMoratorio,
    EslabonInteresCorriente,
    EslabonCapital
} from "./prelacion/eslabones";

/**
 * Aplica un pago a los rubros adeudados segun el orden de prelacion
 * (seccion 6.6.2):
 *
 *   1. Gastos y comisiones      (lo accesorio primero)
 *   2. Interes moratorio        (la penalizacion por el atraso)
 *   3. Interes corriente        (el interes del periodo)
 *   4. Capital                  (reduce el saldo de la deuda)
 *
 * Esta clase ya no contiene el algoritmo: solo arma la cadena y traduce
 * su resultado a un AplicacionPago. El recorrido lo hacen los eslabones.
 *
 * El orden llega por constructor, no quemado en el cuerpo de un metodo.
 * Asi, cambiar la regla de negocio es rearmar la cadena, no reescribir
 * esta clase (Open/Closed).
 */
export class PrelacionPago {

    constructor(
        private readonly primerEslabon: EslabonPrelacion =
            PrelacionPago.cadenaReglamentaria()
    ) {}

    /** La cadena que manda la seccion 6.6.2. */
    public static cadenaReglamentaria(): EslabonPrelacion {

        const gastos = new EslabonGastos();

        gastos
            .encadenarCon(new EslabonInteresMoratorio())
            .encadenarCon(new EslabonInteresCorriente())
            .encadenarCon(new EslabonCapital());

        return gastos;
    }

    public aplicar(
        pago: Dinero,
        deuda: RubrosAdeudados
    ): AplicacionPago {

        const resultado = this.primerEslabon.procesar(pago, deuda);

        return new AplicacionPago(
            resultado.de(Rubro.GASTOS),
            resultado.de(Rubro.INTERES_MORATORIO),
            resultado.de(Rubro.INTERES_CORRIENTE),
            resultado.de(Rubro.CAPITAL),
            resultado.excedente
        );
    }
}
