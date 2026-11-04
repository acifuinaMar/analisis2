import { obtenerCredito } from "../api/cobro";
import { useConsulta } from "../api/useConsulta";
import { useSesion } from "../estado/sesion";
import { BotonEnlace, ChipEstado, ChipTramo, Esqueleto, Icono } from "../ui";
import { formatoQuetzales } from "../utilidades/formato";

/**
 * Un crédito dentro de los resultados de búsqueda. Su estado y su saldo
 * los pide a GET /api/creditos/:id con la fecha de corte vigente: la
 * búsqueda solo dice QUÉ créditos tiene el cliente, nunca sus cifras.
 */
export function TarjetaCreditoResumen({ idCredito, accion }: { idCredito: string; accion: "detalle" | "cobro" }) {
    const { api, fechaCorte } = useSesion();
    const consulta = useConsulta(s => obtenerCredito(api, idCredito, fechaCorte, s), [idCredito, fechaCorte]);
    const ruta = encodeURIComponent(idCredito);

    return (
        <li className="rounded-lg border border-borde bg-fondo p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-texto">{idCredito}</p>
                    {consulta.cargando ? (
                        <div className="mt-2 space-y-1.5" aria-label="Cargando crédito">
                            <Esqueleto className="h-4 w-28" />
                            <Esqueleto className="h-3 w-20" />
                        </div>
                    ) : consulta.error ? (
                        <p className="mt-1 text-xs text-peligro">No se pudo cargar: {consulta.error.codigo}</p>
                    ) : consulta.datos ? (
                        <>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                <ChipEstado estado={consulta.datos.estado} />
                                <ChipTramo tramo={consulta.datos.tramo} />
                            </div>
                            <p className="cifra mt-1.5 text-sm text-texto-medio">
                                Saldo <strong className="text-texto">{formatoQuetzales(consulta.datos.saldoCapital)}</strong>
                                {consulta.datos.diasAtraso > 0 ? ` · ${consulta.datos.diasAtraso} días de atraso` : ""}
                            </p>
                        </>
                    ) : null}
                </div>
                <Icono nombre="tarjeta" tamano={18} className="mt-0.5 shrink-0 text-texto-suave" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                {accion === "cobro" ? (
                    <BotonEnlace a={`/asesor/pagos?credito=${ruta}`} tamano="sm" icono="tarjeta">Cobrar este crédito</BotonEnlace>
                ) : (
                    <>
                        <BotonEnlace a={`/asesor/creditos/${ruta}`} tamano="sm">Ver detalle</BotonEnlace>
                        <BotonEnlace a={`/asesor/pagos?credito=${ruta}`} tamano="sm" variante="secundario">Cobrar</BotonEnlace>
                    </>
                )}
            </div>
        </li>
    );
}
