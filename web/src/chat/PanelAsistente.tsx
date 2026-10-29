import { useEffect, useRef } from "react";

import type { Perfil } from "../api/cliente";
import { useSesion } from "../estado/sesion";
import { Aviso, cx, Icono } from "../ui";
import { formatoFechaLarga } from "../utilidades/formato";

/**
 * Panel lateral del asistente gerencial (E5), dentro de la misma
 * aplicación del E1.
 *
 * FASE 1: estructura visual. La conversación se conecta en la fase del
 * chat, porque la API todavía no expone rutas para el orquestador
 * (src/api/app.ts no tiene /api/chat). Mientras tanto, el panel muestra
 * su forma final sin inventar respuestas.
 *
 * Distribución (preferencia del equipo):
 *   escritorio (lg+)  columna de 400 px a la derecha; el tablero sigue
 *                     visible para comparar pantalla y chat (Bloque 3).
 *   teléfono          ocupa toda la pantalla.
 */

interface PropsPanelAsistente {
    readonly abierto: boolean;
    readonly alCerrar: () => void;
    readonly perfil: Perfil;
}

export function PanelAsistente({ abierto, alCerrar, perfil }: PropsPanelAsistente) {
    const { fechaCorte } = useSesion();
    const titulo = useRef<HTMLHeadingElement>(null);

    // Al abrir, el foco va al panel; Escape lo cierra.
    useEffect(() => {
        if (!abierto) {
            return;
        }
        titulo.current?.focus();
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                alCerrar();
            }
        };
        window.addEventListener("keydown", alTeclear);
        return () => window.removeEventListener("keydown", alTeclear);
    }, [abierto, alCerrar]);

    if (!abierto) {
        return null;
    }

    return (
        <aside
            id="panel-asistente"
            aria-label="Asistente gerencial"
            className={cx(
                "fixed inset-0 z-50 flex flex-col bg-superficie",
                "lg:sticky lg:top-0 lg:z-10 lg:h-dvh lg:w-[400px] lg:shrink-0 lg:border-l lg:border-borde"
            )}
        >
            <header className="flex h-16 items-center gap-3 border-b border-borde px-4">
                <span className="flex size-9 items-center justify-center rounded-lg bg-marca-suave text-marca">
                    <Icono nombre="chat" tamano={18} />
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                    <h2 ref={titulo} tabIndex={-1} className="text-base font-semibold text-texto outline-none">
                        Asistente gerencial
                    </h2>
                    <p className="truncate text-xs text-texto-suave">Cifras del núcleo · políticas con su fuente</p>
                </div>
                <button
                    type="button"
                    onClick={alCerrar}
                    aria-label="Cerrar asistente"
                    className="flex size-10 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-activa"
                >
                    <Icono nombre="cerrar" tamano={20} />
                </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto bg-fondo p-4">
                <div className="rounded-tarjeta border border-borde bg-superficie p-4 text-sm text-texto-medio">
                    <p>
                        Pregunte en lenguaje natural por la cartera, un crédito, un cierre o una política. Las consultas
                        usan la fecha de corte del encabezado: <strong>{formatoFechaLarga(fechaCorte)}</strong>.
                    </p>
                    {perfil === "gerencia" ? (
                        <p className="mt-2 text-xs text-texto-suave">
                            Con el perfil gerencia puede revisar el desglose de un pago propuesto, pero no aplicarlo.
                        </p>
                    ) : null}
                </div>

                <Aviso tipo="alerta" titulo="Conversación pendiente de conexión">
                    El panel se conecta al orquestador en la fase del chat. La API todavía no expone las rutas del
                    asistente; mientras tanto no se envía ninguna pregunta.
                </Aviso>
            </div>

            <form
                className="border-t border-borde bg-superficie p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                onSubmit={e => e.preventDefault()}
            >
                <label htmlFor="pregunta-asistente" className="sr-only">Pregunta para el asistente</label>
                <div className="flex items-end gap-2">
                    <textarea
                        id="pregunta-asistente"
                        rows={2}
                        disabled
                        placeholder="Disponible en la fase del chat"
                        className="min-h-11 flex-1 resize-none rounded-lg border border-borde-fuerte bg-superficie-activa px-3 py-2.5 text-sm placeholder:text-texto-suave"
                    />
                    <button
                        type="submit"
                        disabled
                        aria-label="Enviar pregunta"
                        className="flex size-11 items-center justify-center rounded-lg bg-marca text-white disabled:opacity-40"
                    >
                        <Icono nombre="enviar" tamano={18} />
                    </button>
                </div>
            </form>
        </aside>
    );
}
