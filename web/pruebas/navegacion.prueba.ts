import { expect, test, type Page } from "@playwright/test";

/**
 * Pruebas de la Fase 1 en un navegador real: rutas, perfiles, layouts,
 * fecha de corte y panel del asistente.
 *
 * /api se intercepta en el navegador: no hace falta la API ni la base de
 * datos, y ninguna prueba puede escribir en PostgreSQL.
 */

async function interceptarApi(page: Page, saludOk = true): Promise<string[]> {
    const pedidas: string[] = [];
    await page.route("**/api/**", async ruta => {
        const url = new URL(ruta.request().url());

        if (url.pathname.startsWith("/src/")) {
            await ruta.continue();
            return;
        }
        pedidas.push(`${ruta.request().method()} ${url.pathname}`);
        if (url.pathname === "/api/salud" && saludOk) {
            await ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ estado: "ok" }) });
            return;
        }
        await ruta.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: true, codigo: "SIN_API", mensaje: "API simulada no disponible." })
        });
    });
    return pedidas;
}

async function entrarComo(page: Page, perfil: "Asesor de campo" | "Gerencia") {
    await page.goto("/perfil");
    await page.getByRole("button", { name: new RegExp(perfil) }).click();
}

test.beforeEach(async ({ page }) => {
    await interceptarApi(page);
});

test.describe("Selección de perfil", () => {

    test("sin perfil, la raíz lleva a elegirlo y advierte que no es autenticación", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveURL(/\/perfil$/);
        await expect(page.getByRole("heading", { name: "Elegí un perfil" })).toBeVisible();
        await expect(page.getByText("No es un inicio de sesión")).toBeVisible();
        await expect(page.getByText("API conectada.")).toBeVisible();
    });

    test("si la API no responde, lo dice con la instrucción para levantarla", async ({ page }) => {
        await page.unroute("**/api/**");
        await interceptarApi(page, false);
        await page.goto("/perfil");
        await expect(page.getByText(/La API no responde/)).toBeVisible();
    });

    test("un enlace profundo sin perfil vuelve a su destino después de elegir", async ({ page }) => {
        await page.goto("/gerencia/cierre");
        await expect(page).toHaveURL(/\/perfil\?volver=%2Fgerencia%2Fcierre$/);
        await page.getByRole("button", { name: /Gerencia/ }).click();
        await expect(page).toHaveURL(/\/gerencia\/cierre$/);
    });

    test("no se puede volver a una ruta de OTRO perfil por el parámetro volver", async ({ page }) => {
        await page.goto("/perfil?volver=%2Fgerencia%2Fcierre");
        await page.getByRole("button", { name: /Asesor de campo/ }).click();
        await expect(page).toHaveURL(/\/asesor$/);
    });
});

test.describe("Perfil asesor (teléfono)", () => {

    test.use({ viewport: { width: 390, height: 844 } });

    test("menú inferior del prototipo y estado activo", async ({ page }) => {
        await entrarComo(page, "Asesor de campo");
        await expect(page).toHaveURL(/\/asesor$/);

        const menu = page.getByRole("navigation", { name: "Menú principal" });
        for (const item of ["Inicio", "Clientes", "Pagos", "Más"]) {
            await expect(menu.getByRole("link", { name: item })).toBeVisible();
        }
        await expect(menu.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");

        await menu.getByRole("link", { name: "Clientes" }).click();
        await expect(page).toHaveURL(/\/asesor\/clientes$/);
        await expect(page.getByRole("heading", { name: "Buscar cliente", level: 1 })).toBeVisible();
        await expect(menu.getByRole("link", { name: "Clientes" })).toHaveAttribute("aria-current", "page");
        await expect(menu.getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current", "page");
    });

    test("el detalle del crédito enciende «Clientes» y su botón atrás funciona", async ({ page }) => {
        await entrarComo(page, "Asesor de campo");
        await page.goto("/asesor/creditos/CV-2026-0030");
        await expect(page.getByRole("heading", { name: "Detalle del crédito", level: 1 })).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Menú principal" }).getByRole("link", { name: "Clientes" }))
            .toHaveAttribute("aria-current", "page");

        await page.getByRole("link", { name: "Detalle de la mora" }).click();
        await expect(page).toHaveURL(/\/asesor\/creditos\/CV-2026-0030\/mora$/);

        await page.getByRole("link", { name: "Volver" }).click();
        await expect(page).toHaveURL(/\/asesor\/creditos\/CV-2026-0030$/);
    });

    test("las acciones del inicio llevan a las pantallas obligatorias", async ({ page }) => {
        await entrarComo(page, "Asesor de campo");
        await page.getByRole("link", { name: /Nueva solicitud/ }).click();
        await expect(page.getByRole("heading", { name: "Nueva solicitud de crédito" })).toBeVisible();
        await page.goto("/asesor");
        await page.getByRole("link", { name: /Registrar pago/ }).click();
        await expect(page.getByRole("heading", { name: "Registro de pago" })).toBeVisible();
    });

    test("el asesor no entra a las pantallas de gerencia (guarda de navegación)", async ({ page }) => {
        await entrarComo(page, "Asesor de campo");
        await page.goto("/gerencia");
        await expect(page).toHaveURL(/\/asesor$/);
    });

    test("cabe en 360 px sin desplazamiento horizontal", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 780 });
        await entrarComo(page, "Asesor de campo");
        for (const ruta of ["/asesor", "/asesor/pagos", "/asesor/creditos/CV-2026-0030", "/asesor/mas"]) {
            await page.goto(ruta);
            const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            expect(desborde, ruta).toBeLessThanOrEqual(0);
        }
    });
});

test.describe("Perfil gerencia (escritorio)", () => {

    test.use({ viewport: { width: 1440, height: 900 } });

    test("barra lateral con solo lo implementado y migas", async ({ page }) => {
        await entrarComo(page, "Gerencia");
        await expect(page).toHaveURL(/\/gerencia$/);

        const menu = page.getByRole("navigation", { name: "Menú principal" });
        await expect(menu.getByRole("link")).toHaveCount(3);
        await menu.getByRole("link", { name: "Cartera en mora" }).click();
        await expect(page).toHaveURL(/\/gerencia\/mora$/);

        await page.goto("/gerencia/mora/mora_3");
        await expect(page.getByRole("heading", { name: "Créditos del tramo" })).toBeVisible();
        await expect(page.getByText("Mora 3 · lleva más de dos meses de atraso")).toBeVisible();
        const migas = page.getByRole("navigation", { name: "Ruta" });
        await migas.getByRole("link", { name: "Cartera en mora" }).click();
        await expect(page).toHaveURL(/\/gerencia\/mora$/);
    });

    test("el tablero no muestra cifras inventadas mientras no hay datos", async ({ page }) => {
        await entrarComo(page, "Gerencia");
        const texto = await page.locator("main").innerText();
        expect(texto).not.toMatch(/Q\s?\d/);
    });

    test("el asistente se abre al lado sin tapar los indicadores", async ({ page }) => {
        await entrarComo(page, "Gerencia");
        await page.getByRole("button", { name: "Asistente" }).first().click();

        const panel = page.getByRole("complementary", { name: "Asistente gerencial" });
        await expect(panel).toBeVisible();

        const cajaPanel = await panel.boundingBox();
        const cajaMain = await page.locator("main").boundingBox();
        expect(cajaPanel && cajaMain).toBeTruthy();
        // Conviven: el contenido termina donde empieza el panel.
        expect(cajaMain!.x + cajaMain!.width).toBeLessThanOrEqual(cajaPanel!.x + 1);
        expect(cajaPanel!.width).toBeGreaterThanOrEqual(380);
    });

    test("el panel sobrevive a la navegación y se cierra con Escape", async ({ page }) => {
        await entrarComo(page, "Gerencia");
        await page.getByRole("button", { name: "Asistente" }).first().click();
        await page.getByRole("navigation", { name: "Menú principal" }).getByRole("link", { name: "Cierres" }).click();
        await expect(page).toHaveURL(/\/gerencia\/cierre$/);
        await expect(page.getByRole("complementary", { name: "Asistente gerencial" })).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(page.getByRole("complementary", { name: "Asistente gerencial" })).toHaveCount(0);
    });

    test("cambiar de perfil borra el perfil de la sesión", async ({ page }) => {
        await entrarComo(page, "Gerencia");
        await page.getByRole("button", { name: "Cambiar perfil" }).click();
        await expect(page).toHaveURL(/\/perfil$/);
        await page.goto("/gerencia");
        await expect(page).toHaveURL(/\/perfil\?volver=/);
    });

    test("ruta inexistente: página de no encontrada", async ({ page }) => {
        await entrarComo(page, "Gerencia");
        await page.goto("/gerencia/no-existe");
        await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
    });
});

test.describe("Panel del asistente en pantalla angosta", () => {

    test.use({ viewport: { width: 390, height: 844 } });

    test("ocupa toda la pantalla", async ({ page }) => {
        await entrarComo(page, "Gerencia");
        await page.getByRole("button", { name: "Asistente" }).first().click();
        const caja = await page.getByRole("complementary", { name: "Asistente gerencial" }).boundingBox();
        expect(caja!.width).toBeGreaterThanOrEqual(389);
        expect(caja!.x).toBeLessThanOrEqual(0.5);
        await page.getByRole("button", { name: "Cerrar asistente" }).click();
        await expect(page.getByRole("complementary", { name: "Asistente gerencial" })).toHaveCount(0);
    });
});

test.describe("Fecha de corte", () => {

    test("abre en la fecha del guion y el cambio se conserva al navegar y recargar", async ({ page }) => {
        await entrarComo(page, "Gerencia");
        const selector = page.getByLabel("Fecha de corte");
        await expect(selector).toHaveValue("2026-10-31");

        await selector.fill("2027-01-24");
        await expect(page.getByText("24/01/2027")).toBeVisible();

        await page.getByRole("navigation", { name: "Menú principal" }).getByRole("link", { name: "Cierres" }).click();
        await expect(page.getByLabel("Fecha de corte")).toHaveValue("2027-01-24");
        await page.reload();
        await expect(page.getByLabel("Fecha de corte")).toHaveValue("2027-01-24");
    });
});

test.describe("Aprobación de pagos en el chat (componente)", () => {

    test.use({ viewport: { width: 1440, height: 900 } });

    test("la gerencia ve el desglose pero no un botón para aplicar; el asesor sí", async ({ page }) => {
        await entrarComo(page, "Gerencia");
        await page.goto("/gerencia/componentes");

        const tarjetas = page.getByRole("region", { name: "Pago propuesto: requiere aprobación" });
        await expect(tarjetas).toHaveCount(2);

        // Primera: variante asesor. Segunda: variante gerencia.
        await expect(tarjetas.nth(0).getByRole("button", { name: "Aprobar y aplicar" })).toBeVisible();
        await expect(tarjetas.nth(1).getByRole("button", { name: "Aprobar y aplicar" })).toHaveCount(0);
        await expect(tarjetas.nth(1).getByText("Desglose de la prelación")).toBeVisible();
        await expect(tarjetas.nth(1).getByRole("button", { name: "Descartar propuesta" })).toBeVisible();
    });
});
