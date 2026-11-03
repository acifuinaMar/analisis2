import { PassThrough } from "node:stream";
import { createInterface } from "node:readline";

import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { RepositorioCarteraCsv } from "../src/adaptadores/repositorio-cartera-csv";
import { crearServidorMcp } from "../src/mcp/servidor-mcp";
import { HerramientasMcp } from "../src/asistente/herramientas-mcp";
import { crearLector } from "../src/asistente/lector-lineas";
import { ErrorTrasAplicarPago, Orquestador } from "../src/asistente/orquestador";
import {
    ErrorModeloLenguaje,
    type DeclaracionHerramienta,
    type Mensaje,
    type ModeloLenguaje,
    type TurnoModelo
} from "../src/asistente/modelo-lenguaje";
import type { Perfil } from "../src/acceso/perfil";
import { dice, llama } from "./ayudas/modelo-guionizado";

/**
 * El chat cuando el modelo FALLA a mitad de camino (Gemini saturado o sin
 * respuesta a tiempo), contra el servidor MCP real.
 *
 * Antes, la consola borraba toda la conversacion para no dejar un turno a
 * medias. Ahora cada pregunta es atomica en el orquestador: si falla, el
 * historial vuelve a como estaba y se puede seguir conversando.
 */

const SATURADO = new ErrorModeloLenguaje("saturado", "Gemini esta saturado (503)", 503);

/** Modelo guionizado que tambien puede FALLAR en un turno dado. */
class ModeloQueFalla implements ModeloLenguaje {
    public readonly nombre = "falla";
    public readonly historiales: Array<ReadonlyArray<Mensaje>> = [];
    private i = 0;
    constructor(private readonly guion: ReadonlyArray<TurnoModelo | Error>) {}

    public async responder(
        _instrucciones: string,
        historial: ReadonlyArray<Mensaje>,
        _herramientas: ReadonlyArray<DeclaracionHerramienta>
    ): Promise<TurnoModelo> {
        this.historiales.push([...historial]);
        const paso = this.guion[this.i++];
        if (!paso) throw new Error("guion agotado");
        if (paso instanceof Error) throw paso;
        return paso;
    }
}

async function armar(guion: ReadonlyArray<TurnoModelo | Error>, perfil: Perfil = "gerencia") {
    const servidor = crearServidorMcp(new RepositorioCarteraCsv(process.env.CV_DATA_DIR ?? ""));
    const [aCliente, aServidor] = InMemoryTransport.createLinkedPair();
    const cliente = new Client({ name: "pruebas-errores", version: "1.0.0" });
    await Promise.all([servidor.connect(aServidor), cliente.connect(aCliente)]);
    const modelo = new ModeloQueFalla(guion);
    return { chat: new Orquestador(modelo, new HerramientasMcp(cliente), perfil), modelo };
}

describe("Chat - una falla del modelo no rompe la conversacion", () => {

    it("Si el modelo falla, la pregunta se deshace y el error conserva su motivo", async () => {
        const { chat } = await armar([dice("Hola."), SATURADO]);

        await chat.preguntar("Hola");
        const antes = chat.historial();

        await expect(chat.preguntar("¿Cuantos creditos hay en cartera?"))
            .rejects.toMatchObject({ motivo: "saturado" });

        expect(chat.historial()).toEqual(antes);
    });

    it("Si falla DESPUES de consultar una herramienta, tambien se deshace la consulta", async () => {
        const { chat } = await armar([
            llama("consultar_cartera", { fechaCorte: "2026-10-31" }),
            SATURADO
        ]);

        await expect(chat.preguntar("¿Cuantos creditos hay en cartera?")).rejects.toBe(SATURADO);

        expect(chat.historial()).toEqual([]);
    });

    it("La siguiente pregunta se responde sin arrastrar el turno fallido", async () => {
        const { chat, modelo } = await armar([
            SATURADO,
            llama("consultar_cartera", { fechaCorte: "2026-10-31" }),
            dice("Hay 66 creditos activos.")
        ]);

        await expect(chat.preguntar("primera")).rejects.toBe(SATURADO);
        const r = await chat.preguntar("¿Cuantos creditos hay en cartera?");

        expect(r.tipo).toBe("respuesta");
        if (r.tipo !== "respuesta") return;
        expect(r.texto).toBe("Hay 66 creditos activos.");
        expect(r.herramientasUsadas).toEqual(["consultar_cartera"]);
        // Lo que vio el modelo en el reintento: solo la pregunta nueva.
        expect(modelo.historiales[1]).toEqual([{ papel: "usuario", texto: "¿Cuantos creditos hay en cartera?" }]);
    });

    it("La gerencia sigue sin poder aplicar pagos (sin cambios de permisos)", async () => {
        const { chat } = await armar([], "gerencia");
        expect(chat.puedeAprobar()).toBe(false);
        await expect(chat.aprobarPago()).rejects.toThrow(/no puede registrar pagos/);
    });
});

describe("Chat - falla del modelo despues de aprobar un pago", () => {

    it("El pago YA aplicado no se deshace ni se puede aprobar otra vez, y se informa", async () => {
        const PAGO = {
            idCredito: "CV-2026-0043",
            monto: 1114.54,
            claveIdempotencia: "IDEM-CHAT-ERROR-1",
            fechaOperacion: "2026-10-31"
        };
        const { chat } = await armar([llama("registrar_pago", PAGO), SATURADO], "asesor");

        const propuesta = await chat.preguntar("Registra el pago de CV-2026-0043");
        expect(propuesta.tipo).toBe("aprobacion_requerida");

        let capturado: unknown;
        try {
            await chat.aprobarPago();
        } catch (e) {
            capturado = e;
        }

        expect(capturado).toBeInstanceOf(ErrorTrasAplicarPago);
        const e = capturado as ErrorTrasAplicarPago;
        expect(e.idCredito).toBe("CV-2026-0043");
        expect((JSON.parse(e.resultado) as { aplicado: boolean }).aplicado).toBe(true);
        expect(e.cause).toBe(SATURADO);

        // El resultado queda en el historial y no hay nada pendiente.
        expect(chat.historial().some((m) => m.papel === "resultado" && m.nombre === "registrar_pago")).toBe(true);
        expect(chat.pagoPendiente()).toBeUndefined();
        await expect(chat.aprobarPago()).rejects.toThrow(/pendiente/i);
    });
});

describe("Consola - lector de lineas con cola", () => {

    function consola() {
        const entrada = new PassThrough();
        const salida = new PassThrough();
        salida.resume();
        const rl = createInterface({ input: entrada, output: salida, terminal: false });
        return { entrada, leer: crearLector(rl, salida) };
    }

    it("No pierde lo que se escribe mientras el modelo esta pensando", async () => {
        const { entrada, leer } = consola();

        entrada.write("primera\nsegunda\n");
        await new Promise((r) => setImmediate(r));

        expect(await leer("> ")).toBe("primera");
        expect(await leer("> ")).toBe("segunda");
    });

    it("Entrega la linea que llega despues de preguntar", async () => {
        const { entrada, leer } = consola();

        const pendiente = leer("> ");
        entrada.write("  hola  \n");

        expect(await pendiente).toBe("hola");
    });

    it("Al cerrarse la entrada devuelve undefined (salir), despues de lo que quedo en cola", async () => {
        const { entrada, leer } = consola();

        entrada.end("ultima\n");
        await new Promise((r) => setImmediate(r));

        expect(await leer("> ")).toBe("ultima");
        expect(await leer("> ")).toBeUndefined();
    });
});
