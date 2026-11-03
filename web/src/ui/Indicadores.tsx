import type { ReactNode } from "react";

import type { Variante } from "../utilidades/etiquetas";
import { cx } from "./clases";
import { Icono, type NombreIcono } from "./Icono";

const FONDO_ICONO: Record<Variante, string> = {
    neutro: "bg-superficie-activa text-texto-medio",
    marca: "bg-marca-suave text-marca",
    info: "bg-info-suave text-info",
    exito: "bg-exito-suave text-exito",
    alerta: "bg-alerta-suave text-alerta-acento",
    peligro: "bg-peligro-suave text-peligro"
};

interface PropsTarjetaIndicador {
    readonly etiqueta: string;
    /** La cifra YA FORMATEADA, tal como vino de la API. */
    readonly valor: ReactNode;
    readonly icono?: NombreIcono;
    readonly variante?: Variante;
    /** Línea secundaria: porcentaje, conteo, aclaración. */
    readonly detalle?: ReactNode;
    readonly className?: string;
}

/**
 * Tarjeta de indicador del tablero (prototipo: "Cartera total",
 * "Cartera en mora", "Cartera en riesgo", "Incobrables").
 *
 * No recibe números crudos a propósito: recibe el texto ya formateado de
 * una cifra de la API. Así no hay tentación de calcular aquí.
 */
export function TarjetaIndicador({ etiqueta, valor, icono, variante = "marca", detalle, className }: PropsTarjetaIndicador) {
    return (
        <div className={cx("flex gap-4 rounded-tarjeta border border-borde bg-superficie p-5 shadow-tarjeta", className)}>
            {icono ? (
                <div className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", FONDO_ICONO[variante])}>
                    <Icono nombre={icono} tamano={20} />
                </div>
            ) : null}
            <div className="min-w-0">
                <p className="text-sm font-medium text-texto-suave">{etiqueta}</p>
                <p className="cifra mt-1 text-2xl font-bold tracking-tight text-texto">{valor}</p>
                {detalle ? <div className="mt-1 text-xs text-texto-suave">{detalle}</div> : null}
            </div>
        </div>
    );
}

interface PropsDato {
    readonly etiqueta: string;
    readonly valor: ReactNode;
    readonly detalle?: ReactNode;
    readonly enfasis?: Variante;
    readonly className?: string;
}

/**
 * Cuadro pequeño de "Resumen actual" (prototipo, Detalle del crédito):
 * etiqueta gris arriba, cifra en negrita abajo.
 */
export function Dato({ etiqueta, valor, detalle, enfasis, className }: PropsDato) {
    const color = enfasis === "peligro"
        ? "text-peligro"
        : enfasis === "exito" ? "text-exito" : "text-texto";
    return (
        <div className={cx("rounded-lg border border-borde bg-superficie p-3", className)}>
            <p className="text-xs text-texto-suave">{etiqueta}</p>
            <div className={cx("cifra mt-1 text-base font-bold", color)}>{valor}</div>
            {detalle ? <div className="mt-0.5 text-xs text-texto-suave">{detalle}</div> : null}
        </div>
    );
}

/** Etiqueta en mayúsculas pequeñas + cifra grande (prototipo, Revisión). */
export function CifraDestacada({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
    return (
        <div>
            <p className="text-xs font-medium uppercase tracking-wide text-texto-suave">{etiqueta}</p>
            <p className="cifra mt-1 text-2xl font-bold text-texto">{valor}</p>
        </div>
    );
}
