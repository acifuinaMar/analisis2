import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

import type { RepositorioCartera } from "../dominio/repositorio-cartera";
import {
    CierreDiarioEntrada,
    CreditosEnMoraEntrada,
    DeudaDeCuotaEntrada,
    FechaCorteEsquema,
    IdCreditoEsquema,
    PeriodoEsquema,
    ProximosVencimientosEntrada,
    RegistrarPagoEntrada,
    aFechaCorte
} from "../mcp/esquemas";
import { CobroCredito } from "../servicios/cobro-credito";
import { ConsultasCartera } from "../servicios/consultas-cartera";
import { DirectorioClientes } from "../servicios/directorio-clientes";
import { OriginacionCredito } from "../servicios/originacion-credito";
import { puedeRegistrarPagos, type Perfil } from "../acceso/perfil";
import {
    ErrorPerfilSinPermiso,
    type RespuestaChat
} from "../asistente/orquestador";
import { aCuerpoError, ErrorHttp } from "./errores";
import { exigirPerfil } from "./perfiles";
import { type FabricaChat, SesionesChat } from "./sesiones-chat";

/**
 * API REST (E1, parte servidor).
 *
 * Es un ADAPTADOR PRIMARIO delgado (seccion 7.1 del P1): traduce HTTP a
 * llamadas sobre los servicios y nada mas. No contiene reglas de negocio
 * ni calcula ninguna cifra —todo lo que se muestra en la interfaz sale
 * de ConsultasCartera y OriginacionCredito, que a su vez usan el nucleo
 * del Proyecto 1—. Es la misma fuente que usa el servidor MCP, asi que el
 * tablero y el chat no pueden discrepar.
 *
 * Reglas del enunciado que se hacen cumplir aqui:
 *  - TODA consulta recibe la fecha de corte como parametro; la API nunca
 *    lee el reloj del sistema (seccion 7.3).
 *  - Los esquemas Zod son LOS MISMOS del servidor MCP (src/mcp/esquemas):
 *    un esquema, un contrato, dos adaptadores.
 *  - Errores con convencion uniforme (src/api/errores.ts).
 *  - El perfil se verifica en el servidor (src/api/perfiles.ts).
 *  - Registrar un pago exige confirmacion explicita: sin
 *    `confirmado: true` solo devuelve la vista previa.
 */

export interface OpcionesApp {
    readonly repositorio: RepositorioCartera;
    /** Para registrar errores 500. Por defecto, la consola. */
    readonly registrarError?: (error: unknown) => void;
    /**
     * Como se arma un orquestador del chat (E5). Se INYECTA, igual que
     * el repositorio, por dos razones concretas:
     *
     * - La API se prueba sin clave de API y sin red. Las pruebas pasan
     *   una fabrica con un modelo guionizado y ejercitan las rutas del
     *   chat de forma determinista.
     * - Sin fabrica, la API funciona igual y solo las rutas del chat
     *   responden 503. El nucleo, el tablero y los pagos no dependen
     *   de que haya un modelo de lenguaje disponible.
     */
    readonly crearChat?: FabricaChat;
}

const IdClienteEsquema = z.string().regex(
    /^CL-\d{4}$/,
    "El identificador de cliente tiene la forma CL-NNNN."
);

const IdAsesorEsquema = z.string().regex(
    /^AS-\d{2}$/,
    "El identificador de asesor tiene la forma AS-NN."
);

const NumeroCuotaEsquema = z.coerce.number().pipe(
    DeudaDeCuotaEntrada.shape.numeroCuota
);

const CanalEsquema = z.enum(["agencia", "campo", "transferencia"]);

const SolicitudEsquema = z.object({
    capital: z.number(),
    plazoMeses: z.number(),
    tnaAnual: z.number(),
    fechaDesembolso: FechaCorteEsquema
}).strict();

const DesembolsoEsquema = SolicitudEsquema.extend({
    idCredito: IdCreditoEsquema,
    idCliente: IdClienteEsquema,
    idAsesor: IdAsesorEsquema
}).strict();

const ClienteEsquema = z.object({
    idCliente: IdClienteEsquema,
    nombreCompleto: z.string().min(1).max(120),
    dpi: z.string().min(1).max(30),
    telefono: z.string().min(1).max(30),
    municipio: z.string().min(1).max(80),
    fechaOperacion: FechaCorteEsquema
}).strict();

/** El credito va en la URL; el resto del cuerpo es el del MCP. */
const PagoCuerpoEsquema = RegistrarPagoEntrada.omit({ idCredito: true }).strict();

const FechaCorteQuery = z.object({ fechaCorte: FechaCorteEsquema });

/**
 * El cuerpo del chat.
 *
 * `idSesion` es opcional: sin el se abre una conversacion nueva, con el
 * se continua la que ya existe. Asi el navegador no necesita un paso
 * previo de "abrir sesion" y la primera pregunta ya responde.
 */
const PreguntaChatEsquema = z.object({
    pregunta: z.string().trim().min(1, "Escriba una pregunta.").max(2000),
    idSesion: z.string().uuid().optional()
}).strict();

const SesionChatEsquema = z.object({
    idSesion: z.string().uuid(),
    motivo: z.string().trim().max(500).optional()
}).strict();

/** Texto de busqueda de clientes: nombre, CL-NNNN, DPI o CV-AAAA-NNNN. */
const BusquedaClientesQuery = z.object({
    buscar: z.string().trim().min(2, "Escriba al menos 2 caracteres.").max(60)
});

function validar<T extends z.ZodTypeAny>(esquema: T, datos: unknown): z.infer<T> {

    const r = esquema.safeParse(datos);

    if (!r.success) {
        throw new ErrorHttp(
            400, "VALIDACION",
            "La peticion no cumple el contrato.",
            {
                campos: r.error.issues.map(i => ({
                    campo: i.path.join(".") || "(raiz)",
                    mensaje: i.message
                }))
            }
        );
    }

    return r.data;
}

function fecha(texto: string): Date {

    try {
        return aFechaCorte(texto);
    } catch (error) {
        throw new ErrorHttp(
            400, "FECHA_INVALIDA",
            error instanceof Error ? error.message : String(error)
        );
    }
}

export function crearApp(opciones: OpcionesApp): Express {

    const consultas = new ConsultasCartera(opciones.repositorio);
    const originacion = new OriginacionCredito(opciones.repositorio);
    const cobro = new CobroCredito(opciones.repositorio);
    const directorio = new DirectorioClientes(opciones.repositorio);

    const app = express();

    app.disable("x-powered-by");
    app.use(express.json({ limit: "100kb" }));

    // Datos financieros: nunca deben quedar en cache del navegador.
    app.use((_req, res, siguiente) => {
        res.set("Cache-Control", "no-store");
        siguiente();
    });

    const ambos = exigirPerfil("asesor", "gerencia");
    const soloAsesor = exigirPerfil("asesor");
    const soloGerencia = exigirPerfil("gerencia");

    app.get("/api/salud", (_req, res) => {
        res.json({ estado: "ok" });
    });

    // ------------------------------------------------------------------
    // Originacion (perfil asesor) · OP-3
    // ------------------------------------------------------------------

    app.get("/api/asesores", soloAsesor, async (_req, res) => {
        res.json({ asesores: await opciones.repositorio.listarAsesores() });
    });

    // Busqueda para el cobro en campo. Solo lectura, sin cifras: el estado
    // de cada credito se pide aparte a GET /api/creditos/:id. Del DPI solo
    // viajan los cuatro ultimos caracteres.
    app.get("/api/clientes", soloAsesor, async (req, res) => {

        const q = validar(BusquedaClientesQuery, req.query);

        res.json(await directorio.buscar(q.buscar));
    });

    app.post("/api/clientes", soloAsesor, async (req, res) => {

        const d = validar(ClienteEsquema, req.body);

        const cliente = await originacion.registrarCliente({
            idCliente: d.idCliente,
            nombreCompleto: d.nombreCompleto,
            dpi: d.dpi,
            telefono: d.telefono,
            municipio: d.municipio,
            fechaAlta: fecha(d.fechaOperacion)
        });

        res.status(201).json({
            idCliente: cliente.idCliente,
            nombreCompleto: cliente.nombreCompleto,
            municipio: cliente.municipio
        });
    });

    // Plan simulado: NO guarda nada. Es el paso previo a confirmar.
    app.post("/api/creditos/simulacion", soloAsesor, (req, res) => {

        const d = validar(SolicitudEsquema, req.body);

        res.json(originacion.simularPlan({
            capital: d.capital,
            plazoMeses: d.plazoMeses,
            tnaAnual: d.tnaAnual,
            fechaDesembolso: fecha(d.fechaDesembolso)
        }));
    });

    app.post("/api/creditos", soloAsesor, async (req, res) => {

        const d = validar(DesembolsoEsquema, req.body);

        const resultado = await originacion.desembolsarCredito({
            idCredito: d.idCredito,
            idCliente: d.idCliente,
            idAsesor: d.idAsesor,
            capital: d.capital,
            plazoMeses: d.plazoMeses,
            tnaAnual: d.tnaAnual,
            fechaDesembolso: fecha(d.fechaDesembolso)
        });

        res.status(201).json(resultado);
    });

    // ------------------------------------------------------------------
    // Detalle de credito, plan, deuda y mora (ambos perfiles)
    // ------------------------------------------------------------------

    app.get("/api/creditos/:id", ambos, async (req, res) => {

        const id = validar(IdCreditoEsquema, req.params.id);
        const q = validar(FechaCorteQuery, req.query);

        res.json(await consultas.consultarCredito(id, fecha(q.fechaCorte)));
    });

    app.get("/api/creditos/:id/plan", ambos, async (req, res) => {

        const id = validar(IdCreditoEsquema, req.params.id);
        const q = validar(FechaCorteQuery, req.query);

        res.json(await originacion.obtenerPlan(id, fecha(q.fechaCorte)));
    });

    // Monto exacto a cobrar HOY (todas las cuotas vencidas): lo que la
    // pantalla de pago precarga, porque el sistema calcula los montos.
    app.get("/api/creditos/:id/deuda", ambos, async (req, res) => {

        const id = validar(IdCreditoEsquema, req.params.id);
        const q = validar(FechaCorteQuery, req.query);

        res.json(await cobro.deudaExigible(id, fecha(q.fechaCorte)));
    });

    app.get("/api/creditos/:id/cuotas/:numero/deuda", ambos, async (req, res) => {

        const id = validar(IdCreditoEsquema, req.params.id);
        const numero = validar(NumeroCuotaEsquema, req.params.numero);
        const q = validar(FechaCorteQuery, req.query);

        res.json(await consultas.calcularDeudaDeCuota(id, numero, fecha(q.fechaCorte)));
    });

    app.get("/api/creditos/:id/cuotas/:numero/mora", ambos, async (req, res) => {

        const id = validar(IdCreditoEsquema, req.params.id);
        const numero = validar(NumeroCuotaEsquema, req.params.numero);
        const q = validar(FechaCorteQuery, req.query);

        res.json(await consultas.explicarMora(id, numero, fecha(q.fechaCorte)));
    });

    // ------------------------------------------------------------------
    // Pagos (perfil asesor) · OP-1, OP-2, OP-4, OP-5, OP-6
    // ------------------------------------------------------------------

    app.post("/api/creditos/:id/pagos", soloAsesor, async (req, res) => {

        const id = validar(IdCreditoEsquema, req.params.id);
        const d = validar(PagoCuerpoEsquema, req.body);

        const resultado = await consultas.registrarPago(
            id,
            d.monto,
            d.claveIdempotencia,
            fecha(d.fechaOperacion),
            d.canal ?? "agencia",
            d.confirmado ?? false
        );

        // 201 solo cuando el pago se aplico por primera vez. La vista
        // previa y el reintento idempotente no crean nada: 200.
        res.status(resultado.aplicado && !resultado.duplicado ? 201 : 200)
            .json(resultado);
    });

    // ------------------------------------------------------------------
    // Cartera: morosos y vencimientos (ambos); tablero y cierres (gerencia)
    // ------------------------------------------------------------------

    app.get("/api/cartera/mora", ambos, async (req, res) => {

        const q = validar(CreditosEnMoraEntrada, req.query);

        res.json(await consultas.listarCreditosEnMora(fecha(q.fechaCorte), q.tramo));
    });

    app.get("/api/vencimientos", ambos, async (req, res) => {

        const q = validar(
            z.object({
                fechaCorte: FechaCorteEsquema,
                ventanaDias: z.coerce.number().pipe(ProximosVencimientosEntrada.shape.ventanaDias)
            }),
            req.query
        );

        res.json(await consultas.proximosVencimientos(fecha(q.fechaCorte), q.ventanaDias));
    });

    app.get("/api/cartera", soloGerencia, async (req, res) => {

        const q = validar(FechaCorteQuery, req.query);

        res.json(await consultas.consultarCartera(fecha(q.fechaCorte)));
    });

    app.get("/api/cierres/diario", soloGerencia, async (req, res) => {

        const q = validar(CierreDiarioEntrada, req.query);

        res.json(await consultas.consultarCierreDiario(fecha(q.fechaCorte)));
    });

    app.get("/api/cierres/mensual", soloGerencia, async (req, res) => {

        const q = validar(z.object({ periodo: PeriodoEsquema }), req.query);

        res.json(await consultas.consultarCierreMensual(q.periodo));
    });

    // ------------------------------------------------------------------
    // Chat gerencial (E5) · G-1 a G-8
    // ------------------------------------------------------------------
    //
    // El chat vive DENTRO de esta misma aplicacion, como pide el E5, y
    // no en una ventana aparte ni en una terminal. Estas rutas son la
    // unica forma que tiene la interfaz de hablar con el orquestador.
    //
    // La memoria de la sesion la sostiene SesionesChat, porque HTTP no
    // recuerda nada entre peticiones y el enunciado exige que las
    // preguntas encadenadas tengan contexto.

    const sesiones = opciones.crearChat
        ? new SesionesChat(opciones.crearChat)
        : undefined;

    /** El perfil ya lo valido exigirPerfil; aqui solo se lee. */
    const perfilDe = (req: Request): Perfil =>
        req.header("X-Perfil") as Perfil;

    function registroDeSesiones(): SesionesChat {

        if (!sesiones) {
            throw new ErrorHttp(
                503, "CHAT_NO_DISPONIBLE",
                "El asistente no esta disponible: al servidor no se le "
                + "configuro un modelo de lenguaje. Revise GEMINI_API_KEY."
            );
        }

        return sesiones;
    }

    /**
     * Pasa la respuesta del orquestador a JSON.
     *
     * Se agrega `puedeAprobar` para que la interfaz sepa si pintar el
     * boton de aprobar. Es informativo y no es el control: el control
     * son el perfil de la ruta y la verificacion del orquestador, que
     * niegan la aprobacion aunque alguien llame la ruta a mano. Ocultar
     * un boton no es un control de acceso.
     */
    const aJson = (
        idSesion: string,
        perfil: Perfil,
        r: RespuestaChat
    ) => r.tipo === "respuesta"
        ? {
            idSesion,
            tipo: r.tipo,
            texto: r.texto,
            herramientasUsadas: r.herramientasUsadas
        }
        : {
            idSesion,
            tipo: r.tipo,
            propuesta: r.propuesta,
            herramientasUsadas: r.herramientasUsadas,
            puedeAprobar: puedeRegistrarPagos(perfil)
        };

    app.post("/api/chat", ambos, async (req, res) => {

        const registro = registroDeSesiones();
        const perfil = perfilDe(req);
        const d = validar(PreguntaChatEsquema, req.body);

        const { idSesion, chat } = d.idSesion === undefined
            ? await registro.abrir(perfil)
            : { idSesion: d.idSesion, chat: registro.obtener(d.idSesion, perfil) };

        res.json(aJson(idSesion, perfil, await chat.preguntar(d.pregunta)));
    });

    /**
     * Aprobar el pago que el asistente propuso.
     *
     * Reservada al ASESOR, igual que POST /api/creditos/:id/pagos: es
     * la misma accion y no puede tener dos reglas segun por donde se
     * pida. Si el chat la permitiera a gerencia, seria la puerta de
     * atras de los permisos de esta misma API.
     *
     * La gerencia si ve la vista previa con el desglose —eso es lectura
     * y no mueve nada—; lo que no puede es aplicarlo.
     */
    app.post("/api/chat/aprobar", soloAsesor, async (req, res) => {

        const registro = registroDeSesiones();
        const perfil = perfilDe(req);
        const d = validar(SesionChatEsquema, req.body);
        const chat = registro.obtener(d.idSesion, perfil);

        if (!chat.pagoPendiente()) {
            throw new ErrorHttp(
                409, "SIN_PAGO_PENDIENTE",
                "No hay ningun pago esperando aprobacion en esta "
                + "conversacion."
            );
        }

        res.json(aJson(d.idSesion, perfil, await chat.aprobarPago()));
    });

    /** Rechazar la propuesta. Cualquiera puede decir que no. */
    app.post("/api/chat/rechazar", ambos, async (req, res) => {

        const registro = registroDeSesiones();
        const perfil = perfilDe(req);
        const d = validar(SesionChatEsquema, req.body);
        const chat = registro.obtener(d.idSesion, perfil);

        if (!chat.pagoPendiente()) {
            throw new ErrorHttp(
                409, "SIN_PAGO_PENDIENTE",
                "No hay ningun pago esperando aprobacion en esta "
                + "conversacion."
            );
        }

        res.json(aJson(d.idSesion, perfil, await chat.rechazarPago(d.motivo)));
    });

    /** Cerrar la conversacion. Idempotente: siempre 204. */
    app.delete("/api/chat/:idSesion", ambos, (req, res) => {

        registroDeSesiones().cerrar(String(req.params.idSesion), perfilDe(req));

        res.status(204).end();
    });

    // ------------------------------------------------------------------
    // Rutas desconocidas y manejo uniforme de errores
    // ------------------------------------------------------------------

    app.use((req, _res, _siguiente) => {
        throw new ErrorHttp(
            404, "RUTA_INEXISTENTE",
            `No existe la ruta ${req.method} ${req.path}.`
        );
    });

    app.use((error: unknown, _req: Request, res: Response, _siguiente: NextFunction) => {

        // La negativa por perfil del orquestador es el mismo 403 que da
        // exigirPerfil. Se traduce aqui para que el chat y el resto de
        // la API hablen con un solo vocabulario de errores.
        const traducido = error instanceof ErrorPerfilSinPermiso
            ? new ErrorHttp(403, "PERFIL_SIN_PERMISO", error.message)
            : error;

        const { estado, cuerpo } = aCuerpoError(traducido);

        if (estado >= 500) {
            (opciones.registrarError ?? console.error)(error);
        }

        res.status(estado).json(cuerpo);
    });

    return app;
}
