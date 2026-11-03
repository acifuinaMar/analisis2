import type { ReactNode } from "react";

import { cx } from "./clases";

export interface Columna<F> {
    readonly clave: string;
    readonly titulo: string;
    readonly celda: (fila: F) => ReactNode;
    /** Cifras a la derecha, con dígitos de ancho fijo. */
    readonly numerica?: boolean;
    /** Se oculta en pantallas angostas para que la tabla quepa. */
    readonly ocultarEnMovil?: boolean;
}

interface PropsTabla<F> {
    readonly columnas: ReadonlyArray<Columna<F>>;
    readonly filas: ReadonlyArray<F>;
    readonly claveFila: (fila: F) => string;
    /**
     * Fila de totales. Debe venir de la API (p. ej. saldoCapitalTotal):
     * la tabla no suma columnas por su cuenta.
     */
    readonly pie?: ReactNode;
    readonly vacio?: ReactNode;
    readonly titulo?: string;
    readonly alSeleccionar?: (fila: F) => void;
    readonly className?: string;
}

/**
 * Tabla del prototipo: encabezado gris claro, filas separadas por una
 * línea, cifras alineadas a la derecha. Con desplazamiento horizontal
 * propio en el teléfono, para que la página nunca se desborde.
 */
export function Tabla<F>({ columnas, filas, claveFila, pie, vacio, titulo, alSeleccionar, className }: PropsTabla<F>) {
    return (
        <div className={cx("overflow-hidden rounded-tarjeta border border-borde bg-superficie", className)}>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    {titulo ? <caption className="sr-only">{titulo}</caption> : null}
                    <thead>
                        <tr className="bg-superficie-activa text-left text-xs font-semibold text-texto-suave">
                            {columnas.map(c => (
                                <th
                                    key={c.clave}
                                    scope="col"
                                    className={cx(
                                        "whitespace-nowrap px-4 py-2.5",
                                        c.numerica && "text-right",
                                        c.ocultarEnMovil && "hidden sm:table-cell"
                                    )}
                                >
                                    {c.titulo}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filas.length === 0 ? (
                            <tr>
                                <td colSpan={columnas.length} className="px-4 py-8 text-center text-texto-suave">
                                    {vacio ?? "Sin registros."}
                                </td>
                            </tr>
                        ) : filas.map(fila => (
                            <tr
                                key={claveFila(fila)}
                                className={cx(
                                    "border-t border-borde",
                                    alSeleccionar && "cursor-pointer hover:bg-fondo"
                                )}
                                onClick={alSeleccionar ? () => alSeleccionar(fila) : undefined}
                            >
                                {columnas.map(c => (
                                    <td
                                        key={c.clave}
                                        className={cx(
                                            "px-4 py-3 text-texto",
                                            c.numerica && "cifra whitespace-nowrap text-right",
                                            c.ocultarEnMovil && "hidden sm:table-cell"
                                        )}
                                    >
                                        {c.celda(fila)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                    {pie ? <tfoot className="border-t border-borde bg-fondo font-semibold">{pie}</tfoot> : null}
                </table>
            </div>
        </div>
    );
}
