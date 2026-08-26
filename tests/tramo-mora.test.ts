import { describe, expect, it } from "vitest";

import { ClasificadorTramoMora, TramoMora } from "../src/dominio/tramo-mora";

const clasificador = new ClasificadorTramoMora();

describe("Tramos de mora - fronteras exactas (6.5)", () => {

    it.each([
        [0, TramoMora.AL_DIA],
        [1, TramoMora.MORA_1],
        [30, TramoMora.MORA_1],
        [31, TramoMora.MORA_2],
        [45, TramoMora.MORA_2],
        [60, TramoMora.MORA_2],
        [61, TramoMora.MORA_3],
        [90, TramoMora.MORA_3],
        [91, TramoMora.VENCIDO],
        [120, TramoMora.VENCIDO],
        [121, TramoMora.VENCIDO],
        [210, TramoMora.VENCIDO]
    ])("%i dias de atraso clasifica como %s", (dias, esperado) => {
        expect(clasificador.clasificar(dias)).toBe(esperado);
    });
});

describe("Tramos de mora - la clasificacion es reversible (6.7)", () => {

    it("Un credito en Mora 2 que paga y queda con 10 dias baja a Mora 1", () => {

        // El caso textual del enunciado.
        expect(clasificador.clasificar(45)).toBe(TramoMora.MORA_2);
        expect(clasificador.clasificar(10)).toBe(TramoMora.MORA_1);
    });

    it("Si paga todo lo vencido queda al dia", () => {
        expect(clasificador.clasificar(0)).toBe(TramoMora.AL_DIA);
    });

    it("El tramo depende solo de los dias vigentes, no del historial", () => {

        // Da igual si venia de 210 dias o de 5: 20 dias es Mora 1.
        const tramo = clasificador.clasificar(20);

        expect(tramo).toBe(TramoMora.MORA_1);
        expect(clasificador.clasificar(20)).toBe(tramo);
    });

    it("Sube y baja por el mismo camino", () => {

        const subida = [0, 15, 45, 75, 100].map(d => clasificador.clasificar(d));
        const bajada = [100, 75, 45, 15, 0].map(d => clasificador.clasificar(d));

        expect(bajada).toEqual([...subida].reverse());
    });
});

describe("Tramos de mora - guardas derivadas", () => {

    it("Solo supera el plazo para incobrable pasados los 120 dias", () => {

        expect(clasificador.superaPlazoParaIncobrable(120)).toBe(false);
        expect(clasificador.superaPlazoParaIncobrable(121)).toBe(true);
        expect(clasificador.superaPlazoParaIncobrable(210)).toBe(true);
    });

    it("El devengo de interes corriente se suspende pasados los 90 dias", () => {

        expect(clasificador.suspendeDevengo(90)).toBe(false);
        expect(clasificador.suspendeDevengo(91)).toBe(true);
    });

    it("El devengo se reactiva si el credito se regulariza", () => {

        expect(clasificador.suspendeDevengo(100)).toBe(true);
        expect(clasificador.suspendeDevengo(0)).toBe(false);
    });

    it("Rechaza dias negativos o fraccionarios", () => {
        expect(() => clasificador.clasificar(-1)).toThrow(/negativos/);
        expect(() => clasificador.clasificar(1.5)).toThrow(/entero/);
    });
});
