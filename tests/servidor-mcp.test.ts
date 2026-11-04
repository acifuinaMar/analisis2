import { describe, expect, it } from "vitest";
import {
    Client
} from "@modelcontextprotocol/sdk/client/index.js";
import {
    InMemoryTransport
} from "@modelcontextprotocol/sdk/inMemory.js";

import {
    RepositorioCarteraCsv
} from "../src/adaptadores/repositorio-cartera-csv";
import { crearServidorMcp } from "../src/mcp/servidor-mcp";

/**
 * Pruebas del servidor MCP (E6).
 *
 * El enunciado pide dos cosas de estas pruebas: "que devuelva lo mismo
 * que el nucleo, y que rechace lo que debe rechazar".
 *
 * Corren contra el adaptador CSV, no contra Postgres: deben ejecutarse
 * con npm test, rapido y sin red. Ese es el motivo por el que el
 * adaptador existe y por el que no se tira cuando llegue el E2.
 */
const CORTE = "2026-10-31";

async function clienteConectado(): Promise<Client> {

    const servidor = crearServidorMcp(
        new RepositorioCarteraCsv(process.env.CV_DATA_DIR ?? "")
    );

    const [transporteCliente, transporteServidor] =
        InMemoryTransport.createLinkedPair();

    const cliente = new Client({ name: "pruebas", version: "1.0.0" });

    await Promise.all([
        servidor.connect(transporteServidor),
        cliente.connect(transporteCliente)
    ]);

    return cliente;
}

/** Las herramientas devuelven JSON dentro de un bloque de texto. */
async function invocar(
    cliente: Client,
    nombre: string,
    argumentos: Record<string, unknown>
): Promise<Record<string, unknown>> {

    const respuesta = await cliente.callTool({
        name: nombre,
        arguments: argumentos
    });

    const contenido = (respuesta as {
        content: Array<{ type: string; text: string }>;
    }).content;

    return JSON.parse(contenido[0].text);
}

describe("Servidor MCP - herramientas expuestas", () => {

    it("Publica las herramientas del nucleo", async () => {

        const cliente = await clienteConectado();
        const { tools } = await cliente.listTools();

        const nombres = tools.map(t => t.name);

        expect(nombres).toContain("consultar_credito");
        expect(nombres).toContain("calcular_deuda_de_cuota");
        expect(nombres).toContain("explicar_mora");
        expect(nombres).toContain("listar_creditos_en_mora");
        expect(nombres).toContain("proximos_vencimientos");
        expect(nombres).toContain("consultar_cartera");
        expect(nombres).toContain("consultar_cierre_diario");
        expect(nombres).toContain("consultar_cierre_mensual");
        expect(nombres).toContain("registrar_pago");
    });

    it("Cada herramienta declara su esquema de entrada", async () => {

        const cliente = await clienteConectado();
        const { tools } = await cliente.listTools();

        for (const herramienta of tools) {
            expect(herramienta.inputSchema).toBeDefined();
            expect(herramienta.description).toBeTruthy();

            // Toda herramienta recibe el momento del calculo como
            // parametro: una fecha de corte, o un periodo AAAA-MM en el
            // caso del cierre mensual. Ninguna lo deduce del reloj del
            // sistema, que es el puerto Reloj del Proyecto 1.
            const propiedades = Object.keys(
                (herramienta.inputSchema as { properties?: object })
                    .properties ?? {}
            );

            expect(
                propiedades.includes("fechaCorte")
                || propiedades.includes("periodo")
                || propiedades.includes("fechaOperacion")
            ).toBe(true);
        }
    });
});

describe("Servidor MCP - devuelve lo mismo que el nucleo", () => {

    it("consultar_credito responde el estado de CV-2026-0030 (G-5)", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "consultar_credito", {
            idCredito: "CV-2026-0030",
            fechaCorte: CORTE
        });

        expect(r.idCredito).toBe("CV-2026-0030");
        expect(r.fechaCorte).toBe("2026-10-31");
        expect(r.estado).toBe("en_mora");
        expect(r.tramo).toBe("mora_3");
        expect(r.cuotasPagadas).toBe(2);
        expect(r.cuotasVencidas).toBe(3);
        expect(r.diasAtraso).toBe(65);
        expect(r.saldoCapital).toBe(686.16);
    });

    it("calcular_deuda_de_cuota desglosa los cuatro rubros", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "calcular_deuda_de_cuota", {
            idCredito: "CV-2026-0030",
            numeroCuota: 3,
            fechaCorte: CORTE
        });

        expect(r.gastos).toBeDefined();
        expect(r.interesMoratorio).toBeDefined();
        expect(r.interesCorriente).toBeDefined();
        expect(r.capital).toBeDefined();

        const suma = Math.round(
            ((r.gastos as number) + (r.interesMoratorio as number)
                + (r.interesCorriente as number) + (r.capital as number))
            * 100
        ) / 100;

        expect(r.totalExigible).toBe(suma);
    });
});

describe("Servidor MCP - rechaza lo que debe rechazar", () => {

    it("Credito inexistente devuelve CREDITO_INEXISTENTE", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "consultar_credito", {
            idCredito: "CV-9999-9999",
            fechaCorte: CORTE
        });

        expect(r.error).toBe(true);
        expect(r.codigo).toBe("CREDITO_INEXISTENTE");
    });

    it("Cuota inexistente devuelve CUOTA_INEXISTENTE", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "calcular_deuda_de_cuota", {
            idCredito: "CV-2026-0030",
            numeroCuota: 99,
            fechaCorte: CORTE
        });

        expect(r.codigo).toBe("CUOTA_INEXISTENTE");
    });

    it("Una fecha que no existe en el calendario se rechaza", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "consultar_credito", {
            idCredito: "CV-2026-0030",
            fechaCorte: "2026-02-31"
        });

        expect(r.codigo).toBe("FECHA_INVALIDA");
    });

    it("El esquema Zod rechaza un identificador mal formado", async () => {

        const cliente = await clienteConectado();

        // Esta validacion no llega al manejador: el SDK aplica el esquema
        // Zod en el borde del protocolo y responde isError. Es la prueba
        // de que los esquemas del E3 estan haciendo su trabajo.
        const respuesta = await cliente.callTool({
            name: "consultar_credito",
            arguments: {
                idCredito: "no-es-un-credito",
                fechaCorte: CORTE
            }
        }) as { isError?: boolean; content: Array<{ text: string }> };

        expect(respuesta.isError).toBe(true);
        expect(respuesta.content[0].text)
            .toContain("CV-AAAA-NNNN");
    });

    it("El esquema rechaza una fecha con formato invalido", async () => {

        const cliente = await clienteConectado();

        const respuesta = await cliente.callTool({
            name: "consultar_credito",
            arguments: {
                idCredito: "CV-2026-0030",
                fechaCorte: "31/10/2026"
            }
        }) as { isError?: boolean; content: Array<{ text: string }> };

        expect(respuesta.isError).toBe(true);
        expect(respuesta.content[0].text).toContain("AAAA-MM-DD");
    });
});

describe("Servidor MCP - la fecha de corte es parametro (G-7)", () => {

    it("Acepta una fecha futura sin consultar el reloj", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "consultar_credito", {
            idCredito: "CV-2026-0030",
            fechaCorte: "2027-01-24"
        });

        expect(r.fechaCorte).toBe("2027-01-24");
        expect(r.error).toBeUndefined();
    });

    it("Dos cortes distintos dan atrasos distintos", async () => {

        const cliente = await clienteConectado();

        const octubre = await invocar(cliente, "consultar_credito", {
            idCredito: "CV-2026-0030",
            fechaCorte: CORTE
        });

        const enero = await invocar(cliente, "consultar_credito", {
            idCredito: "CV-2026-0030",
            fechaCorte: "2027-01-31"
        });

        expect(enero.diasAtraso as number)
            .toBeGreaterThan(octubre.diasAtraso as number);
    });
});

describe("Servidor MCP - solo lectura por defecto", () => {

    /**
     * El enunciado pide que el asistente sea de solo lectura salvo una
     * accion. Eso no se declara en un comentario: se declara en el
     * protocolo, con las anotaciones que el cliente MCP lee para decidir
     * si puede aprobar sola una llamada.
     */
    it("Solo una herramienta escribe, y es registrar_pago", async () => {

        const cliente = await clienteConectado();
        const { tools } = await cliente.listTools();

        const escriben = tools.filter(
            herramienta => herramienta.annotations?.readOnlyHint !== true
        );

        expect(escriben).toHaveLength(1);
        expect(escriben[0].name).toBe("registrar_pago");
        expect(escriben[0].annotations?.destructiveHint).toBe(true);
    });

    it("Las otras siete se declaran de solo lectura", async () => {

        const cliente = await clienteConectado();
        const { tools } = await cliente.listTools();

        const lectura = tools.filter(
            herramienta => herramienta.name !== "registrar_pago"
        );

        expect(lectura.length).toBeGreaterThanOrEqual(7);

        for (const herramienta of lectura) {
            expect(herramienta.annotations?.readOnlyHint).toBe(true);
            expect(herramienta.annotations?.idempotentHint).toBe(true);
        }
    });

    it("Consultar dos veces no altera el resultado", async () => {

        const cliente = await clienteConectado();

        const a = await invocar(cliente, "consultar_credito", {
            idCredito: "CV-2026-0030",
            fechaCorte: CORTE
        });

        const b = await invocar(cliente, "consultar_credito", {
            idCredito: "CV-2026-0030",
            fechaCorte: CORTE
        });

        expect(a).toEqual(b);
    });
});


describe("Servidor MCP - listar_creditos_en_mora (G-4)", () => {

    it("Lista los creditos en Mora 3 al corte", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "listar_creditos_en_mora", {
            fechaCorte: CORTE,
            tramo: "mora_3"
        });

        expect(r.fechaCorte).toBe("2026-10-31");
        expect(r.tramoFiltrado).toBe("mora_3");
        expect(r.cantidad).toBe(2);
        expect(r.saldoCapitalTotal).toBe(1954.26);

        const creditos = r.creditos as Array<Record<string, unknown>>;
        expect(creditos.map(c => c.idCredito))
            .toEqual(["CV-2026-0035", "CV-2026-0030"]);
        expect(creditos.map(c => c.diasAtraso)).toEqual([70, 65]);
    });

    it("Sin tramo devuelve toda la cartera en mora", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "listar_creditos_en_mora", {
            fechaCorte: CORTE
        });

        expect(r.cantidad).toBe(16);
        expect(r.tramoFiltrado).toBeNull();
    });

    /**
     * El esquema solo admite los cuatro tramos de mora. Pedir "al_dia" a
     * una herramienta que lista morosos es una contradiccion, y el SDK la
     * rechaza en el borde del protocolo antes de que el nucleo se entere.
     */
    it("Rechaza un tramo que no es de mora", async () => {

        const cliente = await clienteConectado();

        const respuesta = await cliente.callTool({
            name: "listar_creditos_en_mora",
            arguments: { fechaCorte: CORTE, tramo: "al_dia" }
        });

        expect(respuesta.isError).toBe(true);
    });

    it("Rechaza una fecha de corte mal formada", async () => {

        const cliente = await clienteConectado();

        const respuesta = await cliente.callTool({
            name: "listar_creditos_en_mora",
            arguments: { fechaCorte: "31/10/2026" }
        });

        expect(respuesta.isError).toBe(true);
    });

    /**
     * G-4 es la consulta "tablero -> detalle": la cifra del listado y la
     * del detalle se muestran dos veces y deben coincidir. Se comprueba
     * atravesando el protocolo MCP, no solo el servicio.
     */
    it("La linea del listado coincide con consultar_credito", async () => {

        const cliente = await clienteConectado();

        const listado = await invocar(cliente, "listar_creditos_en_mora", {
            fechaCorte: CORTE,
            tramo: "mora_3"
        });

        const linea = (listado.creditos as Array<Record<string, unknown>>)[1];

        const detalle = await invocar(cliente, "consultar_credito", {
            idCredito: linea.idCredito as string,
            fechaCorte: CORTE
        });

        expect(detalle.idCredito).toBe("CV-2026-0030");
        expect(detalle.diasAtraso).toBe(linea.diasAtraso);
        expect(detalle.tramo).toBe(linea.tramo);
        expect(detalle.saldoCapital).toBe(linea.saldoCapital);
    });
});


describe("Servidor MCP - proximos_vencimientos (G-6)", () => {

    it("Responde las dos ventanas que pide la gerencia", async () => {

        const cliente = await clienteConectado();

        const siete = await invocar(cliente, "proximos_vencimientos", {
            fechaCorte: CORTE,
            ventanaDias: 7
        });

        expect(siete.hasta).toBe("2026-11-07");
        expect(siete.cantidadCuotas).toBe(10);
        expect(siete.montoTotal).toBe(7001.31);

        const treinta = await invocar(cliente, "proximos_vencimientos", {
            fechaCorte: CORTE,
            ventanaDias: 30
        });

        expect(treinta.hasta).toBe("2026-11-30");
        expect(treinta.cantidadCuotas).toBe(65);
        expect(treinta.montoTotal).toBe(45960.55);
    });

    it("La ventana es obligatoria", async () => {

        const cliente = await clienteConectado();

        const respuesta = await cliente.callTool({
            name: "proximos_vencimientos",
            arguments: { fechaCorte: CORTE }
        });

        expect(respuesta.isError).toBe(true);
    });

    it("Rechaza ventanas fuera de rango", async () => {

        const cliente = await clienteConectado();

        for (const ventanaDias of [0, 366, 7.5]) {

            const respuesta = await cliente.callTool({
                name: "proximos_vencimientos",
                arguments: { fechaCorte: CORTE, ventanaDias }
            });

            expect(respuesta.isError).toBe(true);
        }
    });
});

describe("Servidor MCP - consultar_cartera (G-1)", () => {

    it("Responde el tablero gerencial al corte", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "consultar_cartera", {
            fechaCorte: CORTE
        });

        expect(r.fechaCorte).toBe("2026-10-31");
        expect(r.carteraActiva).toBe(299939.82);
        expect(r.carteraEnMora).toBe(48715.17);
        expect(r.montoEnRiesgo).toBe(37841.71);
        expect(r.dadoPorIncobrable).toBe(0);
        expect(r.candidatosAIncobrable).toBe(2);
    });

    it("Trae el desglose por tramo, no solo el agregado", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "consultar_cartera", {
            fechaCorte: CORTE
        });

        const desglose = r.desglosePorTramo as Array<
            Record<string, unknown>
        >;

        expect(desglose).toHaveLength(5);
        expect(desglose.map(f => f.categoria)).toEqual([
            "mora_1",
            "mora_2",
            "mora_3",
            "vencido",
            "reestructurado_al_dia"
        ]);
    });

    /**
     * G-1 y G-4 son de doble verificacion. Se comprueba atravesando el
     * protocolo, que es como las va a consumir el asistente: si el
     * tablero y su detalle no cuadran, el chat se contradice.
     */
    it("El tablero cuadra con el listado de morosos", async () => {

        const cliente = await clienteConectado();

        const cartera = await invocar(cliente, "consultar_cartera", {
            fechaCorte: CORTE
        });

        const listado = await invocar(cliente, "listar_creditos_en_mora", {
            fechaCorte: CORTE
        });

        expect(cartera.carteraEnMora).toBe(listado.saldoCapitalTotal);
    });
});


describe("Servidor MCP - consultar_cierre (G-2 y G-3)", () => {

    it("El cierre mensual de octubre trae los conceptos", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "consultar_cierre_mensual", {
            periodo: "2026-10"
        });

        expect(r.id).toBe("CIE-2026-10");
        expect(r.desde).toBe("2026-10-01");
        expect(r.hasta).toBe("2026-10-31");
        expect(r.flujoNeto).toBe(-4445.50);

        const desembolsos = r.desembolsos as Record<string, unknown>;
        expect(desembolsos.cantidad).toBe(10);
        expect(desembolsos.monto).toBe(41000);

        const recuperaciones = r.recuperaciones as Record<string, unknown>;
        expect(recuperaciones.interesMoratorio).toBe(16.93);
        expect(recuperaciones.interesCorriente).toBe(7162.89);
        expect(recuperaciones.capital).toBe(29374.68);
        expect(recuperaciones.total).toBe(36554.50);
    });

    /**
     * El 31 de octubre no hubo movimiento. El cierre en ceros es la
     * respuesta correcta, y el asistente debe poder distinguirla de un
     * error: por eso trae las cantidades y no solo los montos.
     */
    it("El cierre diario del 31 de octubre viene en ceros", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "consultar_cierre_diario", {
            fechaCorte: CORTE
        });

        expect(r.id).toBe("CIE-2026-10-31");
        expect(r.error).toBeUndefined();
        expect((r.pagos as Record<string, unknown>).cantidad).toBe(0);
        expect((r.recuperaciones as Record<string, unknown>).total).toBe(0);
    });

    it("Reejecutar el cierre no cambia el resultado", async () => {

        const cliente = await clienteConectado();

        const a = await invocar(cliente, "consultar_cierre_mensual", {
            periodo: "2026-10"
        });
        const b = await invocar(cliente, "consultar_cierre_mensual", {
            periodo: "2026-10"
        });

        expect(b).toEqual(a);
    });

    it("Rechaza un periodo que no es AAAA-MM", async () => {

        const cliente = await clienteConectado();

        for (const periodo of ["2026-13", "octubre", "2026-10-31"]) {

            const respuesta = await cliente.callTool({
                name: "consultar_cierre_mensual",
                arguments: { periodo }
            });

            expect(respuesta.isError).toBe(true);
        }
    });

    /**
     * El cierre mensual recibe un periodo y el diario una fecha, pero
     * ninguno acepta que se los omita: el momento del calculo siempre
     * llega como parametro y nunca sale del reloj.
     */
    it("Ninguno de los dos cierres asume el mes o el dia actual",
        async () => {

            const cliente = await clienteConectado();

            for (const name of [
                "consultar_cierre_mensual",
                "consultar_cierre_diario"
            ]) {
                const respuesta = await cliente.callTool({
                    name,
                    arguments: {}
                });

                expect(respuesta.isError).toBe(true);
            }
        });
});


describe("Servidor MCP - registrar_pago (OP-1 a OP-6)", () => {

    const EXACTO_0043 = 1114.54;

    /**
     * La barrera de aprobacion vista desde el protocolo: la llamada sin
     * `confirmado` responde el desglose y no mueve nada. El asistente lo
     * muestra, la persona aprueba, y solo entonces se vuelve a llamar.
     */
    it("Sin confirmado devuelve la vista previa (OP-1)", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "registrar_pago", {
            idCredito: "CV-2026-0043",
            monto: EXACTO_0043,
            claveIdempotencia: "IDEM-OP-1",
            fechaOperacion: CORTE
        });

        expect(r.aplicado).toBe(false);
        expect(r.estadoDespues).toBeUndefined();
        expect(r.cuotasCubiertas).toEqual([1, 2]);

        const desglose = r.desglosePrelacion as Record<string, unknown>;
        expect(desglose.total).toBe(EXACTO_0043);

        // Y el credito sigue igual despues de la vista previa.
        const estado = await invocar(cliente, "consultar_credito", {
            idCredito: "CV-2026-0043",
            fechaCorte: CORTE
        });

        expect(estado.estado).toBe("en_mora");
        expect(estado.saldoCapital).toBe(3000);
    });

    it("Con confirmado aplica y regulariza el credito (OP-1)", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "registrar_pago", {
            idCredito: "CV-2026-0043",
            monto: EXACTO_0043,
            claveIdempotencia: "IDEM-OP-1",
            fechaOperacion: CORTE,
            confirmado: true
        });

        expect(r.aplicado).toBe(true);

        const despues = r.estadoDespues as Record<string, unknown>;
        expect(despues.estado).toBe("vigente");
        expect(despues.cuotasVencidas).toBe(0);
        expect(despues.saldoCapital).toBe(2048.96);
    });

    it("El reintento con la misma clave no vuelve a cobrar (OP-4)",
        async () => {

            const cliente = await clienteConectado();

            const argumentos = {
                idCredito: "CV-2026-0043",
                monto: EXACTO_0043,
                claveIdempotencia: "IDEM-OP-1",
                fechaOperacion: CORTE,
                confirmado: true
            };

            const primero = await invocar(
                cliente, "registrar_pago", argumentos
            );
            expect(primero.aplicado).toBe(true);

            const reintento = await invocar(
                cliente, "registrar_pago", argumentos
            );

            expect(reintento.aplicado).toBe(false);
            expect(reintento.duplicado).toBe(true);

            // Y el cierre del dia sigue con un solo pago.
            const cierre = await invocar(
                cliente, "consultar_cierre_diario", { fechaCorte: CORTE }
            );

            expect((cierre.pagos as Record<string, unknown>).cantidad)
                .toBe(1);
        });

    it("Rechaza el monto no exacto y dice el correcto (OP-5)", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "registrar_pago", {
            idCredito: "CV-2026-0061",
            monto: 500.00,
            claveIdempotencia: "IDEM-OP-5",
            fechaOperacion: CORTE,
            confirmado: true
        });

        expect(r.error).toBe(true);
        expect(r.codigo).toBe("MONTO_NO_EXACTO");

        const detalle = r.detalle as Record<string, unknown>;
        expect(detalle.montoCorrecto).toBe(370.85);
        expect(detalle.diferencia).toBe(129.15);
    });

    it("Rechaza el credito incobrable (OP-6)", async () => {

        const cliente = await clienteConectado();

        const r = await invocar(cliente, "registrar_pago", {
            idCredito: "CV-2026-0015",
            monto: 298.22,
            claveIdempotencia: "IDEM-OP-6",
            fechaOperacion: CORTE,
            confirmado: true
        });

        expect(r.error).toBe(true);
        expect(r.codigo).toBe("CREDITO_INCOBRABLE");
        expect((r.detalle as Record<string, unknown>).diasAtraso).toBe(130);
    });

    it("La clave de idempotencia es obligatoria", async () => {

        const cliente = await clienteConectado();

        const respuesta = await cliente.callTool({
            name: "registrar_pago",
            arguments: {
                idCredito: "CV-2026-0043",
                monto: EXACTO_0043,
                fechaOperacion: CORTE,
                confirmado: true
            }
        });

        expect(respuesta.isError).toBe(true);
    });

    it("Rechaza montos no positivos y canales desconocidos", async () => {

        const cliente = await clienteConectado();

        const invalidos = [
            { monto: 0 },
            { monto: -100 },
            { canal: "bitcoin" }
        ];

        for (const extra of invalidos) {

            const respuesta = await cliente.callTool({
                name: "registrar_pago",
                arguments: {
                    idCredito: "CV-2026-0043",
                    monto: EXACTO_0043,
                    claveIdempotencia: "IDEM-Z",
                    fechaOperacion: CORTE,
                    confirmado: true,
                    ...extra
                }
            });

            expect(respuesta.isError).toBe(true);
        }
    });
});
