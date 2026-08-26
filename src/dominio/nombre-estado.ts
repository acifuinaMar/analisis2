/**
 * Nombre del estado en que se encuentra un credito (tabla 6.7.1).
 *
 * Es solo la ETIQUETA del estado, para reportes, persistencia y lectura.
 * El COMPORTAMIENTO de cada estado vive en las clases de estados/, que
 * son las que deciden que transiciones son legales.
 */
export enum NombreEstado {

    SOLICITADO = "solicitado",

    APROBADO = "aprobado",

    VIGENTE = "vigente",

    EN_MORA = "en_mora",

    REESTRUCTURADO = "reestructurado",

    CANCELADO = "cancelado",

    RECHAZADO = "rechazado",

    ANULADO = "anulado",

    INCOBRABLE = "incobrable"

}
