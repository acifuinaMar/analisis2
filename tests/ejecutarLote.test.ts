
import { describe, expect, it, vi } from "vitest";
import { ejecutarLote } from "../src/rag/ejecutarLote";

describe("E6 - Control de ejecución de evaluaciones", () => {
  const casos = [
    { id: "G-01" },
    { id: "G-02" },
    { id: "G-03" },
    { id: "G-04" },
    { id: "G-05" },
    { id: "G-06" },
  ];

  it("detiene las evaluaciones después de un error 429", async () => {
    const ejecutarCaso = vi.fn().mockRejectedValue({
      code: 429,
      status: "RESOURCE_EXHAUSTED",
    });

    const resultados = await ejecutarLote(casos, ejecutarCaso);

    expect(ejecutarCaso).toHaveBeenCalledTimes(1);
    expect(resultados).toHaveLength(6);

    expect(resultados[0].estado).toBe("ERROR");

    for (const resultado of resultados.slice(1)) {
      expect(resultado.estado).toBe("SKIPPED");
    }
  });

  it("continúa con los demás casos después de un error 503", async () => {
    const ejecutarCaso = vi
      .fn()
      .mockRejectedValueOnce({ code: 503 })
      .mockResolvedValue(undefined);

    const resultados = await ejecutarLote(casos, ejecutarCaso);

    expect(ejecutarCaso).toHaveBeenCalledTimes(6);

    expect(resultados[0].estado).toBe("ERROR");

    for (const resultado of resultados.slice(1)) {
      expect(resultado.estado).toBe("OK");
    }
  });

  it("ejecuta todos los casos cuando no hay errores", async () => {
    const ejecutarCaso = vi.fn().mockResolvedValue(undefined);

    const resultados = await ejecutarLote(casos, ejecutarCaso);

    expect(ejecutarCaso).toHaveBeenCalledTimes(6);
    expect(resultados.every((r) => r.estado === "OK")).toBe(true);
  });

  it("maneja correctamente una lista vacía", async () => {
    const ejecutarCaso = vi.fn();

    const resultados = await ejecutarLote([], ejecutarCaso);

    expect(resultados).toEqual([]);
    expect(ejecutarCaso).not.toHaveBeenCalled();
  });

  it("conserva los resultados anteriores al agotamiento de cuota", async () => {
    const ejecutarCaso = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ code: 429 });

    const resultados = await ejecutarLote(casos, ejecutarCaso);

    expect(ejecutarCaso).toHaveBeenCalledTimes(3);

    expect(resultados.map((r) => r.estado)).toEqual([
      "OK",
      "OK",
      "ERROR",
      "SKIPPED",
      "SKIPPED",
      "SKIPPED",
    ]);
  });


it("conserva el valor devuelto por cada evaluación", async () => {
  const casos = [
    { id: "G-01" },
    { id: "G-02" },
  ];

  const ejecutarCaso = vi.fn()
    .mockResolvedValueOnce({
      respuesta: "Política de 2024",
      citas: ["POL-2024-01-chunk-1"],
    })
    .mockResolvedValueOnce({
      respuesta: "Política de 2026",
      citas: ["POL-2026-10-chunk-1"],
    });

  const resultados = await ejecutarLote(casos, ejecutarCaso);

  expect(resultados).toHaveLength(2);
  expect(resultados[0].estado).toBe("OK");
  expect(resultados[0].valor).toEqual({
    respuesta: "Política de 2024",
    citas: ["POL-2024-01-chunk-1"],
  });

  expect(resultados[1].estado).toBe("OK");
  expect(resultados[1].valor).toEqual({
    respuesta: "Política de 2026",
    citas: ["POL-2026-10-chunk-1"],
  });

  expect(ejecutarCaso).toHaveBeenCalledTimes(2);
});
});
