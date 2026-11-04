import { expect, test, type Page } from "@playwright/test";

import { CREDITO_MORA, simularApi, type Simulacion } from "./apiSimulada";

/**
 * Fase 3 · Solicitud de crédito = originación (OP-3), contra la API
 * SIMULADA. Cubre las reglas de operación incierta acordadas:
 *
 *   1. bloqueo de envíos duplicados mientras hay una operación pendiente;
 *   2. sin reintentos automáticos de escrituras inciertas;
 *   3. verificación solo con lecturas;
 *   4. confirmación solo con un 201 (una coincidencia de datos no basta);
 *   5. «Resultado incierto» y bloqueo de escrituras dependientes;
 *   6. nunca se desembolsa con el alta incierta.
 *
 * Ninguna prueba toca PostgreSQL.
 */

const CLAVE = "cv.originacion.pendiente";

const NUEVO = {
    idCliente: "CL-0200",
    nombre: "Diana Prueba Cuatro",
    dpi: "DPI-PRUEBA-000200",
    telefono: "5555-0200",
    municipio: "Chimaltenango"
};

const CREDITO = { idCredito: "CV-2026-0200", capital: "10000", plazo: "12", tna: "36", asesor: "AS-01" };

test.use({ viewport: { width: 390, height: 844 } });

async function entrarComoAsesor(page: Page) {
    await page.goto("/perfil");
    await page.getByRole("button", { name: /Asesor de campo/ }).click();
    await expect(page).toHaveURL(/\/asesor$/);
}

async function llenarClienteNuevo(page: Page, c = NUEVO) {
    await page.getByLabel("Identificador del cliente").fill(c.idCliente);
    await page.getByLabel("Nombre completo").fill(c.nombre);
    await page.getByLabel("DPI", { exact: true }).fill(c.dpi);
    await page.getByLabel("Teléfono").fill(c.telefono);
    await page.getByLabel("Municipio").fill(c.municipio);
    await page.getByRole("button", { name: "Siguiente" }).click();
}

async function elegirClienteExistente(page: Page, buscar: string) {
    await page.getByRole("tab", { name: "Cliente existente" }).click();
    await page.getByRole("searchbox").fill(buscar);
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("button", { name: "Elegir este cliente" }).first().click();
    await page.getByRole("button", { name: "Siguiente" }).click();
}

async function llenarCredito(page: Page, k = CREDITO) {
    await expect(page.getByRole("heading", { name: "Datos del crédito" })).toBeVisible();
    await page.getByLabel("Identificador del crédito").fill(k.idCredito);
    await page.getByLabel("Monto solicitado").fill(k.capital);
    await page.getByLabel("Plazo (meses)").fill(k.plazo);
    await page.getByLabel("Tasa nominal anual (%)").fill(k.tna);
    await page.getByLabel("Asesor").selectOption(k.asesor);
    await page.getByRole("button", { name: "Revisar la solicitud" }).click();
}

const tablaSimulada = (page: Page) => page.getByRole("table", { name: "Plan de amortización simulado" });
const botonAltaYDesembolso = (page: Page) => page.getByRole("button", { name: "Confirmar: dar de alta y desembolsar" });
const botonDesembolso = (page: Page) => page.getByRole("button", { name: "Confirmar el desembolso" });
const incierto = (page: Page) => page.getByRole("alert").filter({ hasText: "Resultado incierto" });

async function hastaRevision(page: Page, sim: Simulacion) {
    await entrarComoAsesor(page);
    await page.goto("/asesor/solicitud");
    await llenarClienteNuevo(page);
    await llenarCredito(page);
    await expect(tablaSimulada(page)).toBeVisible();
    expect(sim.altas()).toHaveLength(0);
    expect(sim.desembolsos()).toHaveLength(0);
}

async function guardado(page: Page): Promise<string | null> {
    return page.evaluate(k => sessionStorage.getItem(k), CLAVE);
}

/** Escrituras (POST) hechas desde un punto: la verificación no debe agregar ninguna. */
const posts = (sim: Simulacion) => sim.pedidas.filter(p => p.metodo === "POST").length;

// ======================================================================
// Camino feliz
// ======================================================================

test.describe("Solicitud de crédito · camino feliz", () => {

    test("cliente nuevo: nada se escribe antes de confirmar; luego alta y desembolso, en ese orden", async ({ page }) => {
        const sim = await simularApi(page);
        await hastaRevision(page, sim);

        // La simulación (solo lectura) recibió la TNA como decimal (D3) y la fecha de corte.
        const s = sim.simulaciones().at(-1)!;
        expect(s.cuerpo).toEqual({ capital: 10000, plazoMeses: 12, tnaAnual: 0.36, fechaDesembolso: "2026-10-31" });
        await expect(page.getByText("36 %", { exact: true })).toBeVisible();
        await expect(page.getByText("Todavía no se ha guardado nada.")).toBeVisible();

        await botonAltaYDesembolso(page).click();
        await expect(page.getByRole("status").filter({ hasText: "Crédito desembolsado" })).toBeVisible();

        expect(sim.altas()).toHaveLength(1);
        expect(sim.altas()[0]!.cuerpo).toEqual({
            idCliente: "CL-0200", nombreCompleto: NUEVO.nombre, dpi: NUEVO.dpi,
            telefono: NUEVO.telefono, municipio: NUEVO.municipio, fechaOperacion: "2026-10-31"
        });
        expect(sim.desembolsos()).toHaveLength(1);
        expect(sim.desembolsos()[0]!.cuerpo).toEqual({
            idCredito: "CV-2026-0200", idCliente: "CL-0200", idAsesor: "AS-01",
            capital: 10000, plazoMeses: 12, tnaAnual: 0.36, fechaDesembolso: "2026-10-31"
        });
        const iAlta = sim.pedidas.indexOf(sim.altas()[0]!);
        const iDesembolso = sim.pedidas.indexOf(sim.desembolsos()[0]!);
        expect(iAlta).toBeLessThan(iDesembolso);

        // Cifras del servidor, sin recalcular.
        const resultado = page.getByRole("region", { name: "Resultado de la solicitud" });
        await expect(resultado.getByText("Q 1,004.62").first()).toBeVisible();
        await expect(resultado.getByText("Q 12,055.45")).toBeVisible();
        expect(await guardado(page)).toBeNull();

        // El crédito creado se puede abrir con sus términos.
        await resultado.getByRole("link", { name: "Ver el plan con su estado" }).click();
        await expect(page).toHaveURL(/\/asesor\/creditos\/CV-2026-0200\/plan$/);
        await expect(page.getByText("Q 10,000.00").first()).toBeVisible();
        await expect(page.getByText("12 meses")).toBeVisible();
    });

    test("cliente existente: solo el desembolso, con el cliente elegido", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto("/asesor/solicitud");
        await elegirClienteExistente(page, "Carla");
        await llenarCredito(page, { ...CREDITO, asesor: "AS-02" });
        await expect(tablaSimulada(page)).toBeVisible();
        await expect(botonAltaYDesembolso(page)).toHaveCount(0);

        await botonDesembolso(page).click();
        await expect(page.getByText("Se desembolsó el crédito.")).toBeVisible();
        expect(sim.altas()).toHaveLength(0);
        expect(sim.desembolsos()).toHaveLength(1);
        expect(sim.desembolsos()[0]!.cuerpo).toMatchObject({ idCliente: "CL-0099", idAsesor: "AS-02" });
    });

    test("cambiar los datos invalida la simulación: se confirma con el plan nuevo", async ({ page }) => {
        const sim = await simularApi(page);
        await hastaRevision(page, sim);

        await page.getByRole("button", { name: "Corregir datos" }).click();
        await page.getByLabel("Monto solicitado").fill("12000");
        await page.getByLabel("Tasa nominal anual (%)").fill("30.5");
        await page.getByRole("button", { name: "Revisar la solicitud" }).click();
        await expect(tablaSimulada(page)).toBeVisible();
        expect(sim.simulaciones().at(-1)!.cuerpo).toMatchObject({ capital: 12000, tnaAnual: 0.305 });

        await botonAltaYDesembolso(page).click();
        await expect(page.getByText("Crédito desembolsado")).toBeVisible();
        expect(sim.desembolsos()[0]!.cuerpo).toMatchObject({ capital: 12000, tnaAnual: 0.305 });
    });

    test("validación de formato antes de simular; los límites los da el servidor", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto("/asesor/solicitud");
        await page.getByRole("button", { name: "Siguiente" }).click();
        await expect(page.getByText("Use la forma CL-NNNN.")).toBeVisible();

        await llenarClienteNuevo(page);
        await llenarCredito(page, { ...CREDITO, idCredito: "CV-26", tna: "treinta" });
        await expect(page.getByText("Use la forma CV-AAAA-NNNN.")).toBeVisible();
        await expect(page.getByText("Escriba la tasa en porcentaje, por ejemplo 36.")).toBeVisible();
        expect(sim.simulaciones()).toHaveLength(0);

        await page.getByLabel("Identificador del crédito").fill(CREDITO.idCredito);
        await page.getByLabel("Tasa nominal anual (%)").fill("36");
        await page.getByLabel("Monto solicitado").fill("30000");
        await page.getByRole("button", { name: "Revisar la solicitud" }).click();
        await expect(page.getByRole("alert").filter({ hasText: "Monto fuera de lo que permite el producto" })).toBeVisible();
        await expect(page.getByText("Rango permitido: Q 1,000.00 a Q 25,000.00.")).toBeVisible();
        await expect(botonAltaYDesembolso(page)).toBeDisabled();

        await page.getByRole("button", { name: "Corregir datos" }).click();
        await page.getByLabel("Monto solicitado").fill("10000");
        await page.getByLabel("Plazo (meses)").fill("36");
        await page.getByRole("button", { name: "Revisar la solicitud" }).click();
        await expect(page.getByText("Plazo permitido: 3 a 24 meses.")).toBeVisible();
        await expect(botonAltaYDesembolso(page)).toBeDisabled();
        expect(sim.altas()).toHaveLength(0);
        expect(sim.desembolsos()).toHaveLength(0);
    });
});

// ======================================================================
// Duplicados en el primer envío: rechazos, no confirmaciones
// ======================================================================

test.describe("Solicitud de crédito · duplicados", () => {

    test("CLIENTE_DUPLICADO en el primer envío es un rechazo: no se desembolsa", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto("/asesor/solicitud");
        // CL-0060 existe (Ana Lucía), aunque el nombre que se escribe sea otro.
        await llenarClienteNuevo(page, { ...NUEVO, idCliente: "CL-0060" });
        await llenarCredito(page);
        await botonAltaYDesembolso(page).click();

        await expect(page.getByRole("alert").filter({ hasText: "Ya existe un cliente con ese identificador" })).toBeVisible();
        await expect(page.getByLabel("Identificador del cliente")).toBeVisible();
        await expect(page.getByText("Crédito desembolsado")).toHaveCount(0);
        await expect(incierto(page)).toHaveCount(0);
        expect(sim.altas()).toHaveLength(1);
        expect(sim.desembolsos()).toHaveLength(0);
        expect(await guardado(page)).toBeNull();
    });

    test("DPI_DUPLICADO también se rechaza y no se desembolsa", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto("/asesor/solicitud");
        await llenarClienteNuevo(page, { ...NUEVO, dpi: "DPI-PRUEBA-000099" });
        await llenarCredito(page);
        await botonAltaYDesembolso(page).click();
        await expect(page.getByRole("alert").filter({ hasText: "Ya existe un cliente con ese DPI" })).toBeVisible();
        expect(sim.desembolsos()).toHaveLength(0);
    });

    test("CREDITO_DUPLICADO en el primer envío es un rechazo y no se da por desembolsado", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto("/asesor/solicitud");
        await elegirClienteExistente(page, "Ana");
        // El identificador ya existe y ES del mismo titular: igual no es una confirmación.
        await llenarCredito(page, { ...CREDITO, idCredito: CREDITO_MORA });
        await botonDesembolso(page).click();
        await expect(page.getByRole("alert").filter({ hasText: "Ya existe un crédito con ese identificador" })).toBeVisible();
        await expect(page.getByText("Crédito desembolsado")).toHaveCount(0);
        expect(sim.desembolsos()).toHaveLength(1);
        expect(await guardado(page)).toBeNull();
    });
});

// ======================================================================
// Respuestas perdidas
// ======================================================================

test.describe("Solicitud de crédito · resultado incierto", () => {

    test("alta perdida (sí se aplicó): incierto, sin desembolso ni reintento; verificar no la confirma", async ({ page }) => {
        const sim = await simularApi(page, { perderAlta: "aplicando" });
        await hastaRevision(page, sim);
        await botonAltaYDesembolso(page).click();

        await expect(incierto(page)).toBeVisible();
        await expect(page.getByText("El desembolso no se enviará")).toBeVisible();
        await expect(page.getByLabel("Identificador del cliente")).toHaveCount(0);
        await expect(botonAltaYDesembolso(page)).toHaveCount(0);

        // Sin reintento automático.
        await page.waitForTimeout(800);
        expect(sim.altas()).toHaveLength(1);
        expect(sim.desembolsos()).toHaveLength(0);

        // Almacenamiento mínimo: sin nombre, DPI, teléfono ni municipio.
        const texto = (await guardado(page))!;
        const g = JSON.parse(texto) as Record<string, unknown>;
        expect(g).toMatchObject({ paso: "alta", estado: "incierta", idCliente: "CL-0200", idCredito: "CV-2026-0200" });
        for (const dato of [NUEVO.nombre, NUEVO.dpi, NUEVO.telefono, NUEVO.municipio, "nombre", "dpi", "telefono", "municipio"]) {
            expect(texto).not.toContain(dato);
        }

        // Verificar: solo lecturas. Coinciden los datos visibles, pero sigue incierto.
        const antes = posts(sim);
        await page.getByRole("button", { name: "Verificar el estado" }).click();
        await expect(page.getByText("Existe un cliente CL-0200")).toBeVisible();
        await expect(page.getByText("no se puede confirmar que sea esta alta")).toBeVisible();
        await expect(incierto(page)).toBeVisible();
        await expect(page.getByRole("button", { name: /Reintentar/ })).toHaveCount(0);
        expect(posts(sim)).toBe(antes);
        expect(sim.pedidas.at(-1)).toMatchObject({ metodo: "GET", ruta: "/api/clientes" });
        expect(sim.desembolsos()).toHaveLength(0);
        expect(await guardado(page)).not.toBeNull();

        // Descartar exige confirmación y limpia el almacenamiento.
        await page.getByRole("button", { name: "Descartar esta solicitud" }).click();
        const dialogo = page.getByRole("dialog", { name: "¿Descartar esta solicitud?" });
        await expect(dialogo).toBeVisible();
        await dialogo.getByRole("button", { name: "Descartar" }).click();
        await expect(page.getByLabel("Identificador del cliente")).toBeVisible();
        expect(await guardado(page)).toBeNull();
        expect(sim.desembolsos()).toHaveLength(0);
    });

    test("alta perdida (no se aplicó): no consta → reintento manual; el desembolso exige otro clic", async ({ page }) => {
        const sim = await simularApi(page, { perderAlta: "sin_aplicar" });
        await hastaRevision(page, sim);
        await botonAltaYDesembolso(page).click();
        await expect(incierto(page)).toBeVisible();
        await expect(page.getByRole("button", { name: /Reintentar/ })).toHaveCount(0);

        await page.getByRole("button", { name: "Verificar el estado" }).click();
        await expect(page.getByText("No se encontró el cliente CL-0200")).toBeVisible();
        await page.getByRole("button", { name: "Reintentar el alta (mismos datos)" }).click();

        await expect(botonDesembolso(page)).toBeVisible();
        expect(sim.altas()).toHaveLength(2);
        expect(sim.altas()[1]!.cuerpo).toEqual(sim.altas()[0]!.cuerpo);
        // El alta confirmada NO encadena el desembolso.
        await page.waitForTimeout(500);
        expect(sim.desembolsos()).toHaveLength(0);
        expect(await guardado(page)).toBeNull();

        await botonDesembolso(page).click();
        await expect(page.getByText("Crédito desembolsado")).toBeVisible();
        expect(sim.altas()).toHaveLength(2);
        expect(sim.desembolsos()).toHaveLength(1);
    });

    test("desembolso perdido (sí se aplicó): coincidencia, sigue incierto y no se reintenta", async ({ page }) => {
        const sim = await simularApi(page, { perderDesembolso: "aplicando" });
        await hastaRevision(page, sim);
        await botonAltaYDesembolso(page).click();

        await expect(incierto(page)).toBeVisible();
        await expect(page.getByText(/Se envió el desembolso del crédito\s*CV-2026-0200/)).toBeVisible();
        const g = JSON.parse((await guardado(page))!) as Record<string, unknown>;
        expect(g).toMatchObject({ paso: "desembolso", idCliente: "CL-0200", capital: 10000, plazoMeses: 12, tnaAnual: 0.36 });

        const antes = posts(sim);
        await page.getByRole("button", { name: "Verificar el estado" }).click();
        await expect(page.getByText("Existe el crédito CV-2026-0200")).toBeVisible();
        await expect(page.getByText("no se puede confirmar que lo creó este envío")).toBeVisible();
        await expect(page.getByRole("table", { name: "Comparación con lo enviado" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Ver el crédito CV-2026-0200" })).toBeVisible();
        await expect(page.getByRole("button", { name: /Reintentar/ })).toHaveCount(0);
        await expect(page.getByText("Crédito desembolsado")).toHaveCount(0);
        await expect(incierto(page)).toBeVisible();
        expect(posts(sim)).toBe(antes);
        await page.waitForTimeout(500);
        expect(sim.desembolsos()).toHaveLength(1);
    });

    test("desembolso perdido (no se aplicó): no consta → reintento manual con el mismo cuerpo", async ({ page }) => {
        const sim = await simularApi(page, { perderDesembolso: "sin_aplicar" });
        await hastaRevision(page, sim);
        await botonAltaYDesembolso(page).click();
        await expect(incierto(page)).toBeVisible();

        await page.getByRole("button", { name: "Verificar el estado" }).click();
        await expect(page.getByText("No se encontró el crédito CV-2026-0200")).toBeVisible();
        await page.getByRole("button", { name: "Reintentar el desembolso (mismos datos)" }).click();
        await expect(page.getByText("Crédito desembolsado")).toBeVisible();
        expect(sim.altas()).toHaveLength(1);
        expect(sim.desembolsos()).toHaveLength(2);
        expect(sim.desembolsos()[1]!.cuerpo).toEqual(sim.desembolsos()[0]!.cuerpo);
        expect(await guardado(page)).toBeNull();
    });

    test("conflicto: el identificador es de OTRO titular → rechazo, no confirmación", async ({ page }) => {
        const sim = await simularApi(page, { perderDesembolso: "sin_aplicar" });
        await entrarComoAsesor(page);
        await page.goto("/asesor/solicitud");
        await elegirClienteExistente(page, "Carla");
        await llenarCredito(page, { ...CREDITO, idCredito: CREDITO_MORA });
        await botonDesembolso(page).click();
        await expect(incierto(page)).toBeVisible();

        await page.getByRole("button", { name: "Verificar el estado" }).click();
        await expect(page.getByRole("heading", { name: "Datos del crédito" })).toBeVisible();
        await expect(page.getByRole("alert").filter({ hasText: "Ya existe un crédito con ese identificador" })).toBeVisible();
        const tabla = page.getByRole("table", { name: "Comparación con lo enviado" });
        await expect(tabla.getByText("✗ distinto").first()).toBeVisible();
        await expect(incierto(page)).toHaveCount(0);
        expect(sim.desembolsos()).toHaveLength(1);
        expect(await guardado(page)).toBeNull();
    });

    test("doble clic en confirmar: una sola alta y un solo desembolso", async ({ page }) => {
        const sim = await simularApi(page, { retrasoEscrituraMs: 700 });
        await hastaRevision(page, sim);

        await botonAltaYDesembolso(page).evaluate((b: HTMLButtonElement) => { b.click(); b.click(); b.click(); });
        await expect(page.getByText("Registrando el cliente…")).toBeVisible();
        await expect(page.getByText("Crédito desembolsado")).toBeVisible();
        expect(sim.altas()).toHaveLength(1);
        expect(sim.desembolsos()).toHaveLength(1);
    });

    test("recargar con el alta incierta: el bloqueo vuelve y una nueva solicitud no se puede enviar", async ({ page }) => {
        const sim = await simularApi(page, { perderAlta: "aplicando" });
        await hastaRevision(page, sim);
        await botonAltaYDesembolso(page).click();
        await expect(incierto(page)).toBeVisible();

        await page.reload();
        await expect(incierto(page)).toBeVisible();
        await expect(page.getByLabel("Identificador del cliente")).toHaveCount(0);

        // Salir y volver no lo desbloquea.
        await page.goto("/asesor");
        await page.goto("/asesor/solicitud");
        await expect(incierto(page)).toBeVisible();

        const antes = posts(sim);
        await page.getByRole("button", { name: "Verificar el estado" }).click();
        await expect(page.getByText("Tras recargar no se conservan los datos personales")).toBeVisible();
        await expect(incierto(page)).toBeVisible();
        await expect(page.getByRole("button", { name: /Reintentar/ })).toHaveCount(0);
        expect(posts(sim)).toBe(antes);
        expect(sim.desembolsos()).toHaveLength(0);
    });

    test("recargar con el desembolso incierto: se verifica con los términos guardados", async ({ page }) => {
        const sim = await simularApi(page, { perderDesembolso: "aplicando" });
        await hastaRevision(page, sim);
        await botonAltaYDesembolso(page).click();
        await expect(incierto(page)).toBeVisible();

        await page.reload();
        await expect(incierto(page)).toBeVisible();
        await page.getByRole("button", { name: "Verificar el estado" }).click();
        await expect(page.getByText("Existe el crédito CV-2026-0200")).toBeVisible();
        await expect(incierto(page)).toBeVisible();
        expect(sim.desembolsos()).toHaveLength(1);
    });
});

// ======================================================================
// Perfil y pantalla
// ======================================================================

test.describe("Solicitud de crédito · perfil y pantalla", () => {

    test("gerencia no entra a la solicitud", async ({ page }) => {
        const sim = await simularApi(page);
        await page.goto("/perfil");
        await page.getByRole("button", { name: /Gerencia/ }).click();
        await page.goto("/asesor/solicitud");
        await expect(page).toHaveURL(/\/gerencia$/);
        expect(sim.pedidas.filter(p => p.ruta === "/api/asesores")).toHaveLength(0);
    });

    test("cabe en 360 px: revisión y resultado", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 780 });
        const sim = await simularApi(page);
        await hastaRevision(page, sim);
        const desborde = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(await desborde(), "revisión").toBeLessThanOrEqual(0);
        await botonAltaYDesembolso(page).click();
        await expect(page.getByText("Crédito desembolsado")).toBeVisible();
        expect(await desborde(), "resultado").toBeLessThanOrEqual(0);
    });
});
