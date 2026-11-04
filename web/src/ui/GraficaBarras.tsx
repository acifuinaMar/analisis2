import { cx } from "./clases";

export interface Barra {
    readonly etiqueta: string;
    /** Magnitud que entregó la API (saldo, conteo). Solo define la altura. */
    readonly valor: number;
    /** Texto de la cifra, ya formateado, para el rótulo y la tabla accesible. */
    readonly rotulo: string;
    readonly destacada?: boolean;
}

/**
 * Gráfica de barras del prototipo ("Pagos del mes": barras gris pizarra
 * con la destacada en azul marino). SVG propio, sin librería.
 *
 * La altura es proporcional al valor: es la única "cuenta" que hace, y es
 * geometría de dibujo, no una cifra que se muestre. Las cifras visibles
 * son los rótulos que vienen formateados de la API. Debajo va la misma
 * información como tabla oculta para lectores de pantalla.
 */
export function GraficaBarras({ barras, titulo, alto = 180, className }: { barras: ReadonlyArray<Barra>; titulo: string; alto?: number; className?: string }) {

    const maximo = Math.max(0, ...barras.map(b => b.valor));
    const ancho = 100 / Math.max(barras.length, 1);

    return (
        <figure className={cx("w-full", className)}>
            <div className="flex items-end gap-3" style={{ height: alto }} aria-hidden="true">
                {barras.map(b => {
                    const proporcion = maximo > 0 ? b.valor / maximo : 0;
                    return (
                        <div key={b.etiqueta} className="flex h-full flex-1 flex-col items-center justify-end gap-1" style={{ maxWidth: `${ancho}%` }}>
                            <span className="cifra text-[11px] font-semibold text-texto-medio">{b.rotulo}</span>
                            <div
                                className={cx("w-full max-w-12 rounded-t-md", b.destacada ? "bg-serie-1" : "bg-serie-2")}
                                style={{ height: `${Math.max(proporcion * 100, b.valor > 0 ? 2 : 0)}%` }}
                            />
                        </div>
                    );
                })}
            </div>
            <div className="mt-2 flex gap-3" aria-hidden="true">
                {barras.map(b => (
                    <span key={b.etiqueta} className={cx("flex-1 text-center text-xs", b.destacada ? "font-semibold text-marca" : "text-texto-suave")} style={{ maxWidth: `${ancho}%` }}>
                        {b.etiqueta}
                    </span>
                ))}
            </div>
            <figcaption className="sr-only">
                {titulo}
                <table>
                    <tbody>
                        {barras.map(b => (
                            <tr key={b.etiqueta}><th scope="row">{b.etiqueta}</th><td>{b.rotulo}</td></tr>
                        ))}
                    </tbody>
                </table>
            </figcaption>
        </figure>
    );
}
