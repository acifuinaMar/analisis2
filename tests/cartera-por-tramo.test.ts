import { describe, expect, it } from "vitest";

import { Cartera, CategoriaRiesgo } from "../src/servicios/cartera";
import { PosicionCartera } from "../src/dominio/posicion-cartera";
import { Dinero } from "../src/dominio/dinero";
import { NombreEstado } from "../src/dominio/nombre-estado";

/**
 * Misma cartera de siete creditos del Proyecto 1 (6.8.1).
 * Cartera activa Q800,000.00; C-007 excluido por incobrable.
 */
function carteraDeReferencia(): Cartera {
    return new Cartera([
        new PosicionCartera("C-001", Dinero.desde(620000), 0, NombreEstado.VIGENTE),
        new PosicionCartera("C-002", Dinero.desde(124000), 8, NombreEstado.EN_MORA),
        new PosicionCartera("C-003", Dinero.desde(24000), 45, NombreEstado.EN_MORA),
        new PosicionCartera("C-004", Dinero.desde(18000), 75, NombreEstado.EN_MORA),
        new PosicionCartera("C-005", Dinero.desde(8000), 100, NombreEstado.EN_MORA),
        new PosicionCartera("C-006", Dinero.desde(6000), 0, NombreEstado.VIGENTE, true),
        new PosicionCartera("C-007", Dinero.desde(15000), 210, NombreEstado.INCOBRABLE)
    ]);
}

function pct(proporcion: number): number {
    return Number((proporcion * 100).toFixed(2));
}

function fila(cartera: Cartera, categoria: CategoriaRiesgo) {
    return cartera.desglosePorTramo()
        .find(f => f.categoria === categoria)!;
}

/**
 * ORACULO OBLIGATORIO de la seccion 7.8 (CP-04.3).
 *
 * Tramo                    Creditos   Saldo (Q)    % cartera activa
 * Mora 1 (1-30 d)          —              0.00       0.00 %
 * Mora 2 (31-60 d)         C-003     24,000.00       3.00 %
 * Mora 3 (61-90 d)         C-004     18,000.00       2.25 %
 * Vencido (91-120 d)       C-005      8,000.00       1.00 %
 * Reestructurado al dia    C-006      6,000.00       0.75 %
 * Total                    4 creditos 56,000.00      7.00 %
 */
describe("Cartera en riesgo por tramo - oraculo 7.8 (CP-04.3)", () => {

    it.each([
        [CategoriaRiesgo.MORA_1, 0, 0, 0.00],
        [CategoriaRiesgo.MORA_2, 1, 24000, 3.00],
        [CategoriaRiesgo.MORA_3, 1, 18000, 2.25],
        [CategoriaRiesgo.VENCIDO, 1, 8000, 1.00],
        [CategoriaRiesgo.REESTRUCTURADO_AL_DIA, 1, 6000, 0.75]
    ])("%s: %i credito(s), Q%d, %d %%", (categoria, creditos, saldo, porcentaje) => {

        const f = fila(carteraDeReferencia(), categoria as CategoriaRiesgo);

        expect(f.creditos).toBe(creditos);
        expect(f.saldo.obtenerValor()).toBe(saldo);
        expect(pct(f.porcentaje)).toBe(porcentaje);
    });

    it("Los porcentajes por tramo suman exactamente el total de 7.00 %", () => {

        const cartera = carteraDeReferencia();

        // El invariante de 7.9 pide esta suma SIN errores de redondeo
        // acumulados: 3.00 + 2.25 + 1.00 + 0.75 = 7.00
        const suma = cartera.desglosePorTramo()
            .reduce((total, f) => total + f.porcentaje, 0);

        expect(pct(suma)).toBe(7.00);
        expect(pct(cartera.porcentajeEnRiesgo())).toBe(7.00);
    });

    it("Los saldos por tramo suman el monto en riesgo", () => {

        const cartera = carteraDeReferencia();

        const suma = cartera.desglosePorTramo().reduce(
            (total, f) => total.sumar(f.saldo),
            Dinero.cero()
        );

        expect(suma.esIgualA(cartera.montoEnRiesgo())).toBe(true);
        expect(suma.obtenerValor()).toBe(56000);
    });

    it("Los creditos por tramo suman los 4 en riesgo", () => {

        const total = carteraDeReferencia().desglosePorTramo()
            .reduce((n, f) => n + f.creditos, 0);

        expect(total).toBe(4);
    });
});

describe("Cartera en mora vs cartera en riesgo (7.8)", () => {

    it("La cartera en MORA es Q174,000.00, el 21.75 %", () => {

        const cartera = carteraDeReferencia();

        // Todo credito activo con al menos un dia de atraso:
        // C-002 + C-003 + C-004 + C-005
        expect(cartera.carteraEnMora().obtenerValor()).toBe(174000);
        expect(pct(cartera.porcentajeEnMora())).toBe(21.75);
    });

    it("La cartera en RIESGO es Q56,000.00, el 7.00 %", () => {

        const cartera = carteraDeReferencia();

        expect(cartera.montoEnRiesgo().obtenerValor()).toBe(56000);
        expect(pct(cartera.porcentajeEnRiesgo())).toBe(7.00);
    });

    it("Son indicadores distintos y ambos correctos", () => {

        const cartera = carteraDeReferencia();

        // Confundirlos, o rotularlos igual, lleva al comite a decidir
        // sobre el numero equivocado. En E5 eso es severidad 4.
        expect(pct(cartera.porcentajeEnMora()))
            .not.toBe(pct(cartera.porcentajeEnRiesgo()));

        expect(cartera.carteraEnMora().esMayorQue(cartera.montoEnRiesgo()))
            .toBe(true);
    });

    it("C-002 esta en mora pero NO en riesgo: 8 dias no superan 30", () => {

        const cartera = carteraDeReferencia();
        const c002 = cartera.obtenerPosiciones()
            .find(p => p.creditoId === "C-002")!;

        expect(c002.diasAtraso).toBe(8);
        expect(c002.estaEnRiesgo()).toBe(false);

        // Su saldo si entra en la cartera en mora.
        expect(cartera.carteraEnMora().obtenerValor()).toBe(174000);
    });

    it("C-006 esta en riesgo pero NO en mora: al dia, reestructurado", () => {

        const cartera = carteraDeReferencia();
        const c006 = cartera.obtenerPosiciones()
            .find(p => p.creditoId === "C-006")!;

        expect(c006.diasAtraso).toBe(0);
        expect(c006.estaEnRiesgo()).toBe(true);

        expect(
            fila(cartera, CategoriaRiesgo.REESTRUCTURADO_AL_DIA)
                .saldo.obtenerValor()
        ).toBe(6000);
    });
});

describe("El reporte lleva todo junto, para que el tablero no recalcule", () => {

    it("Un solo reporte trae mora, riesgo, desglose e incobrable", () => {

        const reporte = carteraDeReferencia().generarReporte();

        expect(pct(reporte.porcentajeEnMora)).toBe(21.75);
        expect(pct(reporte.porcentajeEnRiesgo)).toBe(7.00);
        expect(reporte.dadoPorIncobrable.obtenerValor()).toBe(15000);
        expect(reporte.desglosePorTramo).toHaveLength(5);
    });

    it("Dar de baja C-005 mueve el desglose y sube lo incobrable", () => {

        const despues = carteraDeReferencia().declararIncobrable("C-005");

        // El tramo Vencido se vacia: el credito salio de la cartera.
        expect(fila(despues, CategoriaRiesgo.VENCIDO).creditos).toBe(0);
        expect(fila(despues, CategoriaRiesgo.VENCIDO).saldo.esCero()).toBe(true);

        expect(pct(despues.porcentajeEnRiesgo())).toBe(6.06);
        expect(despues.dadoPorIncobrable().obtenerValor()).toBe(23000);
    });

    it("Un credito incobrable sale de la base Y deja de contar (7.9)", () => {

        const despues = carteraDeReferencia().declararIncobrable("C-005");

        expect(despues.carteraActiva().obtenerValor()).toBe(792000);
        expect(despues.montoEnRiesgo().obtenerValor()).toBe(48000);
    });
});
