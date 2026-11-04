import { describe, expect, it } from "vitest";

import {
    RepositorioCarteraCsv
} from "../src/adaptadores/repositorio-cartera-csv";
import {
    ConsultasCartera,
    ErrorConsulta
} from "../src/servicios/consultas-cartera";
import { TramoMora } from "../src/dominio/tramo-mora";

function consultas(): ConsultasCartera {
    return new ConsultasCartera(
        new RepositorioCarteraCsv(process.env.CV_DATA_DIR ?? "")
    );
}

const CORTE = new Date(2026, 9, 31);

describe("Proximos vencimientos - consulta G-6", () => {

    /**
     * "Que cuotas vencen en los proximos 7 dias desde el 31 de octubre de
     *  2026? Y en los proximos 30?"
     */
    it("A 7 dias vencen 10 cuotas por Q7,001.31", async () => {

        const r = await consultas().proximosVencimientos(CORTE, 7);

        expect(r.fechaCorte).toBe("2026-10-31");
        expect(r.ventanaDias).toBe(7);
        expect(r.hasta).toBe("2026-11-07");
        expect(r.cantidadCuotas).toBe(10);
        expect(r.creditosInvolucrados).toBe(10);
        expect(r.montoTotal).toBe(7001.31);
    });

    it("A 30 dias vencen 65 cuotas por Q45,960.55", async () => {

        const r = await consultas().proximosVencimientos(CORTE, 30);

        expect(r.hasta).toBe("2026-11-30");
        expect(r.cantidadCuotas).toBe(65);
        expect(r.creditosInvolucrados).toBe(65);
        expect(r.montoTotal).toBe(45960.55);
    });

    it("El monto total es la suma de lo pendiente de cada cuota", async () => {

        const r = await consultas().proximosVencimientos(CORTE, 30);

        const suma = r.cuotas.reduce((t, c) => t + c.montoPendiente, 0);

        expect(Math.round(suma * 100) / 100).toBe(r.montoTotal);
    });

    /**
     * La ventana es (corte, corte + dias]: la cuota que vence el dia del
     * corte ya es exigible y pertenece al cobro del dia, no a lo que
     * viene.
     */
    it("La ventana excluye el dia del corte", async () => {

        const r = await consultas().proximosVencimientos(CORTE, 30);

        for (const cuota of r.cuotas) {
            expect(cuota.diasParaVencer).toBeGreaterThanOrEqual(1);
            expect(cuota.diasParaVencer).toBeLessThanOrEqual(30);
            expect(cuota.fechaVencimiento > "2026-10-31").toBe(true);
        }
    });

    it("Las cuotas salen del vencimiento mas proximo al mas lejano", async () => {

        const r = await consultas().proximosVencimientos(CORTE, 30);

        const dias = r.cuotas.map(c => c.diasParaVencer);

        expect(dias).toEqual([...dias].sort((a, b) => a - b));
        expect(r.cuotas[0].fechaVencimiento).toBe("2026-11-01");
        expect(r.cuotas[0].diasParaVencer).toBe(1);
    });

    /**
     * Una ventana mas corta solo puede contener un subconjunto de la mas
     * larga. Si no fuera asi, el filtro por fecha estaria mal.
     */
    it("La ventana de 7 dias esta contenida en la de 30", async () => {

        const servicio = consultas();

        const corta = await servicio.proximosVencimientos(CORTE, 7);
        const larga = await servicio.proximosVencimientos(CORTE, 30);

        const clave = (c: { idCredito: string; numeroCuota: number }) =>
            `${c.idCredito}-${c.numeroCuota}`;

        const enLarga = new Set(larga.cuotas.map(clave));

        for (const cuota of corta.cuotas) {
            expect(enLarga.has(clave(cuota))).toBe(true);
        }

        expect(corta.montoTotal).toBeLessThanOrEqual(larga.montoTotal);
    });

    it("Ninguna cuota saldada aparece como por vencer", async () => {

        const r = await consultas().proximosVencimientos(CORTE, 30);

        for (const cuota of r.cuotas) {
            expect(cuota.montoPendiente).toBeGreaterThan(0);
        }
    });

    it("Rechaza una ventana que no es un entero positivo", async () => {

        for (const ventana of [0, -5, 1.5]) {
            try {
                await consultas().proximosVencimientos(CORTE, ventana);
                throw new Error("debio rechazar " + ventana);
            } catch (error) {
                expect((error as ErrorConsulta).codigo)
                    .toBe("VENTANA_INVALIDA");
            }
        }
    });
});

describe("Consultar la cartera - consulta G-1", () => {

    /**
     * "Como esta la cartera al 31 de octubre de 2026? Dame la cartera
     *  activa, la cartera en mora, la cartera en riesgo desglosada por
     *  tramo y lo dado por incobrable en el mes."
     */
    it("Devuelve las cuatro cifras que pide la gerencia", async () => {

        const r = await consultas().consultarCartera(CORTE);

        expect(r.fechaCorte).toBe("2026-10-31");
        expect(r.creditosActivos).toBe(66);
        expect(r.carteraActiva).toBe(299939.82);
        expect(r.carteraEnMora).toBe(48715.17);
        expect(r.montoEnRiesgo).toBe(37841.71);
        expect(r.dadoPorIncobrable).toBe(0);
    });

    /**
     * Mora y riesgo miden cosas distintas: la mora es operativa —quien no
     * pago a tiempo— y el riesgo es estrategico —quien probablemente no
     * pague—. Rotularlos igual es el error que el P2 clasifica como
     * catastrofico, asi que vienen por separado y no coinciden.
     */
    it("La mora y el riesgo son cifras distintas", async () => {

        const r = await consultas().consultarCartera(CORTE);

        expect(r.carteraEnMora).not.toBe(r.montoEnRiesgo);

        expect(r.porcentajeEnMora).toBeCloseTo(0.1624, 4);
        expect(r.porcentajeEnRiesgo).toBeCloseTo(0.1262, 4);
    });

    it("Los porcentajes son el monto sobre la cartera activa", async () => {

        const r = await consultas().consultarCartera(CORTE);

        expect(r.porcentajeEnMora)
            .toBeCloseTo(r.carteraEnMora / r.carteraActiva, 9);

        expect(r.porcentajeEnRiesgo)
            .toBeCloseTo(r.montoEnRiesgo / r.carteraActiva, 9);

        // Invariante 6.10: siempre entre 0 y 1.
        expect(r.porcentajeEnRiesgo).toBeGreaterThanOrEqual(0);
        expect(r.porcentajeEnRiesgo).toBeLessThanOrEqual(1);
    });

    it("El desglose por tramo reparte el riesgo sin perder nada", async () => {

        const r = await consultas().consultarCartera(CORTE);

        const suma = r.desglosePorTramo
            .reduce((t, f) => t + f.saldo, 0);

        expect(Math.round(suma * 100) / 100).toBe(r.montoEnRiesgo);
    });

    it("El desglose trae las cinco categorias con sus cifras", async () => {

        const r = await consultas().consultarCartera(CORTE);

        const porCategoria = new Map(
            r.desglosePorTramo.map(f => [f.categoria, f])
        );

        expect(porCategoria.size).toBe(5);

        // Mora 1 no entra al riesgo: son 1 a 30 dias y el umbral es
        // SUPERAR los 30 (P1 6.8).
        expect(porCategoria.get("mora_1")?.creditos).toBe(0);
        expect(porCategoria.get("mora_1")?.saldo).toBe(0);

        expect(porCategoria.get("mora_2")?.creditos).toBe(3);
        expect(porCategoria.get("mora_2")?.saldo).toBe(7000);

        expect(porCategoria.get("mora_3")?.creditos).toBe(2);
        expect(porCategoria.get("mora_3")?.saldo).toBe(1954.26);

        expect(porCategoria.get("vencido")?.creditos).toBe(4);
        expect(porCategoria.get("vencido")?.saldo).toBe(6638.30);
    });

    /**
     * Los tres creditos reestructurados del paquete estan AL DIA y entran
     * igual al riesgo: "la reestructuracion NO borra el pasado" (P1 6.7).
     * Son el componente mas grande del indicador, asi que omitirlos lo
     * cambiaria por completo.
     */
    it("Los reestructurados al dia entran al riesgo", async () => {

        const r = await consultas().consultarCartera(CORTE);

        const fila = r.desglosePorTramo
            .find(f => f.categoria === "reestructurado_al_dia");

        expect(fila?.creditos).toBe(3);
        expect(fila?.saldo).toBe(22249.15);

        // Sin ellos el riesgo seria Q15,592.56 en vez de Q37,841.71.
        expect(r.montoEnRiesgo - (fila?.saldo ?? 0)).toBeCloseTo(15592.56, 2);
    });

    /**
     * El enunciado es explicito: el porcentaje en riesgo nunca se reporta
     * solo, porque declarar incobrable lo MEJORA sin haber cobrado nada
     * (P1 6.8). Al corte hay dos creditos que ya pasaron los 120 dias y
     * siguen en la cartera.
     */
    it("Reporta los creditos pendientes de dar de baja", async () => {

        const r = await consultas().consultarCartera(CORTE);

        expect(r.candidatosAIncobrable).toBe(2);
        expect(r.saldoCandidatosAIncobrable).toBe(2333.48);

        // Todavia no se han declarado, asi que la baja del periodo es
        // cero y ambas cifras conviven.
        expect(r.dadoPorIncobrable).toBe(0);
    });
});

describe("Consultar la cartera - coherencia con el detalle", () => {

    /**
     * G-1 y G-4 son consultas de doble verificacion: la cifra del tablero
     * y la del detalle se muestran dos veces y deben coincidir. La
     * cartera en mora del tablero tiene que ser exactamente la suma de
     * los saldos que lista G-4.
     */
    it("La cartera en mora coincide con el listado de G-4", async () => {

        const servicio = consultas();

        const cartera = await servicio.consultarCartera(CORTE);
        const listado = await servicio.listarCreditosEnMora(CORTE);

        expect(cartera.carteraEnMora).toBe(listado.saldoCapitalTotal);
    });

    it("El riesgo por tramo coincide con el listado filtrado", async () => {

        const servicio = consultas();

        const cartera = await servicio.consultarCartera(CORTE);

        const tramos = [
            TramoMora.MORA_2,
            TramoMora.MORA_3,
            TramoMora.VENCIDO
        ];

        for (const tramo of tramos) {

            const fila = cartera.desglosePorTramo
                .find(f => f.categoria === tramo);

            const listado = await servicio.listarCreditosEnMora(
                CORTE,
                tramo
            );

            expect(fila?.creditos).toBe(listado.cantidad);
            expect(fila?.saldo).toBe(listado.saldoCapitalTotal);
        }
    });

    it("La cartera activa no incluye los creditos cancelados", async () => {

        const servicio = consultas();
        const repo = new RepositorioCarteraCsv(process.env.CV_DATA_DIR ?? "");

        const cartera = await servicio.consultarCartera(CORTE);
        const todos = (await repo.listarCreditos()).length;

        expect(todos).toBe(75);
        expect(cartera.creditosActivos).toBeLessThan(todos);

        // La cartera en mora es parte de la activa, nunca mayor.
        expect(cartera.carteraEnMora)
            .toBeLessThanOrEqual(cartera.carteraActiva);
    });
});
