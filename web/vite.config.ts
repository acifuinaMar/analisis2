import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Configuración de Vite para la interfaz del E1.
 *
 * La interfaz NO habla con PostgreSQL, MCP ni el núcleo: solo con la API
 * REST existente (src/api, `npm run api` en la raíz). En desarrollo, Vite
 * reenvía /api a ese proceso, así que el navegador ve un solo origen y la
 * API no necesita CORS.
 *
 * VITE_API_DESTINO solo cambia a dónde reenvía el proxy; no es una
 * credencial. Ningún valor del .env de la raíz llega al navegador.
 */
export default defineConfig(({ mode }) => {
    const entorno = loadEnv(mode, process.cwd(), "VITE_");
    const destino = entorno.VITE_API_DESTINO || "http://127.0.0.1:3000";

    const proxy = { "/api": { target: destino, changeOrigin: false } };

    return {
        plugins: [react(), tailwindcss()],
        server: {
            port: 5173,
            proxy,
            // Precompila la aplicación al arrancar: sin esto, la primera
            // página de cada prueba de Playwright espera a que Vite
            // transforme módulos bajo demanda y, con varios trabajadores en
            // paralelo, alguna espera puede agotar su tiempo.
            warmup: { clientFiles: ["./src/main.tsx"] }
        },
        preview: { port: 4173, proxy }
    };
});
