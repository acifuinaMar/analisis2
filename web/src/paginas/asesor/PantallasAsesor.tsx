import { useParametros } from "../../app/enrutador";
import { PantallaPendiente } from "../PantallaPendiente";

/**
 * Pantallas del asesor que todavía son marcadores (Fase 3: originación y
 * plan de amortización). Las del cobro en campo ya están en
 * CobroEnCampo.tsx y RegistroPago.tsx.
 */

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
