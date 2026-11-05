
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


/**
 * La espera la decide el servidor cuando la dice.
 *
 * Lo destapo el ensayo del video: la cuota POR MINUTO de Gemini pide
 * unos 45 segundos, y los cinco intentos con espera creciente sumaban
 * 30, asi que se rendia justo antes de que la ventana se liberara. La
 * espera creciente es una suposicion nuestra; el retryDelay es el dato.
 */
describe("Cuanto se espera entre reintentos", () => {

  function errorCon(retryDelay: string, code = 429) {
    return {
      message: JSON.stringify({
        error: {
          code,
          status: "RESOURCE_EXHAUSTED",
          details: [{
            "@type": "type.googleapis.com/google.rpc.RetryInfo",
            retryDelay
          }]
        }
      })
    };
  }

  it("Espera lo que el servidor pide, no lo que supone la curva", async () => {

    const esperas: number[] = [];
    const dormir = globalThis.setTimeout;

    // @ts-expect-error se sustituye el reloj para no esperar de verdad
    globalThis.setTimeout = (fn: () => void, ms: number) => {
      esperas.push(ms);
      return dormir(fn, 0);
    };

    try {
      let intentos = 0;
      await reintentarGemini(
        async () => {
          intentos++;
          if (intentos < 2) throw errorCon("45s");
          return "listo";
        },
        {
          maxIntentos: 3,
          esperaInicialMs: 2000,
          esReintentable: () => true
        }
      );
    } finally {
      globalThis.setTimeout = dormir;
    }

    // 45 s del servidor mas un segundo de margen, no los 2 s de la curva.
    expect(esperas[0]).toBe(46_000);
  });

  it("Una espera desmedida se recorta al tope", async () => {

    const esperas: number[] = [];
    const dormir = globalThis.setTimeout;

    // @ts-expect-error se sustituye el reloj para no esperar de verdad
    globalThis.setTimeout = (fn: () => void, ms: number) => {
      esperas.push(ms);
      return dormir(fn, 0);
    };

    try {
      let intentos = 0;
      await reintentarGemini(
        async () => {
          intentos++;
          if (intentos < 2) throw errorCon("12578s");
          return "listo";
        },
        { maxIntentos: 3, esReintentable: () => true }
      );
    } finally {
      globalThis.setTimeout = dormir;
    }

    expect(esperas[0]).toBe(120_000);
  });

  it("Sin retryDelay se usa la espera creciente de siempre", async () => {

    const esperas: number[] = [];
    const dormir = globalThis.setTimeout;

    // @ts-expect-error se sustituye el reloj para no esperar de verdad
    globalThis.setTimeout = (fn: () => void, ms: number) => {
      esperas.push(ms);
      return dormir(fn, 0);
    };

    try {
      let intentos = 0;
      await reintentarGemini(
        async () => {
          intentos++;
          if (intentos < 2) throw { code: 503 };
          return "listo";
        },
        { maxIntentos: 3, esperaInicialMs: 2000 }
      );
    } finally {
      globalThis.setTimeout = dormir;
    }

    expect(esperas[0]).toBe(2000);
  });
});
