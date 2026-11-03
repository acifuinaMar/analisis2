import type { ClienteApi } from "./cliente";
import type { Cierre, EstadoCartera, ListadoCreditosEnMora } from "./contratos";

/**
 * Consultas del perfil gerencia (Fase 4). Todas EXISTEN en src/api/app.ts:
 *
 *   GET /api/cartera?fechaCorte=             solo gerencia  (G-1)
 *   GET /api/cartera/mora?fechaCorte=&tramo= ambos perfiles (G-4)
 *   GET /api/cierres/diario?fechaCorte=      solo gerencia  (G-3)
 *   GET /api/cierres/mensual?periodo=        solo gerencia  (G-2)
 *
 * Son lecturas: ninguna escribe nada.
 */

/** Tramos que acepta el filtro de /api/cartera/mora (TramoEnMoraEsquema). */
export const TRAMOS_EN_MORA = ["mora_1", "mora_2", "mora_3", "vencido"] as const;

export type TramoEnMora = typeof TRAMOS_EN_MORA[number];

export function esTramoEnMora(t: string | undefined | null): t is TramoEnMora {
    return TRAMOS_EN_MORA.some(x => x === t);
}

export function obtenerCartera(api: ClienteApi, fechaCorte: string, senal?: AbortSignal) {
    return api.get<EstadoCartera>("/cartera", { fechaCorte }, senal);
}

export function listarCreditosEnMora(api: ClienteApi, fechaCorte: string, tramo: TramoEnMora | undefined, senal?: AbortSignal) {
    return api.get<ListadoCreditosEnMora>("/cartera/mora", tramo ? { fechaCorte, tramo } : { fechaCorte }, senal);
}

export function obtenerCierreDiario(api: ClienteApi, fechaCorte: string, senal?: AbortSignal) {
    return api.get<Cierre>("/cierres/diario", { fechaCorte }, senal);
}

export function obtenerCierreMensual(api: ClienteApi, periodo: string, senal?: AbortSignal) {
    return api.get<Cierre>("/cierres/mensual", { periodo }, senal);
}
