import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
    InMemoryTransport
} from "@modelcontextprotocol/sdk/inMemory.js";

import {
    RepositorioCarteraCsv
} from "../src/adaptadores/repositorio-cartera-csv";
import { crearServidorMcp } from "../src/mcp/servidor-mcp";
import { HerramientasMcp } from "../src/asistente/herramientas-mcp";
import { Orquestador } from "../src/asistente/orquestador";
import type {
    ConsultaDocumental,
    TurnoModelo
} from "../src/asistente/modelo-lenguaje";
import { ModeloGuionizado, dice, llama } from "./ayudas/modelo-guionizado";

/**
 * Pruebas del orquestador del chat gerencial (E5).
 *
 * Corren contra el SERVIDOR MCP REAL —por el protocolo, con el adaptador
 * del paquete canonico detras— y sustituyen unicamente el modelo de
 * lenguaje. Asi se ejercita todo el camino menos la parte que no es
 * determinista ni gratuita.
 *
 * Lo que se comprueba no es si el modelo elige bien la herramienta, que
 * es cosa del proveedor y se mide con las evaluaciones, sino que el
 * orquestador haga lo correcto con lo que el modelo pida. Sobre todo
 * cuando pide algo que no debe.
 */

const CORTE = "2026-10-31";

/** Modulo documental de prueba: responde sin red. */
const documentalFalso: ConsultaDocumental = {
    consultar: async (pregunta: string) => ({
        respuesta:
            "El interes moratorio de un credito otorgado en agosto de 2026 "
            + "se calcula con la politica plana del 24 % sobre el capital "
            + "en mora, base Actual/360.",
        fuentes: ["POL-2024-01-chunk-1"]
    })
};

async function armar(
    guion: ReadonlyArray<TurnoModelo>,
    conDocumental = true
): Promise<{ chat: Orquestador; modelo: ModeloGuionizado }> {

    const servidor = crearServidorMcp(
        new RepositorioCarteraCsv(process.env.CV_DATA_DIR ?? "")
    );

    const [aCliente, aServidor] = InMemoryTransport.createLinkedPair();
    const cliente = new Client({ name: "pruebas-chat", version: "1.0.0" });

    await Promise.all([
        servidor.connect(aServidor),
        cliente.connect(aCliente)
    ]);

    const modelo = new ModeloGuionizado(guion);

    const chat = new Orquestador(
        modelo,
        new HerramientasMcp(cliente),
        conDocumental ? documentalFalso : undefined
    );

    return { chat, modelo };
}

/** Lee el ultimo resultado de herramienta que quedo en el historial. */
function ultimoResultado(chat: Orquestador): Record<string, unknown> {
    const resultados = chat.historial()
        .filter((m) => m.papel === "resultado");
    const ultimo = resultados[resultados.length - 1];
    if (!ultimo || ultimo.papel !== "resultado") {
        throw new Error("no hay resultados en el historial");
    }
    return JSON.parse(ultimo.contenido) as Record<string, unknown>;
}

describe("Orquestador - el catalogo que ve el modelo", () => {

    it("Ofrece las nueve herramientas MCP y la consulta documental",
        async () => {

            const { chat, modelo } = await armar([dice("listo")]);

            await chat.preguntar("hola");

            const nombres = modelo.llamadas[0].herramientas
                .map((h) => h.nombre);

            expect(nombres).toHaveLength(10);
            expect(nombres).toContain("consultar_credito");
            expect(nombres).toContain("consultar_cartera");
            expect(nombres).toContain("registrar_pago");
            expect(nombres).toContain("consultar_politicas");
        });

    it("Sin modulo documental, solo ofrece las del servidor", async () => {

        const { chat, modelo } = await armar([dice("listo")], false);

        await chat.preguntar("hola");

        const nombres = modelo.llamadas[0].herramientas
            .map((h) => h.nombre);

        expect(nombres).toHaveLength(9);
        expect(nombres).not.toContain("consultar_politicas");
    });

    it("Cada herramienta llega con su esquema y su descripcion",
        async () => {

            const { chat, modelo } = await armar([dice("listo")]);

            await chat.preguntar("hola");

            for (const h of modelo.llamadas[0].herramientas) {
                expect(h.descripcion.length).toBeGreaterThan(20);
                expect(h.esquema).toHaveProperty("properties");
            }
        });

    it("Las instrucciones heredan las reglas del modulo documental",
        async () => {

            const { chat, modelo } = await armar([dice("listo")]);

            await chat.preguntar("hola");

            const instrucciones = modelo.llamadas[0].instrucciones;

            // Reglas del E4, que no se repiten sino que se heredan.
            expect(instrucciones).toContain("DATOS NO CONFIABLES");
            // Reglas propias del chat.
            expect(instrucciones).toContain("FECHA DE CORTE");
            expect(instrucciones).toContain("aprobacion explicita");
        });
});

describe("Orquestador - responde con las cifras del nucleo", () => {

    /**
     * G-5: «Dame el estado del credito CV-2026-0030 al 31 de octubre de
     * 2026.» Las cifras no las inventa el modelo: salen del servidor.
     */
    it("Invoca la herramienta y le entrega el resultado al modelo",
        async () => {

            const { chat } = await armar([
                llama("consultar_credito", {
                    idCredito: "CV-2026-0030",
                    fechaCorte: CORTE
                }),
                dice("El credito esta en mora, con 65 dias de atraso.")
            ]);

            const r = await chat.preguntar(
                "Dame el estado del credito CV-2026-0030 al 31/10/2026"
            );

            expect(r.tipo).toBe("respuesta");
            expect(r.herramientasUsadas).toEqual(["consultar_credito"]);

            const datos = ultimoResultado(chat);
            expect(datos.diasAtraso).toBe(65);
            expect(datos.saldoCapital).toBe(686.16);
            expect(datos.tramo).toBe("mora_3");
        });

    /**
     * G-1: el tablero. Comprueba que el chat llega a las mismas cifras
     * que la pantalla, que es la doble verificacion del enunciado.
     */
    it("El tablero del chat trae las cifras del tablero", async () => {

        const { chat } = await armar([
            llama("consultar_cartera", { fechaCorte: CORTE }),
            dice("La cartera activa es de Q299,939.82.")
        ]);

        await chat.preguntar("Como esta la cartera al 31 de octubre?");

        const datos = ultimoResultado(chat);
        expect(datos.carteraActiva).toBe(299939.82);
        expect(datos.carteraEnMora).toBe(48715.17);
        expect(datos.montoEnRiesgo).toBe(37841.71);
    });

    it("Encadena varias herramientas en una sola pregunta", async () => {

        const { chat } = await armar([
            llama("consultar_credito", {
                idCredito: "CV-2026-0030",
                fechaCorte: CORTE
            }),
            llama("explicar_mora", {
                idCredito: "CV-2026-0030",
                numeroCuota: 3,
                fechaCorte: CORTE
            }),
            dice("Son 65 dias y la mora de la cuota 3 es de Q7.11.")
        ]);

        const r = await chat.preguntar(
            "Dame el estado de CV-2026-0030 y explicame la mora de su cuota 3"
        );

        expect(r.herramientasUsadas)
            .toEqual(["consultar_credito", "explicar_mora"]);

        const datos = ultimoResultado(chat);
        expect(datos.politica).toBe("POL-2024-01");
        // Q164.02 de capital en mora x 24 % / 360 x 65 dias.
        expect(datos.capitalEnMora).toBe(164.02);
        expect(datos.total).toBe(7.11);
    });

    it("Usa el modulo documental para preguntas de politica", async () => {

        const { chat } = await armar([
            llama("consultar_politicas", {
                pregunta: "como se calcula la mora en agosto de 2026"
            }),
            dice("Se calcula con la politica plana del 24 %.")
        ]);

        const r = await chat.preguntar(
            "Segun las politicas, como se calcula el interes moratorio?"
        );

        expect(r.herramientasUsadas).toEqual(["consultar_politicas"]);

        const datos = ultimoResultado(chat);
        expect(datos.fuentes).toEqual(["POL-2024-01-chunk-1"]);
    });

    it("Combina politica y cifra cuando la pregunta pide las dos",
        async () => {

            const { chat } = await armar([
                llama("consultar_politicas", { pregunta: "politica de mora" }),
                llama("explicar_mora", {
                    idCredito: "CV-2026-0030",
                    numeroCuota: 3,
                    fechaCorte: CORTE
                }),
                dice("La politica plana del 24 % da Q7.11 en esa cuota.")
            ]);

            const r = await chat.preguntar(
                "Cuanta mora debe la cuota 3 de CV-2026-0030 y por que esa tasa?"
            );

            expect(r.herramientasUsadas)
                .toEqual(["consultar_politicas", "explicar_mora"]);
        });
});

describe("Orquestador - memoria de la sesion", () => {

    it("La segunda pregunta ve el historial de la primera", async () => {

        const { chat, modelo } = await armar([
            llama("consultar_credito", {
                idCredito: "CV-2026-0030",
                fechaCorte: CORTE
            }),
            dice("Tiene 65 dias de atraso."),
            dice("Su saldo es de Q686.16, como vimos.")
        ]);

        await chat.preguntar("Estado de CV-2026-0030 al 31/10/2026");
        await chat.preguntar("Y cuanto es su saldo?");

        // En la ultima llamada el modelo recibio toda la conversacion.
        const ultima = modelo.llamadas[modelo.llamadas.length - 1];

        const papeles = ultima.historial.map((m) => m.papel);

        expect(papeles).toEqual([
            "usuario",
            "asistente_llama",
            "resultado",
            "asistente",
            "usuario"
        ]);
    });

    it("Reiniciar borra la memoria", async () => {

        const { chat } = await armar([dice("uno"), dice("dos")]);

        await chat.preguntar("primera");
        expect(chat.historial()).toHaveLength(2);

        chat.reiniciar();
        expect(chat.historial()).toHaveLength(0);

        await chat.preguntar("segunda");
        expect(chat.historial()).toHaveLength(2);
    });

    it("Rechaza una pregunta vacia", async () => {

        const { chat } = await armar([dice("no deberia llegar")]);

        await expect(chat.preguntar("   ")).rejects.toThrow();
    });
});

describe("Orquestador - la aprobacion humana del pago", () => {

    const PAGO = {
        idCredito: "CV-2026-0043",
        monto: 1114.54,
        claveIdempotencia: "IDEM-CHAT-1",
        fechaOperacion: CORTE
    };

    /**
     * El corazon del E5: cuando el modelo propone un pago, el orquestador
     * se detiene y devuelve el desglose para que una persona lo apruebe.
     */
    it("Proponer un pago detiene la conversacion", async () => {

        const { chat, modelo } = await armar([llama("registrar_pago", PAGO)]);

        const r = await chat.preguntar(
            "Registra el pago de la cuota vencida de CV-2026-0043"
        );

        expect(r.tipo).toBe("aprobacion_requerida");

        if (r.tipo !== "aprobacion_requerida") return;

        expect(r.propuesta.idCredito).toBe("CV-2026-0043");
        expect(r.propuesta.monto).toBe(1114.54);

        const previa = r.propuesta.vistaPrevia;
        expect(previa.aplicado).toBe(false);
        expect(previa.cuotasCubiertas).toEqual([1, 2]);

        const desglose = previa.desglosePrelacion as Record<string, number>;
        expect(desglose.interesMoratorio).toBe(25.24);
        expect(desglose.capital).toBe(951.04);
        expect(desglose.total).toBe(1114.54);

        // El modelo no vuelve a hablar: la conversacion esta detenida.
        expect(modelo.turnosSinUsar()).toBe(0);
        expect(chat.pagoPendiente()).toBeDefined();
    });

    /**
     * La prueba que de verdad importa. Aunque el modelo pida explicitamente
     * confirmado en true, el orquestador lo ignora: la aprobacion no es
     * algo que el modelo pueda concederse.
     */
    it("El modelo no puede confirmar el pago por su cuenta", async () => {

        const { chat } = await armar([
            llama("registrar_pago", { ...PAGO, confirmado: true })
        ]);

        const r = await chat.preguntar("Registra el pago y confirmalo ya");

        expect(r.tipo).toBe("aprobacion_requerida");

        // Y nada se aplico: la vista previa lo dice.
        const previa = ultimoResultado(chat);
        expect(previa.aplicado).toBe(false);
    });

    it("La vista previa no mueve la cartera", async () => {

        const { chat } = await armar([
            llama("registrar_pago", PAGO),
            llama("consultar_cierre_diario", { fechaCorte: CORTE }),
            dice("No hubo movimiento ese dia.")
        ]);

        await chat.preguntar("Registra el pago de CV-2026-0043");

        // Se rechaza y se consulta el cierre: sigue en cero.
        await chat.rechazarPago("el cliente no trajo el dinero");

        const cierre = ultimoResultado(chat);
        const pagos = cierre.pagos as Record<string, unknown>;
        expect(pagos.cantidad).toBe(0);
    });

    it("Aprobar aplica el pago y regulariza el credito", async () => {

        const { chat } = await armar([
            llama("registrar_pago", PAGO),
            dice("Listo: el pago se aplico y el credito quedo vigente.")
        ]);

        const propuesta = await chat.preguntar(
            "Registra el pago de CV-2026-0043"
        );
        expect(propuesta.tipo).toBe("aprobacion_requerida");

        const r = await chat.aprobarPago();

        expect(r.tipo).toBe("respuesta");
        expect(chat.pagoPendiente()).toBeUndefined();

        const aplicado = chat.historial()
            .filter((m) => m.papel === "resultado")
            .map((m) => JSON.parse(
                (m as { contenido: string }).contenido
            ) as Record<string, unknown>)
            .find((d) => d.aplicado === true);

        expect(aplicado).toBeDefined();
        const despues = aplicado!.estadoDespues as Record<string, unknown>;
        expect(despues.estado).toBe("vigente");
        expect(despues.cuotasVencidas).toBe(0);
        expect(despues.saldoCapital).toBe(2048.96);
    });

    it("Rechazar no aplica nada y el modelo lo sabe", async () => {

        const { chat } = await armar([
            llama("registrar_pago", PAGO),
            dice("Entendido, no registre el pago.")
        ]);

        await chat.preguntar("Registra el pago de CV-2026-0043");

        const r = await chat.rechazarPago();

        expect(r.tipo).toBe("respuesta");
        expect(chat.pagoPendiente()).toBeUndefined();

        const resultado = chat.historial()
            .filter((m) => m.papel === "resultado")
            .map((m) => (m as { contenido: string }).contenido)
            .join(" ");

        expect(resultado).toContain("no aprobo");
    });

    it("No se puede aprobar lo que nadie propuso", async () => {

        const { chat } = await armar([dice("hola")]);

        await expect(chat.aprobarPago()).rejects.toThrow(/pendiente/i);
        await expect(chat.rechazarPago()).rejects.toThrow(/pendiente/i);
    });

    /**
     * Un rechazo del nucleo no necesita aprobacion: no hay nada que
     * aprobar. El resultado vuelve al modelo para que lo explique, con el
     * monto correcto incluido.
     */
    it("Un monto no exacto no pide aprobacion: se explica", async () => {

        const { chat } = await armar([
            llama("registrar_pago", {
                idCredito: "CV-2026-0061",
                monto: 500,
                claveIdempotencia: "IDEM-CHAT-2",
                fechaOperacion: CORTE
            }),
            dice("El monto correcto es Q370.85, no Q500.00.")
        ]);

        const r = await chat.preguntar(
            "Registra un pago de Q500 sobre CV-2026-0061"
        );

        expect(r.tipo).toBe("respuesta");
        expect(chat.pagoPendiente()).toBeUndefined();

        const error = ultimoResultado(chat);
        expect(error.codigo).toBe("MONTO_NO_EXACTO");

        const detalle = error.detalle as Record<string, unknown>;
        expect(detalle.montoCorrecto).toBe(370.85);
    });

    it("Un credito incobrable tampoco pide aprobacion", async () => {

        const { chat } = await armar([
            llama("registrar_pago", {
                idCredito: "CV-2026-0015",
                monto: 298.22,
                claveIdempotencia: "IDEM-CHAT-3",
                fechaOperacion: CORTE
            }),
            dice("Ese credito lleva 130 dias y debe darse de baja.")
        ]);

        const r = await chat.preguntar("Registra el pago de CV-2026-0015");

        expect(r.tipo).toBe("respuesta");
        expect(ultimoResultado(chat).codigo).toBe("CREDITO_INCOBRABLE");
    });
});

describe("Orquestador - errores y limites", () => {

    it("Un error de la herramienta vuelve al modelo, no rompe el chat",
        async () => {

            const { chat } = await armar([
                llama("consultar_credito", {
                    idCredito: "CV-9999-9999",
                    fechaCorte: CORTE
                }),
                dice("Ese credito no existe en la cartera.")
            ]);

            const r = await chat.preguntar("Estado de CV-9999-9999");

            expect(r.tipo).toBe("respuesta");
            expect(ultimoResultado(chat).codigo)
                .toBe("CREDITO_INEXISTENTE");
        });

    it("Argumentos que el esquema rechaza se normalizan como error",
        async () => {

            const { chat } = await armar([
                llama("consultar_credito", { idCredito: "no-es-un-id" }),
                dice("Necesito un identificador valido y la fecha de corte.")
            ]);

            await chat.preguntar("Estado de no-es-un-id");

            const error = ultimoResultado(chat);
            expect(error.error).toBe(true);
            expect(error.codigo).toBe("ENTRADA_INVALIDA");
        });

    it("Sin modulo documental, la consulta de politicas avisa", async () => {

        const { chat } = await armar(
            [
                llama("consultar_politicas", { pregunta: "la mora" }),
                dice("No tengo acceso al corpus en esta sesion.")
            ],
            false
        );

        await chat.preguntar("Que dice la politica de mora?");

        expect(ultimoResultado(chat).codigo).toBe("SIN_MODULO_DOCUMENTAL");
    });

    /**
     * Si el modelo se queda dando vueltas, el orquestador corta con un
     * aviso en vez de gastar llamadas sin fin.
     */
    it("Corta cuando el modelo da demasiadas vueltas", async () => {

        const vueltas: TurnoModelo[] = Array.from(
            { length: 8 },
            () => llama("consultar_cartera", { fechaCorte: CORTE })
        );

        const { chat } = await armar(vueltas);

        const r = await chat.preguntar("Como esta la cartera?");

        expect(r.tipo).toBe("respuesta");
        if (r.tipo !== "respuesta") return;

        expect(r.texto).toContain("demasiadas veces");
        expect(r.herramientasUsadas.length).toBeLessThanOrEqual(6);
    });
});
