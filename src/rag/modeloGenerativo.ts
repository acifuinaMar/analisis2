/**
 * El modelo de texto que usa todo el sistema: el chat y el RAG.
 *
 * Esta en un solo lugar a proposito. El chat y el modulo documental son
 * el mismo asistente para quien lo usa, y si cada uno apuntara a un
 * modelo distinto podrian responder con criterios distintos a la misma
 * pregunta. Tambien evita sostener dos proveedores por un sistema.
 *
 * SE PUEDE CAMBIAR SIN TOCAR CODIGO, con la variable GEMINI_MODELO. No
 * es un lujo: la cuota del plan gratuito es POR MODELO
 * (GenerateRequestsPerDayPerProjectPerModel), y gemini-3.8-flash
 * permite 20 peticiones AL DIA. Catorce casos de evaluacion gastan unas
 * cuarenta, asi que con ese modelo la evaluacion no cabe en un dia y el
 * ensayo del video tampoco. Poder cambiarlo desde el .env permite
 * mover el trabajo a un modelo con mas cupo, o repartirlo entre varios
 * si hace falta, sin recompilar nada.
 *
 * El valor por omision es un modelo "lite" porque el cupo gratuito de
 * los lite es mas amplio y aqui no se necesita un modelo grande: el
 * modelo no calcula ninguna cifra, solo elige la herramienta y redacta.
 * Las cifras las pone el nucleo.
 */

export const MODELO_GENERATIVO =
    process.env.GEMINI_MODELO?.trim() || "gemini-3.5-flash-lite";
