
import {
  esErrorTemporalGemini as _esErrorTemporalGemini
} from "../src/rag/reintentarGemini";
import { describe, expect, it, vi } from "vitest";
import {
  esErrorTemporalGemini,
  reintentarGemini,
} from "../src/rag/reintentarGemini";

describe("RAG - Reintentos de Gemini", () => {
  it("identifica los errores temporales del servidor", () => {
    for (const status of [500, 502, 503, 504]) {
      expect(esErrorTemporalGemini({ status })).toBe(true);
    }
  });

  it("no considera temporales los errores de credenciales", () => {
    for (const status of [400, 401, 403, 429]) {
      expect(esErrorTemporalGemini({ status })).toBe(false);
    }
  });

  it("rechaza errores que no tienen un código válido", () => {
    expect(esErrorTemporalGemini(null)).toBe(false);
    expect(esErrorTemporalGemini(new Error("Error desconocido"))).toBe(
      false
    );
  });

  it("devuelve el resultado cuando Gemini responde correctamente", async () => {
    const operacion = vi.fn().mockResolvedValue("Respuesta correcta");

    const resultado = await reintentarGemini(operacion, {
      esperaInicialMs: 0,
    });

    expect(resultado).toBe("Respuesta correcta");
    expect(operacion).toHaveBeenCalledTimes(1);
  });

  it("reintenta cuando recibe 503 y luego responde correctamente", async () => {
    const operacion = vi
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce("Respuesta recuperada");

    const resultado = await reintentarGemini(operacion, {
      maxIntentos: 3,
      esperaInicialMs: 0,
    });

    expect(resultado).toBe("Respuesta recuperada");
    expect(operacion).toHaveBeenCalledTimes(2);
  });

  it("no reintenta cuando recibe un error 403", async () => {
    const error = { status: 403 };

    const operacion = vi.fn().mockRejectedValue(error);

    await expect(
      reintentarGemini(operacion, {
        maxIntentos: 3,
        esperaInicialMs: 0,
      })
    ).rejects.toBe(error);

    expect(operacion).toHaveBeenCalledTimes(1);
  });

  it("se detiene después de agotar los tres intentos", async () => {
    const error = { status: 503 };

    const operacion = vi.fn().mockRejectedValue(error);

    await expect(
      reintentarGemini(operacion, {
        maxIntentos: 3,
        esperaInicialMs: 0,
      })
    ).rejects.toBe(error);

    expect(operacion).toHaveBeenCalledTimes(3);
  });

  it("rechaza configuraciones inválidas", async () => {
    const operacion = vi.fn().mockResolvedValue("OK");

    await expect(
      reintentarGemini(operacion, { maxIntentos: 0 })
    ).rejects.toThrow("maxIntentos");

    await expect(
      reintentarGemini(operacion, { esperaInicialMs: -1 })
    ).rejects.toThrow("esperaInicialMs");

    expect(operacion).not.toHaveBeenCalled();
  });

  
  it("reconoce un 503 con estado textual del proveedor", () => {
    const error = {
      status: "UNAVAILABLE",
      code: 503,
      message: "This model is currently experiencing high demand.",
    };

    expect(esErrorTemporalGemini(error)).toBe(true);
  });
});


/**
 * Las tres formas en que llega el mismo error.
 *
 * El predicado miraba solo el primer nivel, y el 503 real llega anidado
 * bajo `error` o unicamente dentro del JSON de `message`. Devolvia
 * false, el reintento no se disparaba, y una sobrecarga pasajera del
 * modelo se contaba como falla del asistente: las catorce evaluaciones
 * fallaron asi.
 */
describe("Formas del error de Gemini", () => {

  it("Reconoce el 503 en el primer nivel", () => {
    expect(_esErrorTemporalGemini({ code: 503 })).toBe(true);
  });

  it("Reconoce el 503 anidado bajo error", () => {
    expect(
      _esErrorTemporalGemini({
        error: { code: 503, status: "UNAVAILABLE" }
      })
    ).toBe(true);
  });

  /** La forma que de verdad devolvio el SDK en la corrida fallida. */
  it("Reconoce el 503 dentro del JSON del mensaje", () => {
    expect(
      _esErrorTemporalGemini({
        message: JSON.stringify({
          error: {
            code: 503,
            message: "This model is currently experiencing high demand.",
            status: "UNAVAILABLE"
          }
        })
      })
    ).toBe(true);
  });

  it("No reintenta un 400, que no se arregla esperando", () => {
    expect(
      _esErrorTemporalGemini({
        message: JSON.stringify({
          error: { code: 400, status: "INVALID_ARGUMENT" }
        })
      })
    ).toBe(false);
  });

  it("Un mensaje que no es JSON no lo rompe", () => {
    expect(_esErrorTemporalGemini({ message: "algo salio mal" }))
      .toBe(false);
    expect(_esErrorTemporalGemini(null)).toBe(false);
    expect(_esErrorTemporalGemini("texto")).toBe(false);
  });
});
