import { DetalleCredito, DetalleMora } from "../asesor/CobroEnCampo";
import { PlanAmortizacion } from "../asesor/PlanAmortizacion";

/**
 * Detalle del crédito para la gerencia (G-5 y G-7), decisión D2: SOLO
 * CONSULTA. Reutiliza las pantallas del asesor, que con el perfil
 * gerencia enlazan bajo /gerencia y no ofrecen «Registrar pago». En
 * escritorio se limita el ancho para que se lea como una ficha.
 *
 * Endpoints (ambos perfiles en src/api/app.ts): GET /api/creditos/:id,
 * /plan, /deuda, /cuotas/:n/mora y /cuotas/:n/deuda.
 */

export function DetalleCreditoGerencia() {
    return <div className="max-w-4xl"><DetalleCredito /></div>;
}

export function MoraGerencia() {
    return <div className="max-w-4xl"><DetalleMora /></div>;
}

export function PlanGerencia() {
    return <div className="max-w-5xl"><PlanAmortizacion /></div>;
}
