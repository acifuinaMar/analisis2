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
 * Pruebas de la unica capacidad SENSIBLE (OP-1 a OP-6).
 *
 * Cada prueba levanta su propio servicio con su propio adaptador, porque
 * registrar un pago ESCRIBE: compartir una instancia haria que el orden
 * de ejecucion cambiara los resultados. Las secuencias que si necesitan
 * continuidad —aplicar y despues reintentar— usan un solo servicio a
 * proposito.
 */
function servicio(): ConsultasCartera {
    return new ConsultasCartera(
        new RepositorioCarteraCsv(process.env.CV_DATA_DIR ?? "")
    );
}

const CORTE = new Date(2026, 9, 31);

/** Montos exactos al 31/10/2026, calculados por el nucleo. */
const EXACTO_0043 = 1114.54;
const EXACTO_0035 = 849.77;
const EXACTO_0061 = 370.85;

describe("Registrar un pago - aprobacion humana (OP-1)", () => {

    /**
     * El paso de aprobacion es el corazon de esta herramienta: sin
     * `confirmado` devuelve el desglose y NO toca nada. Es lo que impide
     * que el modelo mueva dinero por su cuenta.
     */
    it("Sin confirmar devuelve el desglose y no aplica nada", async () => {

        const r = await servicio().registrarPago(
            "CV-2026-0043", EXACTO_0043, "IDEM-P1", CORTE, "agencia", false
        );

        expect(r.aplicado).toBe(false);
        expect(r.duplicado).toBe(false);
        expect(r.estadoDespues).toBeUndefined();
        expect(r.mensaje).toContain("aprobacion humana");

        expect(r.cuotasCubiertas).toEqual([1, 2]);
        expect(r.desglosePrelacion.total).toBe(EXACTO_0043);
    });

    it("Desglosa la prelacion en sus cuatro rubros", async () => {

        const d = (await servicio().registrarPago(
            "CV-2026-0043", EXACTO_0043, "IDEM-P2", CORTE, "agencia", false
        )).desglosePrelacion;

        expect(d.gastos).toBe(0);
        expect(d.interesMoratorio).toBe(25.24);
        expect(d.interesCorriente).toBe(138.26);
        expect(d.capital).toBe(951.04);
        expect(d.total).toBe(EXACTO_0043);

        const suma = d.gastos
            + d.interesMoratorio
            + d.interesCorriente
            + d.capital;

        expect(Math.round(suma * 100) / 100).toBe(d.total);
    });

    /**
     * La prueba de seguridad que de verdad importa: pedir la vista previa
     * muchas veces no deja rastro. Si escribiera, el credito cambiaria y
     * el cierre del dia tambien.
     */
    it("La vista previa no deja rastro, ni repetida", async () => {

        const s = servicio();

        const antes = await s.consultarCredito("CV-2026-0043", CORTE);
        const cierreAntes = await s.consultarCierreDiario(CORTE);

        for (let i = 0; i < 3; i++) {
            await s.registrarPago(
                "CV-2026-0043", EXACTO_0043, `IDEM-VP-${i}`, CORTE,
                "agencia", false
            );
        }

        expect(await s.consultarCredito("CV-2026-0043", CORTE))
            .toEqual(antes);
        expect(await s.consultarCierreDiario(CORTE)).toEqual(cierreAntes);
    });

    it("Confirmado aplica el pago y regulariza el credito", async () => {

        const r = await servicio().registrarPago(
            "CV-2026-0043", EXACTO_0043, "IDEM-P3", CORTE, "agencia", true
        );

        expect(r.aplicado).toBe(true);
        expect(r.duplicado).toBe(false);

        expect(r.estadoAntes.estado).toBe(NombreEstado.EN_MORA);
        expect(r.estadoAntes.tramo).toBe(TramoMora.MORA_2);
        expect(r.estadoAntes.diasAtraso).toBe(55);
        expect(r.estadoAntes.cuotasVencidas).toBe(2);
        expect(r.estadoAntes.saldoCapital).toBe(3000);

        // Poscondicion del pago exacto (P1 6.6.3): la deuda vencida queda
        // saldada y el credito regresa a VIGENTE.
        expect(r.estadoDespues?.estado).toBe(NombreEstado.VIGENTE);
        expect(r.estadoDespues?.tramo).toBe(TramoMora.AL_DIA);
        expect(r.estadoDespues?.diasAtraso).toBe(0);
        expect(r.estadoDespues?.cuotasVencidas).toBe(0);
        expect(r.estadoDespues?.saldoCapital).toBe(2048.96);
    });

    /**
     * El saldo baja exactamente lo imputado a capital, nunca el monto
     * completo del pago: la mora y el interes no amortizan (P1 6.9).
     */
    it("El saldo baja solo lo imputado a capital", async () => {

        const r = await servicio().registrarPago(
            "CV-2026-0043", EXACTO_0043, "IDEM-P4", CORTE, "agencia", true
        );

        const bajada = r.estadoAntes.saldoCapital
            - (r.estadoDespues?.saldoCapital ?? 0);

        expect(Math.round(bajada * 100) / 100)
            .toBe(r.desglosePrelacion.capital);

        expect(bajada).toBeLessThan(r.montoRecibido);
    });

    it("El pago aplicado aparece en el cierre del dia", async () => {

        const s = servicio();

        expect((await s.consultarCierreDiario(CORTE)).pagos.cantidad)
            .toBe(0);

        await s.registrarPago(
            "CV-2026-0043", EXACTO_0043, "IDEM-P5", CORTE, "agencia", true
        );

        const cierre = await s.consultarCierreDiario(CORTE);

        expect(cierre.pagos.cantidad).toBe(1);
        expect(cierre.pagos.monto).toBe(EXACTO_0043);
        expect(cierre.recuperaciones.interesMoratorio).toBe(25.24);
        expect(cierre.recuperaciones.capital).toBe(951.04);
    });
});

describe("Registrar un pago - segundo credito del guion (OP-2)", () => {

    it("CV-2026-0035 salda tres cuotas con Q849.77", async () => {

        const r = await servicio().registrarPago(
            "CV-2026-0035", EXACTO_0035, "IDEM-P6", CORTE, "campo", true
        );

        expect(r.aplicado).toBe(true);
        expect(r.cuotasCubiertas).toEqual([2, 3, 4]);

        expect(r.desglosePrelacion.interesMoratorio).toBe(19.07);
        expect(r.desglosePrelacion.interesCorriente).toBe(92.42);
        expect(r.desglosePrelacion.capital).toBe(738.28);

        expect(r.estadoAntes.tramo).toBe(TramoMora.MORA_3);
        expect(r.estadoDespues?.estado).toBe(NombreEstado.VIGENTE);
        expect(r.estadoDespues?.saldoCapital).toBe(529.82);
    });

    /**
     * La cifra del desglose tiene que ser la misma que devuelve la
     * consulta de deuda: si no, la pantalla de registro de pago y el chat
     * mostrarian montos distintos para el mismo cobro.
     */
    it("El desglose coincide con el que informa la consulta", async () => {

        const s = servicio();

        const vista = await s.registrarPago(
            "CV-2026-0035", EXACTO_0035, "IDEM-P7", CORTE, "campo", false
        );

        // La deuda de la cuota mas antigua es parte del total exigible.
        const cuota = await s.calcularDeudaDeCuota(
            "CV-2026-0035", 2, CORTE
        );

        expect(vista.cuotasCubiertas).toContain(cuota.numeroCuota);
        expect(vista.desglosePrelacion.total)
            .toBeGreaterThanOrEqual(cuota.totalExigible);
    });
});

describe("Registrar un pago - idempotencia (OP-4)", () => {

    /**
     * "Reintentar la operacion OP-1 con la misma clave de idempotencia.
     *  El sistema no debe volver a aplicar el pago."
     *
     * El reintento se resuelve ANTES de cualquier validacion de negocio:
     * cuando llega, el credito ya quedo al dia y no tiene cuotas
     * vencidas, asi que validar primero haria que el reintento muriera
     * con un "no hay deuda exigible" en vez del "ya estaba registrado"
     * que necesita oir.
     */
    it("El reintento con la misma clave no vuelve a cobrar", async () => {

        const s = servicio();

        const primero = await s.registrarPago(
            "CV-2026-0043", EXACTO_0043, "IDEM-OP-1", CORTE, "agencia", true
        );

        expect(primero.aplicado).toBe(true);

        const saldo = primero.estadoDespues?.saldoCapital;

        const reintento = await s.registrarPago(
            "CV-2026-0043", EXACTO_0043, "IDEM-OP-1", CORTE, "agencia", true
        );

        expect(reintento.aplicado).toBe(false);
        expect(reintento.duplicado).toBe(true);
        expect(reintento.mensaje).toContain("NO se volvio a aplicar");

        // El saldo no se movio.
        expect(reintento.estadoAntes.saldoCapital).toBe(saldo);
    });

    it("El reintento no agrega un pago al cierre", async () => {

        const s = servicio();

        await s.registrarPago(
            "CV-2026-0043", EXACTO_0043, "IDEM-OP-1", CORTE, "agencia", true
        );

        const unoSolo = await s.consultarCierreDiario(CORTE);

        for (let i = 0; i < 3; i++) {
            await s.registrarPago(
                "CV-2026-0043", EXACTO_0043, "IDEM-OP-1", CORTE,
                "agencia", true
            );
        }

        expect(await s.consultarCierreDiario(CORTE)).toEqual(unoSolo);
        expect(unoSolo.pagos.cantidad).toBe(1);
    });

    /**
     * La clave identifica la OPERACION, no el pago: reintentarla se
     * resuelve igual aunque el credito ya no admita cobros.
     */
    it("El reintento gana incluso sobre las validaciones", async () => {

        const s = servicio();

        await s.registrarPago(
            "CV-2026-0043", EXACTO_0043, "IDEM-OP-1", CORTE, "agencia", true
        );

        // Ya no hay cuotas vencidas: un pago nuevo seria rechazado.
        try {
            await s.registrarPago(
                "CV-2026-0043", EXACTO_0043, "IDEM-OTRA", CORTE,
                "agencia", true
            );
            throw new Error("debio rechazar");
        } catch (error) {
            expect((error as ErrorConsulta).codigo).toBe("CUOTA_YA_PAGADA");
        }

        // Pero el reintento de la clave original sigue respondiendo bien.
        const reintento = await s.registrarPago(
            "CV-2026-0043", EXACTO_0043, "IDEM-OP-1", CORTE, "agencia", true
        );

        expect(reintento.duplicado).toBe(true);
    });

    it("La clave repetida tambien se detecta sin confirmar", async () => {

        const s = servicio();

        await s.registrarPago(
            "CV-2026-0035", EXACTO_0035, "IDEM-OP-2", CORTE, "campo", true
        );

        const vista = await s.registrarPago(
            "CV-2026-0035", EXACTO_0035, "IDEM-OP-2", CORTE, "campo", false
        );

        expect(vista.duplicado).toBe(true);
        expect(vista.aplicado).toBe(false);
    });
});

describe("Registrar un pago - monto no exacto (OP-5)", () => {

    /**
     * "Intentar registrar un pago de Q500.00 sobre el credito
     *  CV-2026-0061. El sistema debe rechazarlo por monto no exacto y
     *  decir cual es el monto correcto."
     */
    it("Rechaza Q500 e informa que el correcto es Q370.85", async () => {

        try {
            await servicio().registrarPago(
                "CV-2026-0061", 500.00, "IDEM-P8", CORTE, "agencia", true
            );
            throw new Error("debio rechazar");
        } catch (error) {
            const e = error as ErrorConsulta;

            expect(e.codigo).toBe("MONTO_NO_EXACTO");
            expect(e.message).toContain("370.85");

            expect(e.detalle?.montoCorrecto).toBe(EXACTO_0061);
            expect(e.detalle?.montoRecibido).toBe(500);
            expect(e.detalle?.diferencia).toBe(129.15);
            expect(e.detalle?.cuotasCubiertas).toEqual([1]);
        }
    });

    /**
     * El monto correcto llega en un campo y no solo en el texto, para que
     * el asistente lo use sin tener que interpretar la frase.
     */
    it("El detalle trae el desglose del monto correcto", async () => {

        try {
            await servicio().registrarPago(
                "CV-2026-0061", 500.00, "IDEM-P9", CORTE, "agencia", true
            );
            throw new Error("debio rechazar");
        } catch (error) {
            const d = (error as ErrorConsulta).detalle
                ?.desglosePrelacion as Record<string, number>;

            expect(d.interesMoratorio).toBe(1.65);
            expect(d.interesCorriente).toBe(60);
            expect(d.capital).toBe(309.20);
            expect(d.total).toBe(EXACTO_0061);
        }
    });

    it("Un centavo de diferencia tambien se rechaza", async () => {

        for (const monto of [EXACTO_0061 - 0.01, EXACTO_0061 + 0.01]) {
            try {
                await servicio().registrarPago(
                    "CV-2026-0061", monto, "IDEM-C", CORTE, "agencia", true
                );
                throw new Error("debio rechazar " + monto);
            } catch (error) {
                expect((error as ErrorConsulta).codigo)
                    .toBe("MONTO_NO_EXACTO");
            }
        }
    });

    it("El monto exacto si se acepta", async () => {

        const r = await servicio().registrarPago(
            "CV-2026-0061", EXACTO_0061, "IDEM-P10", CORTE, "agencia", true
        );

        expect(r.aplicado).toBe(true);
        expect(r.estadoDespues?.estado).toBe(NombreEstado.VIGENTE);
    });

    it("Un rechazo no deja rastro en la cartera", async () => {

        const s = servicio();

        const antes = await s.consultarCredito("CV-2026-0061", CORTE);

        await expect(
            s.registrarPago(
                "CV-2026-0061", 500.00, "IDEM-P11", CORTE, "agencia", true
            )
        ).rejects.toThrow();

        expect(await s.consultarCredito("CV-2026-0061", CORTE))
            .toEqual(antes);
        expect((await s.consultarCierreDiario(CORTE)).pagos.cantidad)
            .toBe(0);
    });
});

describe("Registrar un pago - credito incobrable (OP-6)", () => {

    /**
     * "Intentar registrar un pago sobre el credito CV-2026-0015. El
     *  sistema debe rechazarlo porque el credito es incobrable."
     *
     * Al corte lleva 130 dias. Declarar la baja es una decision contable
     * que el nucleo nunca toma solo (P1 6.7), asi que el credito sigue en
     * EN_MORA y tecnicamente admitiria pagos. La herramienta lo rechaza
     * igual: cobrarlo por la via normal lo mantendria en la cartera
     * cuando las reglas obligan a darlo de baja, y clasificaria el dinero
     * como recuperacion corriente en vez de recuperacion de incobrable,
     * que va en cuenta separada.
     */
    it("Rechaza el pago de un credito con mas de 120 dias", async () => {

        try {
            await servicio().registrarPago(
                "CV-2026-0015", 298.22, "IDEM-P12", CORTE, "agencia", true
            );
            throw new Error("debio rechazar");
        } catch (error) {
            const e = error as ErrorConsulta;

            expect(e.codigo).toBe("CREDITO_INCOBRABLE");
            expect(e.detalle?.diasAtraso).toBe(130);
            expect(e.detalle?.bajaPendiente).toBe(true);
            expect(e.message).toContain("120");
        }
    });

    it("Tampoco lo deja pasar en la vista previa", async () => {

        await expect(
            servicio().registrarPago(
                "CV-2026-0015", 298.22, "IDEM-P13", CORTE, "agencia", false
            )
        ).rejects.toThrow(/incobrable|120/i);
    });

    /**
     * El rechazo depende de los dias de atraso A LA FECHA, no de un campo
     * guardado: el mismo credito en una fecha anterior todavia se podia
     * cobrar.
     */
    it("En una fecha anterior el mismo credito si admitia pago", async () => {

        const s = servicio();

        const antes = await s.consultarCredito(
            "CV-2026-0015",
            new Date(2026, 7, 31)
        );

        expect(antes.diasAtraso).toBeLessThanOrEqual(120);

        // No se rechaza por incobrable; si acaso, por monto.
        try {
            await s.registrarPago(
                "CV-2026-0015", 1.00, "IDEM-P14",
                new Date(2026, 7, 31), "agencia", false
            );
        } catch (error) {
            expect((error as ErrorConsulta).codigo)
                .not.toBe("CREDITO_INCOBRABLE");
        }
    });
});

describe("Registrar un pago - otros rechazos", () => {

    it("Credito inexistente", async () => {

        try {
            await servicio().registrarPago(
                "CV-9999-9999", 100, "IDEM-P15", CORTE, "agencia", true
            );
            throw new Error("debio rechazar");
        } catch (error) {
            expect((error as ErrorConsulta).codigo)
                .toBe("CREDITO_INEXISTENTE");
        }
    });

    it("Un credito sin cuotas vencidas no tiene nada que cobrar", async () => {

        try {
            // Desembolsado el 28/10/2026: su primera cuota vence en
            // noviembre, asi que al corte no debe nada exigible.
            await servicio().registrarPago(
                "CV-2026-0070", 100, "IDEM-P16", CORTE, "agencia", true
            );
            throw new Error("debio rechazar");
        } catch (error) {
            const e = error as ErrorConsulta;
            expect(e.codigo).toBe("CUOTA_YA_PAGADA");
            expect(e.detalle?.cuotasVencidas).toBe(0);
        }
    });
});
