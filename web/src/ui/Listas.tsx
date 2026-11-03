import type { ReactNode } from "react";

import { cx } from "./clases";

export interface Par {
    readonly etiqueta: string;
    readonly valor: ReactNode;
    readonly enfasis?: boolean;
}

/**
 * Etiqueta a la izquierda, valor a la derecha (prototipo: "Detalle del
 * desembolso", comprobante de pago, "Créditos activos").
 */
export function ListaDatos({ pares, className }: { pares: ReadonlyArray<Par>; className?: string }) {
    return (
        <dl className={cx("divide-y divide-borde", className)}>
            {pares.map(p => (
                <div key={p.etiqueta} className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="text-sm text-texto-suave">{p.etiqueta}</dt>
                    <dd className={cx("cifra text-right text-sm text-texto", p.enfasis && "font-bold")}>{p.valor}</dd>
                </div>
            ))}
        </dl>
    );
}

/**
 * Rejilla de datos con la etiqueta encima (prototipo: tarjeta "Crédito
 * #12345" con Producto, Monto original, Tasa anual...).
 */
export function RejillaDatos({ pares, columnas = 3, className }: { pares: ReadonlyArray<Par>; columnas?: 2 | 3; className?: string }) {
    return (
        <dl className={cx("grid gap-x-4 gap-y-4", columnas === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2", className)}>
            {pares.map(p => (
                <div key={p.etiqueta} className="min-w-0">
                    <dt className="text-xs text-texto-suave">{p.etiqueta}</dt>
                    <dd className={cx("cifra mt-0.5 text-sm text-texto", p.enfasis ? "font-bold" : "font-semibold")}>{p.valor}</dd>
                </div>
            ))}
        </dl>
    );
}

export interface LineaDesglose {
    readonly concepto: string;
    /** Monto ya formateado, tal como lo entregó la API. */
    readonly monto: string;
    readonly nota?: string;
}

interface PropsDesglose {
    readonly titulo?: string;
    readonly lineas: ReadonlyArray<LineaDesglose>;
    /** Total que entregó la API (p. ej. desglosePrelacion.total). */
    readonly total: { readonly concepto: string; readonly monto: string };
    readonly totalEnPeligro?: boolean;
    readonly className?: string;
}

/**
 * Desglose con fila de total resaltada: la prelación de un pago (gastos →
 * moratorio → corriente → capital) o el total de mora.
 *
 * El total NO se suma aquí: lo entrega el núcleo. Si se sumaran las
 * líneas en la interfaz, un redondeo distinto daría dos cifras para lo
 * mismo, que es el defecto que penaliza el enunciado.
 */
export function Desglose({ titulo, lineas, total, totalEnPeligro, className }: PropsDesglose) {
    return (
        <div className={cx("rounded-tarjeta border border-borde bg-superficie", className)}>
            {titulo ? <h3 className="border-b border-borde px-4 py-3 text-sm font-semibold text-texto">{titulo}</h3> : null}
            <dl className="px-4">
                {lineas.map(l => (
                    <div key={l.concepto} className="flex items-baseline justify-between gap-4 border-b border-borde py-2.5 last:border-b-0">
                        <dt className="text-sm text-texto-medio">
                            {l.concepto}
                            {l.nota ? <span className="block text-xs text-texto-suave">{l.nota}</span> : null}
                        </dt>
                        <dd className="cifra text-sm font-semibold text-texto">{l.monto}</dd>
                    </div>
                ))}
            </dl>
            <div className="flex items-baseline justify-between gap-4 rounded-b-tarjeta bg-superficie-activa px-4 py-3">
                <span className="text-sm font-bold text-texto">{total.concepto}</span>
                <span className={cx("cifra text-base font-bold", totalEnPeligro ? "text-peligro" : "text-texto")}>
                    {total.monto}
                </span>
            </div>
        </div>
    );
}
