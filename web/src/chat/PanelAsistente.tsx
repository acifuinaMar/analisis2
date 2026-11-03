import { useEffect, useRef } from "react";

import type { Perfil } from "../api/cliente";
import { useSesion } from "../estado/sesion";
import { Aviso, cx, Icono } from "../ui";
import { formatoFechaLarga } from "../utilidades/formato";

/**
 * Panel lateral del asistente gerencial (E5), dentro de la misma
 * aplicación del E1.
 *
 * ESTADO INFORMATIVO (Fase 4, decisión D1): src/api/app.ts no expone
 * ninguna ruta HTTP hacia el orquestador (src/asistente/orquestador.ts),
 * que hoy se opera por consola con `npm run chat`. Sin esa ruta la web no
 * puede conversar, y el panel lo dice en vez de simular respuestas: no
 * hay campo de texto ni botón de enviar que no hagan nada.
 *
 * La aprobación de pagos NO pasa por aquí: en la web, un pago solo se
 * registra en «Registro de pago», con vista previa y confirmación
 * explícita del asesor.
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
                        El asistente responde en lenguaje natural sobre la cartera, un crédito, un cierre o una política,
                        con las cifras del núcleo y la fuente de cada política. La fecha de corte de esta sesión es
                        el <strong>{formatoFechaLarga(fechaCorte)}</strong>.
                    </p>
                    {perfil === "gerencia" ? (
                        <p className="mt-2 text-xs text-texto-suave">
                            Con el perfil gerencia el asistente solo consulta: puede mostrar el desglose de un pago
                            propuesto, pero no aplicarlo.
                        </p>
                    ) : null}
                </div>

                <Aviso tipo="alerta" titulo="El asistente no está disponible en la web">
                    La API de esta versión no tiene una ruta para conversar con el asistente, así que desde aquí no se
                    envía ninguna pregunta ni se muestra ninguna respuesta. Las cifras de esta pantalla vienen del
                    mismo núcleo que usaría el asistente.
                </Aviso>

                <section aria-labelledby="asistente-consola" className="rounded-tarjeta border border-borde bg-superficie p-4 text-sm text-texto-medio">
                    <h3 id="asistente-consola" className="font-semibold text-texto">Para la demostración: asistente por consola</h3>
                    <p className="mt-1">En la raíz del proyecto (requiere <code className="font-mono text-xs">GEMINI_API_KEY</code> en <code className="font-mono text-xs">.env</code>):</p>
                    <ul className="mt-2 space-y-1 font-mono text-xs text-texto">
                        <li>npm run chat</li>
                        <li>npm run chat -- --perfil asesor</li>
                    </ul>
                    <p className="mt-2 text-xs text-texto-suave">
                        Abre como gerencia, que solo consulta. Un pago propuesto por el asistente siempre muestra su
                        desglose y espera la aprobación explícita de un asesor; la gerencia no puede aplicarlo.
                    </p>
                </section>
            </div>
        </aside>
    );
}
