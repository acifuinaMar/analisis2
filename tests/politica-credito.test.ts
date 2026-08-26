import { describe, expect, it } from "vitest";

import { PoliticaCredito, BaseConteo } from "../src/dominio/politica-credito";

function politicaValida(
    tasaAnual = 0.36,
    tasaMoratoriaAnual = 0.24,
    baseConteo = BaseConteo.ACTUAL_360
): PoliticaCredito {
    return new PoliticaCredito(
        "POL-2026-01",
        tasaAnual,
        tasaMoratoriaAnual,
        baseConteo,
        "Comite de Credito",
        new Date(2026, 0, 1)
    );
}

describe("Politica de credito - convenciones de tasa (6.3)", () => {

    it("La tasa mensual es proporcional: TNA / 12", () => {
        expect(politicaValida().tasaMensual()).toBeCloseTo(0.03, 10);
    });

    it("La tasa moratoria diaria es TNA moratoria / base de conteo", () => {
        expect(politicaValida().tasaMoratoriaDiaria())
            .toBeCloseTo(0.24 / 360, 10);
    });

    it("Cambiar la base de conteo cambia el resultado", () => {

        const a360 = politicaValida(0.36, 0.24, BaseConteo.ACTUAL_360);
        const a365 = politicaValida(0.36, 0.24, BaseConteo.ACTUAL_365);

        expect(a360.tasaMoratoriaDiaria())
            .toBeGreaterThan(a365.tasaMoratoriaDiaria());
    });

    it("Se describe declarando tipo de tasa y base, como exige 6.3", () => {

        const descripcion = politicaValida().describir();

        expect(descripcion).toContain("TNA corriente 36.00%");
        expect(descripcion).toContain("TNA moratoria 24.00%");
        expect(descripcion).toContain("Actual/360");
        expect(descripcion).toContain("POL-2026-01");
    });
});

describe("Politica de credito - validacion de razonabilidad (6.3.1)", () => {

    it("Rechaza 36 cuando se quiso decir 0.36", () => {
        // El dedazo mas caro del dominio: 36 seria 3,600% anual.
        expect(() => politicaValida(36)).toThrow(/razonabilidad/);
    });

    it("Rechaza tambien una tasa moratoria desproporcionada", () => {
        expect(() => politicaValida(0.36, 24)).toThrow(/razonabilidad/);
    });

    it("Rechaza tasas negativas", () => {
        expect(() => politicaValida(-0.1)).toThrow(/negativa/);
    });

    it("Rechaza tasas no numericas", () => {
        expect(() => politicaValida(NaN)).toThrow(/valido/);
    });

    it("Acepta una tasa alta pero plausible para microcredito", () => {
        expect(() => politicaValida(0.9)).not.toThrow();
    });
});

describe("Politica de credito - trazabilidad (6.3.1)", () => {

    it("Exige version y autor", () => {

        expect(() => new PoliticaCredito(
            "", 0.36, 0.24, BaseConteo.ACTUAL_360,
            "Comite", new Date(2026, 0, 1)
        )).toThrow(/version/);

        expect(() => new PoliticaCredito(
            "POL-2026-01", 0.36, 0.24, BaseConteo.ACTUAL_360,
            "  ", new Date(2026, 0, 1)
        )).toThrow(/autor/);
    });

    it("Dos politicas distintas conviven: el credito usa la suya", () => {

        const anterior = politicaValida(0.36);
        const nueva = new PoliticaCredito(
            "POL-2026-02", 0.42, 0.24, BaseConteo.ACTUAL_360,
            "Comite de Credito", new Date(2026, 6, 1)
        );

        expect(anterior.tasaMensual()).toBeCloseTo(0.03, 10);
        expect(nueva.tasaMensual()).toBeCloseTo(0.035, 10);
    });
});
