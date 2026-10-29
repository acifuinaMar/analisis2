import type { ReactNode } from "react";

import {
    etiquetaEstado,
    etiquetaTramo,
    varianteEstado,
    varianteTramo,
    type Variante
} from "../utilidades/etiquetas";
import { cx } from "./clases";

/**
 * Chip de estado del prototipo: "En mora - Mora 2" (rojo), "Seguimiento"
 * (ámbar), "Al día" (verde). El color nunca va solo: siempre acompaña a
 * un texto, para quien no distingue colores (P2, E5 accesibilidad).
 */
const COLORES: Record<Variante, string> = {
    neutro: "bg-superficie-activa text-texto-medio border-borde",
    exito: "bg-exito-suave text-green-800 border-green-200",
    alerta: "bg-alerta-suave text-alerta border-amber-300",
    peligro: "bg-peligro-suave text-red-700 border-red-200",
    info: "bg-info-suave text-blue-800 border-blue-200",
    marca: "bg-marca text-white border-marca"
};

interface PropsChip {
    readonly variante?: Variante;
    readonly children: ReactNode;
    readonly className?: string;
}

export function Chip({ variante = "neutro", children, className }: PropsChip) {
    return (
        <span
            className={cx(
                "inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold",
                COLORES[variante],
                className
            )}
        >
            {children}
        </span>
    );
}

/** Estado del crédito tal como lo nombra el núcleo (NombreEstado). */
export function ChipEstado({ estado }: { estado: string }) {
    return <Chip variante={varianteEstado(estado)}>{etiquetaEstado(estado)}</Chip>;
}

/** Tramo de mora tal como lo clasifica el núcleo (TramoMora). */
export function ChipTramo({ tramo }: { tramo: string }) {
    return <Chip variante={varianteTramo(tramo)}>{etiquetaTramo(tramo)}</Chip>;
}
