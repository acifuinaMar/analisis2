import { expect, test } from "@playwright/test";

import { ErrorApi } from "../src/api/cliente";
import type { ClienteEncontrado, CuerpoDesembolso, EstadoCredito, PlanDeCredito } from "../src/api/contratos";
import {
    borrarOriginacionPendiente,
    CLAVE_ALMACEN_ORIGINACION,
    clasificarError,
    guardarOriginacionPendiente,
    leerImporte,
    leerOriginacionPendiente,
    leerPlazo,
    leerTna,
    mismaSimulacion,
    tnaComoPorcentaje,
    verificarAlta,
    verificarDesembolso
} from "../src/originacion/operacionOriginacion";
import { etiquetaCuotasQueCubre, rotuloCuotas } from "../src/utilidades/etiquetas";

/**
 * Fase 3 · Reglas puras de la originación (Node, sin navegador).
 */

function almacenEnMemoria() {
    const datos = new Map<string, string>();
    return {
        datos,
        getItem: (k: string) => datos.get(k) ?? null,
        setItem: (k: string, v: string) => { datos.set(k, v); },
        removeItem: (k: string) => { datos.delete(k); }
    };
}

const TERMINOS = {
    idCredito: "CV-2026-0200", idAsesor: "AS-01", capital: 10000,
    plazoMeses: 12, tnaAnual: 0.36, fechaDesembolso: "2026-10-31"
};

test.describe("Lectura de los campos", () => {

    test("TNA en porcentaje → decimal exacto (D3)", () => {
        expect(leerTna("36")).toBe(0.36);
        expect(leerTna("36.5")).toBe(0.365);
        expect(leerTna("30,5 %")).toBe(0.305);
        expect(leerTna("8")).toBe(0.08);
        expect(leerTna("120")).toBe(1.2);
        expect(leerTna("0.25")).toBe(0.0025);
        expect(leerTna("0")).toBeNull();
        expect(leerTna("treinta")).toBeNull();
        expect(leerTna("-5")).toBeNull();
        expect(leerTna("")).toBeNull();
        expect(tnaComoPorcentaje(0.365)).toBe("36.5 %");
        expect(tnaComoPorcentaje(0.36)).toBe("36 %");
    });

    test("importe y plazo: formato, sin redondear", () => {
        expect(leerImporte("10,000.00")).toBe(10000);
        expect(leerImporte("Q 2500.5")).toBe(2500.5);
        expect(leerImporte("100.555")).toBeNull();
        expect(leerImporte("0")).toBeNull();
        expect(leerImporte("abc")).toBeNull();
        expect(leerPlazo("12")).toBe(12);
        expect(leerPlazo("12.5")).toBeNull();
        expect(leerPlazo("0")).toBeNull();
    });

    test("simulación vigente solo con los mismos términos", () => {
        const a = { capital: 10000, plazoMeses: 12, tnaAnual: 0.36, fechaDesembolso: "2026-10-31" };
        expect(mismaSimulacion(a, { ...a })).toBe(true);
        expect(mismaSimulacion(a, { ...a, capital: 10000.01 })).toBe(false);
        expect(mismaSimulacion(a, { ...a, tnaAnual: 0.365 })).toBe(false);
        expect(mismaSimulacion(a, { ...a, fechaDesembolso: "2026-11-01" })).toBe(false);
    });
});

test.describe("Clasificación de la respuesta de una escritura", () => {

    test("sin respuesta, 5xx o error de red: incierta", () => {
        expect(clasificarError(new ErrorApi(0, "SIN_RESPUESTA", "x"), false)).toBe("incierta");
        expect(clasificarError(new ErrorApi(503, "SIN_API", "x"), false)).toBe("incierta");
        expect(clasificarError(new TypeError("Failed to fetch"), false)).toBe("incierta");
        expect(clasificarError(new DOMException("t", "TimeoutError"), false)).toBe("incierta");
    });

    test("duplicado en el PRIMER envío: rechazo, nunca éxito", () => {
        for (const codigo of ["CLIENTE_DUPLICADO", "DPI_DUPLICADO", "CREDITO_DUPLICADO"]) {
            expect(clasificarError(new ErrorApi(409, codigo, "x"), false)).toBe("rechazada");
        }
    });

    test("duplicado después de un envío incierto: sigue incierta (pudo ser el nuestro)", () => {
        for (const codigo of ["CLIENTE_DUPLICADO", "DPI_DUPLICADO", "CREDITO_DUPLICADO"]) {
            expect(clasificarError(new ErrorApi(409, codigo, "x"), true)).toBe("incierta");
        }
    });

    test("otros rechazos del servidor: rechazada", () => {
        expect(clasificarError(new ErrorApi(400, "CAPITAL_FUERA_DE_RANGO", "x"), true)).toBe("rechazada");
        expect(clasificarError(new ErrorApi(422, "CLIENTE_INEXISTENTE", "x"), false)).toBe("rechazada");
    });
});

test.describe("Verificación del alta (solo lecturas)", () => {

    const enviado = { idCliente: "CL-0200", nombreCompleto: "Diana Prueba", dpi: "DPI-000200", telefono: "1", municipio: "Mixco" };
    const encontrado = (cambios: Partial<ClienteEncontrado> = {}): ClienteEncontrado => ({
        idCliente: "CL-0200", nombreCompleto: "Diana Prueba", municipio: "Mixco", dpiTerminacion: "0200", creditos: [], ...cambios
    });

    test("no consta si el identificador no aparece (otros resultados no cuentan)", () => {
        expect(verificarAlta("CL-0200", enviado, []).resultado).toBe("no_consta");
        expect(verificarAlta("CL-0200", enviado, [encontrado({ idCliente: "CL-2000" })]).resultado).toBe("no_consta");
    });

    test("coincidencia NO es confirmación: el resultado es «coincidencia»", () => {
        const v = verificarAlta("CL-0200", enviado, [encontrado()]);
        expect(v.resultado).toBe("coincidencia");
        expect(v.campos.every(c => c.coincide)).toBe(true);
    });

    test("basta un dato distinto (municipio o DPI) para el conflicto, aunque el nombre coincida", () => {
        expect(verificarAlta("CL-0200", enviado, [encontrado({ municipio: "Antigua" })]).resultado).toBe("conflicto");
        expect(verificarAlta("CL-0200", enviado, [encontrado({ dpiTerminacion: "9999" })]).resultado).toBe("conflicto");
    });

    test("tras recargar (sin datos personales) solo se sabe que el identificador existe", () => {
        const v = verificarAlta("CL-0200", null, [encontrado()]);
        expect(v.resultado).toBe("coincidencia");
        expect(v.campos).toHaveLength(0);
    });
});

test.describe("Verificación del desembolso (solo lecturas)", () => {

    const enviado: CuerpoDesembolso = { ...TERMINOS, idCliente: "CL-0200" };
    const credito = (c: Partial<EstadoCredito> = {}) => ({ idCliente: "CL-0200", capitalDesembolsado: 10000, ...c }) as EstadoCredito;
    const plan = (c: Partial<PlanDeCredito> = {}) => ({ plazoMeses: 12, tnaAnual: 0.36, fechaDesembolso: "2026-10-31", ...c }) as PlanDeCredito;

    test("no consta con CREDITO_INEXISTENTE", () => {
        expect(verificarDesembolso(enviado, null, null).resultado).toBe("no_consta");
    });

    test("todo coincide: «coincidencia», sigue incierto", () => {
        expect(verificarDesembolso(enviado, credito(), plan()).resultado).toBe("coincidencia");
    });

    test("mismo titular no basta: cualquier término distinto es conflicto", () => {
        expect(verificarDesembolso(enviado, credito({ capitalDesembolsado: 9000 }), plan()).resultado).toBe("conflicto");
        expect(verificarDesembolso(enviado, credito(), plan({ plazoMeses: 6 })).resultado).toBe("conflicto");
        expect(verificarDesembolso(enviado, credito(), plan({ tnaAnual: 0.3 })).resultado).toBe("conflicto");
        expect(verificarDesembolso(enviado, credito(), plan({ fechaDesembolso: "2026-01-01" })).resultado).toBe("conflicto");
        expect(verificarDesembolso(enviado, credito({ idCliente: "CL-0060" }), plan()).resultado).toBe("conflicto");
    });
});

test.describe("Almacenamiento mínimo de la operación pendiente", () => {

    test("guarda solo identificadores y términos; nunca datos personales", () => {
        const s = almacenEnMemoria();
        guardarOriginacionPendiente({ paso: "alta", estado: "enviando", idCliente: "CL-0200", credito: TERMINOS }, s);
        const texto = s.datos.get(CLAVE_ALMACEN_ORIGINACION)!;
        expect(Object.keys(JSON.parse(texto)).sort()).toEqual(
            ["capital", "estado", "fechaDesembolso", "idAsesor", "idCliente", "idCredito", "paso", "plazoMeses", "tnaAnual"]
        );
    });

    test("lo que estaba «enviando» vuelve como «incierta»; lo inválido se ignora; se borra", () => {
        const s = almacenEnMemoria();
        guardarOriginacionPendiente({ paso: "desembolso", estado: "enviando", idCliente: "CL-0200", credito: TERMINOS }, s);
        expect(leerOriginacionPendiente(s)).toEqual({ paso: "desembolso", estado: "incierta", idCliente: "CL-0200", credito: TERMINOS });

        s.setItem(CLAVE_ALMACEN_ORIGINACION, JSON.stringify({ paso: "alta", idCliente: "x" }));
        expect(leerOriginacionPendiente(s)).toBeNull();
        s.setItem(CLAVE_ALMACEN_ORIGINACION, "{no es json");
        expect(leerOriginacionPendiente(s)).toBeNull();

        borrarOriginacionPendiente(s);
        expect(s.datos.size).toBe(0);
        expect(leerOriginacionPendiente(null)).toBeNull();
    });
});

test.describe("Rótulos de cuotas en singular o plural (D5)", () => {

    test("una cuota o varias", () => {
        expect(rotuloCuotas([3])).toBe("Cuota N.º 3");
        expect(rotuloCuotas([1, 2])).toBe("Cuotas N.º 1, 2");
        expect(rotuloCuotas([2], false)).toBe("cuota N.º 2");
        expect(etiquetaCuotasQueCubre(1)).not.toBe(etiquetaCuotasQueCubre(2));
    });
});
