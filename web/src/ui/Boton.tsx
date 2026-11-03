import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Enlace } from "../app/enrutador";
import { cx } from "./clases";
import { Icono, type NombreIcono } from "./Icono";

/**
 * Botones del prototipo.
 *
 *   primario    azul marino lleno ("Registrar pago", "Siguiente")
 *   secundario  borde gris sobre blanco ("Comprobante", "Cancelar")
 *   fantasma    solo texto, para acciones de menor peso
 *   peligro     rojo, para acciones que no se pueden deshacer
 */
export type VarianteBoton = "primario" | "secundario" | "fantasma" | "peligro";
export type TamanoBoton = "md" | "lg" | "sm";

const BASE =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors "
    + "disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2";

const VARIANTES: Record<VarianteBoton, string> = {
    primario: "bg-marca text-white hover:bg-marca-hover",
    secundario: "border border-borde-fuerte bg-superficie text-texto hover:bg-superficie-activa",
    fantasma: "text-marca hover:bg-marca-suave",
    peligro: "bg-peligro text-white hover:bg-red-700"
};

const TAMANOS: Record<TamanoBoton, string> = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-5 text-base"
};

interface PropsComunes {
    readonly variante?: VarianteBoton;
    readonly tamano?: TamanoBoton;
    readonly icono?: NombreIcono;
    readonly bloque?: boolean;
    readonly cargando?: boolean;
    readonly children: ReactNode;
}

type PropsBoton = PropsComunes & ButtonHTMLAttributes<HTMLButtonElement>;

export function Boton({
    variante = "primario",
    tamano = "md",
    icono,
    bloque,
    cargando,
    className,
    children,
    disabled,
    type = "button",
    ...resto
}: PropsBoton) {
    return (
        <button
            type={type}
            className={cx(BASE, VARIANTES[variante], TAMANOS[tamano], bloque && "w-full", className)}
            disabled={disabled || cargando}
            aria-busy={cargando || undefined}
            {...resto}
        >
            {cargando
                ? <Icono nombre="cargando" tamano={18} className="animate-spin" />
                : icono ? <Icono nombre={icono} tamano={18} /> : null}
            {children}
        </button>
    );
}

interface PropsBotonEnlace extends PropsComunes {
    readonly a: string;
    readonly className?: string;
}

/** Misma apariencia que Boton, pero navega (es un enlace real). */
export function BotonEnlace({ a, variante = "primario", tamano = "md", icono, bloque, className, children }: PropsBotonEnlace) {
    return (
        <Enlace a={a} className={cx(BASE, VARIANTES[variante], TAMANOS[tamano], bloque && "w-full", className)}>
            {icono ? <Icono nombre={icono} tamano={18} /> : null}
            {children}
        </Enlace>
    );
}
