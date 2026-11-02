import type { ClienteApi } from "./cliente";
import type {
    CuerpoRegistrarPago,
    DeudaCuota,
    DeudaExigible,
    EstadoCredito,
    ExplicacionMora,
    PlanDeCredito,
    ResultadoBusquedaClientes,
    ResultadoPago
} from "./contratos";

/**
 * Endpoints que usa el cobro en campo. Todos EXISTEN en src/api/app.ts;
 * aquí solo se fija la ruta y el tipo de la respuesta, para que ninguna
 * pantalla escriba URLs a mano.
 */

const id = encodeURIComponent;

export function buscarClientes(api: ClienteApi, buscar: string, senal?: AbortSignal) {
    return api.get<ResultadoBusquedaClientes>("/clientes", { buscar }, senal);
}

export function obtenerCredito(api: ClienteApi, idCredito: string, fechaCorte: string, senal?: AbortSignal) {
    return api.get<EstadoCredito>(`/creditos/${id(idCredito)}`, { fechaCorte }, senal);
}

export function obtenerPlan(api: ClienteApi, idCredito: string, fechaCorte: string, senal?: AbortSignal) {
    return api.get<PlanDeCredito>(`/creditos/${id(idCredito)}/plan`, { fechaCorte }, senal);
}

export function obtenerDeuda(api: ClienteApi, idCredito: string, fechaCorte: string, senal?: AbortSignal) {
    return api.get<DeudaExigible>(`/creditos/${id(idCredito)}/deuda`, { fechaCorte }, senal);
}

export function obtenerDeudaCuota(api: ClienteApi, idCredito: string, numero: number, fechaCorte: string, senal?: AbortSignal) {
    return api.get<DeudaCuota>(`/creditos/${id(idCredito)}/cuotas/${numero}/deuda`, { fechaCorte }, senal);
}

export function obtenerMora(api: ClienteApi, idCredito: string, numero: number, fechaCorte: string, senal?: AbortSignal) {
    return api.get<ExplicacionMora>(`/creditos/${id(idCredito)}/cuotas/${numero}/mora`, { fechaCorte }, senal);
}

/**
 * POST /api/creditos/:id/pagos. Con `confirmado: false` es la vista previa
 * y no mueve nada; con `true` aplica el pago. La clave de idempotencia
 * hace que repetir la misma operación nunca cobre dos veces.
 */
export function registrarPago(api: ClienteApi, idCredito: string, cuerpo: CuerpoRegistrarPago, senal?: AbortSignal) {
    return api.post<ResultadoPago>(`/creditos/${id(idCredito)}/pagos`, cuerpo, senal);
}
