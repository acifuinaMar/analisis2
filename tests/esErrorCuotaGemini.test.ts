
import { describe, expect, it } from "vitest";
import { esErrorCuotaGemini } from "../src/rag/esErrorCuotaGemini";

describe("RAG - Detección de cuota Gemini", () => {
  it("reconoce un error 429", () => {
    expect(esErrorCuotaGemini({ code: 429 })).toBe(true);
  });

  it("reconoce un estado RESOURCE_EXHAUSTED", () => {
    expect(
      esErrorCuotaGemini({
        status: "RESOURCE_EXHAUSTED",
        code: 429,
      })
    ).toBe(true);
  });

  it("reconoce un 429 en la propiedad status", () => {
    expect(esErrorCuotaGemini({ status: 429 })).toBe(true);
  });

  it("no confunde un error 503 con agotamiento de cuota", () => {
    expect(
      esErrorCuotaGemini({
        status: "UNAVAILABLE",
        code: 503,
      })
    ).toBe(false);
  });

  it("no considera los errores de credenciales como cuota", () => {
    expect(esErrorCuotaGemini({ code: 403 })).toBe(false);
  });

  it("maneja valores desconocidos", () => {
    expect(esErrorCuotaGemini(null)).toBe(false);
    expect(esErrorCuotaGemini(new Error("Desconocido"))).toBe(false);
  });
});
