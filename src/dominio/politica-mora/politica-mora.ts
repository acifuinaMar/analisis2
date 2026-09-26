import { Dinero } from "../dinero";

/**
 * Base de conteo de dias para la mora. Se repite aqui, y no se importa de
 * politica-credito, para que el puerto de mora no arrastre dependencias
 * de la politica general del credito.
 */
export enum BaseConteoMora {

    ACTUAL_360 = 360,

    ACTUAL_365 = 365

}

/**
 * PUERTO de politica moratoria.
 *
 * El Proyecto 1 inyectaba la TASA pero dejaba la FORMULA dentro del motor
 * (capital x tasa diaria x dias). La politica escalonada del Proyecto 2 no
 * es una tasa distinta: es una formula distinta, una suma sobre los tramos
 * recorridos. Por eso lo que se inyecta ahora es el calculo completo.
 *
 * La interfaz expone lo minimo que el motor necesita —calcular— mas la
 * version, que es requisito de trazabilidad: la politica es un parametro
 * versionado con fecha, autor y motivo (P1, seccion 6.3.1). Ninguna
 * implementacion lanza "no soportado" (segregacion de interfaces).
 */
export interface PoliticaMora {

    /** Identificador versionado, p. ej. "POL-2026-10". */
    readonly version: string;

    /**
     * Interes moratorio de UNA cuota vencida, sobre su propio capital en
     * mora y sus propios dias de atraso.
     *
     * Se calcula solo sobre capital, nunca sobre interes: el Codigo Civil
     * de Guatemala prohibe el anatocismo.
     */
    calcular(capitalEnMora: Dinero, diasAtraso: number): Dinero;

}

/**
 * Tope comun a todas las politicas: el interes moratorio acumulado de una
 * cuota nunca excede su propio capital en mora (invariante 7.9).
 *
 * Vive aqui, junto al puerto, porque es una regla del dominio y no de una
 * politica concreta: ninguna implementacion puede saltarsela.
 */
export function aplicarTope(
    moratorio: Dinero,
    capitalEnMora: Dinero
): Dinero {
    return Dinero.minimo(moratorio, capitalEnMora);
}

/** Validacion comun de los dias de atraso. */
export function validarDiasAtraso(diasAtraso: number): void {

    if (!Number.isInteger(diasAtraso)) {
        throw new Error("Los dias de atraso deben ser un numero entero.");
    }

    if (diasAtraso < 0) {
        throw new Error("Los dias de atraso no pueden ser negativos.");
    }
}
