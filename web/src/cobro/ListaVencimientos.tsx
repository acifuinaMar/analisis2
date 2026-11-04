import type { CuotaPorVencer } from "../api/contratos";
import { BotonEnlace, Chip } from "../ui";
import { formatoFecha, formatoQuetzales } from "../utilidades/formato";

/**
 * Cuotas por vencer, tal como las devuelve GET /api/vencimientos.
 *
 * No hay botón "Cobrar": una cuota que todavía no vence no es exigible, y
 * el registro de pago solo acepta deuda exigible. Desde aquí se va al
 * detalle del crédito para preparar la visita.
 */
export function ListaVencimientos({ cuotas }: { cuotas: ReadonlyArray<CuotaPorVencer> }) {
    return (
        <ul className="space-y-2" aria-label="Cuotas por vencer">
            {cuotas.map(c => (
                <li key={`${c.idCredito}-${c.numeroCuota}`} className="rounded-tarjeta border border-borde bg-superficie p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-texto">{c.nombreCliente}</p>
                            <p className="text-sm text-texto-suave">
                                <span className="font-mono">{c.idCredito}</span> · Cuota N.º {c.numeroCuota}
                            </p>
                        </div>
                        <Chip variante={c.diasParaVencer <= 3 ? "alerta" : "info"}>
                            {c.diasParaVencer === 1 ? "Mañana" : `En ${c.diasParaVencer} días`}
                        </Chip>
                    </div>
                    <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                        <p className="cifra text-sm text-texto-medio">
                            Vence {formatoFecha(c.fechaVencimiento)} ·{" "}
                            <strong className="text-texto">{formatoQuetzales(c.montoPendiente)}</strong>
                            {c.montoPendiente !== c.montoCuota
                                ? <span className="text-texto-suave"> de {formatoQuetzales(c.montoCuota)}</span>
                                : null}
                        </p>
                        <BotonEnlace a={`/asesor/creditos/${encodeURIComponent(c.idCredito)}`} variante="secundario" tamano="sm">
                            Ver crédito
                        </BotonEnlace>
                    </div>
                </li>
            ))}
        </ul>
    );
}
