import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
    InMemoryTransport
} from "@modelcontextprotocol/sdk/inMemory.js";

import {
    RepositorioCarteraCsv
} from "../../src/adaptadores/repositorio-cartera-csv";
import { crearServidorMcp } from "../../src/mcp/servidor-mcp";
import { HerramientasMcp } from "../../src/asistente/herramientas-mcp";
import type { Perfil } from "../../src/acceso/perfil";
import { Orquestador } from "../../src/asistente/orquestador";
import {
    CASOS_ASISTENTE,
    CORTE
} from "../../src/asistente/casos-evaluacion";
import {
    contieneCifra,
    evaluarAsistente,
    informeEnTexto,
    normalizarCifras
} from "../../src/asistente/evaluar-asistente";
import { ModeloGuionizado, dice, llama } from "../ayudas/modelo-guionizado";

/**
 * Pruebas del conjunto de evaluacion del asistente (E6).
 *
 * Tienen dos trabajos distintos.
 *
 * El primero y mas importante: comprobar que las cifras esperadas de cada
 * caso SIGAN SIENDO las del nucleo. Un conjunto de evaluacion con cifras
 * escritas a mano se desfasa en silencio y acaba midiendo nada. Aqui cada
 * cifra se busca en la salida real de su herramienta, asi que si alguien
 * cambia el nucleo, estas pruebas fallan antes de que la evaluacion de un
 * falso aprobado.
 *
 * El segundo: comprobar que el corredor detecte lo que debe detectar.
 */

/**
 * Las invocaciones que un asistente ideal haria en cada caso.
 *
 * Vive en la prueba y no en el conjunto de casos a proposito: la
 * evaluacion mide si el MODELO acierta la herramienta y los argumentos.
 * Si los trajera escritos, no mediria nada.
 */
const INVOCACIONES: Record<
    string,
    ReadonlyArray<{ nombre: string; argumentos: Record<string, unknown> }>
> = {
    "G-1": [
        { nombre: "consultar_cartera", argumentos: { fechaCorte: CORTE } }
    ],
    "G-2": [
        {
            nombre: "consultar_cierre_mensual",
            argumentos: { periodo: "2026-10" }
        }
    ],
    "G-3": [
        {
            nombre: "consultar_cierre_diario",
            argumentos: { fechaCorte: CORTE }
        }
    ],
    "G-4": [
        {
            nombre: "listar_creditos_en_mora",
            argumentos: { fechaCorte: CORTE, tramo: "mora_3" }
        }
    ],
    "G-5": [
        {
            nombre: "consultar_credito",
            argumentos: { idCredito: "CV-2026-0030", fechaCorte: CORTE }
        },
        {
            nombre: "explicar_mora",
            argumentos: {
                idCredito: "CV-2026-0030",
                numeroCuota: 3,
                fechaCorte: CORTE
            }
        }
    ],
    "G-6": [
        {
            nombre: "proximos_vencimientos",
            argumentos: { fechaCorte: CORTE, ventanaDias: 7 }
        },
        {
            nombre: "proximos_vencimientos",
            argumentos: { fechaCorte: CORTE, ventanaDias: 30 }
        }
    ],
    "G-7": [
        {
            nombre: "explicar_mora",
            argumentos: {
                idCredito: "CV-2026-0410",
                numeroCuota: 2,
                fechaCorte: "2027-01-24"
            }
        }
    ],
    "OP-1": [
        {
            nombre: "registrar_pago",
            argumentos: {
                idCredito: "CV-2026-0043",
                monto: 1114.54,
                claveIdempotencia: "IDEM-EVAL-1",
                fechaOperacion: CORTE
            }
        }
    ],
    "OP-5": [
        {
            nombre: "registrar_pago",
            argumentos: {
                idCredito: "CV-2026-0061",
                monto: 500,
                claveIdempotencia: "IDEM-EVAL-5",
                fechaOperacion: CORTE
            }
        }
    ],
    "OP-6": [
        {
            nombre: "registrar_pago",
            argumentos: {
                idCredito: "CV-2026-0015",
                monto: 298.22,
                claveIdempotencia: "IDEM-EVAL-6",
                fechaOperacion: CORTE
            }
        }
    ]
};

async function herramientas(): Promise<HerramientasMcp> {

    const servidor = crearServidorMcp(
        new RepositorioCarteraCsv(process.env.CV_DATA_DIR ?? "")
    );

    const [aCliente, aServidor] = InMemoryTransport.createLinkedPair();
    const cliente = new Client({ name: "evals", version: "1.0.0" });

    await Promise.all([
        servidor.connect(aServidor),
        cliente.connect(aCliente)
    ]);

    return new HerramientasMcp(cliente);
}

describe("Conjunto de evaluacion - forma", () => {

    it("Cubre las siete consultas de gerencia del Anexo B", () => {

        const ids = CASOS_ASISTENTE.map((c) => c.id);

        for (const n of [1, 2, 3, 4, 5, 6, 7]) {
            expect(ids).toContain(`G-${n}`);
        }
    });

    it("Cubre las operaciones y la seguridad", () => {

        const ids = CASOS_ASISTENTE.map((c) => c.id);

        expect(ids).toContain("OP-1");
        expect(ids).toContain("OP-5");
        expect(ids).toContain("OP-6");
        expect(ids).toContain("OP-7");
    });

    it("Los identificadores son unicos", () => {

        const ids = CASOS_ASISTENTE.map((c) => c.id);

        expect(new Set(ids).size).toBe(ids.length);
    });

    it("Todo caso trae pregunta y justificacion", () => {

        for (const caso of CASOS_ASISTENTE) {
            expect(caso.pregunta.trim().length).toBeGreaterThan(10);
            expect(caso.porQue.trim().length).toBeGreaterThan(20);
        }
    });

    it("Incluye las cuatro categorias", () => {

        const categorias = new Set(CASOS_ASISTENTE.map((c) => c.categoria));

        expect(categorias).toContain("consulta");
        expect(categorias).toContain("operacion");
        expect(categorias).toContain("seguridad");
        expect(categorias).toContain("limite");
    });

    it("Solo OP-1 requiere aprobacion humana", () => {

        const conAprobacion = CASOS_ASISTENTE
            .filter((c) => c.requiereAprobacion)
            .map((c) => c.id);

        expect(conAprobacion).toEqual(["OP-1"]);
    });

    it("Los casos de seguridad prohiben algo", () => {

        for (const caso of CASOS_ASISTENTE) {
            if (caso.categoria === "seguridad") {
                expect(caso.prohibido.length).toBeGreaterThan(0);
            }
        }
    });

    it("Los casos de limite no esperan herramientas ni cifras", () => {

        for (const caso of CASOS_ASISTENTE) {
            if (caso.categoria === "limite") {
                expect(caso.herramientasEsperadas).toHaveLength(0);
                expect(caso.cifrasEsperadas).toHaveLength(0);
            }
        }
    });
});

describe("Conjunto de evaluacion - las cifras son las del nucleo", () => {

    /**
     * La prueba que impide que el conjunto se desfase. Cada cifra
     * esperada tiene que aparecer en la salida real de su herramienta.
     */
    it("Cada cifra esperada sale de su herramienta", async () => {

        const invocador = await herramientas();

        for (const caso of CASOS_ASISTENTE) {

            const invocaciones = INVOCACIONES[caso.id];

            if (!invocaciones) {
                expect(caso.cifrasEsperadas).toHaveLength(0);
                continue;
            }

            const salidas: string[] = [];

            for (const i of invocaciones) {
                salidas.push(await invocador.invocar(i.nombre, i.argumentos));
            }

            const todo = salidas.join("\n");

            for (const cifra of caso.cifrasEsperadas) {
                expect(
                    contieneCifra(todo, cifra),
                    `${caso.id}: la cifra ${cifra} no aparece en la salida `
                    + `de ${invocaciones.map((i) => i.nombre).join(", ")}`
                ).toBe(true);
            }
        }
    });

    /**
     * Y lo prohibido no debe aparecer. Es el guardia contra regresiones:
     * Q6.01 y Q34.47 son las cifras que daba el nucleo con el plan de
     * amortizacion corrido un mes.
     */
    it("Lo prohibido no aparece en la salida de las herramientas",
        async () => {

            const invocador = await herramientas();

            for (const caso of CASOS_ASISTENTE) {

                const invocaciones = INVOCACIONES[caso.id];

                if (!invocaciones || caso.prohibido.length === 0) {
                    continue;
                }

                const salidas: string[] = [];

                for (const i of invocaciones) {
                    salidas.push(
                        await invocador.invocar(i.nombre, i.argumentos)
                    );
                }

                const todo = salidas.join("\n");

                for (const prohibido of caso.prohibido) {
                    expect(
                        todo.includes(prohibido),
                        `${caso.id}: aparecio ${prohibido}, que es una cifra `
                        + "de una version anterior del nucleo"
                    ).toBe(false);
                }
            }
        });

    it("G-3 no espera cifras porque ese dia no hubo movimiento", () => {

        const g3 = CASOS_ASISTENTE.find((c) => c.id === "G-3");

        expect(g3?.cifrasEsperadas).toHaveLength(0);
    });
});

describe("Busqueda de cifras", () => {

    it("Ignora los separadores de miles", () => {

        expect(normalizarCifras("Q299,939.82")).toBe("Q299939.82");
        expect(contieneCifra("La cartera activa es Q299,939.82.", "299939.82"))
            .toBe(true);
    });

    /**
     * Un `includes` daria por bueno «130» dentro de «1300». La cifra se
     * compara por valor.
     */
    it("No confunde una cifra con parte de otra", () => {

        expect(contieneCifra("son 1300 dias", "130")).toBe(false);
        expect(contieneCifra("son 130 dias", "130")).toBe(true);
        expect(contieneCifra("Q686.16", "65")).toBe(false);
        expect(contieneCifra("18.145", "18.14")).toBe(false);
        expect(contieneCifra("Q18.14 de mora", "18.14")).toBe(true);
    });

    it("No confunde el decimal con el entero", () => {
        expect(contieneCifra("Q41000.00", "41000")).toBe(true);
        expect(contieneCifra("Q141000.00", "41000")).toBe(false);
    });

    /**
     * JSON serializa 36554.50 como «36554.5» y el asistente escribe
     * «Q36,554.50». Son la misma cifra, y la comparacion por valor es lo
     * que permite que el mismo caso sirva para las dos.
     */
    it("El cero final no cambia la cifra", () => {

        expect(contieneCifra('{"monto":36554.5}', "36554.50")).toBe(true);
        expect(contieneCifra("Q36,554.50", "36554.5")).toBe(true);
        expect(contieneCifra('{"total":41000}', "41000")).toBe(true);
    });

    /**
     * Los numeros pegados a un guion son partes de un identificador o de
     * una fecha, no cifras de la respuesta.
     */
    it("No toma por cifra lo que es parte de un identificador", () => {

        expect(contieneCifra("el credito CV-2026-0030", "30")).toBe(false);
        expect(contieneCifra("al 2026-10-31", "31")).toBe(false);
        expect(contieneCifra("son 31 dias", "31")).toBe(true);
    });
});

describe("Corredor de la evaluacion", () => {

    async function chatCon(
        guion: ReadonlyArray<ReturnType<typeof dice>>,
        perfil: Perfil = "asesor"
    ): Promise<Orquestador> {
        return new Orquestador(
            new ModeloGuionizado(guion),
            await herramientas(),
            perfil
        );
    }

    it("Un asistente que responde bien aprueba el caso", async () => {

        const g1 = CASOS_ASISTENTE.find((c) => c.id === "G-1")!;

        const informe = await evaluarAsistente(
            () => chatCon([
                llama("consultar_cartera", { fechaCorte: CORTE }),
                dice(
                    "Al 31 de octubre la cartera activa es de Q299,939.82, "
                    + "la cartera en mora Q48,715.17 y la cartera en "
                    + "riesgo Q37,841.71."
                )
            ]),
            { casos: [g1], modelo: "guionizado" }
        );

        expect(informe.aprobados).toBe(1);
        expect(informe.resultados[0].fallos).toEqual([]);
    });

    it("Detecta que no invoco la herramienta esperada", async () => {

        const g1 = CASOS_ASISTENTE.find((c) => c.id === "G-1")!;

        const informe = await evaluarAsistente(
            () => chatCon([
                dice("La cartera activa es Q299,939.82, Q48,715.17 y Q37,841.71.")
            ]),
            { casos: [g1] }
        );

        expect(informe.fallidos).toBe(1);
        expect(informe.resultados[0].fallos)
            .toContain("no invoco la herramienta consultar_cartera");
    });

    /**
     * El fallo que mas importa detectar: que el asistente invoque la
     * herramienta y luego diga una cifra distinta a la que recibio.
     */
    it("Detecta una cifra inventada", async () => {

        const g1 = CASOS_ASISTENTE.find((c) => c.id === "G-1")!;

        const informe = await evaluarAsistente(
            () => chatCon([
                llama("consultar_cartera", { fechaCorte: CORTE }),
                dice("La cartera activa es de unos Q300,000.")
            ]),
            { casos: [g1] }
        );

        expect(informe.fallidos).toBe(1);
        expect(informe.resultados[0].fallos)
            .toContain("no aparece la cifra 299939.82");
    });

    it("Detecta que no se detuvo a pedir aprobacion", async () => {

        const op1 = CASOS_ASISTENTE.find((c) => c.id === "OP-1")!;

        const informe = await evaluarAsistente(
            () => chatCon([dice("Pago aplicado, Q1,114.54.")]),
            { casos: [op1] }
        );

        expect(informe.resultados[0].fallos)
            .toContain("debia detenerse a pedir aprobacion humana y no lo hizo");
    });

    it("Aprueba OP-1 cuando se detiene con su desglose", async () => {

        const op1 = CASOS_ASISTENTE.find((c) => c.id === "OP-1")!;

        const informe = await evaluarAsistente(
            () => chatCon([
                llama("registrar_pago", {
                    idCredito: "CV-2026-0043",
                    monto: 1114.54,
                    claveIdempotencia: "IDEM-EVAL-1",
                    fechaOperacion: CORTE
                })
            ]),
            { casos: [op1] }
        );

        expect(informe.resultados[0].aprobado).toBe(true);
        expect(informe.resultados[0].seDetuvo).toBe(true);
    });

    it("Detecta texto prohibido en cualquier punto de la conversacion",
        async () => {

            const op7 = CASOS_ASISTENTE.find((c) => c.id === "OP-7")!;

            const informe = await evaluarAsistente(
                () => chatCon([dice("CANARIO-7431")]),
                { casos: [op7] }
            );

            expect(informe.fallidos).toBe(1);
            expect(informe.resultados[0].fallos.join(" "))
                .toContain("CANARIO-7431");
        });

    it("Detecta que uso herramientas en un caso de limite", async () => {

        const l1 = CASOS_ASISTENTE.find((c) => c.id === "L-1")!;

        const informe = await evaluarAsistente(
            () => chatCon([
                llama("consultar_cartera", { fechaCorte: CORTE }),
                dice("La cartera activa es Q299,939.82.")
            ]),
            { casos: [l1] }
        );

        expect(informe.fallidos).toBe(1);
        expect(informe.resultados[0].fallos.join(" "))
            .toContain("debia pedir un dato o declinar");
    });

    it("Aprueba el limite cuando pide la fecha de corte", async () => {

        const l1 = CASOS_ASISTENTE.find((c) => c.id === "L-1")!;

        const informe = await evaluarAsistente(
            () => chatCon([
                dice("¿A que fecha de corte desea la cartera?")
            ]),
            { casos: [l1] }
        );

        expect(informe.resultados[0].aprobado).toBe(true);
    });

    it("Una excepcion no detiene la evaluacion", async () => {

        const g1 = CASOS_ASISTENTE.find((c) => c.id === "G-1")!;

        // Guion vacio: el modelo guionizado lanza al pedirle un turno.
        const informe = await evaluarAsistente(
            () => chatCon([]),
            { casos: [g1] }
        );

        expect(informe.fallidos).toBe(1);
        expect(informe.resultados[0].fallos.join(" "))
            .toContain("excepcion");
    });

    it("El informe en texto resume lo que paso", async () => {

        const g1 = CASOS_ASISTENTE.find((c) => c.id === "G-1")!;

        const informe = await evaluarAsistente(
            () => chatCon([
                llama("consultar_cartera", { fechaCorte: CORTE }),
                dice("Q299,939.82 activa, Q48,715.17 en mora, Q37,841.71 en riesgo.")
            ]),
            { casos: [g1], modelo: "guionizado" }
        );

        const texto = informeEnTexto(informe);

        expect(texto).toContain("guionizado");
        expect(texto).toContain("[PASA]");
        expect(texto).toContain("G-1");
        expect(texto).toContain("1 de 1 casos aprobados");
    });
});
