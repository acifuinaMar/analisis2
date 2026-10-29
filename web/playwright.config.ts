import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de la interfaz con Playwright (navegador real).
 *
 * Extensión propia (*.prueba.ts) a propósito: el `npm test` de la raíz
 * usa el patrón por omisión de Vitest (*.test.* / *.spec.*) y no debe
 * recoger estas pruebas.
 *
 * Las pruebas NO necesitan la API ni la base de datos: interceptan /api
 * en el navegador. Así no tocan PostgreSQL y no dependen de datos.
 */
const PUERTO = 5174;

export default defineConfig({
    testDir: "./pruebas",
    testMatch: "**/*.prueba.ts",
    fullyParallel: true,
    reporter: [["list"]],
    use: {
        baseURL: `http://127.0.0.1:${PUERTO}`,
        locale: "es-GT",
        timezoneId: "America/Guatemala"
    },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } }
    ],
    webServer: {
        command: `npm run dev -- --host 127.0.0.1 --port ${PUERTO} --strictPort`,
        url: `http://127.0.0.1:${PUERTO}`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000
    }
});
