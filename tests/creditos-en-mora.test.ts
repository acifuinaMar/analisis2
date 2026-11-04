import { describe, expect, it } from "vitest";

import {
    RepositorioCarteraCsv
} from "../src/adaptadores/repositorio-cartera-csv";
import { ConsultasCartera } from "../src/servicios/consultas-cartera";
import { NombreEstado } from "../src/dominio/nombre-estado";
import { TramoMora } from "../src/dominio/tramo-mora";

function consultas(): ConsultasCartera {
    return new ConsultasCartera(
        new RepositorioCarteraCsv(process.env.CV_DATA_DIR ?? "")
    );
}

/** El corte del paquete canonico: la cartera esta congelada ese dia. */
const CORTE = new Date(2026, 9, 31);

describe("Listar creditos en mora - consulta G-4", () => {

    /**
     * "Lista los creditos en Mora 3 al 31 de octubre de 2026, con sus dias
     *  de atraso y su saldo."
     */
    it("Devuelve los dos creditos en Mora 3 con dias y saldo", async () => {

        const r = await consultas()
            .listarCreditosEnMora(CORTE, TramoMora.MORA_3);

        expect(r.fechaCorte).toBe("2026-10-31");
        expect(r.tramoFiltrado).toBe(TramoMora.MORA_3);
        expect(r.cantidad).toBe(2);

        expect(r.creditos.map(c => c.idCredito))
            .toEqual(["CV-2026-0035", "CV-2026-0030"]);

        expect(r.creditos.map(c => c.diasAtraso)).toEqual([70, 65]);

        expect(r.creditos.map(c => c.saldoCapital))
            .toEqual([1268.10, 686.16]);
    });

    it("El saldo total es la suma de los saldos listados", async () => {

        const r = await consultas()
            .listarCreditosEnMora(CORTE, TramoMora.MORA_3);

        const suma = r.creditos.reduce((t, c) => t + c.saldoCapital, 0);

        expect(r.saldoCapitalTotal).toBe(1954.26);
        expect(Math.round(suma * 100) / 100).toBe(r.saldoCapitalTotal);
    });

    it("Cada linea trae el cliente, para poder trabajarla", async () => {

        const r = await consultas()
            .listarCreditosEnMora(CORTE, TramoMora.MORA_3);

        expect(r.creditos.map(c => c.nombreCliente)).toEqual([
            "Ana Rosa Cabrera Morales",
            "Fernando Óscar Ramírez Coy"
        ]);

        expect(r.creditos.every(c => c.idCliente.startsWith("CL-")))
            .toBe(true);
    });

    /**
     * El tramo es una clasificacion DERIVADA de los dias de atraso (P1
     * 6.5): si el filtro dice Mora 3, los dias tienen que caer en 61..90.
     * Comprobarlo aqui evita que el filtro y la clasificacion se
     * desfasen.
     */
    it("Los dias de cada credito caen dentro del tramo filtrado", async () => {

        const r = await consultas()
            .listarCreditosEnMora(CORTE, TramoMora.MORA_3);

        for (const credito of r.creditos) {
            expect(credito.tramo).toBe(TramoMora.MORA_3);
            expect(credito.diasAtraso).toBeGreaterThanOrEqual(61);
            expect(credito.diasAtraso).toBeLessThanOrEqual(90);
        }
    });
});

describe("Listar creditos en mora - la cartera completa", () => {

    it("Sin filtro devuelve los 16 creditos con atraso", async () => {

        const r = await consultas().listarCreditosEnMora(CORTE);

        expect(r.tramoFiltrado).toBeNull();
        expect(r.cantidad).toBe(16);
        expect(r.saldoCapitalTotal).toBe(48715.17);
    });

    it("Ningun credito al dia entra en la lista", async () => {

        const r = await consultas().listarCreditosEnMora(CORTE);

        for (const credito of r.creditos) {
            expect(credito.diasAtraso).toBeGreaterThan(0);
            expect(credito.tramo).not.toBe(TramoMora.AL_DIA);
        }
    });

    /**
     * Un credito cancelado no se cobra. Que apareciera aqui seria sintoma
     * de que el plan quedo con interes pendiente despues de amortizar todo
     * el capital.
     */
    it("Solo aparecen creditos en mora, ninguno cancelado", async () => {

        const r = await consultas().listarCreditosEnMora(CORTE);

        for (const credito of r.creditos) {
            expect(credito.estado).toBe(NombreEstado.EN_MORA);
        }
    });

    it("El orden va del mayor al menor atraso", async () => {

        const r = await consultas().listarCreditosEnMora(CORTE);

        const dias = r.creditos.map(c => c.diasAtraso);

        expect(dias).toEqual([...dias].sort((a, b) => b - a));
        expect(r.creditos[0].idCredito).toBe("CV-2026-0015");
        expect(dias[0]).toBe(130);
    });

    /**
     * Los cuatro tramos particionan la mora: cada credito con atraso cae
     * en uno y solo uno, asi que las cuatro listas filtradas deben sumar
     * exactamente la lista sin filtro, tanto en cantidad como en saldo.
     */
    it("Los tramos particionan la cartera en mora", async () => {

        const servicio = consultas();

        const todos = await servicio.listarCreditosEnMora(CORTE);

        const tramos = [
            TramoMora.MORA_1,
            TramoMora.MORA_2,
            TramoMora.MORA_3,
            TramoMora.VENCIDO
        ];

        let cantidad = 0;
        let saldo = 0;
        const vistos = new Set<string>();

        for (const tramo of tramos) {

            const r = await servicio.listarCreditosEnMora(CORTE, tramo);

            cantidad += r.cantidad;
            saldo += r.saldoCapitalTotal;

            for (const credito of r.creditos) {
                expect(vistos.has(credito.idCredito)).toBe(false);
                vistos.add(credito.idCredito);
            }
        }

        expect(cantidad).toBe(todos.cantidad);
        expect(Math.round(saldo * 100) / 100).toBe(todos.saldoCapitalTotal);
    });

    it("El reparto por tramo es 7, 3, 2 y 4", async () => {

        const servicio = consultas();

        const conteo = async (tramo: TramoMora) =>
            (await servicio.listarCreditosEnMora(CORTE, tramo)).cantidad;

        expect(await conteo(TramoMora.MORA_1)).toBe(7);
        expect(await conteo(TramoMora.MORA_2)).toBe(3);
        expect(await conteo(TramoMora.MORA_3)).toBe(2);
        expect(await conteo(TramoMora.VENCIDO)).toBe(4);
    });
});

describe("Listar creditos en mora - coherencia con el detalle", () => {

    /**
     * El enunciado llama a G-4 "Tablero -> detalle": la cifra del listado
     * y la del detalle del credito se muestran dos veces y deben
     * coincidir. Si divergen, el asistente se contradice a si mismo.
     */
    it("Cada linea coincide con consultar_credito", async () => {

        const servicio = consultas();

        const r = await servicio.listarCreditosEnMora(
            CORTE,
            TramoMora.MORA_3
        );

        for (const linea of r.creditos) {

            const detalle = await servicio.consultarCredito(
                linea.idCredito,
                CORTE
            );

            expect(detalle.diasAtraso).toBe(linea.diasAtraso);
            expect(detalle.tramo).toBe(linea.tramo);
            expect(detalle.saldoCapital).toBe(linea.saldoCapital);
            expect(detalle.estado).toBe(linea.estado);
            expect(detalle.nombreCliente).toBe(linea.nombreCliente);
            expect(detalle.cuotasVencidas).toBe(linea.cuotasVencidas);
        }
    });
});
