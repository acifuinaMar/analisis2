import { expect, test, type Page } from "@playwright/test";

import { CREDITO_INCOBRABLE, CREDITO_MORA, FECHA_SIN_CARTERA, simularApi } from "./apiSimulada";

/**
 * Fase 4 · Perfil gerencia contra la API SIMULADA: tablero (G-1), cartera
 * en mora (G-4), cierres (G-2, G-3), detalle de solo lectura (G-5, G-7),
 * asistente informativo, perfiles y pantallas. Ninguna prueba escribe.
 *
 * Las cifras esperadas son las del simulador, que reproduce la forma real
 * de cada respuesta: la interfaz debe mostrarlas tal cual.
 */

test.use({ viewport: { width: 1440, height: 900 } });

async function entrarComoGerencia(page: Page) {
    await page.goto("/perfil");
    await page.getByRole("button", { name: /Gerencia/ }).click();
    await expect(page).toHaveURL(/\/gerencia$/);
}

const desborde = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Ninguna petición de escritura: la gerencia solo consulta. */
const escrituras = (sim: { pedidas: ReadonlyArray<{ metodo: string }> }) => sim.pedidas.filter(p => p.metodo !== "GET").length;

// ======================================================================
// Tablero
// ======================================================================

test.describe("Tablero gerencial (G-1)", () => {

    test("indicadores y desglose con las cifras y porcentajes del servidor", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoGerencia(page);

        const indicadores = page.getByRole("region", { name: "Indicadores de la cartera" });
        await expect(indicadores.getByText("Q 299,939.82")).toBeVisible();
        await expect(indicadores.getByText("66 créditos activos")).toBeVisible();
        await expect(indicadores.getByText("Q 48,715.17")).toBeVisible();
        await expect(indicadores.getByText(/16\.24% de la activa/)).toBeVisible();
        await expect(indicadores.getByText("Q 37,841.71")).toBeVisible();
        await expect(indicadores.getByText(/12\.62% de la activa/)).toBeVisible();
        await expect(indicadores.getByText("Dado por incobrable")).toBeVisible();

        await expect(page.getByRole("alert").filter({ hasText: "2 créditos con más de 120 días sin dar de baja" })).toBeVisible();
        await expect(page.getByText(/Saldo de capital: Q 2,333\.48/)).toBeVisible();

        const tabla = page.getByRole("table", { name: "Cartera en riesgo por categoría" });
        await expect(tabla.getByRole("row")).toHaveCount(7); // encabezado + 5 categorías + total
        const reest = tabla.getByRole("row").filter({ hasText: "Reestructurado al día" });
        await expect(reest.getByText("Q 22,249.15")).toBeVisible();
        await expect(reest.getByText("7.42%")).toBeVisible();
        await expect(reest.getByRole("link")).toHaveCount(0);
        const total = tabla.getByRole("row").filter({ hasText: "Total en riesgo" });
        await expect(total.getByText("Q 37,841.71")).toBeVisible();
        await expect(total.getByText("12.62%")).toBeVisible();

        const pedida = sim.pedidas.find(p => p.ruta === "/api/cartera")!;
        expect(pedida.consulta.get("fechaCorte")).toBe("2026-10-31");
        expect(pedida.perfil).toBe("gerencia");
        expect(escrituras(sim)).toBe(0);
    });

    test("del desglose al listado del tramo y de ahí al detalle", async ({ page }) => {
        await simularApi(page);
        await entrarComoGerencia(page);
        await page.getByRole("table", { name: "Cartera en riesgo por categoría" }).getByRole("link", { name: "Mora 2" }).click();
        await expect(page).toHaveURL(/\/gerencia\/mora\/mora_2$/);
        await expect(page.getByText("Mora 2 · lleva más de un mes de atraso").first()).toBeVisible();
        await page.getByRole("link", { name: CREDITO_MORA }).click();
        await expect(page).toHaveURL(new RegExp(`/gerencia/creditos/${CREDITO_MORA}$`));
    });

    test("cartera vacía: estado informativo, sin desglose", async ({ page }) => {
        await simularApi(page);
        await entrarComoGerencia(page);
        await page.getByLabel("Fecha de corte").fill(FECHA_SIN_CARTERA);
        await expect(page.getByText("Sin cartera activa")).toBeVisible();
        await expect(page.getByRole("table", { name: "Cartera en riesgo por categoría" })).toHaveCount(0);
        await expect(page.getByText("0 créditos activos")).toBeVisible();
    });

    test("error de la API: aviso con reintento y ninguna cifra", async ({ page }) => {
        const sim = await simularApi(page, { gerenciaFalla: ["cartera"] });
        await entrarComoGerencia(page);
        await expect(page.getByRole("alert")).toBeVisible();
        expect(await page.locator("main").innerText()).not.toMatch(/Q\s?\d/);
        sim.opciones.gerenciaFalla = [];
        await page.getByRole("button", { name: "Reintentar" }).click();
        await expect(page.getByText("Q 299,939.82")).toBeVisible();
    });

    test("estado de carga mientras responde el servidor", async ({ page }) => {
        await simularApi(page, { retrasoGerenciaMs: 800 });
        await entrarComoGerencia(page);
        await expect(page.getByText("Consultando la cartera…")).toBeVisible();
        await expect(page.getByText("Q 299,939.82")).toBeVisible();
    });
});

// ======================================================================
// Cartera en mora
// ======================================================================

test.describe("Cartera en mora (G-4)", () => {

    test("todos los tramos: cantidad y saldo del servidor; filtro por pestaña con el tramo en la URL", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoGerencia(page);
        await page.getByRole("navigation", { name: "Menú principal" }).getByRole("link", { name: "Cartera en mora" }).click();
        await expect(page).toHaveURL(/\/gerencia\/mora$/);

        const tabla = page.getByRole("table", { name: "Créditos en mora" });
        await expect(tabla.getByRole("row")).toHaveCount(3);
        await expect(page.getByText("Q 3,029.24")).toBeVisible();
        await expect(tabla.getByText("Reestructurado")).toBeVisible();
        expect(sim.pedidas.find(p => p.ruta === "/api/cartera/mora")!.consulta.has("tramo")).toBe(false);

        await page.getByRole("tab", { name: "Vencido" }).click();
        await expect(page).toHaveURL(/\/gerencia\/mora\/vencido$/);
        await expect(page.getByRole("heading", { name: "Créditos del tramo" })).toBeVisible();
        await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
        await expect(page.getByText("Q 1,029.24").first()).toBeVisible();
        expect(sim.pedidas.some(p => p.ruta === "/api/cartera/mora" && p.consulta.get("tramo") === "vencido")).toBe(true);

        await page.getByRole("tab", { name: "Todos" }).click();
        await expect(page).toHaveURL(/\/gerencia\/mora$/);
    });

    test("tramo sin créditos y tramo inválido", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoGerencia(page);
        await page.goto("/gerencia/mora/mora_1");
        await expect(page.getByText("Sin créditos en este tramo")).toBeVisible();

        const antes = sim.pedidas.length;
        await page.goto("/gerencia/mora/al_dia");
        await expect(page.getByText("Tramo no válido")).toBeVisible();
        expect(sim.pedidas.slice(antes).some(p => p.ruta === "/api/cartera/mora")).toBe(false);
    });

    test("error de la API en el listado", async ({ page }) => {
        await simularApi(page, { gerenciaFalla: ["mora"] });
        await entrarComoGerencia(page);
        await page.goto("/gerencia/mora");
        await expect(page.getByRole("alert")).toBeVisible();
        await expect(page.getByRole("table")).toHaveCount(0);
    });

    test("clic en la fila abre el detalle", async ({ page }) => {
        await simularApi(page);
        await entrarComoGerencia(page);
        await page.goto("/gerencia/mora");
        await page.getByRole("row").filter({ hasText: "Bruno Prueba Dos" }).getByText("130").click();
        await expect(page).toHaveURL(new RegExp(`/gerencia/creditos/${CREDITO_INCOBRABLE}$`));
    });
});

// ======================================================================
// Detalle de solo lectura
// ======================================================================

test.describe("Detalle del crédito para gerencia (solo consulta)", () => {

    test("detalle, mora y plan bajo /gerencia, sin registrar pagos", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoGerencia(page);
        await page.goto(`/gerencia/creditos/${CREDITO_MORA}`);
        await expect(page.getByRole("heading", { name: "Detalle del crédito" })).toBeVisible();
        await expect(page.getByText("Perfil gerencia: solo consulta.")).toBeVisible();
        await expect(page.getByRole("link", { name: "Registrar pago" })).toHaveCount(0);
        await expect(page.getByText("2 cuotas vencidas")).toBeVisible();
        const migas = page.getByRole("navigation", { name: "Ruta" });
        await expect(migas.getByRole("link", { name: "Cartera en mora" })).toBeVisible();

        await page.getByRole("link", { name: "Detalle de la mora" }).click();
        await expect(page).toHaveURL(new RegExp(`/gerencia/creditos/${CREDITO_MORA}/mora$`));
        await expect(page.getByRole("table", { name: "Desglose de la mora por tramo" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Registrar pago" })).toHaveCount(0);
        await page.getByRole("button", { name: "Cuota 3" }).click();
        await expect(page).toHaveURL(new RegExp(`/gerencia/creditos/${CREDITO_MORA}/mora\\?cuota=3$`));

        await page.getByRole("link", { name: "Volver al detalle del crédito" }).click();
        await page.getByRole("link", { name: "Plan de amortización" }).click();
        await expect(page).toHaveURL(new RegExp(`/gerencia/creditos/${CREDITO_MORA}/plan$`));
        await expect(page.getByRole("table", { name: "Cuotas del plan de amortización" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Registrar pago" })).toHaveCount(0);
        await migas.getByRole("link", { name: `Crédito ${CREDITO_MORA}` }).click();
        await expect(page).toHaveURL(new RegExp(`/gerencia/creditos/${CREDITO_MORA}$`));

        expect(escrituras(sim)).toBe(0);
        expect(sim.pedidas.every(p => p.perfil === "gerencia" || p.ruta === "/api/salud")).toBe(true);
    });

    test("el asesor conserva «Registrar pago» en el mismo detalle (sin regresión)", async ({ page }) => {
        await simularApi(page);
        await page.goto("/perfil");
        await page.getByRole("button", { name: /Asesor de campo/ }).click();
        await page.goto(`/asesor/creditos/${CREDITO_MORA}`);
        await expect(page.getByRole("link", { name: "Registrar pago" })).toBeVisible();
        await expect(page.getByText("Perfil gerencia: solo consulta.")).toHaveCount(0);
    });

    test("crédito inexistente", async ({ page }) => {
        await simularApi(page);
        await entrarComoGerencia(page);
        await page.goto("/gerencia/creditos/CV-2026-9999");
        await expect(page.getByText("El crédito no existe")).toBeVisible();
    });
});

// ======================================================================
// Cierres
// ======================================================================

test.describe("Cierres (G-2, G-3)", () => {

    test("diario con la fecha de corte; sin movimientos se informa y se muestran los ceros del servidor", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoGerencia(page);
        await page.getByRole("navigation", { name: "Menú principal" }).getByRole("link", { name: "Cierres" }).click();
        await expect(page.getByRole("tab", { name: "Cierre diario" })).toHaveAttribute("aria-selected", "true");
        await expect(page.getByText("Sin movimientos en el periodo")).toBeVisible();
        await expect(page.getByText("CIE-2026-10-31")).toBeVisible();
        expect(sim.pedidas.find(p => p.ruta === "/api/cierres/diario")!.consulta.get("fechaCorte")).toBe("2026-10-31");

        await page.getByLabel("Fecha de corte").fill("2026-10-15");
        await expect(page.getByText("CIE-2026-10-15")).toBeVisible();
        await expect(page.getByText("1 pago", { exact: true })).toBeVisible();
        await expect(page.getByText("Sin movimientos en el periodo")).toHaveCount(0);
    });

    test("mensual: abre en el mes de la fecha de corte, flujo negativo y otro mes elegido", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoGerencia(page);
        await page.goto("/gerencia/cierre");
        await page.getByRole("tab", { name: "Cierre mensual" }).click();
        await expect(page).toHaveURL(/tipo=mensual/);
        await expect(page.getByLabel("Mes del cierre")).toHaveValue("2026-10");
        await expect(page.getByText("Cierre de Octubre 2026")).toBeVisible();
        await expect(page.getByText("−Q 4,445.50")).toBeVisible();
        await expect(page.getByText("Negativo: se desembolsó más de lo que se recuperó")).toBeVisible();
        await expect(page.getByText("10 desembolsos")).toBeVisible();
        await expect(page.getByText("42 pagos")).toBeVisible();
        const desglose = page.getByText("Recuperaciones por concepto (orden de la prelación)").locator("..");
        await expect(desglose.getByText("Q 7,162.89")).toBeVisible();
        await expect(desglose.getByText("Q 36,554.50")).toBeVisible();
        expect(sim.pedidas.find(p => p.ruta === "/api/cierres/mensual")!.consulta.get("periodo")).toBe("2026-10");

        await page.getByLabel("Mes del cierre").fill("2026-09");
        await expect(page).toHaveURL(/periodo=2026-09/);
        await expect(page.getByText("Cierre de Septiembre 2026")).toBeVisible();
        await expect(page.getByText("Q 12,000.00")).toBeVisible();
        await expect(desglose.getByText("Q 500.00")).toBeVisible();
        expect(sim.pedidas.some(p => p.ruta === "/api/cierres/mensual" && p.consulta.get("periodo") === "2026-09")).toBe(true);

        // Recargar conserva el mes elegido.
        await page.reload();
        await expect(page.getByLabel("Mes del cierre")).toHaveValue("2026-09");
        expect(escrituras(sim)).toBe(0);
    });

    test("error de la API en el cierre", async ({ page }) => {
        await simularApi(page, { gerenciaFalla: ["cierres"] });
        await entrarComoGerencia(page);
        await page.goto("/gerencia/cierre?tipo=mensual");
        await expect(page.getByRole("alert")).toBeVisible();
        expect(await page.locator("main").innerText()).not.toMatch(/Q\s?\d/);
    });
});

// ======================================================================
// Asistente, perfiles y pantallas
// ======================================================================

test.describe("Asistente y perfiles", () => {

    test("el asistente informa que no está disponible: sin campo de texto ni respuestas simuladas", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoGerencia(page);
        await page.getByRole("button", { name: "Asistente" }).first().click();
        const panel = page.getByRole("complementary", { name: "Asistente gerencial" });
        await expect(panel.getByText("El asistente no está disponible en la web")).toBeVisible();
        await expect(panel.getByText("npm run chat", { exact: true })).toBeVisible();
        await expect(panel.getByRole("textbox")).toHaveCount(0);
        await expect(panel.getByRole("button", { name: /Enviar/ })).toHaveCount(0);
        await expect(panel.getByRole("button", { name: /Aprobar|Aplicar/ })).toHaveCount(0);
        expect(sim.pedidas.some(p => /chat|asistente/.test(p.ruta))).toBe(false);
    });

    test("el asesor no entra a las pantallas de gerencia ni ve el asistente", async ({ page }) => {
        const sim = await simularApi(page);
        await page.goto("/perfil");
        await page.getByRole("button", { name: /Asesor de campo/ }).click();
        for (const ruta of ["/gerencia", "/gerencia/mora/mora_2", "/gerencia/cierre", `/gerencia/creditos/${CREDITO_MORA}`]) {
            await page.goto(ruta);
            await expect(page).toHaveURL(/\/asesor$/);
        }
        await expect(page.getByRole("button", { name: "Asistente" })).toHaveCount(0);
        expect(sim.pedidas.some(p => p.ruta === "/api/cartera" || p.ruta.startsWith("/api/cierres"))).toBe(false);
    });

    test("la gerencia no entra al registro de pagos ni a la solicitud", async ({ page }) => {
        await simularApi(page);
        await entrarComoGerencia(page);
        for (const ruta of [`/asesor/pagos?credito=${CREDITO_MORA}`, "/asesor/solicitud", `/asesor/creditos/${CREDITO_MORA}`]) {
            await page.goto(ruta);
            await expect(page).toHaveURL(/\/gerencia$/);
        }
    });

    test("cambiar de perfil no deja datos de gerencia en la sesión del asesor", async ({ page }) => {
        await simularApi(page);
        await entrarComoGerencia(page);
        await expect(page.getByText("Q 299,939.82")).toBeVisible();
        await page.getByRole("button", { name: "Cambiar perfil" }).click();
        await page.getByRole("button", { name: /Asesor de campo/ }).click();
        await expect(page).toHaveURL(/\/asesor$/);
        await expect(page.getByText("Q 299,939.82")).toHaveCount(0);
        const almacen = await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }));
        expect(almacen).not.toContain("299939");
        expect(almacen).not.toContain("Bruno");
    });
});

test.describe("Gerencia en teléfono y tableta", () => {

    for (const [nombre, ancho, alto] of [["360 px", 360, 780], ["tableta", 820, 1180]] as const) {
        test(`sin desplazamiento horizontal en ${nombre}`, async ({ page }) => {
            await page.setViewportSize({ width: ancho, height: alto });
            await simularApi(page);
            await entrarComoGerencia(page);
            await expect(page.getByText("Q 299,939.82")).toBeVisible();
            expect(await desborde(page), "tablero").toBeLessThanOrEqual(0);

            await page.goto("/gerencia/mora");
            await expect(page.getByRole("table", { name: "Créditos en mora" })).toBeVisible();
            expect(await desborde(page), "mora").toBeLessThanOrEqual(0);

            await page.goto("/gerencia/cierre?tipo=mensual");
            await expect(page.getByText("Cierre de Octubre 2026")).toBeVisible();
            expect(await desborde(page), "cierre").toBeLessThanOrEqual(0);

            await page.goto(`/gerencia/creditos/${CREDITO_MORA}`);
            await expect(page.getByRole("heading", { name: "Detalle del crédito" })).toBeVisible();
            expect(await desborde(page), "detalle").toBeLessThanOrEqual(0);
        });
    }

    test("en el teléfono el menú se abre como cajón y navega", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 780 });
        await simularApi(page);
        await entrarComoGerencia(page);
        await page.getByRole("button", { name: "Abrir menú" }).click();
        await page.getByRole("navigation", { name: "Menú principal" }).getByRole("link", { name: "Cierres" }).click();
        await expect(page).toHaveURL(/\/gerencia\/cierre$/);
        await expect(page.getByRole("button", { name: "Cerrar menú" })).toHaveCount(0);
    });
});
