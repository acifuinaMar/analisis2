import { expect, test } from "@playwright/test";

import {
    borrarPendiente,
    CLAVE_ALMACEN,
    generarClave,
    guardarPendiente,
    leerMonto,
    leerPendiente,
    nuevaOperacion,
    operacionPara,
    type DatosPago,
    type OperacionPago
} from "../src/cobro/operacionPago";

/**
 * Reglas de la operación de pago idempotente (corren en Node, sin
 * navegador). Son las reglas que aprobó el equipo para la Fase 2.
 */

const A: DatosPago = { idCredito: "CV-2026-0043", monto: 1234.56, fechaOperacion: "2026-10-31", canal: "campo" };

function almacenFalso() {
    const datos = new Map<string, string>();
    return {
        datos,
        getItem: (k: string) => datos.get(k) ?? null,
        setItem: (k: string, v: string) => { datos.set(k, v); },
        removeItem: (k: string) => { datos.delete(k); }
    };
}

test.describe("Clave de idempotencia", () => {

    test("WEB-<uuid v4>, dentro del formato que acepta la API (4 a 64, [A-Za-z0-9._:-])", () => {
        const clave = generarClave();
        expect(clave).toMatch(/^WEB-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(clave.length).toBeLessThanOrEqual(64);
        expect(clave).toMatch(/^[A-Za-z0-9._:-]+$/);
        expect(generarClave()).not.toBe(clave);
    });
});

test.describe("Qué operación corresponde a los datos", () => {

    test("mismos datos: la MISMA operación y la misma clave", () => {
        const op = nuevaOperacion(A);
        expect(operacionPara(op, { ...A })).toBe(op);
    });

    test("cambia crédito, monto, fecha o canal: OTRA operación con clave nueva", () => {
        const op = nuevaOperacion(A);
        for (const cambio of [
            { idCredito: "CV-2026-0044" },
            { monto: 1234.5 },
            { fechaOperacion: "2026-11-01" },
            { canal: "agencia" as const }
        ]) {
            const otra = operacionPara(op, { ...A, ...cambio });
            expect(otra.clave, JSON.stringify(cambio)).not.toBe(op.clave);
            expect(otra.estado).toBe("borrador");
        }
    });

    test("pendiente (confirmando o incierta): se conserva aunque cambie el formulario", () => {
        for (const estado of ["confirmando", "incierta"] as const) {
            const op: OperacionPago = { ...nuevaOperacion(A), estado };
            const misma = operacionPara(op, { ...A, monto: 1 });
            expect(misma).toBe(op);
            expect(misma.datos.monto).toBe(1234.56);
        }
    });

    test("cerrada (aplicada o duplicada): su clave no se reutiliza para un cobro nuevo", () => {
        for (const estado of ["aplicada", "duplicada"] as const) {
            const op: OperacionPago = { ...nuevaOperacion(A), estado };
            const nueva = operacionPara(op, { ...A });
            expect(nueva.clave).not.toBe(op.clave);
        }
    });
});

test.describe("Lectura del monto (no redondea)", () => {

    test("acepta formatos comunes y rechaza lo dudoso", () => {
        expect(leerMonto("1234.56")).toBe(1234.56);
        expect(leerMonto("Q 1,234.56")).toBe(1234.56);
        expect(leerMonto("950")).toBe(950);
        expect(leerMonto("1234.567")).toBeNull();
        expect(leerMonto("-5")).toBeNull();
        expect(leerMonto("0")).toBeNull();
        expect(leerMonto("abc")).toBeNull();
    });
});

test.describe("Lo que se guarda en sessionStorage", () => {

    test("nada mientras no hay una confirmación pendiente", () => {
        const s = almacenFalso();
        guardarPendiente(nuevaOperacion(A), s);
        expect(s.datos.size).toBe(0);
    });

    test("solo clave, crédito, monto, fecha, canal y estado mientras está pendiente", () => {
        const s = almacenFalso();
        const op: OperacionPago = { ...nuevaOperacion(A), estado: "confirmando" };
        guardarPendiente(op, s);
        const guardado = JSON.parse(s.datos.get(CLAVE_ALMACEN)!) as Record<string, unknown>;
        expect(Object.keys(guardado).sort()).toEqual(["canal", "clave", "estado", "fechaOperacion", "idCredito", "monto"]);
    });

    test("al recargar vuelve como INCIERTA con la misma clave y los mismos datos", () => {
        const s = almacenFalso();
        const op: OperacionPago = { ...nuevaOperacion(A), estado: "confirmando" };
        guardarPendiente(op, s);
        const recuperada = leerPendiente(s)!;
        expect(recuperada.estado).toBe("incierta");
        expect(recuperada.clave).toBe(op.clave);
        expect(recuperada.datos).toEqual(A);
    });

    test("al cerrarse la operación se borra; una entrada alterada se ignora", () => {
        const s = almacenFalso();
        guardarPendiente({ ...nuevaOperacion(A), estado: "incierta" }, s);
        guardarPendiente({ ...nuevaOperacion(A), estado: "aplicada" }, s);
        expect(s.datos.size).toBe(0);

        s.setItem(CLAVE_ALMACEN, JSON.stringify({ clave: "otra-cosa", idCredito: "X", monto: 1, fechaOperacion: "2026-10-31", canal: "campo" }));
        expect(leerPendiente(s)).toBeNull();
        borrarPendiente(s);
        expect(s.datos.size).toBe(0);
    });
});
