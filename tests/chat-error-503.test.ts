
import { describe, expect, it } from "vitest";
import { ApiError } from "@google/genai";

import { esErrorGeminiSaturado } from "../src/asistente/es-error-gemini-saturado";

describe("Chat gerencial - errores de Gemini", () => {

    it("reconoce un error 503 de Gemini", () => {
        const error = new ApiError({
            message: "Gemini temporalmente no disponible",
            status: 503
        });

        expect(esErrorGeminiSaturado(error)).toBe(true);
    });

        
    it("reconoce un error 504 de Gemini", () => {
        const error = new ApiError({
            message: "Deadline expired before operation could complete.",
            status: 504
        });

        expect(esErrorGeminiSaturado(error)).toBe(true);
    });


    it("no confunde un error 401 con saturacion", () => {
        const error = new ApiError({
            message: "Clave API no valida",
            status: 401
        });

        expect(esErrorGeminiSaturado(error)).toBe(false);
    });

    it("no confunde un error comun con saturacion", () => {
        const error = new Error("Error interno del sistema");

        expect(esErrorGeminiSaturado(error)).toBe(false);
    });

    it("lee el codigo por forma, aunque el error no sea instancia de ApiError", () => {
        // Si el SDK llegara a cargarse dos veces (ESM y CJS), instanceof fallaria.
        expect(esErrorGeminiSaturado({ status: 503, message: "{}" })).toBe(true);
        expect(esErrorGeminiSaturado({ status: 429, message: "{}" })).toBe(false);
    });

    it("rechaza valores que no son errores", () => {
        expect(esErrorGeminiSaturado(null)).toBe(false);
        expect(esErrorGeminiSaturado(undefined)).toBe(false);
        expect(esErrorGeminiSaturado("503")).toBe(false);
    });
});
