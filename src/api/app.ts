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
import { OriginacionCredito } from "../servicios/originacion-credito";
import { aCuerpoError, ErrorHttp } from "./errores";
import { exigirPerfil } from "./perfiles";

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
    // Rutas desconocidas y manejo uniforme de errores
    // ------------------------------------------------------------------

    app.use((req, _res, _siguiente) => {
        throw new ErrorHttp(
            404, "RUTA_INEXISTENTE",
            `No existe la ruta ${req.method} ${req.path}.`
        );
    });

    app.use((error: unknown, _req: Request, res: Response, _siguiente: NextFunction) => {

        const { estado, cuerpo } = aCuerpoError(error);

        if (estado >= 500) {
            (opciones.registrarError ?? console.error)(error);
        }

        res.status(estado).json(cuerpo);
    });

    return app;
}
