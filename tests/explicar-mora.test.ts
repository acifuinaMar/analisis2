import { describe, expect, it } from "vitest";

import {
    RepositorioCarteraCsv
} from "../src/adaptadores/repositorio-cartera-csv";
import {
    ConsultasCartera,
    ErrorConsulta
} from "../src/servicios/consultas-cartera";
import { Dinero } from "../src/dominio/dinero";
import {
    POLITICA_ESCALONADA_2026,
    POLITICA_PLANA_2024
} from "../src/dominio/politica-mora/catalogo-politicas";
import { TramoMora } from "../src/dominio/tramo-mora";

function consultas(): ConsultasCartera {
    return new ConsultasCartera(
        new RepositorioCarteraCsv(process.env.CV_DATA_DIR ?? "")
    );
}

describe("Explicar una mora - consulta G-7", () => {

    /**
     * "Explicame el interes moratorio de la cuota 2 del credito
     *  CV-2026-0410 con fecha de corte 24 de enero de 2027, tramo por
     *  tramo."
     *
     * Pide deliberadamente una fecha futura: es la prueba de que el
     * sistema calcula contra la fecha que recibe y no contra el reloj.
     */
    it("Desglosa los tramos recorridos a una fecha futura", async () => {

        const r = await consultas()
            .explicarMora("CV-2026-0410", 2, new Date(2027, 0, 24));

        expect(r.fechaCorte).toBe("2027-01-24");
        expect(r.politica).toBe("POL-2026-10");
        expect(r.capitalEnMora).toBe(725.76);
        expect(r.diasAtraso).toBe(75);
        expect(r.tramo).toBe(TramoMora.MORA_3);
    });

    it("Reparte los 75 dias en tres tramos: 30, 30 y 15", async () => {

        const r = await consultas()
            .explicarMora("CV-2026-0410", 2, new Date(2027, 0, 24));

        expect(r.tramosRecorridos.map(l => l.tramo))
            .toEqual(["mora_1", "mora_2", "mora_3"]);

        expect(r.tramosRecorridos.map(l => l.dias)).toEqual([30, 30, 15]);

        const suma = r.tramosRecorridos
            .reduce((total, l) => total + l.dias, 0);
        expect(suma).toBe(r.diasAtraso);
    });

    it("Cada tramo trae su TNA y su tasa diaria", async () => {

        const r = await consultas()
            .explicarMora("CV-2026-0410", 2, new Date(2027, 0, 24));

        expect(r.tramosRecorridos.map(l => l.tnaMoratoria))
            .toEqual(["18 %", "24 %", "30 %"]);

        expect(r.tramosRecorridos[0].tasaDiaria).toBeCloseTo(0.0005, 9);
        expect(r.tramosRecorridos[3 - 1].tasaDiaria)
            .toBeCloseTo(0.30 / 360, 9);
    });

    /**
     * El punto mas delicado del desglose (P2 7.3): el redondeo ocurre UNA
     * sola vez, al cerrar el calculo de la cuota. La suma de los montos
     * ya redondeados puede diferir un centavo del total, y la pantalla
     * debe poder explicarlo en vez de ajustar los numeros para que cuadre.
     */
    it("Expone la diferencia entre la suma de tramos y el total", async () => {

        const r = await consultas()
            .explicarMora("CV-2026-0410", 2, new Date(2027, 0, 24));

        expect(r.sumaDeTramosRedondeados).toBe(34.48);
        expect(r.total).toBe(34.47);
        expect(r.hayDiferenciaPorRedondeo).toBe(true);
    });

    it("El total coincide con lo que cobra la politica", async () => {

        const r = await consultas()
            .explicarMora("CV-2026-0410", 2, new Date(2027, 0, 24));

        const delNucleo = POLITICA_ESCALONADA_2026
            .calcular(Dinero.desde(r.capitalEnMora), r.diasAtraso)
            .obtenerValor();

        expect(r.total).toBe(delNucleo);
    });
});

describe("Explicar una mora - consulta G-5", () => {

    /**
     * "Dame el estado del credito CV-2026-0030 al 31 de octubre de 2026 y
     *  explicame como se formo la mora de su cuota 3."
     */
    it("Un credito con politica plana tiene una sola linea", async () => {

        const r = await consultas()
            .explicarMora("CV-2026-0030", 3, new Date(2026, 9, 31));

        expect(r.politica).toBe("POL-2024-01");
        expect(r.tramosRecorridos).toHaveLength(1);
        expect(r.tramosRecorridos[0].tramo).toBe("plana");
        expect(r.tramosRecorridos[0].tnaMoratoria).toBe("24 %");
    });

    it("Sin tramos que recorrer no hay diferencia por redondeo", async () => {

        const r = await consultas()
            .explicarMora("CV-2026-0030", 3, new Date(2026, 9, 31));

        expect(r.hayDiferenciaPorRedondeo).toBe(false);
        expect(r.sumaDeTramosRedondeados).toBe(r.total);
    });

    it("El total coincide con la politica plana del nucleo", async () => {

        const r = await consultas()
            .explicarMora("CV-2026-0030", 3, new Date(2026, 9, 31));

        const delNucleo = POLITICA_PLANA_2024
            .calcular(Dinero.desde(r.capitalEnMora), r.diasAtraso)
            .obtenerValor();

        expect(r.total).toBe(delNucleo);
    });
});

describe("Explicar una mora - caso M-3 del Proyecto 2", () => {

    it("A 100 dias reproduce los cuatro tramos y Q50.80", () => {

        // El oraculo del P2 7.4, ahora visto desde la explicacion.
        const d = POLITICA_ESCALONADA_2026
            .explicar(Dinero.desde(725.76), 100);

        expect(d.lineas.map(l => l.diasEnTramo)).toEqual([30, 30, 30, 10]);
        expect(d.total.obtenerValor()).toBe(50.80);

        // Redondeadas, las cuatro lineas suman Q50.81: un centavo mas.
        const suma = d.lineas.reduce(
            (t, l) => t + Math.round(l.montoSinRedondear * 100) / 100,
            0
        );
        expect(Math.round(suma * 100) / 100).toBe(50.81);
    });

    it("La suma sin redondear es exacta", () => {

        const d = POLITICA_ESCALONADA_2026
            .explicar(Dinero.desde(725.76), 100);

        expect(Number(d.sumaSinRedondear.toFixed(4))).toBe(50.8032);
    });
});

describe("Explicar una mora - las tres politicas explican igual", () => {

    it("Toda politica devuelve un desglose consistente", () => {

        const capital = Dinero.desde(725.76);

        for (const politica of [POLITICA_PLANA_2024, POLITICA_ESCALONADA_2026]) {

            const d = politica.explicar(capital, 45);

            expect(d.versionPolitica).toBe(politica.version);
            expect(d.capitalEnMora.esIgualA(capital)).toBe(true);
            expect(d.diasAtraso).toBe(45);
            expect(d.total.esIgualA(politica.calcular(capital, 45)))
                .toBe(true);

            // Los dias de las lineas nunca exceden el atraso.
            const dias = d.lineas.reduce((t, l) => t + l.diasEnTramo, 0);
            expect(dias).toBeLessThanOrEqual(45);
        }
    });

    it("Sin atraso no hay lineas que explicar", () => {

        for (const politica of [POLITICA_PLANA_2024, POLITICA_ESCALONADA_2026]) {
            const d = politica.explicar(Dinero.desde(725.76), 0);
            expect(d.lineas).toHaveLength(0);
            expect(d.total.esCero()).toBe(true);
        }
    });
});

describe("Explicar una mora - rechazos", () => {

    it("Cuota inexistente", async () => {
        try {
            await consultas()
                .explicarMora("CV-2026-0030", 99, new Date(2026, 9, 31));
            throw new Error("debio rechazar");
        } catch (error) {
            expect((error as ErrorConsulta).codigo).toBe("CUOTA_INEXISTENTE");
        }
    });

    it("Credito inexistente", async () => {
        try {
            await consultas()
                .explicarMora("CV-9999-9999", 1, new Date(2026, 9, 31));
            throw new Error("debio rechazar");
        } catch (error) {
            expect((error as ErrorConsulta).codigo)
                .toBe("CREDITO_INEXISTENTE");
        }
    });
});
