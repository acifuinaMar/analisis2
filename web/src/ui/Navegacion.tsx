import { Enlace } from "../app/enrutador";
import { cx } from "./clases";
import { Icono } from "./Icono";

/**
 * Pasos numerados del prototipo (Solicitud: Datos → Revisión → Resultado;
 * Registro de pago: Pago → Confirmación → Comprobante). El paso actual va
 * en azul marino; los completados llevan check.
 */
export function Pasos({ pasos, actual }: { pasos: ReadonlyArray<string>; actual: number }) {
    return (
        <ol className="flex items-start" aria-label="Progreso">
            {pasos.map((paso, i) => {
                const completado = i < actual;
                const enCurso = i === actual;
                return (
                    <li key={paso} className="relative flex flex-1 flex-col items-center text-center">
                        {i > 0 ? (
                            <span
                                aria-hidden="true"
                                className={cx(
                                    "absolute right-1/2 top-3.5 h-px w-full -translate-y-1/2",
                                    i <= actual ? "bg-marca" : "bg-borde-fuerte"
                                )}
                            />
                        ) : null}
                        <span
                            className={cx(
                                "relative z-10 flex size-7 items-center justify-center rounded-full border text-xs font-bold",
                                completado && "border-marca bg-marca text-white",
                                enCurso && "border-marca bg-marca text-white ring-4 ring-marca-suave",
                                !completado && !enCurso && "border-borde-fuerte bg-superficie text-texto-suave"
                            )}
                            aria-current={enCurso ? "step" : undefined}
                        >
                            {completado ? <Icono nombre="check" tamano={14} /> : i + 1}
                        </span>
                        <span className={cx("mt-1.5 text-xs", enCurso ? "font-semibold text-marca" : "text-texto-suave")}>
                            {paso}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

export interface OpcionPestana<V extends string> {
    readonly valor: V;
    readonly etiqueta: string;
}

/**
 * Pestañas segmentadas (prototipo: Resumen | Plan de pagos | Pagos;
 * Cierre: Diario | Mensual). La activa va rellena.
 */
export function Pestanas<V extends string>({
    opciones,
    valor,
    alCambiar,
    etiqueta
}: {
    opciones: ReadonlyArray<OpcionPestana<V>>;
    valor: V;
    alCambiar: (valor: V) => void;
    etiqueta: string;
}) {
    return (
        <div role="tablist" aria-label={etiqueta} className="flex overflow-x-auto rounded-lg border border-borde bg-superficie p-1">
            {opciones.map(o => {
                const activa = o.valor === valor;
                return (
                    <button
                        key={o.valor}
                        type="button"
                        role="tab"
                        aria-selected={activa}
                        onClick={() => alCambiar(o.valor)}
                        className={cx(
                            "flex-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            activa ? "bg-marca text-white" : "text-texto-medio hover:bg-superficie-activa"
                        )}
                    >
                        {o.etiqueta}
                    </button>
                );
            })}
        </div>
    );
}

/** Ruta de migas (prototipo, Créditos del tramo: Dashboard › Cartera › Mora 2). */
export function Migas({ elementos }: { elementos: ReadonlyArray<{ etiqueta: string; a?: string }> }) {
    return (
        <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1.5 text-sm">
            {elementos.map((e, i) => {
                const ultimo = i === elementos.length - 1;
                return (
                    <span key={e.etiqueta} className="flex min-w-0 items-center gap-1.5">
                        {i > 0 ? <Icono nombre="adelante" tamano={14} className="shrink-0 text-texto-suave" /> : null}
                        {ultimo || !e.a ? (
                            <span className={cx("truncate", ultimo ? "font-medium text-texto" : "text-texto-suave")} aria-current={ultimo ? "page" : undefined}>
                                {e.etiqueta}
                            </span>
                        ) : (
                            <Enlace a={e.a} className="truncate text-texto-suave hover:text-marca">
                                {e.etiqueta}
                            </Enlace>
                        )}
                    </span>
                );
            })}
        </nav>
    );
}
