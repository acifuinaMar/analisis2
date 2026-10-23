import { describe, expect, it } from "vitest";

import {
    RepositorioCarteraCsv
} from "../src/adaptadores/repositorio-cartera-csv";
import {
    ConsultasCartera,
    ErrorConsulta
} from "../src/servicios/consultas-cartera";

function consultas(): ConsultasCartera {
    return new ConsultasCartera(
        new RepositorioCarteraCsv(process.env.CV_DATA_DIR ?? "")
    );
}

/** Los meses del paquete: el primer desembolso es de enero de 2026. */
const MESES = [
    "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
    "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"
];

describe("Cierre mensual - consulta G-2", () => {

    /**
     * "Dame el cierre mensual de octubre de 2026: desembolsos y
     *  recuperaciones por concepto."
     */
    it("Octubre: 10 desembolsos por Q41,000 y 42 pagos por Q36,554.50",
        async () => {

            const c = await consultas().consultarCierreMensual("2026-10");

            expect(c.id).toBe("CIE-2026-10");
            expect(c.tipo).toBe("mensual");
            expect(c.desde).toBe("2026-10-01");
            expect(c.hasta).toBe("2026-10-31");

            expect(c.desembolsos.cantidad).toBe(10);
            expect(c.desembolsos.monto).toBe(41000);

            expect(c.pagos.cantidad).toBe(42);
            expect(c.pagos.monto).toBe(36554.50);
        });

    it("Desglosa las recuperaciones por concepto", async () => {

        const r = (await consultas().consultarCierreMensual("2026-10"))
            .recuperaciones;

        expect(r.gastos).toBe(0);
        expect(r.interesMoratorio).toBe(16.93);
        expect(r.interesCorriente).toBe(7162.89);
        expect(r.capital).toBe(29374.68);
        expect(r.excedenteACapital).toBe(0);
        expect(r.total).toBe(36554.50);
    });

    /**
     * Nada se pierde: las cinco lineas del desglose suman siempre el
     * total recibido. Si no cuadrara, habria dinero imputado a un
     * concepto que el cierre no reporta.
     */
    it("Los conceptos suman exactamente lo recibido", async () => {

        for (const periodo of MESES) {

            const c = await consultas().consultarCierreMensual(periodo);
            const r = c.recuperaciones;

            const suma = r.gastos
                + r.interesMoratorio
                + r.interesCorriente
                + r.capital
                + r.excedenteACapital;

            expect(Math.round(suma * 100) / 100).toBe(r.total);
            expect(r.total).toBe(c.pagos.monto);
        }
    });

    /**
     * No se cobro ningun gasto de gestion en todo el historial, y es
     * correcto: el gasto solo aplica a la politica escalonada POL-2026-10
     * (decision RP-08), que rige los creditos otorgados desde el 1 de
     * octubre de 2026, y ninguno de esos alcanzo 31 dias de atraso antes
     * del cierre del paquete.
     */
    it("No hay gasto de gestion cobrado en ningun mes", async () => {

        for (const periodo of MESES) {
            const c = await consultas().consultarCierreMensual(periodo);
            expect(c.recuperaciones.gastos).toBe(0);
        }
    });

    /**
     * El flujo neto es el unico campo que puede ser negativo: en octubre
     * se desembolsaron Q41,000 y entraron Q36,554.50.
     */
    it("El flujo neto de octubre es negativo", async () => {

        const c = await consultas().consultarCierreMensual("2026-10");

        expect(c.flujoNeto).toBe(-4445.50);
        expect(c.flujoNeto).toBe(c.pagos.monto - c.desembolsos.monto);
    });

    it("Un mes sin movimiento devuelve ceros, no un error", async () => {

        const c = await consultas().consultarCierreMensual("2026-01");

        // En enero se desembolso, pero la primera cuota vence un mes
        // despues: no hubo ningun pago.
        expect(c.desembolsos.cantidad).toBe(5);
        expect(c.pagos.cantidad).toBe(0);
        expect(c.pagos.monto).toBe(0);
        expect(c.recuperaciones.total).toBe(0);
    });

    it("Rechaza un periodo mal formado o inexistente", async () => {

        for (const periodo of ["2026-13", "octubre", "2026-1", "2026"]) {
            try {
                await consultas().consultarCierreMensual(periodo);
                throw new Error("debio rechazar " + periodo);
            } catch (error) {
                expect((error as ErrorConsulta).codigo)
                    .toBe("PERIODO_INVALIDO");
            }
        }
    });
});

describe("Cierre diario - consulta G-3", () => {

    /**
     * "Dame el cierre del 31 de octubre de 2026."
     *
     * Ese dia no hubo movimiento: el ultimo pago del paquete es del 30 de
     * octubre y el ultimo desembolso del 28. El cierre en ceros es la
     * respuesta CORRECTA, no un fallo, y por eso reporta las cantidades
     * explicitamente en vez de solo los montos.
     */
    it("El 31 de octubre no hubo movimiento", async () => {

        const c = await consultas()
            .consultarCierreDiario(new Date(2026, 9, 31));

        expect(c.id).toBe("CIE-2026-10-31");
        expect(c.tipo).toBe("diario");
        expect(c.desde).toBe("2026-10-31");
        expect(c.hasta).toBe("2026-10-31");

        expect(c.desembolsos.cantidad).toBe(0);
        expect(c.pagos.cantidad).toBe(0);
        expect(c.recuperaciones.total).toBe(0);
        expect(c.flujoNeto).toBe(0);
    });

    it("Un dia con movimiento: el 23 de octubre entraron Q6,449.45",
        async () => {

            const c = await consultas()
                .consultarCierreDiario(new Date(2026, 9, 23));

            expect(c.pagos.cantidad).toBe(5);
            expect(c.pagos.monto).toBe(6449.45);
            expect(c.recuperaciones.interesMoratorio).toBe(13.39);
            expect(c.recuperaciones.interesCorriente).toBe(491.66);
            expect(c.recuperaciones.capital).toBe(5944.40);
            expect(c.flujoNeto).toBe(6449.45);
        });

    /**
     * Los dias del mes tienen que sumar el mes. Es la comprobacion de que
     * el rango diario y el mensual filtran igual, sin dejar fuera ni
     * contar dos veces el primero o el ultimo dia.
     */
    it("Los 31 dias de octubre suman el cierre mensual", async () => {

        const servicio = consultas();

        const mes = await servicio.consultarCierreMensual("2026-10");

        let pagos = 0;
        let monto = 0;
        let desembolsos = 0;
        let desembolsado = 0;

        for (let dia = 1; dia <= 31; dia++) {

            const c = await servicio
                .consultarCierreDiario(new Date(2026, 9, dia));

            pagos += c.pagos.cantidad;
            monto += c.pagos.monto;
            desembolsos += c.desembolsos.cantidad;
            desembolsado += c.desembolsos.monto;
        }

        expect(pagos).toBe(mes.pagos.cantidad);
        expect(Math.round(monto * 100) / 100).toBe(mes.pagos.monto);
        expect(desembolsos).toBe(mes.desembolsos.cantidad);
        expect(desembolsado).toBe(mes.desembolsos.monto);
    });
});

describe("Cierre - idempotencia (P1 6.9)", () => {

    /**
     * "Reejecutar el cierre del mismo dia debe producir el mismo
     *  resultado y no duplicar movimientos."
     *
     * Se cumple por construccion: el cierre no acumula ni escribe nada,
     * reconstruye el periodo a partir de la bitacora de eventos.
     */
    it("Pedir el mismo cierre dos veces da el mismo resultado", async () => {

        const servicio = consultas();

        const a = await servicio.consultarCierreMensual("2026-10");
        const b = await servicio.consultarCierreMensual("2026-10");

        expect(b).toEqual(a);

        const d1 = await servicio
            .consultarCierreDiario(new Date(2026, 9, 23));
        const d2 = await servicio
            .consultarCierreDiario(new Date(2026, 9, 23));

        expect(d2).toEqual(d1);
    });

    /**
     * Los dos pagos con clave de idempotencia repetida del paquete
     * (IDEM-000068 e IDEM-000127) NO se cuentan dos veces. Se ven en el
     * cierre: los 228 eventos de pago quedan en 226 aplicados, y la
     * diferencia cae en julio y en septiembre.
     */
    it("Los pagos duplicados no se cuentan dos veces", async () => {

        const servicio = consultas();

        let pagos = 0;

        for (const periodo of MESES) {
            pagos += (await servicio.consultarCierreMensual(periodo))
                .pagos.cantidad;
        }

        expect(pagos).toBe(226);

        const resumen = await new RepositorioCarteraCsv(
            process.env.CV_DATA_DIR ?? ""
        ).resumenCarga();

        expect(resumen.eventosPagoLeidos).toBe(228);
        expect(resumen.duplicadosIgnorados).toBe(2);
        expect(pagos).toBe(
            resumen.eventosPagoLeidos - resumen.duplicadosIgnorados
        );
    });
});

describe("Cierre - coherencia con el historial completo", () => {

    /**
     * Los doce meses de 2026 cubren todo el paquete, asi que sus cierres
     * tienen que sumar el capital desembolsado de los 75 creditos y el
     * total de los pagos aplicados. Si el filtro por fecha perdiera un
     * evento, esta suma lo delataria.
     */
    it("Los doce meses suman todo el historial", async () => {

        const servicio = consultas();
        const repo = new RepositorioCarteraCsv(
            process.env.CV_DATA_DIR ?? ""
        );

        let desembolsado = 0;
        let recuperado = 0;

        for (const periodo of MESES) {
            const c = await servicio.consultarCierreMensual(periodo);
            desembolsado += c.desembolsos.monto;
            recuperado += c.pagos.monto;
        }

        const capitalTotal = (await repo.listarCreditos())
            .reduce((t, c) => t + c.capital.obtenerValor(), 0);

        expect(desembolsado).toBe(capitalTotal);
        expect(desembolsado).toBe(530500);

        const pagosTotal = (await repo.listarPagos())
            .reduce((t, p) => t + p.monto.obtenerValor(), 0);

        expect(Math.round(recuperado * 100) / 100)
            .toBe(Math.round(pagosTotal * 100) / 100);
        expect(Math.round(recuperado * 100) / 100).toBe(277775.96);
    });

    /**
     * La mora cobrada en todo el historial es Q155.86. Es la misma cifra
     * que aparece al comparar, credito por credito, lo recibido contra lo
     * imputado a capital e interes de cuota: la diferencia es exactamente
     * la mora, porque no es ni capital ni interes corriente.
     */
    it("La mora cobrada en el historial es Q155.86", async () => {

        const servicio = consultas();

        let mora = 0;

        for (const periodo of MESES) {
            mora += (await servicio.consultarCierreMensual(periodo))
                .recuperaciones.interesMoratorio;
        }

        expect(Math.round(mora * 100) / 100).toBe(155.86);
    });
});
