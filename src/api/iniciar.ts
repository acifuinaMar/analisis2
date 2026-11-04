import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
    InMemoryTransport
} from "@modelcontextprotocol/sdk/inMemory.js";

import { ModeloGemini } from "../adaptadores/modelo-gemini";
import { RepositorioCarteraPostgres } from "../adaptadores/repositorio-cartera-postgres";
import { HerramientasMcp } from "../asistente/herramientas-mcp";
import type { ConsultaDocumental } from "../asistente/modelo-lenguaje";
import { Orquestador } from "../asistente/orquestador";
import { crearServidorMcp } from "../mcp/servidor-mcp";
import { abrirBaseDatos } from "../persistencia/base-datos";
import { responderPregunta } from "../rag/responderPregunta";
import type { RepositorioCartera } from "../dominio/repositorio-cartera";
import { crearApp } from "./app";
import type { FabricaChat } from "./sesiones-chat";

/** El modulo documental del E4, visto por el puerto del asistente. */
const documental: ConsultaDocumental = {
    consultar: async (pregunta) => {
        const r = await responderPregunta(pregunta);
        return {
            respuesta: r.respuesta,
            fuentes: r.fuentesRecuperadas.map((f) => f.id)
        };
    }
};

/**
 * Como se arma una conversacion del chat.
 *
 * Cada conversacion recibe su PROPIO cliente MCP sobre un transporte en
 * memoria, igual que hace el chat de consola. No es desperdicio: el
 * transporte en memoria no abre sockets ni procesos, y en cambio
 * garantiza que dos conversaciones simultaneas no se pisen el estado
 * del protocolo. El repositorio si se comparte, que es lo correcto:
 * las dos deben ver la misma cartera.
 */
function fabricaDeChat(repositorio: RepositorioCartera): FabricaChat {

    return async (perfil) => {

        const servidor = crearServidorMcp(repositorio);
        const [aCliente, aServidor] = InMemoryTransport.createLinkedPair();
        const cliente = new Client({
            name: "chat-web",
            version: "1.0.0"
        });

        await Promise.all([
            servidor.connect(aServidor),
            cliente.connect(aCliente)
        ]);

        return new Orquestador(
            new ModeloGemini(),
            new HerramientasMcp(cliente),
            perfil,
            documental
        );
    };
}

/**
 * Punto de arranque de la API (composition root).
 *
 *   npm run api
 *
 * Aqui, y solo aqui, se decide QUE adaptadores usa la aplicacion: la
 * cartera sale de PostgreSQL (DATABASE_URL). El resto del codigo depende
 * del puerto RepositorioCartera y no sabe de donde vienen los datos.
 *
 * Variables de entorno (ver .env.example):
 *   DATABASE_URL  Cadena de conexion a PostgreSQL (obligatoria).
 *   PORT          Puerto de escucha (por defecto 3000).
 *   HOST          Interfaz de escucha (por defecto 127.0.0.1).
 *
 * Escucha solo en la maquina local por defecto: el perfil por
 * encabezado no es autenticacion, asi que no conviene exponer la API a
 * toda la red. Para probar desde un telefono, sirva la interfaz con el
 * servidor de Vite, que reenvia /api a este proceso.
 */
async function principal(): Promise<void> {

    const puerto = Number(process.env.PORT ?? 3000);
    const host = process.env.HOST ?? "127.0.0.1";

    const db = abrirBaseDatos();

    try {
        const carga = await db.query("SELECT 1 FROM carga_canonica WHERE id = 1");

        if (carga.rows.length === 0) {
            throw new Error("vacia");
        }
    } catch {
        await db.cerrar();
        console.error(
            "La base de datos no tiene la cartera cargada.\n"
            + "Ejecute primero: npm run cargar"
        );
        process.exit(1);
    }

    const repositorio = new RepositorioCarteraPostgres(db);

    // Sin clave de Gemini la API arranca igual y solo el chat queda
    // fuera, respondiendo 503. El tablero, los pagos y las consultas no
    // tienen por que depender de que haya un modelo disponible.
    const hayModelo = Boolean(process.env.GEMINI_API_KEY?.trim());

    if (!hayModelo) {
        console.warn(
            "Aviso: sin GEMINI_API_KEY el asistente no esta disponible "
            + "(las rutas /api/chat responden 503). El resto de la API "
            + "funciona normalmente."
        );
    }

    const app = crearApp({
        repositorio,
        ...(hayModelo ? { crearChat: fabricaDeChat(repositorio) } : {})
    });

    const servidor = app.listen(puerto, host, () => {
        console.log(`API de Credito Vecino escuchando en http://${host}:${puerto}`);
    });

    const apagar = () => {
        servidor.close(async () => {
            await db.cerrar();
            process.exit(0);
        });
    };

    process.on("SIGINT", apagar);
    process.on("SIGTERM", apagar);
}

principal().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});
