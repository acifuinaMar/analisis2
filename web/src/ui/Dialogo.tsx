import { useEffect, useId, useRef, type ReactNode } from "react";

import { Icono } from "./Icono";

interface PropsDialogo {
    readonly abierto: boolean;
    readonly titulo: string;
    readonly alCerrar: () => void;
    readonly children: ReactNode;
    /** Botones del pie. */
    readonly acciones?: ReactNode;
}

/**
 * Diálogo modal sobre <dialog> nativo: atrapa el foco, cierra con Escape
 * y devuelve el foco al cerrar, sin librerías.
 */
export function Dialogo({ abierto, titulo, alCerrar, children, acciones }: PropsDialogo) {
    const ref = useRef<HTMLDialogElement>(null);
    const idTitulo = useId();

    useEffect(() => {
        const dialogo = ref.current;
        if (!dialogo) {
            return;
        }
        if (abierto && !dialogo.open) {
            dialogo.showModal();
        } else if (!abierto && dialogo.open) {
            dialogo.close();
        }
    }, [abierto]);

    return (
        <dialog
            ref={ref}
            aria-labelledby={idTitulo}
            onCancel={e => {
                e.preventDefault();
                alCerrar();
            }}
            onClick={e => {
                if (e.target === ref.current) {
                    alCerrar();
                }
            }}
            className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-tarjeta border border-borde bg-superficie p-0 text-texto shadow-xl backdrop:bg-slate-900/40"
        >
            <div className="flex items-start justify-between gap-4 border-b border-borde px-5 py-4">
                <h2 id={idTitulo} className="text-lg font-semibold">{titulo}</h2>
                <button type="button" onClick={alCerrar} className="rounded-md p-1 text-texto-suave hover:bg-superficie-activa" aria-label="Cerrar">
                    <Icono nombre="cerrar" tamano={18} />
                </button>
            </div>
            <div className="px-5 py-4">{children}</div>
            {acciones ? <div className="flex flex-wrap justify-end gap-2 border-t border-borde px-5 py-4">{acciones}</div> : null}
        </dialog>
    );
}
