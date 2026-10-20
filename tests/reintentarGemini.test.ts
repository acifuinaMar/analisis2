
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
