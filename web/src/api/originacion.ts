import type { ClienteApi } from "./cliente";
import type {
    ClienteDadoDeAlta,
    CuerpoAltaCliente,
    CuerpoDesembolso,
    CuerpoSimulacion,
    PlanSimulado,
    RespuestaAsesores,
    ResultadoDesembolso
} from "./contratos";

/**
 * Endpoints de la originación (OP-3). Todos existen en src/api/app.ts y
 * son exclusivos del perfil asesor.
 *
 *   GET  /api/asesores             catálogo para elegir el asesor
 *   POST /api/clientes             alta del cliente            (ESCRIBE)
 *   POST /api/creditos/simulacion  plan simulado, no guarda nada
 *   POST /api/creditos             desembolso                  (ESCRIBE)
 */

export function listarAsesores(api: ClienteApi, senal?: AbortSignal) {
    return api.get<RespuestaAsesores>("/asesores", undefined, senal);
}

export function altaCliente(api: ClienteApi, cuerpo: CuerpoAltaCliente, senal?: AbortSignal) {
    return api.post<ClienteDadoDeAlta>("/clientes", cuerpo, senal);
}

export function simularCredito(api: ClienteApi, cuerpo: CuerpoSimulacion, senal?: AbortSignal) {
    return api.post<PlanSimulado>("/creditos/simulacion", cuerpo, senal);
}

export function desembolsarCredito(api: ClienteApi, cuerpo: CuerpoDesembolso, senal?: AbortSignal) {
    return api.post<ResultadoDesembolso>("/creditos", cuerpo, senal);
}
