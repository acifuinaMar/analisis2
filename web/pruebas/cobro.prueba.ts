import { expect, test, type Page } from "@playwright/test";

import {
    CREDITO_AL_DIA,
    CREDITO_INCOBRABLE,
    CREDITO_MORA,
    simularApi,
    type Simulacion
} from "./apiSimulada";

/**
 * Fase 2 · Cobro en campo, en un navegador real contra la API SIMULADA
 * (pruebas/apiSimulada.ts). Ninguna prueba toca PostgreSQL.
 */

const CLAVE_PENDIENTE = "cv.cobro.operacionPendiente";

async function entrarComoAsesor(page: Page) {
    await page.goto("/perfil");
    await page.getByRole("button", { name: /Asesor de campo/ }).click();
    await expect(page).toHaveURL(/\/asesor$/);
}

async function irAPago(page: Page, idCredito = CREDITO_MORA) {
    await page.goto(`/asesor/pagos?credito=${idCredito}`);
    await expect(page.getByLabel("Monto a pagar")).toBeVisible();
}

async function pedirVistaPrevia(page: Page) {
    await page.getByRole("button", { name: "Revisar el pago" }).click();
    await expect(page.getByRole("region", { name: "Pago propuesto: requiere aprobación" })).toBeVisible();
}

const tarjetaVistaPrevia = (page: Page) => page.getByRole("region", { name: "Pago propuesto: requiere aprobación" });
const botonConfirmar = (page: Page) => page.getByRole("button", { name: "Confirmar y registrar el pago" });

async function guardado(page: Page): Promise<Record<string, unknown> | null> {
    const texto = await page.evaluate(k => sessionStorage.getItem(k), CLAVE_PENDIENTE);
    return texto ? JSON.parse(texto) as Record<string, unknown> : null;
}

test.use({ viewport: { width: 390, height: 844 } });

// ======================================================================
// A. Búsqueda y selección
// ======================================================================

test.describe("Búsqueda de clientes", () => {

    test("indicador de carga, resultados mínimos y créditos con su estado desde la API", async ({ page }) => {
        const sim = await simularApi(page, { retrasoBusquedaMs: 600 });
        await entrarComoAsesor(page);
        await page.goto("/asesor/clientes");

        await page.getByRole("searchbox").fill("ana");
        await page.getByRole("button", { name: "Buscar" }).click();
        await expect(page.getByText("Buscando clientes…")).toBeVisible();

        const resultados = page.getByRole("region", { name: "Resultados de la búsqueda" });
        await expect(resultados.getByText("Ana Lucía Prueba Uno")).toBeVisible();
        await expect(resultados.getByText(/DPI •••• 0060/)).toBeVisible();
        // El DPI completo nunca aparece.
        await expect(page.getByText(/DPI-PRUEBA/)).toHaveCount(0);

        // El estado y el saldo vienen de GET /api/creditos/:id, no de la búsqueda.
        await expect(resultados.getByText("En mora")).toBeVisible();
        await expect(resultados.getByText("Q 2,000.00")).toBeVisible();

        const busqueda = sim.pedidas.find(p => p.ruta === "/api/clientes")!;
        expect(busqueda.consulta.get("buscar")).toBe("ana");
        expect(busqueda.perfil).toBe("asesor");

        await resultados.getByRole("link", { name: "Ver detalle" }).click();
        await expect(page).toHaveURL(new RegExp(`/asesor/creditos/${CREDITO_MORA}$`));
    });

    test("busca por identificador de crédito", async ({ page }) => {
        await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto("/asesor/clientes");
        await page.getByRole("searchbox").fill(CREDITO_INCOBRABLE);
        await page.getByRole("button", { name: "Buscar" }).click();
        await expect(page.getByText("Bruno Prueba Dos")).toBeVisible();
    });

    test("sin coincidencias muestra el estado vacío", async ({ page }) => {
        await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto("/asesor/clientes");
        await page.getByRole("searchbox").fill("zzzz");
        await page.getByRole("button", { name: "Buscar" }).click();
        await expect(page.getByRole("heading", { name: "Sin coincidencias" })).toBeVisible();
    });

    test("un error de la API se muestra con su código y permite reintentar", async ({ page }) => {
        const sim = await simularApi(page, { busquedaFalla: true });
        await entrarComoAsesor(page);
        await page.goto("/asesor/clientes");
        await page.getByRole("searchbox").fill("ana");
        await page.getByRole("button", { name: "Buscar" }).click();
        await expect(page.getByText("SIN_API")).toBeVisible();

        sim.opciones.busquedaFalla = false;
        await page.getByRole("button", { name: "Reintentar" }).click();
        await expect(page.getByText("Ana Lucía Prueba Uno")).toBeVisible();
    });

    test("con menos de 2 caracteres no consulta la API", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto("/asesor/clientes");
        await page.getByRole("searchbox").fill("a");
        await page.getByRole("button", { name: "Buscar" }).click();
        await expect(page.getByText("Escriba al menos 2 caracteres.")).toBeVisible();
        expect(sim.pedidas.filter(p => p.ruta === "/api/clientes")).toHaveLength(0);
    });

    test("desde «Pagos» la búsqueda lleva directo al cobro del crédito", async ({ page }) => {
        await simularApi(page);
        await entrarComoAsesor(page);
        await page.getByRole("navigation", { name: "Menú principal" }).getByRole("link", { name: "Pagos" }).click();
        await page.getByRole("searchbox").fill("CL-0060");
        await page.getByRole("button", { name: "Buscar" }).click();
        await page.getByRole("link", { name: "Cobrar este crédito" }).click();
        await expect(page).toHaveURL(new RegExp(`/asesor/pagos\\?credito=${CREDITO_MORA}$`));
        await expect(page.getByLabel("Monto a pagar")).toHaveValue("1234.56");
    });
});

// ======================================================================
// B. Detalle del crédito y de la mora
// ======================================================================

test.describe("Detalle del crédito y de la mora", () => {

    test("muestra las cifras de la API y «Estado de cuotas» en lugar de un historial", async ({ page }) => {
        await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto(`/asesor/creditos/${CREDITO_MORA}`);

        await expect(page.getByRole("heading", { name: "Detalle del crédito" })).toBeVisible();
        await expect(page.getByText("Ana Lucía Prueba Uno · CL-0060")).toBeVisible();
        await expect(page.getByText("Q 2,000.00")).toBeVisible();
        await expect(page.getByText("Q 1,234.56")).toBeVisible();
        await expect(page.getByRole("heading", { name: "Estado de cuotas" })).toBeVisible();
        await expect(page.getByText("Últimos pagos")).toHaveCount(0);
        await expect(page.getByText("Mora 2 · lleva más de un mes de atraso")).toBeVisible();
    });

    test("navega detalle → mora → pago, con el desglose por tramo y la nota de redondeo", async ({ page }) => {
        await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto(`/asesor/creditos/${CREDITO_MORA}`);

        await page.getByRole("link", { name: "Detalle de la mora" }).click();
        await expect(page).toHaveURL(new RegExp(`/asesor/creditos/${CREDITO_MORA}/mora$`));

        const tabla = page.getByRole("table", { name: "Desglose de la mora por tramo" });
        await expect(tabla.getByRole("row")).toHaveCount(4); // encabezado + 2 tramos + total
        await expect(page.getByText(/Las líneas redondeadas suman Q 12.01/)).toBeVisible();

        await page.getByRole("button", { name: "Cuota 3" }).click();
        await expect(page).toHaveURL(/\/mora\?cuota=3$/);
        await expect(page.getByText(/Las líneas redondeadas suman/)).toHaveCount(0);

        await page.getByRole("link", { name: "Registrar pago" }).click();
        await expect(page).toHaveURL(new RegExp(`/asesor/pagos\\?credito=${CREDITO_MORA}$`));
    });

    test("cambiar la fecha de corte vuelve a consultar con la nueva fecha", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto(`/asesor/creditos/${CREDITO_MORA}`);
        await expect(page.getByText("Q 1,234.56")).toBeVisible();

        await page.getByLabel("Fecha de corte").fill("2026-11-15");
        await expect(page.getByText("Q 1,300.00")).toBeVisible();

        const deudas = sim.pedidas.filter(p => p.ruta.endsWith("/deuda"));
        expect(deudas.at(-1)!.consulta.get("fechaCorte")).toBe("2026-11-15");
    });

    test("un crédito sin cuotas vencidas no ofrece detalle de mora", async ({ page }) => {
        await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto(`/asesor/creditos/${CREDITO_AL_DIA}`);
        await expect(page.getByText("Sin cuotas vencidas", { exact: true })).toBeVisible();
        await expect(page.getByRole("link", { name: "Detalle de la mora" })).toHaveCount(0);
    });
});

// ======================================================================
// C. Registro de pago
// ======================================================================

test.describe("Registro de pago", () => {

    test("entrar y cambiar la fecha NO envía ningún pago", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await irAPago(page);
        await expect(page.getByLabel("Monto a pagar")).toHaveValue("1234.56");
        await page.getByLabel("Fecha de corte").fill("2026-11-15");
        await expect(page.getByLabel("Monto a pagar")).toHaveValue("1300.00");
        await page.reload();
        await expect(page.getByLabel("Monto a pagar")).toBeVisible();
        expect(sim.pagos()).toHaveLength(0);
    });

    test("la vista previa muestra el desglose del servidor y no registra nada", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await irAPago(page);
        await pedirVistaPrevia(page);

        const tarjeta = tarjetaVistaPrevia(page);
        await expect(tarjeta.getByText("Desglose de la prelación")).toBeVisible();
        await expect(tarjeta.getByText("Q 9.56")).toBeVisible();
        await expect(tarjeta.getByText("Q 1,234.56")).toBeVisible();

        expect(sim.vistasPrevias()).toHaveLength(1);
        expect(sim.vistasPrevias()[0]!.cuerpo!.confirmado).toBe(false);
        expect(sim.confirmaciones()).toHaveLength(0);
        expect(sim.aplicadas).toHaveLength(0);
    });

    test("confirmar envía EXACTAMENTE los datos y la clave de la vista previa", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await irAPago(page);
        await pedirVistaPrevia(page);
        await botonConfirmar(page).click();

        await expect(page.getByText("Pago aplicado")).toBeVisible();
        const previa = sim.vistasPrevias()[0]!.cuerpo!;
        const confirmacion = sim.confirmaciones()[0]!.cuerpo!;
        expect(confirmacion).toEqual({ ...previa, confirmado: true });
        expect(String(confirmacion.claveIdempotencia)).toMatch(/^WEB-[0-9a-f-]{36}$/);
        expect(sim.confirmaciones()[0]!.perfil).toBe("asesor");

        await expect(page.getByRole("table", { name: "Estado del crédito antes y después" })).toBeVisible();
        expect(await guardado(page)).toBeNull();

        // La tarjeta del crédito se vuelve a consultar: ya no dice «En mora».
        await expect(page.getByText("Q 1,000.00").first()).toBeVisible();
        await expect(page.getByText("0 días · Al día")).toBeVisible();
    });

    test("reintentar con la misma clave no cobra dos veces (OP-4)", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await irAPago(page);
        await pedirVistaPrevia(page);
        await botonConfirmar(page).click();
        await expect(page.getByText("Pago aplicado")).toBeVisible();

        await page.getByRole("button", { name: "Reintentar con la misma clave" }).click();
        await expect(page.getByText("Pago ya registrado: no se volvió a cobrar")).toBeVisible();

        const confirmaciones = sim.confirmaciones();
        expect(confirmaciones).toHaveLength(2);
        expect(confirmaciones[1]!.cuerpo).toEqual(confirmaciones[0]!.cuerpo);
        expect(sim.aplicadas).toHaveLength(1);
    });

    test("un nuevo cobro después de uno aplicado usa una clave NUEVA", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await irAPago(page);
        await pedirVistaPrevia(page);
        await botonConfirmar(page).click();
        await expect(page.getByText("Pago aplicado")).toBeVisible();

        await page.getByRole("button", { name: "Nuevo cobro" }).click();
        // El crédito ya no debe nada: no se ofrece cobrar con la clave cerrada.
        await expect(page.getByText("Sin cuotas vencidas", { exact: true })).toBeVisible();
        expect(sim.confirmaciones()).toHaveLength(1);
    });

    test("el doble clic en confirmar envía UNA sola confirmación", async ({ page }) => {
        const sim = await simularApi(page, { retrasoConfirmacionMs: 800 });
        await entrarComoAsesor(page);
        await irAPago(page);
        await pedirVistaPrevia(page);

        await botonConfirmar(page).dblclick();
        await expect(page.getByText("Pago aplicado")).toBeVisible();
        expect(sim.confirmaciones()).toHaveLength(1);
        expect(sim.aplicadas).toHaveLength(1);
    });

    test("cambiar el monto, el canal o la fecha invalida la vista previa", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await irAPago(page);

        // Monto
        await pedirVistaPrevia(page);
        await page.getByLabel("Monto a pagar").fill("1234.50");
        await expect(tarjetaVistaPrevia(page)).toHaveCount(0);
        await expect(botonConfirmar(page)).toHaveCount(0);
        // Volver a escribir el mismo monto NO resucita la vista previa vieja.
        await page.getByLabel("Monto a pagar").fill("1234.56");
        await expect(tarjetaVistaPrevia(page)).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Revisar el pago" })).toBeVisible();

        // Canal: otra operación, con otra clave
        await pedirVistaPrevia(page);
        const clave1 = sim.vistasPrevias().at(-1)!.cuerpo!.claveIdempotencia;
        await page.getByLabel("Medio de pago").selectOption("agencia");
        await expect(tarjetaVistaPrevia(page)).toHaveCount(0);
        await pedirVistaPrevia(page);
        const clave2 = sim.vistasPrevias().at(-1)!.cuerpo!.claveIdempotencia;
        expect(clave2).not.toBe(clave1);

        // Fecha de corte (= fecha de operación)
        await page.getByLabel("Fecha de corte").fill("2026-11-15");
        await expect(tarjetaVistaPrevia(page)).toHaveCount(0);

        expect(sim.confirmaciones()).toHaveLength(0);
    });

    test("cancelar y volver a revisar con los mismos datos conserva la clave", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await irAPago(page);
        await pedirVistaPrevia(page);
        await page.getByRole("button", { name: "Cancelar" }).click();
        await expect(tarjetaVistaPrevia(page)).toHaveCount(0);
        await pedirVistaPrevia(page);

        const [a, b] = sim.vistasPrevias();
        expect(b!.cuerpo!.claveIdempotencia).toBe(a!.cuerpo!.claveIdempotencia);
    });

    test("monto no exacto: el servidor dice el correcto y se puede usar (OP-5)", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await irAPago(page);
        await page.getByLabel("Monto a pagar").fill("500");
        await page.getByRole("button", { name: "Revisar el pago" }).click();

        await expect(page.getByText("Monto no exacto")).toBeVisible();
        await expect(botonConfirmar(page)).toHaveCount(0);
        await page.getByRole("button", { name: /Usar el monto correcto \(Q 1,234.56\)/ }).click();
        await expect(page.getByLabel("Monto a pagar")).toHaveValue("1234.56");

        await pedirVistaPrevia(page);
        expect(sim.confirmaciones()).toHaveLength(0);
    });

    test("crédito incobrable: rechazo del servidor y sin botón para confirmar (OP-6)", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await irAPago(page, CREDITO_INCOBRABLE);
        await page.getByRole("button", { name: "Revisar el pago" }).click();

        await expect(page.getByText("Crédito incobrable: no se recibe el pago")).toBeVisible();
        await expect(botonConfirmar(page)).toHaveCount(0);
        expect(sim.confirmaciones()).toHaveLength(0);
    });
});

// ======================================================================
// D. Resultado incierto
// ======================================================================

test.describe("Resultado incierto de una confirmación", () => {

    async function confirmarYPerderRespuesta(page: Page): Promise<Simulacion> {
        const sim = await simularApi(page, { perderRespuestas: 1 });
        await entrarComoAsesor(page);
        await irAPago(page);
        await pedirVistaPrevia(page);
        await botonConfirmar(page).click();
        await expect(page.getByText("No sabemos si el pago se aplicó")).toBeVisible();
        return sim;
    }

    test("no asume que falló: bloquea otro cobro y guarda solo lo indispensable", async ({ page }) => {
        const sim = await confirmarYPerderRespuesta(page);

        // El formulario desaparece: no se puede armar otra operación.
        await expect(page.getByRole("button", { name: "Revisar el pago" })).toHaveCount(0);
        await expect(page.getByLabel("Monto a pagar")).toHaveCount(0);

        const g = await guardado(page);
        expect(Object.keys(g!).sort()).toEqual(["canal", "clave", "estado", "fechaOperacion", "idCredito", "monto"]);
        expect(g!.estado).toBe("incierta");
        expect(g!.clave).toBe(sim.confirmaciones()[0]!.cuerpo!.claveIdempotencia);
        expect(JSON.stringify(g)).not.toMatch(/Prueba|DPI/);
        expect(sim.aplicadas).toHaveLength(1);
    });

    test("tras recargar sigue pendiente, no reenvía solo y el reintento usa la misma clave y datos", async ({ page }) => {
        const sim = await confirmarYPerderRespuesta(page);
        const primera = sim.confirmaciones()[0]!.cuerpo!;

        await page.reload();
        await expect(page.getByText("No sabemos si el pago se aplicó")).toBeVisible();
        await expect(page.getByText(String(primera.claveIdempotencia))).toBeVisible();
        expect(sim.confirmaciones()).toHaveLength(1);

        // Aunque cambie la fecha del encabezado, la operación conserva la suya.
        await page.getByLabel("Fecha de corte").fill("2026-11-15");

        await page.getByRole("button", { name: "Reintentar con la misma clave" }).click();
        await expect(page.getByText("Pago ya registrado: no se volvió a cobrar")).toBeVisible();

        const confirmaciones = sim.confirmaciones();
        expect(confirmaciones).toHaveLength(2);
        expect(confirmaciones[1]!.cuerpo).toEqual(primera);
        expect(sim.aplicadas).toHaveLength(1);
        expect(await guardado(page)).toBeNull();
    });

    test("mientras hay un pago incierto, no se puede cobrar otro crédito", async ({ page }) => {
        const sim = await confirmarYPerderRespuesta(page);
        await page.goto(`/asesor/pagos?credito=${CREDITO_AL_DIA}`);
        await expect(page.getByText("Hay un pago con resultado incierto")).toBeVisible();
        await expect(page.getByLabel("Monto a pagar")).toHaveCount(0);

        await page.getByRole("link", { name: "Resolver el pago pendiente" }).click();
        await expect(page).toHaveURL(new RegExp(`credito=${CREDITO_MORA}`));
        await expect(page.getByText("No sabemos si el pago se aplicó")).toBeVisible();
        expect(sim.confirmaciones()).toHaveLength(1);
    });

    test("descartar la operación pendiente pide confirmación y borra lo guardado", async ({ page }) => {
        await confirmarYPerderRespuesta(page);
        await page.getByRole("button", { name: "Descartar operación pendiente" }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.getByRole("button", { name: "Descartar", exact: true }).click();
        expect(await guardado(page)).toBeNull();
        await expect(page.getByText("No sabemos si el pago se aplicó")).toHaveCount(0);
    });
});

// ======================================================================
// E. Perfiles, privacidad y teléfono
// ======================================================================

test.describe("Perfiles, privacidad y ancho de teléfono", () => {

    test("la gerencia no llega al registro de pago ni a la búsqueda de clientes", async ({ page }) => {
        const sim = await simularApi(page);
        await page.goto("/perfil");
        await page.getByRole("button", { name: /Gerencia/ }).click();

        await page.goto(`/asesor/pagos?credito=${CREDITO_MORA}`);
        await expect(page).toHaveURL(/\/gerencia$/);
        await page.goto("/asesor/clientes");
        await expect(page).toHaveURL(/\/gerencia$/);

        expect(sim.pagos()).toHaveLength(0);
        expect(sim.pedidas.filter(p => p.ruta === "/api/clientes")).toHaveLength(0);
    });

    test("no deja nombres ni DPI en el almacenamiento ni en la consola", async ({ page }) => {
        const consola: string[] = [];
        page.on("console", m => consola.push(m.text()));
        await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto("/asesor/clientes");
        await page.getByRole("searchbox").fill("ana");
        await page.getByRole("button", { name: "Buscar" }).click();
        await expect(page.getByText("Ana Lucía Prueba Uno")).toBeVisible();
        await irAPago(page);
        await pedirVistaPrevia(page);

        const almacenado = await page.evaluate(() => JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage }));
        expect(almacenado).not.toMatch(/Prueba|DPI|0060/);
        expect(await page.evaluate(() => localStorage.length)).toBe(0);
        expect(consola.join("\n")).not.toMatch(/Prueba|DPI/);
    });

    test("cabe en 360 px: búsqueda, detalle, mora y pago con vista previa", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 780 });
        await simularApi(page);
        await entrarComoAsesor(page);

        const sinDesborde = async (donde: string) => {
            const exceso = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            expect(exceso, donde).toBeLessThanOrEqual(0);
        };

        await page.goto("/asesor/clientes");
        await page.getByRole("searchbox").fill("prueba");
        await page.getByRole("button", { name: "Buscar" }).click();
        await expect(page.getByText("Ana Lucía Prueba Uno")).toBeVisible();
        await sinDesborde("búsqueda");

        await page.goto(`/asesor/creditos/${CREDITO_MORA}`);
        await expect(page.getByRole("heading", { name: "Estado de cuotas" })).toBeVisible();
        await sinDesborde("detalle");

        await page.goto(`/asesor/creditos/${CREDITO_MORA}/mora`);
        await expect(page.getByRole("table", { name: "Desglose de la mora por tramo" })).toBeVisible();
        await sinDesborde("mora");

        await irAPago(page);
        await pedirVistaPrevia(page);
        await sinDesborde("pago");
    });
});
