import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

import { cx } from "./clases";
import { Icono } from "./Icono";

/**
 * Campos de formulario del prototipo: etiqueta encima, caja con borde
 * gris y esquinas de 8 px, mensaje de error en rojo debajo. La etiqueta
 * siempre está asociada al control (accesibilidad, P2 E5).
 */

const CAJA =
    "w-full rounded-lg border bg-superficie px-3 text-sm text-texto placeholder:text-texto-suave "
    + "focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca-suave disabled:bg-superficie-activa";

interface PropsCampo {
    readonly etiqueta: string;
    readonly ayuda?: ReactNode;
    readonly error?: string;
    readonly className?: string;
    readonly children: (props: { id: string; describedBy?: string; invalido: boolean }) => ReactNode;
}

export function Campo({ etiqueta, ayuda, error, className, children }: PropsCampo) {
    const id = useId();
    const idAyuda = `${id}-ayuda`;
    const idError = `${id}-error`;
    const describedBy = [ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(" ") || undefined;

    return (
        <div className={cx("flex flex-col gap-1.5", className)}>
            <label htmlFor={id} className="text-sm font-medium text-texto">{etiqueta}</label>
            {children({ id, describedBy, invalido: Boolean(error) })}
            {ayuda && !error ? <p id={idAyuda} className="text-xs text-texto-suave">{ayuda}</p> : null}
            {error ? <p id={idError} className="text-xs font-medium text-peligro">{error}</p> : null}
        </div>
    );
}

type PropsTexto = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
    readonly etiqueta: string;
    readonly ayuda?: ReactNode;
    readonly error?: string;
    /** Prefijo dentro de la caja, p. ej. "Q". */
    readonly prefijo?: string;
};

export function CampoTexto({ etiqueta, ayuda, error, prefijo, className, ...resto }: PropsTexto) {
    return (
        <Campo etiqueta={etiqueta} ayuda={ayuda} error={error} className={className}>
            {({ id, describedBy, invalido }) => (
                <div className="relative">
                    {prefijo ? (
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-texto-suave">
                            {prefijo}
                        </span>
                    ) : null}
                    <input
                        id={id}
                        aria-describedby={describedBy}
                        aria-invalid={invalido || undefined}
                        className={cx(CAJA, "h-11", prefijo && "pl-8", invalido ? "border-peligro" : "border-borde-fuerte")}
                        {...resto}
                    />
                </div>
            )}
        </Campo>
    );
}

type PropsSeleccion = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
    readonly etiqueta: string;
    readonly opciones: ReadonlyArray<{ readonly valor: string; readonly etiqueta: string }>;
    readonly ayuda?: ReactNode;
    readonly error?: string;
    readonly vacia?: string;
};

export function CampoSeleccion({ etiqueta, opciones, ayuda, error, vacia, className, ...resto }: PropsSeleccion) {
    return (
        <Campo etiqueta={etiqueta} ayuda={ayuda} error={error} className={className}>
            {({ id, describedBy, invalido }) => (
                <div className="relative">
                    <select
                        id={id}
                        aria-describedby={describedBy}
                        aria-invalid={invalido || undefined}
                        className={cx(CAJA, "h-11 appearance-none pr-9", invalido ? "border-peligro" : "border-borde-fuerte")}
                        {...resto}
                    >
                        {vacia !== undefined ? <option value="">{vacia}</option> : null}
                        {opciones.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
                    </select>
                    <Icono nombre="abajo" tamano={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-texto-suave" />
                </div>
            )}
        </Campo>
    );
}

type PropsAreaTexto = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
    readonly etiqueta: string;
    readonly ayuda?: ReactNode;
    readonly error?: string;
};

export function CampoAreaTexto({ etiqueta, ayuda, error, className, ...resto }: PropsAreaTexto) {
    return (
        <Campo etiqueta={etiqueta} ayuda={ayuda} error={error} className={className}>
            {({ id, describedBy, invalido }) => (
                <textarea
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalido || undefined}
                    className={cx(CAJA, "min-h-24 py-2.5", invalido ? "border-peligro" : "border-borde-fuerte")}
                    {...resto}
                />
            )}
        </Campo>
    );
}

interface PropsBuscador {
    readonly valor: string;
    readonly alCambiar: (valor: string) => void;
    readonly alBuscar: () => void;
    readonly marcador: string;
    readonly etiqueta: string;
    readonly textoBoton?: string;
}

/**
 * Caja de búsqueda con botón (prototipo: "Ingrese DPI, nombre o número de
 * cliente" + lupa; en escritorio, "Buscar").
 */
export function Buscador({ valor, alCambiar, alBuscar, marcador, etiqueta, textoBoton }: PropsBuscador) {
    return (
        <form
            role="search"
            className="flex gap-2"
            onSubmit={e => {
                e.preventDefault();
                alBuscar();
            }}
        >
            <label className="relative flex-1">
                <span className="sr-only">{etiqueta}</span>
                <Icono nombre="buscar" tamano={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave" />
                <input
                    type="search"
                    value={valor}
                    onChange={e => alCambiar(e.target.value)}
                    placeholder={marcador}
                    className={cx(CAJA, "h-11 border-borde-fuerte pl-10")}
                />
            </label>
            <button
                type="submit"
                className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg bg-texto-medio px-3 text-sm font-semibold text-white hover:bg-texto sm:bg-marca sm:px-5 sm:hover:bg-marca-hover"
            >
                <Icono nombre="buscar" tamano={18} className={textoBoton ? "sm:hidden" : undefined} />
                {textoBoton ? <span className="sr-only sm:not-sr-only">{textoBoton}</span> : <span className="sr-only">Buscar</span>}
            </button>
        </form>
    );
}
