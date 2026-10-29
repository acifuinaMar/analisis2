import { useParametros } from "../../app/enrutador";
import { BotonEnlace } from "../../ui";
import { PantallaPendiente } from "../PantallaPendiente";

/**
 * Pantallas del asesor. En la Fase 1 solo existen su ruta, su lugar en la
 * navegación y su estructura; los datos se conectan en las fases 2 y 3.
 * Cada una declara qué endpoints EXISTENTES va a consumir.
 */

export function BuscarCliente() {
    return (
        <PantallaPendiente
            titulo="Buscar cliente"
            subtitulo="Busca por nombre, DPI o número de cliente."
            fase="Fase 2 · Cobro en campo"
            referencia="wf-06-busqueda-cliente.png, registro-pago.png"
            endpoints={["(pendiente) búsqueda de clientes: la API aún no la expone"]}
            silueta="tabla"
            notas="La API no tiene todavía una ruta para buscar clientes. Se resolverá en la Fase 2 antes de conectar la pantalla."
        />
    );
}

export function DetalleCredito() {
    const { id = "" } = useParametros();
    return (
        <PantallaPendiente
            titulo="Detalle del crédito"
            subtitulo={`Información del crédito ${id}.`}
            fase="Fase 2 · Cobro en campo"
            referencia="detalle-credito.png"
            endpoints={[
                `GET /api/creditos/${id}?fechaCorte=`,
                `GET /api/creditos/${id}/plan?fechaCorte=`,
                `GET /api/creditos/${id}/deuda?fechaCorte=`
            ]}
            silueta="detalle"
            notas={(
                <div className="flex flex-wrap gap-2">
                    <BotonEnlace a={`/asesor/creditos/${encodeURIComponent(id)}/mora`} variante="secundario" tamano="sm">Detalle de la mora</BotonEnlace>
                    <BotonEnlace a={`/asesor/creditos/${encodeURIComponent(id)}/plan`} variante="secundario" tamano="sm">Plan de amortización</BotonEnlace>
                </div>
            )}
        />
    );
}

export function DetalleMora() {
    const { id = "" } = useParametros();
    return (
        <PantallaPendiente
            titulo="Detalle de la mora"
            subtitulo="Cómo se calcula el monto de mora, tramo por tramo."
            fase="Fase 2 · Cobro en campo"
            referencia="detalle-de-la-mora.png"
            endpoints={[`GET /api/creditos/${id}/cuotas/:numero/mora?fechaCorte=`]}
            silueta="mora"
        />
    );
}

export function PlanAmortizacion() {
    const { id = "" } = useParametros();
    return (
        <PantallaPendiente
            titulo="Plan de amortización"
            subtitulo={`Cuotas del crédito ${id} y su avance de pago.`}
            fase="Fase 3 · Originación y plan"
            referencia="sin captura (pestaña «Plan de pagos» de detalle-credito.png)"
            endpoints={[`GET /api/creditos/${id}/plan?fechaCorte=`]}
            silueta="tabla"
        />
    );
}

export function RegistroPago() {
    return (
        <PantallaPendiente
            titulo="Registro de pago"
            subtitulo="Registra un pago realizado por el cliente."
            fase="Fase 2 · Cobro en campo"
            referencia="registro-pago.png, comprobante-pago.png"
            endpoints={[
                "GET /api/creditos/:id/deuda?fechaCorte=",
                "POST /api/creditos/:id/pagos  (sin confirmado → vista previa con desglose)",
                "POST /api/creditos/:id/pagos  (confirmado: true → aplica)"
            ]}
            silueta="formulario"
            notas="El desglose de la prelación se muestra siempre antes de permitir la confirmación."
        />
    );
}

export function SolicitudCredito() {
    return (
        <PantallaPendiente
            titulo="Nueva solicitud de crédito"
            subtitulo="Alta del cliente, simulación del plan y desembolso."
            fase="Fase 3 · Originación y plan"
            referencia="solicitud-de-crédito.png, simulación-crédito.png, aprobación-crédito.png"
            endpoints={[
                "GET /api/asesores",
                "POST /api/clientes",
                "POST /api/creditos/simulacion",
                "POST /api/creditos"
            ]}
            silueta="formulario"
        />
    );
}
