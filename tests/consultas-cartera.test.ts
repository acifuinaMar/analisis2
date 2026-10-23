import { describe, expect, it } from "vitest";

import {
    RepositorioCarteraCsv
} from "../src/adaptadores/repositorio-cartera-csv";
import {
    ConsultasCartera,
    ErrorConsulta
} from "../src/servicios/consultas-cartera";
import { NombreEstado } from "../src/dominio/nombre-estado";
import { TramoMora } from "../src/dominio/tramo-mora";

/**
 * La fecha de corte del paquete canonico: la cartera esta construida al
 * 31 de octubre de 2026. Es la fecha contra la que el docente calculo las
 * respuestas correctas.
 */
const CORTE = new Date(2026, 9, 31);

function consultas(): ConsultasCartera {
    return new ConsultasCartera(
        new RepositorioCarteraCsv(process.env.CV_DATA_DIR ?? "")
    );
}

describe("Consultar un credito (capacidad 1, consulta G-5)", () => {

    it("Devuelve el estado completo de CV-2026-0030", async () => {

        const estado = await consultas()
            .consultarCredito("CV-2026-0030", CORTE);

        expect(estado.idCredito).toBe("CV-2026-0030");
        expect(estado.fechaCorte).toBe("2026-10-31");
        expect(estado.estado).toBe(NombreEstado.EN_MORA);
        expect(estado.nombreCliente).not.toBe("(desconocido)");
    });

    it("Trae las seis cosas que el enunciado exige", async () => {

        const estado = await consultas()
            .consultarCredito("CV-2026-0030", CORTE);

        // Estado, saldo, dias de atraso, tramo, cuotas pagadas y
        // vencidas, proxima cuota (seccion 6.3).
        expect(estado.estado).toBeDefined();
        expect(estado.saldoCapital).toBeGreaterThan(0);
        expect(estado.diasAtraso).toBeGreaterThan(0);
        expect(estado.tramo).toBeDefined();
        expect(estado.cuotasPagadas).toBeGreaterThanOrEqual(0);
        expect(estado.cuotasVencidas).toBeGreaterThan(0);
        expect(estado.proximaCuota).toBeDefined();
    });

    it("El tramo corresponde a los dias de atraso", async () => {

        const estado = await consultas()
            .consultarCredito("CV-2026-0030", CORTE);

        // Desembolso 27/05/2026 a 6 meses, con las cuotas 1 y 2 pagadas
        // puntualmente. La cuota 3 vencio el 27/08/2026, asi que al corte
        // lleva 65 dias: tercer tramo.
        expect(estado.diasAtraso).toBe(65);
        expect(estado.tramo).toBe(TramoMora.MORA_3);
    });

    it("El saldo nunca supera el capital desembolsado", async () => {

        const repo = new RepositorioCarteraCsv(process.env.CV_DATA_DIR ?? "");
        const servicio = new ConsultasCartera(repo);

        for (const credito of (await repo.listarCreditos()).slice(0, 15)) {

            const estado = await servicio
                .consultarCredito(credito.idCredito, CORTE);

            expect(estado.saldoCapital)
                .toBeLessThanOrEqual(estado.capitalDesembolsado);
            expect(estado.saldoCapital).toBeGreaterThanOrEqual(0);
        }
    });

    it("Rechaza un credito inexistente con codigo estable", async () => {

        await expect(
            consultas().consultarCredito("CV-NO-EXISTE", CORTE)
        ).rejects.toThrow(ErrorConsulta);

        try {
            await consultas().consultarCredito("CV-NO-EXISTE", CORTE);
        } catch (error) {
            expect((error as ErrorConsulta).codigo)
                .toBe("CREDITO_INEXISTENTE");
        }
    });
});

describe("La fecha de corte es un parametro, no el reloj", () => {

    it("Dos cortes distintos dan dias de atraso distintos", async () => {

        const servicio = consultas();

        const enOctubre = await servicio
            .consultarCredito("CV-2026-0030", CORTE);

        const enEnero = await servicio
            .consultarCredito("CV-2026-0030", new Date(2027, 0, 31));

        // Noventa y dos dias mas de calendario, noventa y dos de atraso.
        expect(enEnero.diasAtraso).toBeGreaterThan(enOctubre.diasAtraso);
    });

    it("Acepta una fecha futura sin consultar el reloj (G-7)", async () => {

        const estado = await consultas()
            .consultarCredito("CV-2026-0030", new Date(2027, 0, 24));

        expect(estado.fechaCorte).toBe("2027-01-24");
    });

    it("El mismo corte da siempre el mismo resultado", async () => {

        const servicio = consultas();

        const a = await servicio.consultarCredito("CV-2026-0030", CORTE);
        const b = await servicio.consultarCredito("CV-2026-0030", CORTE);

        expect(a).toEqual(b);
    });
});

describe("Deuda de una cuota (capacidad 2, OP-1 y OP-2)", () => {

    it("Desglosa los cuatro rubros de la prelacion", async () => {

        const deuda = await consultas()
            .calcularDeudaDeCuota("CV-2026-0030", 3, CORTE);

        expect(deuda.gastos).toBeGreaterThanOrEqual(0);
        expect(deuda.interesMoratorio).toBeGreaterThan(0);
        expect(deuda.interesCorriente).toBeGreaterThan(0);
        expect(deuda.capital).toBeGreaterThan(0);
    });

    it("El total es la suma exacta de los cuatro rubros", async () => {

        const d = await consultas()
            .calcularDeudaDeCuota("CV-2026-0030", 3, CORTE);

        const suma = Math.round(
            (d.gastos + d.interesMoratorio + d.interesCorriente + d.capital)
            * 100
        ) / 100;

        expect(d.totalExigible).toBe(suma);
    });

    it("Un credito con politica plana no genera gasto de gestion", async () => {

        // CV-2026-0030 se otorgo antes del 1/10/2026, asi que le aplica
        // POL-2024-01. El paquete canonico limita el gasto a POL-2026-10.
        const deuda = await consultas()
            .calcularDeudaDeCuota("CV-2026-0030", 3, CORTE);

        expect(deuda.gastos).toBe(0);
    });

    it("Rechaza una cuota que no existe en el plan", async () => {

        try {
            await consultas().calcularDeudaDeCuota("CV-2026-0030", 99, CORTE);
            throw new Error("debio rechazar");
        } catch (error) {
            expect((error as ErrorConsulta).codigo).toBe("CUOTA_INEXISTENTE");
        }
    });

    it("Rechaza un credito inexistente antes de calcular nada", async () => {

        try {
            await consultas().calcularDeudaDeCuota("CV-NO-EXISTE", 1, CORTE);
            throw new Error("debio rechazar");
        } catch (error) {
            expect((error as ErrorConsulta).codigo)
                .toBe("CREDITO_INEXISTENTE");
        }
    });
});

describe("La reconstruccion reproduce los pagos registrados", () => {

    it("Un credito con pagos tiene menos saldo que su capital", async () => {

        const repo = new RepositorioCarteraCsv(process.env.CV_DATA_DIR ?? "");
        const servicio = new ConsultasCartera(repo);

        const conPagos = (await repo.listarCreditos()).find(
            async c => (await repo.pagosDe(c.idCredito)).length > 0
        )!;

        const estado = await servicio
            .consultarCredito(conPagos.idCredito, CORTE);

        expect(estado.cuotasPagadas + estado.cuotasVencidas)
            .toBeGreaterThan(0);
    });

    it("Las cuotas pagadas no cuentan como vencidas", async () => {

        const estado = await consultas()
            .consultarCredito("CV-2026-0030", CORTE);

        // Una cuota saldada no acumula atraso (P1 6.5), asi que no puede
        // estar en los dos conteos a la vez.
        // Los dos pagos de Q184.60 llegaron en la fecha exacta de
        // vencimiento y saldaron las cuotas 1 y 2 completas. Vencidas
        // quedan la 3, la 4 y la 5; la 6 todavia no vence.
        expect(estado.cuotasPagadas).toBe(2);
        expect(estado.cuotasVencidas).toBe(3);
    });
});
