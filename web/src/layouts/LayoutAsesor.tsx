import type { ReactNode } from "react";

import { Enlace, useUbicacion } from "../app/enrutador";
import { Avatar, cx, Icono, Logotipo, type NombreIcono } from "../ui";
import { SelectorFechaCorte } from "./SelectorFechaCorte";

/**
 * Layout del perfil ASESOR: pensado primero para el teléfono (E1: "las
 * pantallas de asesor son usables en ancho de teléfono"; P2 E4: diseño
 * mobile-first de 360–414 px).
 *
 * Encabezado y menú inferior del prototipo (registro-pago.png,
 * comprobante-pago.png): Inicio · Clientes · Pagos · Más. En una pantalla
 * ancha se conserva la misma columna centrada, para que el asesor vea en
 * el monitor lo mismo que en el teléfono.
 */

interface ItemMenu {
    readonly a: string;
    readonly etiqueta: string;
    readonly icono: NombreIcono;
    /** Rutas que también encienden este ítem (Detalle del crédito → Clientes). */
    readonly tambien?: ReadonlyArray<string>;
    readonly exacta?: boolean;
}

const MENU: ReadonlyArray<ItemMenu> = [
    { a: "/asesor", etiqueta: "Inicio", icono: "inicio", exacta: true, tambien: ["/asesor/solicitud"] },
    { a: "/asesor/clientes", etiqueta: "Clientes", icono: "clientes", tambien: ["/asesor/creditos"] },
    { a: "/asesor/pagos", etiqueta: "Pagos", icono: "tarjeta" },
    { a: "/asesor/mas", etiqueta: "Más", icono: "mas" }
];

function estaActivo(item: ItemMenu, ruta: string): boolean {
    const bajo = (base: string) => ruta === base || ruta.startsWith(`${base}/`);
    if (item.exacta ? ruta === item.a : bajo(item.a)) {
        return true;
    }
    return (item.tambien ?? []).some(bajo);
}

interface PropsLayoutAsesor {
    /** Destino del botón "atrás" del encabezado; sin él no se muestra. */
    readonly atras?: string;
    readonly children: ReactNode;
}

export function LayoutAsesor({ atras, children }: PropsLayoutAsesor) {
    const { ruta } = useUbicacion();

    return (
        <div className="min-h-dvh bg-fondo">
            <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-fondo sm:border-x sm:border-borde">
                <header className="sticky top-0 z-30 border-b border-borde bg-superficie/95 backdrop-blur">
                    <div className="flex h-16 items-center gap-2 px-4">
                        {atras ? (
                            <Enlace
                                a={atras}
                                aria-label="Volver"
                                className="-ml-2 flex size-10 items-center justify-center rounded-lg text-texto hover:bg-superficie-activa"
                            >
                                <Icono nombre="atras" tamano={22} />
                            </Enlace>
                        ) : null}
                        <Logotipo tamano="sm" />
                        <div className="min-w-0 flex-1 leading-tight">
                            <p className="truncate text-base font-semibold text-texto">Crédito Vecino</p>
                            <p className="text-xs text-texto-suave">Asesor</p>
                        </div>
                        <SelectorFechaCorte compacto />
                        {/* En teléfonos angostos el nombre de la app tiene prioridad. */}
                        <span className="hidden min-[420px]:block">
                            <Avatar nombre="Asesor" />
                        </span>
                    </div>
                </header>

                <main id="contenido" className="flex-1 px-4 pb-28 pt-5">
                    {children}
                </main>

                <nav
                    aria-label="Menú principal"
                    className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-lg border-t border-borde bg-superficie pb-[env(safe-area-inset-bottom)] sm:border-x"
                >
                    <ul className="grid grid-cols-4">
                        {MENU.map(item => {
                            const activo = estaActivo(item, ruta);
                            return (
                                <li key={item.a}>
                                    <Enlace
                                        a={item.a}
                                        aria-current={activo ? "page" : undefined}
                                        className={cx(
                                            "flex h-16 flex-col items-center justify-center gap-1 text-xs",
                                            activo ? "font-semibold text-marca" : "text-texto-suave hover:text-texto"
                                        )}
                                    >
                                        <Icono nombre={item.icono} tamano={22} strokeWidth={activo ? 2.25 : 2} />
                                        {item.etiqueta}
                                    </Enlace>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </div>
        </div>
    );
}
