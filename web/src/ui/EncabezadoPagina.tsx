import type { ReactNode } from "react";

import { cx } from "./clases";

interface PropsEncabezadoPagina {
    readonly titulo: string;
    readonly subtitulo?: ReactNode;
    /** Controles a la derecha en escritorio (debajo en el teléfono). */
    readonly acciones?: ReactNode;
    /** Línea destacada bajo el título ("Mora 2 (31 - 60 días de atraso)"). */
    readonly destacado?: ReactNode;
    readonly className?: string;
}

/**
 * Título grande en negrita + subtítulo gris, como abre cada pantalla del
 * prototipo ("Detalle del crédito", "Dashboard Gerencial").
 */
export function EncabezadoPagina({ titulo, subtitulo, acciones, destacado, className }: PropsEncabezadoPagina) {
    return (
        <header className={cx("mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
            <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-texto sm:text-[1.75rem]">{titulo}</h1>
                {destacado ? <p className="mt-1 text-base font-semibold text-marca">{destacado}</p> : null}
                {subtitulo ? <p className="mt-1 text-sm text-texto-suave sm:text-base">{subtitulo}</p> : null}
            </div>
            {acciones ? <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div> : null}
        </header>
    );
}
