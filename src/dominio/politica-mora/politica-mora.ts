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
/**
 * Una linea del desglose: un tramo recorrido con sus dias y su tasa.
 *
 * El monto va SIN REDONDEAR a proposito. El redondeo ocurre una sola vez,
 * al cerrar el calculo de la cuota (P2 7.3), y quien muestre el desglose
 * necesita poder explicar por que la suma de los montos redondeados puede
 * diferir un centavo del total.
 */
export interface LineaDesgloseMora {

    /** Etiqueta del tramo: mora_1, mora_2, mora_3, vencido o plana. */
    readonly tramo: string;

    readonly diasEnTramo: number;

    /** TNA del tramo en decimal: 0.18 = 18 % anual. */
    readonly tnaMoratoria: number;

    readonly tasaDiaria: number;

    readonly montoSinRedondear: number;

}

/**
 * Explicacion de como se formo el interes moratorio de una cuota.
 *
 * Es lo que la pantalla "Detalle de la mora" del E3 debe mostrarle al
 * cliente: no basta con decir "Mora: Q50.80", porque entonces no puede
 * verificar nada; tampoco sirve la formula completa, porque no se
 * entiende. El desglose por tramo es el punto intermedio.
 */
export interface DesgloseMora {

    readonly versionPolitica: string;

    readonly capitalEnMora: Dinero;

    readonly diasAtraso: number;

    readonly lineas: ReadonlyArray<LineaDesgloseMora>;

    /** Suma exacta de las lineas, antes del unico redondeo. */
    readonly sumaSinRedondear: number;

    /** Lo que efectivamente se cobra, redondeado una sola vez. */
    readonly total: Dinero;

}

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

    /**
     * Explica como se formo ese interes.
     *
     * Vive en la politica y no fuera porque solo ella sabe como calculo:
     * la plana tiene una sola linea, la escalonada una por tramo
     * recorrido. Pedirle a un tercero que lo reconstruya seria duplicar
     * la formula, y dos formulas de lo mismo siempre divergen.
     */
    explicar(capitalEnMora: Dinero, diasAtraso: number): DesgloseMora;

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
