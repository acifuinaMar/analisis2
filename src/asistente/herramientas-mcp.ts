import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

import type { DeclaracionHerramienta } from "./modelo-lenguaje";

/**
 * PUERTO por el que el chat ejecuta herramientas.
 *
 * El orquestador no habla el protocolo MCP: pide un catalogo y pide
 * invocar por nombre. Asi el chat se puede probar contra el servidor real
 * —que es lo que se hace— sin quedar atado a los detalles del SDK.
 */
export interface InvocadorHerramientas {

    listar(): Promise<ReadonlyArray<DeclaracionHerramienta>>;

    /** Devuelve el contenido de la respuesta, en texto. */
    invocar(
        nombre: string,
        argumentos: Record<string, unknown>
    ): Promise<string>;

}

/**
 * ADAPTADOR sobre un cliente MCP.
 *
 * El enunciado pide que el chat responda «invocando el servidor»: esta
 * clase es la que lo cumple literalmente. Las herramientas no se llaman
 * por atajo contra el servicio de consultas, sino atravesando el
 * protocolo, igual que lo haria cualquier otro cliente.
 */
export class HerramientasMcp implements InvocadorHerramientas {

    constructor(private readonly cliente: Client) {}

    public async listar(): Promise<ReadonlyArray<DeclaracionHerramienta>> {

        const { tools } = await this.cliente.listTools();

        return tools.map((herramienta) => ({
            nombre: herramienta.name,
            descripcion: herramienta.description ?? "",
            esquema: (herramienta.inputSchema ?? {}) as Record<
                string,
                unknown
            >
        }));
    }

    public async invocar(
        nombre: string,
        argumentos: Record<string, unknown>
    ): Promise<string> {

        const respuesta = await this.cliente.callTool({
            name: nombre,
            arguments: argumentos
        });

        const contenido = (respuesta as {
            content?: Array<{ type: string; text?: string }>;
        }).content;

        const texto = (contenido ?? [])
            .map((parte) => parte.text ?? "")
            .join("\n")
            .trim();

        // El SDK rechaza en el borde lo que no cumple el esquema Zod y
        // responde con texto plano en vez del JSON de la herramienta. Se
        // normaliza para que el modelo reciba siempre la misma forma.
        if ((respuesta as { isError?: boolean }).isError) {
            return JSON.stringify({
                error: true,
                codigo: "ENTRADA_INVALIDA",
                mensaje: texto || "La herramienta rechazo los argumentos."
            });
        }

        return texto;
    }
}
