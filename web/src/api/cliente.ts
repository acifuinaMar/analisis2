/**
 * Cliente HTTP de la API REST existente (src/api/app.ts).
 *
 * Es la ÚNICA puerta de la interfaz hacia el sistema. No hay otra API ni
 * lógica financiera aquí: se arma la petición, se manda el perfil y se
 * traduce la convención uniforme de errores de src/api/errores.ts.
 *
 * Perfil: viaja en el encabezado X-Perfil, que es el mecanismo que ya
 * verifica el servidor (src/api/perfiles.ts, catálogo en
 * src/acceso/perfil.ts). No es autenticación —el enunciado la deja fuera
 * en su sección 3.1— y la interfaz no lo presenta como tal: ocultar un
 * botón es comodidad; quien decide es el servidor.
 */

/** Los perfiles de src/acceso/perfil.ts. Se repiten aquí solo como tipo. */
export type Perfil = "asesor" | "gerencia";

export const PERFILES: readonly Perfil[] = ["asesor", "gerencia"];

export function esPerfil(valor: unknown): valor is Perfil {
    return valor === "asesor" || valor === "gerencia";
}

/**
 * Error con la forma uniforme de la API:
 * { error: true, codigo, mensaje, detalle? }.
 *
 * `detalle` trae datos para REACCIONAR, no solo para leer: por ejemplo
 * `montoCorrecto` en MONTO_NO_EXACTO. La pantalla los toma de aquí en vez
 * de sacarlos del texto del mensaje.
 */
export class ErrorApi extends Error {
    constructor(
        public readonly estado: number,
        public readonly codigo: string,
        mensaje: string,
        public readonly detalle?: Record<string, unknown>
    ) {
        super(mensaje);
        this.name = "ErrorApi";
    }
}

export type ValorConsulta = string | number | boolean | undefined | null;

export interface OpcionesCliente {
    /** Perfil vigente; se lee en cada petición, no al crear el cliente. */
    readonly obtenerPerfil: () => Perfil | null;
    /** Prefijo de la API. En desarrollo Vite lo reenvía a `npm run api`. */
    readonly base?: string;
    /** Inyectable para las pruebas. */
    readonly fetchImpl?: typeof fetch;
}

export interface ClienteApi {
    get<T>(ruta: string, consulta?: Record<string, ValorConsulta>, senal?: AbortSignal): Promise<T>;
    post<T>(ruta: string, cuerpo: unknown, senal?: AbortSignal): Promise<T>;
}

/** Arma "?a=1&b=x" omitiendo los valores vacíos. */
export function armarConsulta(consulta?: Record<string, ValorConsulta>): string {
    if (!consulta) {
        return "";
    }
    const parametros = new URLSearchParams();
    for (const [clave, valor] of Object.entries(consulta)) {
        if (valor !== undefined && valor !== null && valor !== "") {
            parametros.set(clave, String(valor));
        }
    }
    const texto = parametros.toString();
    return texto ? `?${texto}` : "";
}

export function crearClienteApi(opciones: OpcionesCliente): ClienteApi {

    const base = opciones.base ?? "/api";
    const hacerFetch = opciones.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

    async function pedir<T>(metodo: "GET" | "POST", ruta: string, cuerpo: unknown, senal?: AbortSignal): Promise<T> {

        const encabezados: Record<string, string> = { Accept: "application/json" };

        const perfil = opciones.obtenerPerfil();
        if (perfil) {
            encabezados["X-Perfil"] = perfil;
        }
        if (cuerpo !== undefined) {
            encabezados["Content-Type"] = "application/json";
        }

        let respuesta: Response;
        try {
            respuesta = await hacerFetch(`${base}${ruta}`, {
                method: metodo,
                headers: encabezados,
                body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
                signal: senal
            });
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                throw error;
            }
            throw new ErrorApi(
                0,
                "SIN_CONEXION",
                "No se pudo conectar con la API. Verifique que `npm run api` esté corriendo."
            );
        }

        const datos: unknown = await respuesta.json().catch(() => undefined);

        if (!respuesta.ok) {
            const e = (datos ?? {}) as Partial<{ codigo: string; mensaje: string; detalle: Record<string, unknown> }>;
            throw new ErrorApi(
                respuesta.status,
                typeof e.codigo === "string" ? e.codigo : `HTTP_${respuesta.status}`,
                typeof e.mensaje === "string" ? e.mensaje : "La API respondió con un error.",
                e.detalle
            );
        }

        return datos as T;
    }

    return {
        get: (ruta, consulta, senal) => pedir("GET", `${ruta}${armarConsulta(consulta)}`, undefined, senal),
        post: (ruta, cuerpo, senal) => pedir("POST", ruta, cuerpo, senal)
    };
}
