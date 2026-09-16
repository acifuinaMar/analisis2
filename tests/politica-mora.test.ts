import { describe, expect, it } from "vitest";

import { Dinero } from "../src/dominio/dinero";
import {
    POLITICA_ESCALONADA_2026,
    POLITICA_PLANA_2024,
    TRAMOS_CP01,
    CatalogoPoliticasMora,
    VIGENCIA_ESCALONADA
} from "../src/dominio/politica-mora/catalogo-politicas";
import { PoliticaMoraEscalonada } from "../src/dominio/politica-mora/politica-mora-escalonada";
import { PoliticaMoraPlana } from "../src/dominio/politica-mora/politica-mora-plana";
import { BaseConteoMora } from "../src/dominio/politica-mora/politica-mora";

/**
 * Todos los casos usan la cuota 2 del caso de referencia del Proyecto 1:
 * capital en mora Q725.76 (la amortizacion de la cuota 2).
 */
const CAPITAL_EN_MORA = Dinero.desde(725.76);

const escalonada = POLITICA_ESCALONADA_2026;

function moraEscalonada(dias: number): number {
    return escalonada.calcular(CAPITAL_EN_MORA, dias).obtenerValor();
}

describe("Politica escalonada - casos de referencia obligatorios (7.4)", () => {

    it("M-1 · 15 dias de atraso, solo Mora 1 → Q5.44", () => {
        // 725.76 x 0.000500000 x 15 = 5.4432
        expect(moraEscalonada(15)).toBe(5.44);
    });

    it("M-2 · 45 dias, Mora 1 completo + Mora 2 parcial → Q18.14", () => {
        // 10.8864 + 7.2576 = 18.1440
        expect(moraEscalonada(45)).toBe(18.14);
    });

    it("M-3 · 100 dias, los cuatro tramos → Q50.80", () => {
        // 10.8864 + 14.5152 + 18.1440 + 7.2576 = 50.8032
        expect(moraEscalonada(100)).toBe(50.80);
    });

    it("M-4 · 120 dias, frontera con incobrable → Q65.32", () => {
        // 10.8864 + 14.5152 + 18.1440 + 21.7728 = 65.3184
        expect(moraEscalonada(120)).toBe(65.32);
    });
});

describe("Politica escalonada - el redondeo ocurre UNA sola vez (7.3)", () => {

    it("M-2 da Q18.14, no Q18.15", () => {

        // La trampa comprobada del enunciado: redondear tramo por tramo
        // daria 10.89 + 7.26 = 18.15. Un centavo por cuota vencida,
        // multiplicado por miles de cuotas al mes, es un descuadre real.
        const porTramo = Dinero.desde(10.8864).obtenerValor()
            + Dinero.desde(7.2576).obtenerValor();

        expect(porTramo).toBe(18.15);
        expect(moraEscalonada(45)).toBe(18.14);
    });

    it("El desglose por tramo suma exactamente el total del caso M-3", () => {

        const dias = 100;
        let sinRedondear = 0;

        for (const tramo of TRAMOS_CP01) {
            const diasEnTramo = escalonada.diasEnTramo(dias, tramo);
            sinRedondear += 725.76 * escalonada.tasaDiaria(tramo) * diasEnTramo;
        }

        expect(Number(sinRedondear.toFixed(4))).toBe(50.8032);
        expect(moraEscalonada(dias)).toBe(50.80);
    });
});

describe("Politica escalonada - tramos recorridos, no tramo actual (7.3)", () => {

    it.each([
        [15, 15, 0, 0, 0],
        [45, 30, 15, 0, 0],
        [100, 30, 30, 30, 10],
        [120, 30, 30, 30, 30]
    ])(
        "Con %i dias: %i en Mora 1, %i en Mora 2, %i en Mora 3, %i en Vencido",
        (dias, m1, m2, m3, vencido) => {

            const repartidos = TRAMOS_CP01.map(
                t => escalonada.diasEnTramo(dias, t)
            );

            expect(repartidos).toEqual([m1, m2, m3, vencido]);
        }
    );

    it("Los dias repartidos suman los dias de atraso, hasta el tope de 120", () => {

        for (const dias of [1, 15, 30, 31, 60, 90, 100, 120]) {

            const suma = TRAMOS_CP01.reduce(
                (total, t) => total + escalonada.diasEnTramo(dias, t),
                0
            );

            expect(suma).toBe(dias);
        }
    });
});

describe("Politica escalonada - frontera de incobrable (M-4)", () => {

    it("A los 121 dias la mora no crece por acumulacion automatica", () => {

        // Mas alla de 120 el credito es incobrable: sale de la cartera y
        // deja de generar moratorio. No hay tramo que lo acumule.
        expect(moraEscalonada(121)).toBe(moraEscalonada(120));
        expect(moraEscalonada(365)).toBe(moraEscalonada(120));
    });
});

describe("Coexistencia de politicas - CP-03 (7.6)", () => {

    it("La misma cuota a 45 dias: plana Q21.77 vs escalonada Q18.14", () => {

        expect(
            POLITICA_PLANA_2024.calcular(CAPITAL_EN_MORA, 45).obtenerValor()
        ).toBe(21.77);

        expect(moraEscalonada(45)).toBe(18.14);
    });

    it("La escalonada es MAS BARATA para el atraso moderado", () => {

        // Es el efecto que buscaba el comite: distinguir el descuido del
        // deterioro, no castigar igual cinco dias que cuatro meses.
        const plana = POLITICA_PLANA_2024
            .calcular(CAPITAL_EN_MORA, 45).obtenerValor();

        expect(moraEscalonada(45)).toBeLessThan(plana);
    });

    it("El catalogo resuelve por FECHA DE OTORGAMIENTO, no de corte", () => {

        const catalogo = CatalogoPoliticasMora.vigente();

        // CV-2026-0100, otorgado el 15 de agosto de 2026
        expect(catalogo.resolver(new Date(2026, 7, 15)).version)
            .toBe("POL-2024-01");

        // CV-2026-0410, otorgado el 10 de octubre de 2026
        expect(catalogo.resolver(new Date(2026, 9, 10)).version)
            .toBe("POL-2026-10");
    });

    it("El dia exacto de vigencia ya usa la politica nueva", () => {

        const catalogo = CatalogoPoliticasMora.vigente();

        expect(catalogo.resolver(VIGENCIA_ESCALONADA).version)
            .toBe("POL-2026-10");
    });

    it("Reproduce los dos creditos de la tabla 7.6", () => {

        const catalogo = CatalogoPoliticasMora.vigente();

        const cv0100 = catalogo.resolver(new Date(2026, 7, 15));
        const cv0410 = catalogo.resolver(new Date(2026, 9, 10));

        expect(cv0100.calcular(CAPITAL_EN_MORA, 45).obtenerValor()).toBe(21.77);
        expect(cv0410.calcular(CAPITAL_EN_MORA, 45).obtenerValor()).toBe(18.14);
    });
});

describe("Politica plana - sigue dando los valores del Proyecto 1", () => {

    it("Q7.26 a 15 dias con el 24 % plano (P1, 6.5)", () => {

        // El valor del P1 sigue siendo correcto para los creditos
        // otorgados antes del 1 de octubre de 2026. No se "corrige".
        expect(
            POLITICA_PLANA_2024.calcular(CAPITAL_EN_MORA, 15).obtenerValor()
        ).toBe(7.26);
    });

    it("Q48.38 a 100 dias con el 24 % plano", () => {
        expect(
            POLITICA_PLANA_2024.calcular(CAPITAL_EN_MORA, 100).obtenerValor()
        ).toBe(48.38);
    });
});

describe("Invariantes nuevos de la seccion 7.9", () => {

    it("La mora es monotona creciente respecto de los dias de atraso", () => {

        let anterior = 0;

        for (let dias = 0; dias <= 130; dias++) {
            const actual = moraEscalonada(dias);
            expect(actual).toBeGreaterThanOrEqual(anterior);
            anterior = actual;
        }
    });

    it("Por tramos recorridos nunca cobra mas que la retroactiva", () => {

        for (const dias of [1, 15, 30, 45, 61, 90, 100, 120]) {

            const tramoActual = TRAMOS_CP01.find(
                t => dias >= t.desde && dias <= t.hasta
            )!;

            const retroactiva = Dinero.desde(
                725.76 * (tramoActual.tnaMoratoria / 360) * dias
            ).obtenerValor();

            expect(moraEscalonada(dias)).toBeLessThanOrEqual(retroactiva);
        }
    });

    it("La mora acumulada nunca excede el capital en mora", () => {

        const capitalChico = Dinero.desde(1);

        for (const dias of [30, 60, 90, 120, 500]) {
            expect(
                escalonada.calcular(capitalChico, dias)
                    .esMenorOIgualA(capitalChico)
            ).toBe(true);
        }
    });

    it("En el primer tramo equivale a una politica plana del 18 %", () => {

        const plana18 = new PoliticaMoraPlana(
            "POL-PRUEBA-18", 0.18, BaseConteoMora.ACTUAL_360
        );

        for (let dias = 1; dias <= 30; dias++) {
            expect(moraEscalonada(dias)).toBe(
                plana18.calcular(CAPITAL_EN_MORA, dias).obtenerValor()
            );
        }
    });

    it("Sin atraso no hay mora", () => {
        expect(moraEscalonada(0)).toBe(0);
        expect(POLITICA_PLANA_2024.calcular(CAPITAL_EN_MORA, 0).obtenerValor())
            .toBe(0);
    });
});

describe("Politica escalonada - validaciones de la tabla", () => {

    it("Rechaza tramos con huecos entre si", () => {

        expect(() => new PoliticaMoraEscalonada("POL-X", [
            { ...TRAMOS_CP01[0] },
            { ...TRAMOS_CP01[1], desde: 35 }
        ])).toThrow(/encadenan/);
    });

    it("Exige que el primer tramo empiece en el dia 1", () => {

        expect(() => new PoliticaMoraEscalonada("POL-X", [
            { ...TRAMOS_CP01[0], desde: 5 }
        ])).toThrow(/dia 1/);
    });

    it("Rechaza dias de atraso negativos o fraccionarios", () => {
        expect(() => moraEscalonada(-1)).toThrow(/negativos/);
        expect(() => moraEscalonada(1.5)).toThrow(/entero/);
    });
});
