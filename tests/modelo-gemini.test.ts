import { describe, expect, it } from "vitest";

import {
    MODELO_POR_OMISION,
    ModeloGemini,
    aContenidos,
    aDeclaraciones,
    aTurno
} from "../src/adaptadores/modelo-gemini";
import type { Mensaje } from "../src/asistente/modelo-lenguaje";

/**
 * Pruebas del adaptador de Gemini.
 *
 * No llaman al modelo: eso costaria dinero, necesitaria red y no
 * devolveria lo mismo dos veces. Lo que se prueba es la TRADUCCION entre
 * el vocabulario del puerto y el formato del proveedor, que es la parte
 * que si se puede verificar y la que mas facilmente se rompe al cambiar
 * de version del SDK.
 */

describe("Adaptador Gemini - traduccion del historial", () => {

    it("Una conversacion completa se traduce papel por papel", () => {

        const historial: Mensaje[] = [
            { papel: "usuario", texto: "estado de CV-2026-0030" },
            {
                papel: "asistente_llama",
                llamadas: [{
                    nombre: "consultar_credito",
                    argumentos: {
                        idCredito: "CV-2026-0030",
                        fechaCorte: "2026-10-31"
                    }
                }]
            },
            {
                papel: "resultado",
                nombre: "consultar_credito",
                contenido: '{"diasAtraso":65,"saldoCapital":686.16}'
            },
            { papel: "asistente", texto: "Lleva 65 dias de atraso." }
        ];

        const c = aContenidos(historial);

        expect(c).toHaveLength(4);

        expect(c[0].role).toBe("user");
        expect(c[0].parts?.[0].text).toBe("estado de CV-2026-0030");

        // La llamada la hizo el modelo.
        expect(c[1].role).toBe("model");
        expect(c[1].parts?.[0].functionCall?.name)
            .toBe("consultar_credito");
        expect(c[1].parts?.[0].functionCall?.args)
            .toEqual({ idCredito: "CV-2026-0030", fechaCorte: "2026-10-31" });

        // El resultado llega al modelo desde fuera, con papel de usuario.
        expect(c[2].role).toBe("user");
        expect(c[2].parts?.[0].functionResponse?.name)
            .toBe("consultar_credito");
        expect(c[2].parts?.[0].functionResponse?.response)
            .toEqual({ diasAtraso: 65, saldoCapital: 686.16 });

        expect(c[3].role).toBe("model");
    });

    it("Varias llamadas en un turno van en un solo contenido", () => {

        const c = aContenidos([{
            papel: "asistente_llama",
            llamadas: [
                { nombre: "consultar_credito", argumentos: {} },
                { nombre: "explicar_mora", argumentos: {} }
            ]
        }]);

        expect(c).toHaveLength(1);
        expect(c[0].parts).toHaveLength(2);
    });

    /**
     * El SDK rechaza en el borde lo que no cumple el esquema y responde
     * en texto plano. Envolverlo en vez de descartarlo deja que el modelo
     * explique el fallo al usuario.
     */
    it("Un resultado que no es JSON se envuelve, no se pierde", () => {

        const c = aContenidos([{
            papel: "resultado",
            nombre: "consultar_credito",
            contenido: "algo salio mal"
        }]);

        expect(c[0].parts?.[0].functionResponse?.response)
            .toEqual({ resultado: "algo salio mal" });
    });

    it("Un resultado que es un arreglo tambien se envuelve", () => {

        // functionResponse.response tiene que ser un objeto.
        const c = aContenidos([{
            papel: "resultado",
            nombre: "x",
            contenido: "[1,2,3]"
        }]);

        expect(c[0].parts?.[0].functionResponse?.response)
            .toEqual({ resultado: [1, 2, 3] });
    });

    it("Un historial vacio se traduce a nada", () => {
        expect(aContenidos([])).toEqual([]);
    });
});

describe("Adaptador Gemini - traduccion del catalogo", () => {

    it("El esquema del servidor viaja tal cual, sin redefinirse", () => {

        const esquema = {
            type: "object",
            properties: {
                idCredito: { type: "string", pattern: "^CV-\\d{4}-\\d{4}$" }
            },
            required: ["idCredito"],
            additionalProperties: false
        };

        const [d] = aDeclaraciones([{
            nombre: "consultar_credito",
            descripcion: "Devuelve el estado de un credito.",
            esquema
        }]);

        expect(d.name).toBe("consultar_credito");
        expect(d.description).toBe("Devuelve el estado de un credito.");
        expect(d.parametersJsonSchema).toEqual(esquema);
    });

    /**
     * $schema es metadato del documento y no describe ningun parametro.
     * El servidor MCP lo incluye; el proveedor no lo necesita.
     */
    it("Se quita $schema y se conserva todo lo demas", () => {

        const [d] = aDeclaraciones([{
            nombre: "x",
            descripcion: "y",
            esquema: {
                $schema: "http://json-schema.org/draft-07/schema#",
                type: "object",
                properties: { a: { type: "string" } },
                required: ["a"]
            }
        }]);

        const esquema = d.parametersJsonSchema as Record<string, unknown>;

        expect(esquema).not.toHaveProperty("$schema");
        expect(esquema.type).toBe("object");
        expect(esquema.required).toEqual(["a"]);
    });

    it("Quitar $schema no muta el esquema original", () => {

        const original = { $schema: "x", type: "object" };

        aDeclaraciones([{ nombre: "a", descripcion: "b", esquema: original }]);

        expect(original).toHaveProperty("$schema");
    });
});

describe("Adaptador Gemini - lectura de la respuesta", () => {

    it("Una respuesta con texto da un turno de texto", () => {

        expect(aTurno({ text: "La cartera activa es Q299,939.82." }))
            .toEqual({
                tipo: "texto",
                texto: "La cartera activa es Q299,939.82."
            });
    });

    it("Una respuesta con llamadas da un turno de llamadas", () => {

        const turno = aTurno({
            functionCalls: [
                { name: "consultar_cartera", args: { fechaCorte: "2026-10-31" } }
            ]
        });

        expect(turno).toEqual({
            tipo: "llamadas",
            llamadas: [{
                nombre: "consultar_cartera",
                argumentos: { fechaCorte: "2026-10-31" }
            }]
        });
    });

    it("Las llamadas mandan sobre el texto que las acompane", () => {

        const turno = aTurno({
            text: "voy a consultar",
            functionCalls: [{ name: "consultar_cartera", args: {} }]
        });

        expect(turno.tipo).toBe("llamadas");
    });

    it("Una llamada sin nombre se descarta", () => {

        const turno = aTurno({
            functionCalls: [{ args: {} }, { name: "valida", args: {} }]
        });

        expect(turno.tipo).toBe("llamadas");
        if (turno.tipo !== "llamadas") return;
        expect(turno.llamadas).toHaveLength(1);
        expect(turno.llamadas[0].nombre).toBe("valida");
    });

    it("Una llamada sin argumentos recibe un objeto vacio", () => {

        const turno = aTurno({ functionCalls: [{ name: "x" }] });

        if (turno.tipo !== "llamadas") throw new Error("deberia ser llamadas");
        expect(turno.llamadas[0].argumentos).toEqual({});
    });

    it("Una respuesta vacia da texto vacio, no un fallo", () => {
        expect(aTurno({})).toEqual({ tipo: "texto", texto: "" });
    });
});

describe("Adaptador Gemini - construccion", () => {

    it("Sin clave de API falla al construirse, no al usarse", () => {

        expect(() => new ModeloGemini(MODELO_POR_OMISION, ""))
            .toThrow(/GEMINI_API_KEY/);

        expect(() => new ModeloGemini(MODELO_POR_OMISION, "   "))
            .toThrow(/GEMINI_API_KEY/);
    });

    it("Usa el mismo modelo que el modulo RAG", () => {
        expect(MODELO_POR_OMISION).toBe("gemini-3.8-flash");
    });

    it("Con clave se construye y se identifica", () => {

        const m = new ModeloGemini("gemini-3.8-flash", "clave-de-prueba");

        expect(m.nombre).toBe("gemini-3.8-flash");
    });
});
