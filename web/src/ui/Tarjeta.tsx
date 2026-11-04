import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./clases";

/** Contenedor blanco con borde suave: la pieza base de todo el prototipo. */
export function Tarjeta({ className, children, ...resto }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cx("rounded-tarjeta border border-borde bg-superficie shadow-tarjeta", className)}
            {...resto}
        >
            {children}
        </div>
    );
}

interface PropsEncabezadoTarjeta {
    readonly titulo: ReactNode;
    readonly subtitulo?: ReactNode;
    /** Acción a la derecha: "Ver todos", un chip de estado, un botón. */
    readonly accion?: ReactNode;
    readonly separador?: boolean;
    readonly className?: string;
}

export function EncabezadoTarjeta({ titulo, subtitulo, accion, separador, className }: PropsEncabezadoTarjeta) {
    return (
        <div className={cx("flex items-start justify-between gap-3", separador && "border-b border-borde pb-3", className)}>
            <div className="min-w-0">
                <h3 className="text-base font-semibold text-texto">{titulo}</h3>
                {subtitulo ? <p className="mt-0.5 text-sm text-texto-suave">{subtitulo}</p> : null}
            </div>
            {accion ? <div className="shrink-0">{accion}</div> : null}
        </div>
    );
}

/** Título de sección fuera de tarjeta ("Resumen actual", "Últimos pagos"). */
export function TituloSeccion({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
    return (
        <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-texto">{children}</h2>
            {accion}
        </div>
    );
}
