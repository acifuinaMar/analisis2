import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { dump } from "js-yaml";

import { construirRegistro } from "./registro-rutas";

/**
 * Genera docs/api/openapi.yaml a partir de los esquemas Zod.
 *
 * Ejecucion: npm run contratos:openapi
 */
function generar(): void {

    const registro = construirRegistro();
    const generador = new OpenApiGeneratorV3(registro.definitions);

    const documento = generador.generateDocument({
        openapi: "3.0.3",
        info: {
            title: "Sistema de Gestion de Microcredito -- Credito Vecino, S.A.",
            version: "1.0.0",
            description:
                "Contrato de la API (Entregable E5, Proyecto 1). "
                + "Entrega de recursos principales -- "
                + "Clientes, Solicitudes, Creditos, Pagos, Cierres y "
                + "Cartera en riesgo -- derivada de los mismos esquemas "
                + "Zod."
        },
        servers: [
            {
                url: "/api/v1",
                description: "API V1"
            }
        ],
        tags: [
            { name: "Clientes" },
            { name: "Solicitudes" },
            { name: "Creditos" },
            { name: "Pagos" },
            { name: "Cierres" },
            { name: "Cartera en riesgo" }
        ]
    });

    const salida = resolve(__dirname, "../../docs/api/openapi.yaml");

    mkdirSync(dirname(salida), { recursive: true });

    const encabezado =
        "# ============================================================\n"
        + "# ARCHIVO GENERADO. No editar a mano.\n"
        + "# Se produce con: npm run contratos:openapi\n"
        + "# Fuente: src/contratos/*.ts (esquemas Zod, nota 8.2)\n"
        + "# ============================================================\n";

    writeFileSync(
        salida,
        encabezado + dump(documento, { noRefs: false, lineWidth: 100 }),
        "utf-8"
    );

    // eslint-disable-next-line no-console
    console.log(`OpenAPI generado en ${salida}`);
}

generar();
