import type { ReactNode } from "react";

import { cx } from "./clases";
import { Icono, type NombreIcono } from "./Icono";

/** Indicador de carga accesible. */
export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
    return (
        <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-texto-suave">
            <Icono nombre="cargando" tamano={18} className="animate-spin" />
            <span>{texto}</span>
        </div>
    );
}

/**
 * Bloque gris que reserva el lugar de una cifra mientras carga. Se usa en
 * vez de un número de relleno: la pantalla nunca muestra cifras que no
 * vinieron del núcleo.
 */
export function Esqueleto({ className }: { className?: string }) {
    return <div aria-hidden="true" className={cx("animate-pulse rounded-md bg-superficie-activa", className)} />;
}

interface PropsEstadoVacio {
    readonly icono?: NombreIcono;
    readonly titulo: string;
    readonly children?: ReactNode;
    readonly accion?: ReactNode;
    readonly className?: string;
}

export function EstadoVacio({ icono = "documento", titulo, children, accion, className }: PropsEstadoVacio) {
    return (
        <div className={cx("flex flex-col items-center rounded-tarjeta border border-dashed border-borde-fuerte bg-superficie px-6 py-10 text-center", className)}>
            <div className="flex size-12 items-center justify-center rounded-full bg-marca-suave text-marca">
                <Icono nombre={icono} tamano={22} />
            </div>
            <h3 className="mt-3 text-base font-semibold text-texto">{titulo}</h3>
            {children ? <div className="mt-1 max-w-md text-sm text-texto-suave">{children}</div> : null}
            {accion ? <div className="mt-4">{accion}</div> : null}
        </div>
    );
}
