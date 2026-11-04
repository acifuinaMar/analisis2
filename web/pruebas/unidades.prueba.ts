import { expect, test } from "@playwright/test";

import { armarConsulta, crearClienteApi, ErrorApi } from "../src/api/cliente";
import { etiquetaTramoConExplicacion, varianteEstado } from "../src/utilidades/etiquetas";
import { esFechaValida, fechaCorteInicial, periodoDe } from "../src/utilidades/fechas";
import { formatoFecha, formatoFechaLarga, formatoPeriodo, formatoPorcentaje, formatoQuetzales, iniciales } from "../src/utilidades/formato";

/**
 * Pruebas de funciones puras (corren en Node, sin navegador).
 */

test.describe("Formato de presentación (no calcula: solo escribe)", () => {

    test("quetzales con separador de miles y dos decimales, como el prototipo", () => {
        expect(formatoQuetzales(8542.15)).toBe("Q 8,542.15");
        expect(formatoQuetzales(1004.6)).toBe("Q 1,004.60");
        expect(formatoQuetzales(0)).toBe("Q 0.00");
        // flujoNeto del cierre puede ser negativo
        expect(formatoQuetzales(-1500)).toBe("−Q 1,500.00");
        expect(formatoQuetzales(Number.NaN)).toBe("—");
    });

    test("porcentaje desde la proporción que entrega la API", () => {
        expect(formatoPorcentaje(0.0606)).toBe("6.06%");
        expect(formatoPorcentaje(1)).toBe("100.00%");
    });

    test("fechas desde el texto AAAA-MM-DD, sin pasar por UTC", () => {
        expect(formatoFecha("2026-10-31")).toBe("31/10/2026");
        expect(formatoFecha("2026-01-01")).toBe("01/01/2026");
        expect(formatoFechaLarga("2026-10-31")).toBe("31 de octubre de 2026");
        expect(formatoPeriodo("2026-10")).toBe("Octubre 2026");
        expect(formatoFecha("no es fecha")).toBe("no es fecha");
    });

    test("iniciales para el avatar", () => {
        expect(iniciales("Gerencia")).toBe("GE");
        expect(iniciales("Ana Ruiz")).toBe("AR");
    });

    test("etiquetas del núcleo con su explicación (microcopy del P2)", () => {
        expect(etiquetaTramoConExplicacion("mora_2")).toBe("Mora 2 · lleva más de un mes de atraso");
        expect(varianteEstado("en_mora")).toBe("peligro");
        // Un código desconocido se muestra tal cual, no se inventa.
        expect(etiquetaTramoConExplicacion("otro")).toBe("otro");
    });
});

test.describe("Fecha de corte", () => {

    test("solo acepta fechas reales del calendario", () => {
        expect(esFechaValida("2026-10-31")).toBe(true);
        expect(esFechaValida("2028-02-29")).toBe(true);
        expect(esFechaValida("2026-02-30")).toBe(false);
        expect(esFechaValida("31/10/2026")).toBe(false);
    });

    test("la inicial es la configurada o la del guion, nunca el reloj", () => {
        expect(fechaCorteInicial("2027-01-24")).toBe("2027-01-24");
        expect(fechaCorteInicial(undefined)).toBe("2026-10-31");
        expect(fechaCorteInicial("basura")).toBe("2026-10-31");
        expect(periodoDe("2026-10-31")).toBe("2026-10");
    });
});

test.describe("Cliente de la API existente", () => {

    function fetchFalso(respuesta: { estado: number; cuerpo?: unknown }) {
        const llamadas: Array<{ url: string; init: RequestInit }> = [];
        const impl = (async (url: string, init: RequestInit) => {
            llamadas.push({ url, init });
            return new Response(
                respuesta.cuerpo === undefined ? null : JSON.stringify(respuesta.cuerpo),
                { status: respuesta.estado, headers: { "Content-Type": "application/json" } }
            );
        }) as unknown as typeof fetch;
        return { impl, llamadas };
    }

    test("arma la consulta omitiendo vacíos", () => {
        expect(armarConsulta({ fechaCorte: "2026-10-31", tramo: undefined, x: "" })).toBe("?fechaCorte=2026-10-31");
        expect(armarConsulta()).toBe("");
    });

    test("manda el perfil en X-Perfil, que es lo que verifica src/api/perfiles.ts", async () => {
        const { impl, llamadas } = fetchFalso({ estado: 200, cuerpo: { ok: true } });
        const api = crearClienteApi({ obtenerPerfil: () => "gerencia", fetchImpl: impl });

        await api.get("/cartera", { fechaCorte: "2026-10-31" });

        expect(llamadas[0]!.url).toBe("/api/cartera?fechaCorte=2026-10-31");
        expect((llamadas[0]!.init.headers as Record<string, string>)["X-Perfil"]).toBe("gerencia");
    });

    test("lee el perfil en cada petición (cambiar de perfil no deja el viejo)", async () => {
        const { impl, llamadas } = fetchFalso({ estado: 200, cuerpo: {} });
        let perfil: "asesor" | "gerencia" | null = "asesor";
        const api = crearClienteApi({ obtenerPerfil: () => perfil, fetchImpl: impl });

        await api.get("/salud");
        perfil = null;
        await api.get("/salud");

        expect((llamadas[0]!.init.headers as Record<string, string>)["X-Perfil"]).toBe("asesor");
        expect((llamadas[1]!.init.headers as Record<string, string>)["X-Perfil"]).toBeUndefined();
    });

    test("POST manda JSON", async () => {
        const { impl, llamadas } = fetchFalso({ estado: 200, cuerpo: {} });
        const api = crearClienteApi({ obtenerPerfil: () => "asesor", fetchImpl: impl });

        await api.post("/creditos/CV-2026-0043/pagos", { monto: 10, claveIdempotencia: "IDEM-1", fechaOperacion: "2026-10-31" });

        expect(llamadas[0]!.init.method).toBe("POST");
        expect((llamadas[0]!.init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
        expect(JSON.parse(String(llamadas[0]!.init.body))).toEqual({ monto: 10, claveIdempotencia: "IDEM-1", fechaOperacion: "2026-10-31" });
    });

    test("traduce la convención uniforme de errores con su detalle", async () => {
        const { impl } = fetchFalso({
            estado: 422,
            cuerpo: { error: true, codigo: "MONTO_NO_EXACTO", mensaje: "El monto correcto es otro.", detalle: { montoCorrecto: 123.45 } }
        });
        const api = crearClienteApi({ obtenerPerfil: () => "asesor", fetchImpl: impl });

        const error = await api.post("/creditos/CV-2026-0061/pagos", {}).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ErrorApi);
        expect((error as ErrorApi).estado).toBe(422);
        expect((error as ErrorApi).codigo).toBe("MONTO_NO_EXACTO");
        expect((error as ErrorApi).detalle).toEqual({ montoCorrecto: 123.45 });
    });

    test("sin conexión da un error claro en vez de una excepción cruda", async () => {
        const impl = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
        const api = crearClienteApi({ obtenerPerfil: () => null, fetchImpl: impl });

        const error = await api.get("/salud").catch((e: unknown) => e);

        expect((error as ErrorApi).codigo).toBe("SIN_CONEXION");
    });
});
