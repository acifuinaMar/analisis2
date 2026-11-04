import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
    InMemoryTransport
} from "@modelcontextprotocol/sdk/inMemory.js";

import type { Perfil } from "../src/acceso/perfil";
import {
    RepositorioCarteraCsv
} from "../src/adaptadores/repositorio-cartera-csv";
import { crearApp } from "../src/api/app";
import { SesionesChat } from "../src/api/sesiones-chat";
import { HerramientasMcp } from "../src/asistente/herramientas-mcp";
import { Orquestador } from "../src/asistente/orquestador";
import type { TurnoModelo } from "../src/asistente/modelo-lenguaje";
import { crearServidorMcp } from "../src/mcp/servidor-mcp";
import { ModeloGuionizado, dice, llama } from "./ayudas/modelo-guionizado";

/**
 * Las rutas del chat gerencial (E5), probadas por HTTP real.
 *
 * El enunciado pide que el chat viva DENTRO de la aplicacion del E1 y
 * no en una terminal. Estas rutas son el puente, y lo que se prueba
 * aqui es el puente: la memoria entre peticiones, que el perfil no se
 * pueda cambiar a mitad de la conversacion, y que aprobar un pago siga
 * siendo cosa del asesor por este camino tambien.
 *
 * El modelo es GUIONIZADO, asi que no hace falta clave ni red. El
 * servidor MCP de atras si es el de verdad, con el paquete canonico: lo
 * unico que se sustituye es la parte que no es determinista.
 */

const DATOS = resolve(process.env.CV_DATA_DIR ?? "./datos");
const CORTE = "2026-10-31";

/** La cuota vencida de CV-2026-0043, como en las demas pruebas. */
const PAGO = {
    idCredito: "CV-2026-0043",
    monto: 1114.54,
    claveIdempotencia: "IDEM-API-CHAT",
    fechaOperacion: CORTE
};

const servidores: Server[] = [];

afterEach(async () => {
    await Promise.all(
        servidores.splice(0).map((s) => new Promise((r) => s.close(r)))
    );
});

interface ClienteHttp {
    post(ruta: string, cuerpo: unknown, perfil?: string): Promise<Rta>;
    del(ruta: string, perfil?: string): Promise<Rta>;
}

interface Rta {
    estado: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cuerpo: any;
}

/**
 * Levanta la API con un chat guionizado.
 *
 * `conChat` en falso deja la API sin fabrica, que es como corre cuando
 * no hay GEMINI_API_KEY.
 */
async function iniciar(
    guion: ReadonlyArray<TurnoModelo> = [],
    conChat = true
): Promise<ClienteHttp> {

    const repositorio = new RepositorioCarteraCsv(DATOS);

    const crearChat = async (perfil: Perfil) => {

        const servidorMcp = crearServidorMcp(new RepositorioCarteraCsv(DATOS));
        const [aCliente, aServidor] = InMemoryTransport.createLinkedPair();
        const cliente = new Client({ name: "pruebas", version: "1.0.0" });

        await Promise.all([
            servidorMcp.connect(aServidor),
            cliente.connect(aCliente)
        ]);

        return new Orquestador(
            new ModeloGuionizado(guion),
            new HerramientasMcp(cliente),
            perfil
        );
    };

    const app = crearApp({
        repositorio,
        registrarError: () => {},
        ...(conChat ? { crearChat } : {})
    });

    const servidor = await new Promise<Server>((ok) => {
        const s = app.listen(0, "127.0.0.1", () => ok(s));
    });
    servidores.push(servidor);

    const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

    const llamar = async (
        metodo: string,
        ruta: string,
        perfil?: string,
        cuerpo?: unknown
    ): Promise<Rta> => {

        const r = await fetch(base + ruta, {
            method: metodo,
            headers: {
                ...(perfil ? { "X-Perfil": perfil } : {}),
                ...(cuerpo !== undefined
                    ? { "Content-Type": "application/json" }
                    : {})
            },
            body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
        });

        const texto = await r.text();

        return { estado: r.status, cuerpo: texto ? JSON.parse(texto) : undefined };
    };

    return {
        post: (ruta, cuerpo, perfil) => llamar("POST", ruta, perfil, cuerpo),
        del: (ruta, perfil) => llamar("DELETE", ruta, perfil)
    };
}

describe("Chat por HTTP - disponibilidad y perfiles", { timeout: 60_000 }, () => {

    /**
     * Sin modelo configurado la API entera no se cae: solo el chat
     * queda fuera. El tablero y los pagos no tienen por que depender de
     * que haya un modelo de lenguaje disponible.
     */
    it("Sin fabrica de chat: 503 y el resto de la API sigue viva", async () => {

        const api = await iniciar([], false);

        const r = await api.post("/api/chat", { pregunta: "hola" }, "gerencia");

        expect(r.estado).toBe(503);
        expect(r.cuerpo).toMatchObject({ codigo: "CHAT_NO_DISPONIBLE" });
    });

    it("Sin X-Perfil: 401, como en toda la API", async () => {

        const api = await iniciar([dice("hola")]);

        const r = await api.post("/api/chat", { pregunta: "hola" });

        expect(r.estado).toBe(401);
        expect(r.cuerpo).toMatchObject({ codigo: "PERFIL_REQUERIDO" });
    });

    it("Pregunta vacia: 400 y no abre conversacion", async () => {

        const api = await iniciar([dice("hola")]);

        const r = await api.post("/api/chat", { pregunta: "   " }, "gerencia");

        expect(r.estado).toBe(400);
        expect(r.cuerpo).toMatchObject({ codigo: "VALIDACION" });
    });
});

describe("Chat por HTTP - la memoria de la sesion", { timeout: 60_000 }, () => {

    it("La primera pregunta abre la conversacion y responde", async () => {

        const api = await iniciar([dice("La cartera esta sana.")]);

        const r = await api.post(
            "/api/chat",
            { pregunta: "Como esta la cartera?" },
            "gerencia"
        );

        expect(r.estado).toBe(200);
        expect(r.cuerpo.tipo).toBe("respuesta");
        expect(r.cuerpo.texto).toBe("La cartera esta sana.");
        expect(r.cuerpo.idSesion).toMatch(/^[0-9a-f-]{36}$/);
    });

    /**
     * El E5 exige contexto entre preguntas encadenadas, y HTTP no
     * recuerda nada: si la segunda pregunta abriera una conversacion
     * nueva, «y de ese credito, cuanto debe?» no tendria a que
     * referirse.
     */
    it("La segunda pregunta con el mismo id conserva el contexto",
        async () => {

            const api = await iniciar([
                dice("Primera."),
                dice("Segunda.")
            ]);

            const uno = await api.post(
                "/api/chat", { pregunta: "Primera pregunta" }, "gerencia"
            );

            const dos = await api.post(
                "/api/chat",
                { pregunta: "Segunda pregunta", idSesion: uno.cuerpo.idSesion },
                "gerencia"
            );

            expect(dos.estado).toBe(200);
            expect(dos.cuerpo.idSesion).toBe(uno.cuerpo.idSesion);
            expect(dos.cuerpo.texto).toBe("Segunda.");
        });

    it("Un id que no existe: 404, no una conversacion nueva en silencio",
        async () => {

            const api = await iniciar([dice("hola")]);

            const r = await api.post(
                "/api/chat",
                {
                    pregunta: "hola",
                    idSesion: "00000000-0000-4000-8000-000000000000"
                },
                "gerencia"
            );

            expect(r.estado).toBe(404);
            expect(r.cuerpo).toMatchObject({ codigo: "SESION_INEXISTENTE" });
        });

    /**
     * LA PROPIEDAD MAS IMPORTANTE DEL ARCHIVO.
     *
     * Si la sesion aceptara cualquier perfil, el chat volveria a ser la
     * puerta de atras de los permisos por otro camino: abrir la
     * conversacion como gerencia, pedir el pago, y cambiar el
     * encabezado a asesor para aprobarlo.
     */
    it("La conversacion no se puede continuar con otro perfil", async () => {

        const api = await iniciar([dice("hola"), dice("otra vez")]);

        const abierta = await api.post(
            "/api/chat", { pregunta: "hola" }, "gerencia"
        );

        const robada = await api.post(
            "/api/chat",
            { pregunta: "sigo yo", idSesion: abierta.cuerpo.idSesion },
            "asesor"
        );

        expect(robada.estado).toBe(404);
        expect(robada.cuerpo).toMatchObject({ codigo: "SESION_INEXISTENTE" });
    });

    it("Cerrar la conversacion la termina de verdad", async () => {

        const api = await iniciar([dice("hola"), dice("otra")]);

        const abierta = await api.post(
            "/api/chat", { pregunta: "hola" }, "gerencia"
        );

        const cerrada = await api.del(
            `/api/chat/${abierta.cuerpo.idSesion}`, "gerencia"
        );

        expect(cerrada.estado).toBe(204);

        const despues = await api.post(
            "/api/chat",
            { pregunta: "sigo", idSesion: abierta.cuerpo.idSesion },
            "gerencia"
        );

        expect(despues.estado).toBe(404);
    });
});

describe("Chat por HTTP - el pago y quien lo aprueba", { timeout: 60_000 }, () => {

    const guion = (): TurnoModelo[] => [
        llama("registrar_pago", PAGO),
        dice("Listo.")
    ];

    it("Gerencia ve la vista previa pero no puede aprobar", async () => {

        const api = await iniciar(guion());

        const propuesta = await api.post(
            "/api/chat",
            { pregunta: "Registra el pago de CV-2026-0043" },
            "gerencia"
        );

        expect(propuesta.estado).toBe(200);
        expect(propuesta.cuerpo.tipo).toBe("aprobacion_requerida");

        // La vista previa es lectura: el desglose se ve y nada se aplico.
        expect(propuesta.cuerpo.propuesta.vistaPrevia.aplicado).toBe(false);
        expect(propuesta.cuerpo.propuesta.vistaPrevia.desglosePrelacion)
            .toBeDefined();

        // Y la interfaz sabe que no debe pintar el boton.
        expect(propuesta.cuerpo.puedeAprobar).toBe(false);

        // Pero ocultar el boton no es el control: la ruta tambien niega.
        const intento = await api.post(
            "/api/chat/aprobar",
            { idSesion: propuesta.cuerpo.idSesion },
            "gerencia"
        );

        expect(intento.estado).toBe(403);
        expect(intento.cuerpo).toMatchObject({ codigo: "PERFIL_SIN_PERMISO" });
    });

    it("El asesor aprueba y el pago se aplica", async () => {

        const api = await iniciar(guion());

        const propuesta = await api.post(
            "/api/chat",
            { pregunta: "Registra el pago de CV-2026-0043" },
            "asesor"
        );

        expect(propuesta.cuerpo.tipo).toBe("aprobacion_requerida");
        expect(propuesta.cuerpo.puedeAprobar).toBe(true);

        const aprobado = await api.post(
            "/api/chat/aprobar",
            { idSesion: propuesta.cuerpo.idSesion },
            "asesor"
        );

        expect(aprobado.estado).toBe(200);
        expect(aprobado.cuerpo.tipo).toBe("respuesta");
        expect(aprobado.cuerpo.herramientasUsadas)
            .toContain("registrar_pago");
    });

    it("Aprobar sin nada pendiente: 409", async () => {

        const api = await iniciar([dice("hola")]);

        const abierta = await api.post(
            "/api/chat", { pregunta: "hola" }, "asesor"
        );

        const r = await api.post(
            "/api/chat/aprobar",
            { idSesion: abierta.cuerpo.idSesion },
            "asesor"
        );

        expect(r.estado).toBe(409);
        expect(r.cuerpo).toMatchObject({ codigo: "SIN_PAGO_PENDIENTE" });
    });

    /** Decir que no lo puede cualquiera: rechazar no mueve dinero. */
    it("Gerencia si puede rechazar la propuesta", async () => {

        const api = await iniciar(guion());

        const propuesta = await api.post(
            "/api/chat",
            { pregunta: "Registra el pago de CV-2026-0043" },
            "gerencia"
        );

        const r = await api.post(
            "/api/chat/rechazar",
            { idSesion: propuesta.cuerpo.idSesion, motivo: "no toca" },
            "gerencia"
        );

        expect(r.estado).toBe(200);
        expect(r.cuerpo.tipo).toBe("respuesta");
    });
});

/**
 * El registro de conversaciones, por dentro.
 *
 * Se prueba con un reloj inyectado para no esperar media hora, y con un
 * tope pequeno para no abrir cincuenta conversaciones.
 */
describe("Registro de conversaciones", () => {

    const fabricaBoba = async (perfil: Perfil) =>
        ({ perfilDeLaSesion: () => perfil }) as unknown as Orquestador;

    it("Una conversacion sin usar vence y deja de existir", async () => {

        let reloj = 0;
        const registro = new SesionesChat(fabricaBoba, {
            vidaMs: 1000,
            ahora: () => reloj
        });

        const { idSesion } = await registro.abrir("gerencia");

        expect(registro.obtener(idSesion, "gerencia")).toBeDefined();

        reloj = 1001;

        expect(() => registro.obtener(idSesion, "gerencia")).toThrow();
        expect(registro.vivas()).toBe(0);
    });

    it("Usarla renueva su tiempo", async () => {

        let reloj = 0;
        const registro = new SesionesChat(fabricaBoba, {
            vidaMs: 1000,
            ahora: () => reloj
        });

        const { idSesion } = await registro.abrir("gerencia");

        reloj = 900;
        registro.obtener(idSesion, "gerencia");

        reloj = 1700;

        expect(registro.obtener(idSesion, "gerencia")).toBeDefined();
    });

    /**
     * Sin tope, cada recarga del navegador dejaria una conversacion
     * viva para siempre y la memoria creceria sin limite.
     */
    it("Al llegar al tope se desaloja la mas vieja", async () => {

        let reloj = 0;
        const registro = new SesionesChat(fabricaBoba, {
            maxSesiones: 2,
            ahora: () => reloj++
        });

        const vieja = await registro.abrir("gerencia");
        await registro.abrir("gerencia");
        await registro.abrir("gerencia");

        expect(registro.vivas()).toBeLessThanOrEqual(2);
        expect(() => registro.obtener(vieja.idSesion, "gerencia")).toThrow();
    });

    it("El perfil queda atado a la conversacion", async () => {

        const registro = new SesionesChat(fabricaBoba);

        const { idSesion } = await registro.abrir("asesor");

        expect(registro.obtener(idSesion, "asesor")).toBeDefined();
        expect(() => registro.obtener(idSesion, "gerencia")).toThrow();
    });

    it("Cerrar con otro perfil no cierra la conversacion de nadie",
        async () => {

            const registro = new SesionesChat(fabricaBoba);

            const { idSesion } = await registro.abrir("asesor");

            registro.cerrar(idSesion, "gerencia");

            expect(registro.obtener(idSesion, "asesor")).toBeDefined();
        });
});
