import type { ReactNode } from "react";

import { Chip, EncabezadoPagina, Esqueleto, Tarjeta } from "../ui";

/**
 * Marcador de una pantalla que se implementa en una fase posterior.
 *
 * Muestra la estructura del prototipo con bloques grises —nunca cifras de
 * relleno— y deja escrito qué endpoints de la API existente va a
 * consumir, para que la revisión de la fase sea concreta.
 */

export type Silueta = "tablero" | "detalle" | "formulario" | "tabla" | "mora" | "cierre";

interface PropsPantallaPendiente {
    readonly titulo: string;
    readonly subtitulo: string;
    readonly fase: string;
    readonly referencia: string;
    readonly endpoints: ReadonlyArray<string>;
    readonly silueta: Silueta;
    readonly destacado?: ReactNode;
    readonly notas?: ReactNode;
}

export function PantallaPendiente({ titulo, subtitulo, fase, referencia, endpoints, silueta, destacado, notas }: PropsPantallaPendiente) {
    return (
        <div>
            <EncabezadoPagina titulo={titulo} subtitulo={subtitulo} destacado={destacado} />

            <Tarjeta className="mb-5 p-4">
                <div className="flex flex-wrap items-center gap-2">
                    <Chip variante="info">{fase}</Chip>
                    <span className="text-sm text-texto-suave">Referencia: {referencia}</span>
                </div>
                <p className="mt-3 text-sm font-medium text-texto">Consumirá la API existente:</p>
                <ul className="mt-1.5 space-y-1">
                    {endpoints.map(e => (
                        <li key={e} className="break-all font-mono text-xs text-texto-medio">{e}</li>
                    ))}
                </ul>
                {notas ? <div className="mt-3 text-sm text-texto-suave">{notas}</div> : null}
            </Tarjeta>

            <div aria-hidden="true">
                <SiluetaPantalla tipo={silueta} />
            </div>
        </div>
    );
}

function SiluetaPantalla({ tipo }: { tipo: Silueta }) {
    switch (tipo) {
        case "tablero":
            return (
                <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {[0, 1, 2, 3].map(i => (
                            <Tarjeta key={i} className="flex gap-4 p-5">
                                <Esqueleto className="size-10 shrink-0 rounded-lg" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <Esqueleto className="h-3 w-2/3" />
                                    <Esqueleto className="h-6 w-5/6" />
                                </div>
                            </Tarjeta>
                        ))}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-3">
                        <Tarjeta className="h-72 p-5 lg:col-span-2"><Esqueleto className="h-full w-full" /></Tarjeta>
                        <Tarjeta className="h-72 p-5"><Esqueleto className="h-full w-full" /></Tarjeta>
                    </div>
                </div>
            );
        case "detalle":
            return (
                <div className="space-y-4">
                    <Tarjeta className="space-y-4 p-4">
                        <Esqueleto className="h-5 w-40" />
                        <div className="grid grid-cols-3 gap-4">
                            {[0, 1, 2, 3, 4, 5].map(i => <Esqueleto key={i} className="h-9" />)}
                        </div>
                    </Tarjeta>
                    <div className="grid grid-cols-2 gap-3">
                        {[0, 1, 2, 3].map(i => <Esqueleto key={i} className="h-16" />)}
                    </div>
                    <Esqueleto className="h-40" />
                </div>
            );
        case "mora":
            return (
                <div className="space-y-4">
                    <Esqueleto className="h-28" />
                    <Tarjeta className="space-y-3 p-4">
                        {[0, 1, 2, 3, 4].map(i => <Esqueleto key={i} className="h-6" />)}
                    </Tarjeta>
                    <Esqueleto className="h-16" />
                </div>
            );
        case "formulario":
            return (
                <div className="space-y-4">
                    <Esqueleto className="h-10" />
                    {[0, 1, 2].map(i => (
                        <Tarjeta key={i} className="space-y-3 p-4">
                            <Esqueleto className="h-4 w-32" />
                            <Esqueleto className="h-11" />
                        </Tarjeta>
                    ))}
                    <Esqueleto className="h-12" />
                </div>
            );
        case "cierre":
            return (
                <div className="space-y-4">
                    <Esqueleto className="h-12 max-w-sm" />
                    <div className="grid gap-4 sm:grid-cols-3">
                        {[0, 1, 2].map(i => <Esqueleto key={i} className="h-24" />)}
                    </div>
                    <Tarjeta className="space-y-3 p-5">
                        {[0, 1, 2, 3, 4, 5].map(i => <Esqueleto key={i} className="h-6" />)}
                    </Tarjeta>
                </div>
            );
        case "tabla":
        default:
            return (
                <div className="space-y-4">
                    <Esqueleto className="h-11" />
                    <Tarjeta className="space-y-3 p-4">
                        {[0, 1, 2, 3, 4, 5].map(i => <Esqueleto key={i} className="h-8" />)}
                    </Tarjeta>
                </div>
            );
    }
}
