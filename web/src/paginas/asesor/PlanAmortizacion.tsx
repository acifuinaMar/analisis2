import { obtenerCredito, obtenerPlan } from "../../api/cobro";
import { useConsulta } from "../../api/useConsulta";
import { useParametros } from "../../app/enrutador";
import { useSesion } from "../../estado/sesion";
import { TablaPlan } from "../../plan/TablaPlan";
import {
    AvisoError,
    BotonEnlace,
    Cargando,
    ChipEstado,
    EncabezadoPagina,
    EncabezadoTarjeta,
    EstadoVacio,
    RejillaDatos,
    Tarjeta
} from "../../ui";
import { formatoFecha, formatoFechaLarga, formatoPorcentaje, formatoQuetzales } from "../../utilidades/formato";

/**
 * Plan de amortización de un crédito (pantalla obligatoria del E1).
 *
 * GET /api/creditos/:id/plan con la fecha de corte del encabezado: el
 * plan programado por el núcleo (sistema francés) y, por cuota, lo pagado,
 * su estado y si está vencida a esa fecha. El nombre y el estado del
 * crédito vienen de GET /api/creditos/:id.
 *
 * El plan de un crédito existente no trae totales y la interfaz no los
 * suma. La mora y los gastos de una cuota vencida están en «Detalle de la
 * mora».
 */
export function PlanAmortizacion() {
    const { id = "" } = useParametros();
    const { api, fechaCorte } = useSesion();

    const plan = useConsulta(s => obtenerPlan(api, id, fechaCorte, s), [id, fechaCorte]);
    const credito = useConsulta(s => obtenerCredito(api, id, fechaCorte, s), [id, fechaCorte]);

    if (plan.cargando && !plan.datos) {
        return <Cargando texto="Cargando el plan…" />;
    }
    if (plan.error) {
        return plan.error.codigo === "CREDITO_INEXISTENTE"
            ? <EstadoVacio icono="alerta" titulo="El crédito no existe">No hay un crédito {id}.</EstadoVacio>
            : <AvisoError error={plan.error} alReintentar={plan.recargar} />;
    }

    const p = plan.datos;
    if (!p) {
        return null;
    }
    const c = credito.datos;
    const ruta = encodeURIComponent(id);

    return (
        <div className="space-y-5">
            <EncabezadoPagina
                titulo="Plan de amortización"
                subtitulo={`Estado de las cuotas al ${formatoFechaLarga(fechaCorte)}.`}
            />

            <Tarjeta className="p-4">
                <EncabezadoTarjeta
                    titulo={<span className="font-mono">{p.idCredito}</span>}
                    subtitulo={c ? `${c.nombreCliente} · ${c.idCliente}` : undefined}
                    accion={c ? <ChipEstado estado={c.estado} /> : undefined}
                    separador
                />
                <RejillaDatos
                    className="mt-4"
                    pares={[
                        { etiqueta: "Capital", valor: formatoQuetzales(p.capital), enfasis: true },
                        { etiqueta: "Plazo", valor: `${p.plazoMeses} meses` },
                        { etiqueta: "Tasa anual", valor: `${formatoPorcentaje(p.tnaAnual, 0)} nominal` },
                        { etiqueta: "Desembolso", valor: formatoFecha(p.fechaDesembolso) }
                    ]}
                />
            </Tarjeta>

            <TablaPlan titulo="Cuotas del plan de amortización" filas={p.cuotas} />

            <p className="text-xs text-texto-suave">
                Cuotas del sistema francés calculadas por el núcleo. «Vencida» y los días de atraso se miden a la
                fecha de corte. En el teléfono se ocultan interés, capital, saldo y lo pagado.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
                <BotonEnlace a={`/asesor/creditos/${ruta}`} variante="secundario" bloque>Volver al detalle del crédito</BotonEnlace>
                <BotonEnlace a={`/asesor/pagos?credito=${ruta}`} icono="tarjeta" bloque>Registrar pago</BotonEnlace>
            </div>
        </div>
    );
}
