import { describe, expect, it } from "vitest";

import { Dinero } from "../src/dominio/dinero";
import { CalculadoraMora } from "../src/servicios/calculadora-mora";
import { PoliticaMora } from "../src/dominio/politica-mora/politica-mora";
import {
    POLITICA_ESCALONADA_2026,
    POLITICA_PLANA_2024,
    TRAMOS_CP01
} from "../src/dominio/politica-mora/catalogo-politicas";
import {
    PoliticaMoraRetroactiva
} from "../src/dominio/politica-mora/politica-mora-retroactiva";

/**
 * PRUEBA DE SUSTITUCION DE LISKOV.
 *
 * La misma bateria corre contra las TRES implementaciones del puerto. Si
 * alguna rompiera un invariante del motor, dejaria de ser sustituible por
 * las otras y el puerto estaria mal definido.
 *
 * Ninguna prueba de este archivo menciona cifras propias de una politica:
 * todas verifican reglas que cualquier politica moratoria debe cumplir.
 */
const POLITICA_RETROACTIVA = new PoliticaMoraRetroactiva(
    "POL-RETRO-PRUEBA",
    TRAMOS_CP01
);

const POLITICAS: ReadonlyArray<[string, PoliticaMora]> = [
    ["plana", POLITICA_PLANA_2024],
    ["escalonada", POLITICA_ESCALONADA_2026],
    ["retroactiva", POLITICA_RETROACTIVA]
];

const CAPITAL = Dinero.desde(725.76);

describe.each(POLITICAS)(
    "Contrato del puerto PoliticaMora · implementacion %s",
    (_nombre, politica) => {

        it("Declara una version no vacia (trazabilidad 6.3.1)", () => {
            expect(politica.version.trim().length).toBeGreaterThan(0);
        });

        it("Sin atraso no cobra mora", () => {
            expect(politica.calcular(CAPITAL, 0).esCero()).toBe(true);
        });

        it("Es monotona creciente respecto de los dias de atraso", () => {

            let anterior = Dinero.cero();

            for (let dias = 0; dias <= 130; dias++) {
                const actual = politica.calcular(CAPITAL, dias);
                expect(actual.esMayorOIgualA(anterior)).toBe(true);
                anterior = actual;
            }
        });

        it("Nunca cobra mas que el capital en mora (invariante 7.9)", () => {

            const capitalChico = Dinero.desde(1);

            for (const dias of [30, 90, 120, 400, 5000]) {
                expect(
                    politica.calcular(capitalChico, dias)
                        .esMenorOIgualA(capitalChico)
                ).toBe(true);
            }
        });

        it("Es determinista: mismos datos, mismo resultado", () => {

            const a = politica.calcular(CAPITAL, 45);
            const b = politica.calcular(CAPITAL, 45);

            expect(a.esIgualA(b)).toBe(true);
        });

        it("Conserva la moneda del capital", () => {
            expect(politica.calcular(CAPITAL, 45).obtenerMoneda())
                .toBe(CAPITAL.obtenerMoneda());
        });

        it("Rechaza dias negativos o fraccionarios, nunca los ignora", () => {
            expect(() => politica.calcular(CAPITAL, -1)).toThrow(/negativos/);
            expect(() => politica.calcular(CAPITAL, 2.5)).toThrow(/entero/);
        });

        it("Sobre capital cero no cobra nada", () => {
            expect(politica.calcular(Dinero.cero(), 100).esCero()).toBe(true);
        });

        it("Es proporcional al capital en mora", () => {

            // El doble de capital, el doble de mora: el moratorio se
            // calcula sobre capital y solo sobre capital.
            const simple = politica.calcular(Dinero.desde(1000), 45);
            const doble = politica.calcular(Dinero.desde(2000), 45);

            expect(doble.obtenerCentavos())
                .toBe(simple.obtenerCentavos() * 2);
        });

        it("El motor la acepta sin conocer cual es (sustituibilidad)", () => {

            const calculadora = new CalculadoraMora(politica);

            expect(calculadora.calcular(CAPITAL, 45).obtenerValor())
                .toBeGreaterThan(0);
            expect(calculadora.versionPolitica()).toBe(politica.version);
        });
    }
);

describe("Las tres politicas son distintas entre si", () => {

    it("Dan resultados diferentes para el mismo caso de 100 dias", () => {

        const plana = POLITICA_PLANA_2024.calcular(CAPITAL, 100).obtenerValor();
        const escalonada = POLITICA_ESCALONADA_2026.calcular(CAPITAL, 100).obtenerValor();
        const retroactiva = POLITICA_RETROACTIVA.calcular(CAPITAL, 100).obtenerValor();

        // Los tres valores del enunciado, seccion 7.4.
        expect(plana).toBe(48.38);
        expect(escalonada).toBe(50.80);
        expect(retroactiva).toBe(72.58);
    });

    it("La retroactiva siempre cobra igual o mas que la escalonada", () => {

        for (const dias of [1, 15, 30, 45, 61, 90, 100, 120]) {
            expect(
                POLITICA_RETROACTIVA.calcular(CAPITAL, dias).obtenerValor()
            ).toBeGreaterThanOrEqual(
                POLITICA_ESCALONADA_2026.calcular(CAPITAL, dias).obtenerValor()
            );
        }
    });

    it("En el primer tramo escalonada y retroactiva coinciden", () => {

        // Con un solo tramo recorrido no hay diferencia entre cobrar por
        // tramos recorridos y aplicar la tasa del tramo actual.
        for (const dias of [1, 15, 30]) {
            expect(
                POLITICA_ESCALONADA_2026.calcular(CAPITAL, dias).esIgualA(
                    POLITICA_RETROACTIVA.calcular(CAPITAL, dias)
                )
            ).toBe(true);
        }
    });
});

describe("Abierto/cerrado: agregar una politica no toca el motor", () => {

    it("Una politica inventada en la prueba funciona con el motor tal cual", () => {

        // Se define aqui mismo, fuera del nucleo. Si el motor tuviera la
        // formula adentro, esto seria imposible sin modificarlo.
        const politicaDeGracia: PoliticaMora = {
            version: "POL-GRACIA-PRUEBA",
            calcular: (capital, dias) =>
                dias <= 5 ? Dinero.cero() : capital.multiplicar(0.01)
        };

        const calculadora = new CalculadoraMora(politicaDeGracia);

        expect(calculadora.calcular(CAPITAL, 3).esCero()).toBe(true);
        expect(calculadora.calcular(CAPITAL, 30).obtenerValor()).toBe(7.26);
    });
});
