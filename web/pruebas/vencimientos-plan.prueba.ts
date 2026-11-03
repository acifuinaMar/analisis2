import { expect, test, type Page } from "@playwright/test";

import { CREDITO_AL_DIA, CREDITO_MORA, simularApi } from "./apiSimulada";

/**
 * Fase 3 · Próximos vencimientos (D1) y plan de amortización, contra la
 * API SIMULADA. Las cantidades y los montos son los del servidor.
 */

test.use({ viewport: { width: 390, height: 844 } });

async function entrarComoAsesor(page: Page) {
    await page.goto("/perfil");
    await page.getByRole("button", { name: /Asesor de campo/ }).click();
    await expect(page).toHaveURL(/\/asesor$/);
}

const desborde = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("Próximos vencimientos", () => {

    test("el inicio resume los próximos 7 días con las cifras del servidor", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);

        const seccion = page.getByRole("region", { name: "Próximos 7 días" });
        await expect(seccion.getByText("Carla Prueba Tres")).toBeVisible();
        await expect(seccion.getByText(/2\s*cuotas por\s*Q 820.40/)).toBeVisible();
        await expect(seccion.getByText("En 2 días")).toBeVisible();
        // Abono parcial: lo pendiente "de" la cuota.
        await expect(seccion.getByText("de Q 520.40")).toBeVisible();
        // Una cuota que aún no vence no se cobra desde aquí.
        await expect(seccion.getByRole("button", { name: /Cobrar/ })).toHaveCount(0);
        await expect(seccion.getByRole("link", { name: /Cobrar|Registrar pago/ })).toHaveCount(0);

        const pedida = sim.pedidas.find(p => p.ruta === "/api/vencimientos")!;
        expect(pedida.consulta.get("ventanaDias")).toBe("7");
        expect(pedida.consulta.get("fechaCorte")).toBe("2026-10-31");
    });

    test("pantalla completa: ventana en la URL, 30 días pide ventanaDias=30", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await page.getByRole("link", { name: "Ver todos" }).click();
        await expect(page).toHaveURL(/\/asesor\/vencimientos\?dias=7$/);
        await expect(page.getByRole("heading", { name: "Próximos vencimientos" })).toBeVisible();
        await expect(page.getByRole("list", { name: "Cuotas por vencer" }).getByRole("listitem")).toHaveCount(2);

        await page.getByRole("tab", { name: "30 días" }).click();
        await expect(page).toHaveURL(/dias=30$/);
        await expect(page.getByRole("list", { name: "Cuotas por vencer" }).getByRole("listitem")).toHaveCount(3);
        await expect(page.getByText("En 28 días")).toBeVisible();
        expect(sim.pedidas.some(p => p.ruta === "/api/vencimientos" && p.consulta.get("ventanaDias") === "30")).toBe(true);
        await expect(page.getByRole("button", { name: /Cobrar/ })).toHaveCount(0);

        // "Ver crédito" lleva al detalle para preparar la visita.
        await page.getByRole("link", { name: "Ver crédito" }).first().click();
        await expect(page).toHaveURL(new RegExp(`/asesor/creditos/${CREDITO_AL_DIA}$`));
        await page.goBack();
        await expect(page).toHaveURL(/dias=30$/);
    });

    test("sin vencimientos: estado vacío en la pantalla y en el inicio", async ({ page }) => {
        await simularApi(page);
        await entrarComoAsesor(page);
        await page.getByLabel("Fecha de corte").fill("2027-06-01");
        await expect(page.getByText("Ninguna cuota vence en los próximos 7 días.")).toBeVisible();
        await page.goto("/asesor/vencimientos?dias=15");
        await expect(page.getByText("Sin vencimientos en esta ventana")).toBeVisible();
    });

    test("error de la API: aviso con reintento, sin cifras inventadas", async ({ page }) => {
        const sim = await simularApi(page, { vencimientosFalla: true });
        await entrarComoAsesor(page);
        await page.goto("/asesor/vencimientos");
        await expect(page.getByRole("alert")).toBeVisible();
        await expect(page.getByRole("list", { name: "Cuotas por vencer" })).toHaveCount(0);
        const antes = sim.pedidas.filter(p => p.ruta === "/api/vencimientos").length;
        sim.opciones.vencimientosFalla = false;
        await page.getByRole("button", { name: "Reintentar" }).click();
        await expect(page.getByRole("list", { name: "Cuotas por vencer" })).toBeVisible();
        expect(sim.pedidas.filter(p => p.ruta === "/api/vencimientos").length).toBeGreaterThan(antes);
    });

    test("cabe en 360 px", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 780 });
        await simularApi(page);
        await entrarComoAsesor(page);
        await expect(page.getByText("Carla Prueba Tres").first()).toBeVisible();
        expect(await desborde(page), "inicio").toBeLessThanOrEqual(0);
        await page.goto("/asesor/vencimientos?dias=30");
        await expect(page.getByText("En 28 días")).toBeVisible();
        expect(await desborde(page), "vencimientos").toBeLessThanOrEqual(0);
    });
});

test.describe("Plan de amortización", () => {

    test("desde el detalle: encabezado y estado de cada cuota según el servidor", async ({ page }) => {
        const sim = await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto(`/asesor/creditos/${CREDITO_MORA}`);
        await page.getByRole("link", { name: "Plan de amortización" }).click();
        await expect(page).toHaveURL(new RegExp(`/asesor/creditos/${CREDITO_MORA}/plan$`));
        await expect(page.getByRole("heading", { name: "Plan de amortización" })).toBeVisible();
        await expect(page.getByText("Q 3,000.00")).toBeVisible();
        await expect(page.getByText("6 meses")).toBeVisible();
        await expect(page.getByText("36% nominal")).toBeVisible();

        const tabla = page.getByRole("table", { name: "Cuotas del plan de amortización" });
        const filas = tabla.getByRole("row");
        await expect(filas).toHaveCount(5); // encabezado + 4 cuotas
        await expect(filas.nth(1).getByText("Pagada")).toBeVisible();
        await expect(filas.nth(2).getByText("Vencida")).toBeVisible();
        await expect(filas.nth(2).getByText("45 d")).toBeVisible();
        await expect(filas.nth(4).getByText("Pendiente")).toBeVisible();

        const pedida = sim.pedidas.find(p => p.ruta === `/api/creditos/${CREDITO_MORA}/plan`)!;
        expect(pedida.consulta.get("fechaCorte")).toBe("2026-10-31");
    });

    test("cuota con abono parcial", async ({ page }) => {
        await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto(`/asesor/creditos/${CREDITO_AL_DIA}/plan`);
        const fila = page.getByRole("table", { name: "Cuotas del plan de amortización" }).getByRole("row").nth(4);
        await expect(fila.getByText("Parcial")).toBeVisible();
        await expect(fila.getByText("Vencida")).toHaveCount(0);
    });

    test("crédito inexistente", async ({ page }) => {
        await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto("/asesor/creditos/CV-2026-9999/plan");
        await expect(page.getByText("El crédito no existe")).toBeVisible();
    });

    test("360 px: oculta las columnas secundarias y no desborda", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 780 });
        await simularApi(page);
        await entrarComoAsesor(page);
        await page.goto(`/asesor/creditos/${CREDITO_MORA}/plan`);
        const tabla = page.getByRole("table", { name: "Cuotas del plan de amortización" });
        await expect(tabla.getByRole("columnheader", { name: "Estado" })).toBeVisible();
        await expect(tabla.getByRole("columnheader", { name: "Interés" })).toBeHidden();
        expect(await desborde(page)).toBeLessThanOrEqual(0);
    });
});
