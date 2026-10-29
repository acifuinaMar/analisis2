import { useEffect, useState, type ReactNode } from "react";

import { Enlace, useNavegar, useUbicacion } from "../app/enrutador";
import { PanelAsistente } from "../chat/PanelAsistente";
import { escribir, leer } from "../estado/almacen";
import { useSesion } from "../estado/sesion";
import { Avatar, cx, Icono, Logotipo, Migas, type NombreIcono } from "../ui";
import { SelectorFechaCorte } from "./SelectorFechaCorte";

/**
 * Layout del perfil GERENCIA: optimizado para escritorio (E1).
 *
 * Barra lateral, encabezado y migas del prototipo
 * (dashboard-gerencial-pc.png, creditos-del-tramo-mora-2.png). El menú
 * muestra solo lo que existe (decisión D8): Inicio, Cartera en mora y
 * Cierres. El asistente es un panel lateral desplegable: en escritorio
 * convive con los indicadores para comparar pantalla y chat (Bloque 3 del
 * video); en pantallas angostas ocupa toda la pantalla.
 *
 * El panel vive en el layout y no en cada página: al navegar del tablero
 * al cierre la conversación no se pierde.
 */

interface ItemMenu {
    readonly a: string;
    readonly etiqueta: string;
    readonly icono: NombreIcono;
    readonly exacta?: boolean;
    readonly tambien?: ReadonlyArray<string>;
}

const MENU: ReadonlyArray<ItemMenu> = [
    { a: "/gerencia", etiqueta: "Inicio", icono: "inicio", exacta: true, tambien: ["/gerencia/creditos"] },
    { a: "/gerencia/mora", etiqueta: "Cartera en mora", icono: "alerta" },
    { a: "/gerencia/cierre", etiqueta: "Cierres", icono: "cierre" }
];

const CLAVE_PANEL = "cv.asistenteAbierto";

function estaActivo(item: ItemMenu, ruta: string): boolean {
    const bajo = (base: string) => ruta === base || ruta.startsWith(`${base}/`);
    if (item.exacta ? ruta === item.a : bajo(item.a)) {
        return true;
    }
    return (item.tambien ?? []).some(bajo);
}

interface PropsLayoutGerencia {
    readonly migas?: ReadonlyArray<{ etiqueta: string; a?: string }>;
    readonly children: ReactNode;
}

export function LayoutGerencia({ migas, children }: PropsLayoutGerencia) {
    const { ruta } = useUbicacion();
    const { salir, perfil } = useSesion();
    const navegar = useNavegar();

    const [panelAbierto, setPanelAbierto] = useState(() => leer(CLAVE_PANEL) === "1");
    const [menuMovil, setMenuMovil] = useState(false);

    useEffect(() => {
        escribir(CLAVE_PANEL, panelAbierto ? "1" : null);
    }, [panelAbierto]);

    // Al navegar, el menú del teléfono se cierra solo.
    useEffect(() => {
        setMenuMovil(false);
    }, [ruta]);

    const cambiarPerfil = () => {
        salir();
        navegar("/perfil", { reemplazar: true });
    };

    const barraLateral = (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 px-5 pb-6 pt-6">
                <Logotipo />
                <div className="leading-tight">
                    <p className="text-base font-bold text-texto">Crédito Vecino</p>
                    <p className="text-xs text-texto-suave">Sistema de Gestión</p>
                </div>
            </div>
            <nav aria-label="Menú principal" className="flex-1 px-3">
                <ul className="flex flex-col gap-1">
                    {MENU.map(item => {
                        const activo = estaActivo(item, ruta);
                        return (
                            <li key={item.a}>
                                <Enlace
                                    a={item.a}
                                    aria-current={activo ? "page" : undefined}
                                    className={cx(
                                        "flex h-10 items-center gap-3 rounded-lg px-3 text-sm",
                                        activo
                                            ? "bg-superficie-activa font-semibold text-marca"
                                            : "text-texto-medio hover:bg-fondo hover:text-texto"
                                    )}
                                >
                                    <Icono nombre={item.icono} tamano={18} />
                                    {item.etiqueta}
                                </Enlace>
                            </li>
                        );
                    })}
                    <li>
                        <button
                            type="button"
                            onClick={() => setPanelAbierto(v => !v)}
                            aria-pressed={panelAbierto}
                            className={cx(
                                "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm",
                                panelAbierto ? "bg-marca-suave font-semibold text-marca" : "text-texto-medio hover:bg-fondo hover:text-texto"
                            )}
                        >
                            <Icono nombre="chat" tamano={18} />
                            Asistente
                        </button>
                    </li>
                </ul>
            </nav>
            <div className="px-3 pb-6">
                <button
                    type="button"
                    onClick={cambiarPerfil}
                    className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-peligro hover:bg-peligro-suave"
                >
                    <Icono nombre="salir" tamano={18} />
                    Cambiar perfil
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-dvh bg-fondo">
            {/* Barra lateral fija en escritorio */}
            <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-borde bg-superficie lg:block">
                {barraLateral}
            </aside>

            {/* Barra lateral como cajón en pantallas angostas */}
            {menuMovil ? (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuMovil(false)} />
                    <aside className="absolute inset-y-0 left-0 w-64 bg-superficie shadow-xl">{barraLateral}</aside>
                </div>
            ) : null}

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-20 border-b border-borde bg-superficie/95 backdrop-blur">
                    <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
                        <button
                            type="button"
                            onClick={() => setMenuMovil(true)}
                            aria-label="Abrir menú"
                            className="-ml-1 flex size-10 items-center justify-center rounded-lg text-texto hover:bg-superficie-activa lg:hidden"
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                <path d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div className="min-w-0 flex-1">
                            {migas && migas.length > 0 ? <Migas elementos={migas} /> : null}
                        </div>
                        <SelectorFechaCorte />
                        <button
                            type="button"
                            onClick={() => setPanelAbierto(v => !v)}
                            aria-label="Asistente"
                            aria-expanded={panelAbierto}
                            aria-controls="panel-asistente"
                            className={cx(
                                "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
                                panelAbierto
                                    ? "border-marca bg-marca text-white hover:bg-marca-hover"
                                    : "border-borde-fuerte bg-superficie text-marca hover:bg-marca-suave"
                            )}
                        >
                            <Icono nombre="chat" tamano={18} />
                            <span className="hidden sm:inline">Asistente</span>
                        </button>
                        <div className="hidden items-center gap-3 border-l border-borde pl-3 xl:flex">
                            <Avatar nombre="Gerencia" />
                            <div className="leading-tight">
                                <p className="text-sm font-semibold text-texto">Gerencia</p>
                                <p className="text-xs text-texto-suave">Perfil de demostración</p>
                            </div>
                        </div>
                    </div>
                </header>

                <main id="contenido" className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                    <div className="mx-auto max-w-7xl">{children}</div>
                </main>
            </div>

            {perfil ? (
                <PanelAsistente
                    abierto={panelAbierto}
                    alCerrar={() => setPanelAbierto(false)}
                    perfil={perfil}
                />
            ) : null}
        </div>
    );
}
