import type { Page, Route } from "@playwright/test";

import type {
    Cierre,
    CuerpoDesembolso,
    EstadoCartera,
    ListadoCreditosEnMora,
    DeudaCuota,
    DeudaExigible,
    EstadoCredito,
    ExplicacionMora,
    PlanDeCredito,
    PlanSimulado,
    ProximosVencimientos,
    RespuestaAsesores,
    ResultadoBusquedaClientes,
    ResultadoDesembolso,
    ResultadoPago
} from "../src/api/contratos";

/**
 * API simulada para las pruebas del cobro en campo.
 *
 * Imita los contratos REALES de src/api (los tipos se importan de ahí: si
 * el servidor cambia un campo, `npm run tipos` falla aquí). Los datos son
 * de prueba, inventados: no salen del paquete canónico ni de PostgreSQL, y
 * nada de esto toca una base de datos.
 *
 * Es CON ESTADO para poder probar la idempotencia: recuerda qué claves se
 * aplicaron, y puede "perder" la respuesta de una confirmación DESPUÉS de
 * aplicarla, que es justo el caso del resultado incierto.
 *
 * Solo intercepta rutas cuyo pathname empieza con /api/. Un patrón como
 * "**\/api/**" también atraparía /src/api/cliente.ts, que Vite sirve como
 * módulo en desarrollo, y la aplicación no cargaría.
 */

export interface Pedida {
    readonly metodo: string;
    readonly ruta: string;
    readonly consulta: URLSearchParams;
    readonly perfil: string | undefined;
    readonly cuerpo: Record<string, unknown> | undefined;
}

export interface OpcionesSimulacion {
    /** Cuántas confirmaciones aplicar y luego perder la respuesta. */
    perderRespuestas?: number;
    /** Demora de cada confirmación (para probar el doble clic). */
    retrasoConfirmacionMs?: number;
    /** Demora de la búsqueda (para ver el indicador de carga). */
    retrasoBusquedaMs?: number;
    /** La búsqueda responde 503. */
    busquedaFalla?: boolean;
    /** GET /api/vencimientos responde 503. */
    vencimientosFalla?: boolean;
    /**
     * Pierde la respuesta del PRÓXIMO alta de cliente (una vez):
     *   "aplicando"   el cliente SÍ se crea y la respuesta no llega;
     *   "sin_aplicar" la petición se corta antes de crear nada.
     */
    perderAlta?: "aplicando" | "sin_aplicar";
    /** Igual, para el próximo desembolso. */
    perderDesembolso?: "aplicando" | "sin_aplicar";
    /** Demora de las escrituras de la originación (para el doble clic). */
    retrasoEscrituraMs?: number;
    /** Consultas de gerencia que responden 503 (Fase 4). */
    gerenciaFalla?: ReadonlyArray<"cartera" | "mora" | "cierres">;
    /** Demora de las consultas de gerencia (para ver el estado de carga). */
    retrasoGerenciaMs?: number;
}

export interface Simulacion {
    readonly pedidas: Pedida[];
    /** Claves que la API simulada aplicó, en orden. */
    readonly aplicadas: string[];
    pagos(): Pedida[];
    confirmaciones(): Pedida[];
    vistasPrevias(): Pedida[];
    altas(): Pedida[];
    desembolsos(): Pedida[];
    simulaciones(): Pedida[];
    opciones: OpcionesSimulacion;
}

// ----------------------------------------------------------------------
// Datos de prueba
// ----------------------------------------------------------------------

export const CREDITO_MORA = "CV-2026-0043";
export const CREDITO_INCOBRABLE = "CV-2026-0015";
export const CREDITO_AL_DIA = "CV-2026-0099";

const CLIENTES = [
    { idCliente: "CL-0060", nombreCompleto: "Ana Lucía Prueba Uno", dpi: "DPI-PRUEBA-000060", municipio: "Mixco", creditos: [CREDITO_MORA] },
    { idCliente: "CL-0015", nombreCompleto: "Bruno Prueba Dos", dpi: "DPI-PRUEBA-000015", municipio: "Villa Nueva", creditos: [CREDITO_INCOBRABLE] },
    { idCliente: "CL-0099", nombreCompleto: "Carla Prueba Tres", dpi: "DPI-PRUEBA-000099", municipio: "Antigua Guatemala", creditos: [CREDITO_AL_DIA] }
];

/** Monto exacto que "calcula el servidor" para CV-2026-0043, según la fecha. */
export function montoExactoDe(fechaCorte: string): number {
    return fechaCorte === "2026-11-15" ? 1300 : 1234.56;
}

function desgloseDe(fechaCorte: string) {
    return fechaCorte === "2026-11-15"
        ? { gastos: 25, interesMoratorio: 75, interesCorriente: 200, capital: 1000, total: 1300 }
        : { gastos: 25, interesMoratorio: 9.56, interesCorriente: 200, capital: 1000, total: 1234.56 };
}

/**
 * Plan simulado de PRUEBA: cifras fijas por cuota, no un cálculo. Solo
 * importa que la interfaz muestre lo que "devuelve el servidor".
 */
function planSimulado(capital: number, plazo: number, tna: number, fecha: string): PlanSimulado {
    return {
        capital,
        plazoMeses: plazo,
        tnaAnual: tna,
        fechaDesembolso: fecha,
        cuotas: Array.from({ length: plazo }, (_, i) => ({
            numero: i + 1,
            fechaVencimiento: `2027-${String((i % 12) + 1).padStart(2, "0")}-15`,
            saldoInicial: 9999.99,
            cuota: 1004.62,
            interes: 171.3,
            capital: 833.32,
            saldoFinal: 9166.67
        })),
        totales: { cuotas: 12055.45, intereses: 2055.45, capital }
    };
}

// ----------------------------------------------------------------------
// Datos de PRUEBA de gerencia (cifras fijas, no calculadas)
// ----------------------------------------------------------------------

/** Fecha de corte con la que la cartera simulada está vacía. */
export const FECHA_SIN_CARTERA = "2020-01-01";

function carteraDe(fechaCorte: string): EstadoCartera {
    if (fechaCorte === FECHA_SIN_CARTERA) {
        return {
            fechaCorte, creditosActivos: 0, carteraActiva: 0, carteraEnMora: 0, porcentajeEnMora: 0,
            montoEnRiesgo: 0, porcentajeEnRiesgo: 0, dadoPorIncobrable: 0, candidatosAIncobrable: 0,
            saldoCandidatosAIncobrable: 0,
            desglosePorTramo: ["mora_1", "mora_2", "mora_3", "vencido", "reestructurado_al_dia"]
                .map(categoria => ({ categoria, creditos: 0, saldo: 0, porcentaje: 0 }))
        };
    }
    return {
        fechaCorte,
        creditosActivos: 66,
        carteraActiva: 299939.82,
        carteraEnMora: 48715.17,
        porcentajeEnMora: 0.16241648074603765,
        montoEnRiesgo: 37841.71,
        porcentajeEnRiesgo: 0.12616434190031853,
        dadoPorIncobrable: 0,
        candidatosAIncobrable: 2,
        saldoCandidatosAIncobrable: 2333.48,
        desglosePorTramo: [
            { categoria: "mora_1", creditos: 0, saldo: 0, porcentaje: 0 },
            { categoria: "mora_2", creditos: 3, saldo: 7000, porcentaje: 0.02333801493913012 },
            { categoria: "mora_3", creditos: 2, saldo: 1954.26, porcentaje: 0.0065155070107063475 },
            { categoria: "vencido", creditos: 4, saldo: 6638.3, porcentaje: 0.02213210636720393 },
            { categoria: "reestructurado_al_dia", creditos: 3, saldo: 22249.15, porcentaje: 0.07417871358327814 }
        ]
    };
}

function moraDe(fechaCorte: string, tramo: string | null): ListadoCreditosEnMora {
    const todos = fechaCorte === FECHA_SIN_CARTERA ? [] : [
        { idCredito: CREDITO_INCOBRABLE, idCliente: "CL-0015", nombreCliente: "Bruno Prueba Dos", diasAtraso: 130, tramo: "vencido", estado: "en_mora", reestructurado: false, saldoCapital: 1029.24, cuotasVencidas: 4 },
        { idCredito: CREDITO_MORA, idCliente: "CL-0060", nombreCliente: "Ana Lucía Prueba Uno", diasAtraso: 45, tramo: "mora_2", estado: "en_mora", reestructurado: true, saldoCapital: 2000, cuotasVencidas: 2 }
    ] as unknown as ListadoCreditosEnMora["creditos"];
    const creditos = tramo ? todos.filter(k => k.tramo === tramo) : todos;
    // Totales fijos por filtro, como los daría el servidor (no se suman aquí).
    const saldo = creditos.length === 0 ? 0 : tramo === "vencido" ? 1029.24 : tramo === "mora_2" ? 2000 : 3029.24;
    return {
        fechaCorte,
        tramoFiltrado: (tramo ?? null) as ListadoCreditosEnMora["tramoFiltrado"],
        cantidad: creditos.length,
        saldoCapitalTotal: saldo,
        creditos
    };
}

function cierreVacio(id: string, tipo: "diario" | "mensual", desde: string, hasta: string): Cierre {
    return {
        id, tipo, desde, hasta,
        desembolsos: { cantidad: 0, monto: 0 },
        pagos: { cantidad: 0, monto: 0 },
        recuperaciones: { gastos: 0, interesMoratorio: 0, interesCorriente: 0, capital: 0, excedenteACapital: 0, total: 0 },
        flujoNeto: 0
    };
}

function cierreDiario(fecha: string): Cierre {
    const base = cierreVacio(`CIE-${fecha}`, "diario", fecha, fecha);
    if (fecha !== "2026-10-15") {
        return base;
    }
    return {
        ...base,
        pagos: { cantidad: 1, monto: 520.4 },
        recuperaciones: { gastos: 0, interesMoratorio: 0, interesCorriente: 40.4, capital: 480, excedenteACapital: 0, total: 520.4 },
        flujoNeto: 520.4
    };
}

function cierreMensual(periodo: string): Cierre {
    const fin = periodo === "2026-09" ? "30" : "31";
    const base = cierreVacio(`CIE-${periodo}`, "mensual", `${periodo}-01`, `${periodo}-${fin}`);
    if (periodo === "2026-10") {
        return {
            ...base,
            desembolsos: { cantidad: 10, monto: 41000 },
            pagos: { cantidad: 42, monto: 36554.5 },
            recuperaciones: { gastos: 0, interesMoratorio: 16.93, interesCorriente: 7162.89, capital: 29374.68, excedenteACapital: 0, total: 36554.5 },
            flujoNeto: -4445.5
        };
    }
    if (periodo === "2026-09") {
        return {
            ...base,
            desembolsos: { cantidad: 1, monto: 3000 },
            pagos: { cantidad: 30, monto: 15000 },
            recuperaciones: { gastos: 25, interesMoratorio: 75, interesCorriente: 2900, capital: 11500, excedenteACapital: 500, total: 15000 },
            flujoNeto: 12000
        };
    }
    return base;
}

function normalizar(t: string) {
    return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// ----------------------------------------------------------------------

export async function simularApi(page: Page, opciones: OpcionesSimulacion = {}): Promise<Simulacion> {

    const pedidas: Pedida[] = [];
    const aplicadas: string[] = [];
    const sim: Simulacion = {
        pedidas,
        aplicadas,
        opciones,
        pagos: () => pedidas.filter(p => p.metodo === "POST" && p.ruta.endsWith("/pagos")),
        confirmaciones: () => sim.pagos().filter(p => p.cuerpo?.confirmado === true),
        vistasPrevias: () => sim.pagos().filter(p => p.cuerpo?.confirmado !== true),
        altas: () => pedidas.filter(p => p.metodo === "POST" && p.ruta === "/api/clientes"),
        desembolsos: () => pedidas.filter(p => p.metodo === "POST" && p.ruta === "/api/creditos"),
        simulaciones: () => pedidas.filter(p => p.metodo === "POST" && p.ruta === "/api/creditos/simulacion")
    };

    // Estado PROPIO de esta simulación: lo que se crea no se filtra a otras pruebas.
    const clientes = CLIENTES.map(c => ({ ...c, creditos: [...c.creditos] }));
    const creditosCreados = new Map<string, CuerpoDesembolso>();
    const esperar = () => opciones.retrasoEscrituraMs
        ? new Promise(r => setTimeout(r, opciones.retrasoEscrituraMs))
        : Promise.resolve();

    const pagado = (idCredito: string) => idCredito === CREDITO_MORA && aplicadas.length > 0;

    const responder = (ruta: Route, estado: number, cuerpo: unknown) =>
        ruta.fulfill({ status: estado, contentType: "application/json", body: JSON.stringify(cuerpo) });

    const error = (ruta: Route, estado: number, codigo: string, mensaje: string, detalle?: unknown) =>
        responder(ruta, estado, { error: true, codigo, mensaje, ...(detalle ? { detalle } : {}) });

    await page.route(url => url.pathname.startsWith("/api/"), async ruta => {

        const peticion = ruta.request();
        const url = new URL(peticion.url());
        const metodo = peticion.method();
        const perfil = await peticion.headerValue("x-perfil") ?? undefined;
        const cuerpo = metodo === "POST" ? peticion.postDataJSON() as Record<string, unknown> : undefined;
        pedidas.push({ metodo, ruta: url.pathname, consulta: url.searchParams, perfil, cuerpo });

        const p = url.pathname;
        const fechaCorte = url.searchParams.get("fechaCorte") ?? "2026-10-31";

        if (p === "/api/salud") {
            return responder(ruta, 200, { estado: "ok" });
        }

        // --- Búsqueda de clientes (solo asesor) ---------------------------
        if (p === "/api/clientes" && metodo === "GET") {
            if (perfil !== "asesor") {
                return error(ruta, 403, "PERFIL_SIN_PERMISO", "El perfil no tiene permiso para esta operacion.");
            }
            if (opciones.retrasoBusquedaMs) {
                await new Promise(r => setTimeout(r, opciones.retrasoBusquedaMs));
            }
            if (opciones.busquedaFalla) {
                return error(ruta, 503, "SIN_API", "Servicio no disponible (simulado).");
            }
            const buscar = (url.searchParams.get("buscar") ?? "").trim();
            const q = normalizar(buscar);
            const encontrados = clientes.filter(c =>
                normalizar(c.nombreCompleto).includes(q)
                || c.idCliente.toLowerCase().includes(q)
                || c.creditos.some(k => k.toLowerCase().includes(q))
                || (q.length >= 4 && c.dpi.toLowerCase().includes(q)));
            const r: ResultadoBusquedaClientes = {
                buscar,
                total: encontrados.length,
                truncado: false,
                resultados: encontrados.map(c => ({
                    idCliente: c.idCliente,
                    nombreCompleto: c.nombreCompleto,
                    municipio: c.municipio,
                    dpiTerminacion: c.dpi.slice(-4),
                    creditos: c.creditos.map(idCredito => ({ idCredito }))
                }))
            };
            return responder(ruta, 200, r);
        }

        // --- Consultas de gerencia (Fase 4) ---------------------------------
        // Formas verificadas contra la API real (src/api/app.ts) sobre el
        // paquete CSV. Las cifras son de PRUEBA y fijas: la interfaz debe
        // mostrarlas tal cual, sin sumar ni recalcular.
        const falla = (q: "cartera" | "mora" | "cierres") => opciones.gerenciaFalla?.includes(q) ?? false;
        const esperarGerencia = () => opciones.retrasoGerenciaMs
            ? new Promise(r => setTimeout(r, opciones.retrasoGerenciaMs))
            : Promise.resolve();

        if (p === "/api/cartera") {
            if (perfil !== "gerencia") {
                return error(ruta, 403, "PERFIL_SIN_PERMISO", `El perfil '${perfil}' no tiene permiso para esta operacion.`, { permitidos: ["gerencia"] });
            }
            await esperarGerencia();
            if (falla("cartera")) {
                return error(ruta, 503, "SIN_API", "Servicio no disponible (simulado).");
            }
            return responder(ruta, 200, carteraDe(fechaCorte));
        }

        if (p === "/api/cartera/mora") {
            await esperarGerencia();
            if (falla("mora")) {
                return error(ruta, 503, "SIN_API", "Servicio no disponible (simulado).");
            }
            const tramo = url.searchParams.get("tramo");
            if (tramo !== null && !["mora_1", "mora_2", "mora_3", "vencido"].includes(tramo)) {
                return error(ruta, 400, "VALIDACION", "La peticion no cumple el contrato.", { campos: [{ campo: "tramo", mensaje: "Invalid enum value." }] });
            }
            return responder(ruta, 200, moraDe(fechaCorte, tramo));
        }

        if (p === "/api/cierres/diario" || p === "/api/cierres/mensual") {
            if (perfil !== "gerencia") {
                return error(ruta, 403, "PERFIL_SIN_PERMISO", `El perfil '${perfil}' no tiene permiso para esta operacion.`, { permitidos: ["gerencia"] });
            }
            await esperarGerencia();
            if (falla("cierres")) {
                return error(ruta, 503, "SIN_API", "Servicio no disponible (simulado).");
            }
            if (p === "/api/cierres/diario") {
                return responder(ruta, 200, cierreDiario(fechaCorte));
            }
            const periodo = url.searchParams.get("periodo") ?? "";
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
                return error(ruta, 400, "VALIDACION", "La peticion no cumple el contrato.", { campos: [{ campo: "periodo", mensaje: "El periodo debe venir en formato AAAA-MM." }] });
            }
            return responder(ruta, 200, cierreMensual(periodo));
        }

        // --- Próximos vencimientos (ambos perfiles) -------------------------
        if (p === "/api/vencimientos") {
            if (opciones.vencimientosFalla) {
                return error(ruta, 503, "SIN_API", "Servicio no disponible (simulado).");
            }
            const ventana = Number(url.searchParams.get("ventanaDias"));
            if (!Number.isInteger(ventana) || ventana < 1 || ventana > 365) {
                return error(ruta, 400, "VALIDACION", "La peticion no cumple el contrato.");
            }
            const todas = fechaCorte === "2027-06-01" ? [] : [
                { idCredito: CREDITO_AL_DIA, idCliente: "CL-0099", nombreCliente: "Carla Prueba Tres", numeroCuota: 4, fechaVencimiento: "2026-11-02", diasParaVencer: 2, montoCuota: 520.4, montoPendiente: 520.4 },
                { idCredito: CREDITO_MORA, idCliente: "CL-0060", nombreCliente: "Ana Lucía Prueba Uno", numeroCuota: 4, fechaVencimiento: "2026-11-06", diasParaVencer: 6, montoCuota: 520.4, montoPendiente: 300 },
                { idCredito: CREDITO_AL_DIA, idCliente: "CL-0099", nombreCliente: "Carla Prueba Tres", numeroCuota: 5, fechaVencimiento: "2026-11-28", diasParaVencer: 28, montoCuota: 520.4, montoPendiente: 520.4 }
            ];
            const cuotas = todas.filter(c => c.diasParaVencer <= ventana);
            // Totales fijos por ventana, como si los diera el servidor (no se suman aquí).
            const montoTotal = cuotas.length === 0 ? 0 : ventana >= 30 ? 820.4 : cuotas.length === 2 ? 820.4 : 520.4;
            const r: ProximosVencimientos = {
                fechaCorte,
                ventanaDias: ventana,
                hasta: ventana >= 30 ? "2026-11-30" : "2026-11-07",
                cantidadCuotas: cuotas.length,
                creditosInvolucrados: new Set(cuotas.map(c => c.idCredito)).size,
                montoTotal,
                cuotas
            };
            return responder(ruta, 200, r);
        }

        // --- Originación (solo asesor) ----------------------------------------
        if (p === "/api/asesores") {
            if (perfil !== "asesor") {
                return error(ruta, 403, "PERFIL_SIN_PERMISO", "El perfil no tiene permiso para esta operacion.");
            }
            const r: RespuestaAsesores = { asesores: [
                { idAsesor: "AS-01", nombreCompleto: "Asesor Prueba Uno" },
                { idAsesor: "AS-02", nombreCompleto: "Asesor Prueba Dos" }
            ] };
            return responder(ruta, 200, r);
        }

        if (p === "/api/clientes" && metodo === "POST") {
            if (perfil !== "asesor") {
                return error(ruta, 403, "PERFIL_SIN_PERMISO", "El perfil no tiene permiso para esta operacion.");
            }
            const b = cuerpo ?? {};
            if (opciones.perderAlta === "sin_aplicar") {
                opciones.perderAlta = undefined;
                return ruta.abort("connectionreset");
            }
            await esperar();
            const id = String(b.idCliente);
            if (clientes.some(c => c.idCliente === id)) {
                return error(ruta, 409, "CLIENTE_DUPLICADO", `El cliente ${id} ya existe.`);
            }
            if (clientes.some(c => c.dpi === b.dpi)) {
                return error(ruta, 409, "DPI_DUPLICADO", `Ya existe un cliente con el DPI ${String(b.dpi)}.`);
            }
            clientes.push({ idCliente: id, nombreCompleto: String(b.nombreCompleto), dpi: String(b.dpi), municipio: String(b.municipio), creditos: [] });
            if (opciones.perderAlta === "aplicando") {
                opciones.perderAlta = undefined;
                return ruta.abort("connectionreset");
            }
            return responder(ruta, 201, { idCliente: id, nombreCompleto: b.nombreCompleto, municipio: b.municipio });
        }

        if (p === "/api/creditos/simulacion" && metodo === "POST") {
            if (perfil !== "asesor") {
                return error(ruta, 403, "PERFIL_SIN_PERMISO", "El perfil no tiene permiso para esta operacion.");
            }
            const b = cuerpo ?? {};
            const capital = Number(b.capital);
            const plazo = Number(b.plazoMeses);
            if (capital < 1000 || capital > 25000) {
                return error(ruta, 400, "CAPITAL_FUERA_DE_RANGO", "El capital debe estar entre Q1000 y Q25000.", { minimo: 1000, maximo: 25000 });
            }
            if (plazo < 3 || plazo > 24) {
                return error(ruta, 400, "PLAZO_FUERA_DE_RANGO", "El plazo debe ser un numero entero de meses entre 3 y 24.", { minimo: 3, maximo: 24 });
            }
            return responder(ruta, 200, planSimulado(capital, plazo, Number(b.tnaAnual), String(b.fechaDesembolso)));
        }

        if (p === "/api/creditos" && metodo === "POST") {
            if (perfil !== "asesor") {
                return error(ruta, 403, "PERFIL_SIN_PERMISO", "El perfil no tiene permiso para esta operacion.");
            }
            const b = cuerpo as unknown as CuerpoDesembolso;
            if (opciones.perderDesembolso === "sin_aplicar") {
                opciones.perderDesembolso = undefined;
                return ruta.abort("connectionreset");
            }
            await esperar();
            const existe = creditosCreados.has(b.idCredito) || clientes.some(c => c.creditos.includes(b.idCredito));
            if (existe) {
                return error(ruta, 409, "CREDITO_DUPLICADO", `El credito ${b.idCredito} ya existe.`);
            }
            const titular = clientes.find(c => c.idCliente === b.idCliente);
            if (!titular) {
                return error(ruta, 422, "CLIENTE_INEXISTENTE", `El cliente ${b.idCliente} no existe.`);
            }
            creditosCreados.set(b.idCredito, b);
            titular.creditos.push(b.idCredito);
            if (opciones.perderDesembolso === "aplicando") {
                opciones.perderDesembolso = undefined;
                return ruta.abort("connectionreset");
            }
            const r: ResultadoDesembolso = {
                idCredito: b.idCredito,
                idCliente: b.idCliente,
                idAsesor: b.idAsesor,
                plan: planSimulado(b.capital, b.plazoMeses, b.tnaAnual, b.fechaDesembolso)
            };
            return responder(ruta, 201, r);
        }

        const m = /^\/api\/creditos\/([^/]+)(\/.*)?$/.exec(p);
        if (!m) {
            return error(ruta, 404, "RUTA_INEXISTENTE", `No existe la ruta ${metodo} ${p}.`);
        }
        const idCredito = decodeURIComponent(m[1]!);
        const resto = m[2] ?? "";

        // Créditos creados en esta prueba: se devuelven con SUS términos.
        const creado = creditosCreados.get(idCredito);
        if (creado) {
            const titular = clientes.find(c => c.idCliente === creado.idCliente)!;
            if (resto === "/plan") {
                const ps = planSimulado(creado.capital, creado.plazoMeses, creado.tnaAnual, creado.fechaDesembolso);
                const r: PlanDeCredito = {
                    idCredito, fechaCorte, capital: creado.capital, plazoMeses: creado.plazoMeses,
                    tnaAnual: creado.tnaAnual, fechaDesembolso: creado.fechaDesembolso,
                    cuotas: ps.cuotas.map(f => ({ ...f, capitalPagado: 0, interesPagado: 0, estado: "pendiente" as const, vencida: false, diasAtraso: 0 }))
                };
                return responder(ruta, 200, r);
            }
            const r = {
                idCredito, idCliente: creado.idCliente, nombreCliente: titular.nombreCompleto, fechaCorte,
                estado: "vigente", tramo: "al_dia", reestructurado: false,
                capitalDesembolsado: creado.capital, saldoCapital: creado.capital, diasAtraso: 0,
                cuotasPagadas: 0, cuotasVencidas: 0
            } as unknown as EstadoCredito;
            return responder(ruta, 200, r);
        }

        const cliente = clientes.find(c => c.creditos.includes(idCredito));
        if (!cliente) {
            return error(ruta, 404, "CREDITO_INEXISTENTE", `No existe el credito ${idCredito}.`);
        }

        const enMora = idCredito !== CREDITO_AL_DIA && !pagado(idCredito);
        const exigibles = !enMora ? [] : idCredito === CREDITO_INCOBRABLE ? [1] : [2, 3];

        // --- Detalle del crédito -----------------------------------------
        if (resto === "" && metodo === "GET") {
            const r: EstadoCredito = {
                idCredito,
                idCliente: cliente.idCliente,
                nombreCliente: cliente.nombreCompleto,
                fechaCorte,
                estado: (enMora ? "en_mora" : "vigente") as EstadoCredito["estado"],
                tramo: (idCredito === CREDITO_INCOBRABLE ? "vencido" : enMora ? "mora_2" : "al_dia") as EstadoCredito["tramo"],
                reestructurado: false,
                capitalDesembolsado: 3000,
                saldoCapital: enMora ? 2000 : 1000,
                diasAtraso: idCredito === CREDITO_INCOBRABLE ? 130 : enMora ? 45 : 0,
                cuotasPagadas: enMora ? 1 : 3,
                cuotasVencidas: exigibles.length,
                proximaCuota: {
                    numero: enMora ? exigibles[0]! : 4,
                    fechaVencimiento: "2026-09-06",
                    monto: 520.4,
                    capital: 480,
                    interes: 40.4,
                    estado: "pendiente",
                    diasAtraso: enMora ? 45 : 0
                }
            };
            return responder(ruta, 200, r);
        }

        if (resto === "/plan") {
            const r: PlanDeCredito = {
                idCredito,
                fechaCorte,
                capital: 3000,
                plazoMeses: 6,
                tnaAnual: 0.36,
                fechaDesembolso: "2026-08-06",
                cuotas: [1, 2, 3].map(n => ({
                    numero: n,
                    fechaVencimiento: `2026-${String(8 + n).padStart(2, "0")}-06`,
                    saldoInicial: 3000 - (n - 1) * 480,
                    cuota: 520.4,
                    interes: 40.4,
                    capital: 480,
                    saldoFinal: 3000 - n * 480,
                    capitalPagado: n === 1 || !enMora ? 480 : 0,
                    interesPagado: n === 1 || !enMora ? 40.4 : 0,
                    estado: (n === 1 || !enMora ? "pagada" : "pendiente") as "pagada" | "pendiente",
                    vencida: true,
                    diasAtraso: n === 1 || !enMora ? 0 : 45
                })).concat([{
                    // Cuota 4, aún no vencida: pendiente (en mora) o con un abono parcial (al día).
                    numero: 4,
                    fechaVencimiento: "2026-12-06",
                    saldoInicial: 1560,
                    cuota: 520.4,
                    interes: 40.4,
                    capital: 480,
                    saldoFinal: 1080,
                    capitalPagado: enMora ? 0 : 100,
                    interesPagado: 0,
                    estado: (enMora ? "pendiente" : "parcial") as "pagada" | "pendiente",
                    vencida: false,
                    diasAtraso: 0
                }])
            };
            return responder(ruta, 200, r);
        }

        if (resto === "/deuda") {
            const d = enMora ? desgloseDe(fechaCorte) : { gastos: 0, interesMoratorio: 0, interesCorriente: 0, capital: 0, total: 0 };
            const r: DeudaExigible = {
                idCredito,
                fechaCorte,
                cuotasExigibles: exigibles,
                desglosePrelacion: d,
                montoExacto: d.total
            };
            return responder(ruta, 200, r);
        }

        const cuota = /^\/cuotas\/(\d+)\/(deuda|mora)$/.exec(resto);
        if (cuota) {
            const numero = Number(cuota[1]);
            if (cuota[2] === "mora") {
                const r: ExplicacionMora = {
                    idCredito,
                    numeroCuota: numero,
                    fechaCorte,
                    politica: "POL-PRUEBA",
                    capitalEnMora: 480,
                    diasAtraso: 45,
                    tramo: "mora_2" as ExplicacionMora["tramo"],
                    tramosRecorridos: [
                        { tramo: "mora_1", dias: 30, tnaMoratoria: "18 %", tasaDiaria: 0.0005, monto: 7.2 },
                        { tramo: "mora_2", dias: 15, tnaMoratoria: "24 %", tasaDiaria: 0.000666667, monto: 4.81 }
                    ],
                    sumaDeTramosRedondeados: 12.01,
                    total: 12,
                    hayDiferenciaPorRedondeo: numero === 2
                };
                return responder(ruta, 200, r);
            }
            const r: DeudaCuota = {
                idCredito,
                numeroCuota: numero,
                fechaCorte,
                diasAtraso: 45,
                tramo: "mora_2" as DeudaCuota["tramo"],
                gastos: 25,
                interesMoratorio: 12,
                interesCorriente: 40.4,
                capital: 480,
                totalExigible: 557.4
            };
            return responder(ruta, 200, r);
        }

        // --- Registro de pago ----------------------------------------------
        if (resto === "/pagos" && metodo === "POST") {
            if (perfil !== "asesor") {
                return error(ruta, 403, "PERFIL_SIN_PERMISO", "El perfil no tiene permiso para esta operacion.");
            }
            const b = cuerpo ?? {};
            const clave = String(b.claveIdempotencia ?? "");
            const fecha = String(b.fechaOperacion ?? "");
            const monto = Number(b.monto);
            const desglose = desgloseDe(fecha);
            const antes = { estado: "en_mora", tramo: "mora_2", diasAtraso: 45, saldoCapital: 2000, cuotasVencidas: 2 };
            const comun = {
                idCredito,
                nombreCliente: cliente.nombreCompleto,
                fechaOperacion: fecha,
                claveIdempotencia: clave,
                montoRecibido: monto
            };

            // Idempotencia primero, como el servidor real.
            if (aplicadas.includes(clave)) {
                const r = {
                    ...comun,
                    aplicado: false,
                    duplicado: true,
                    cuotasCubiertas: [],
                    desglosePrelacion: { gastos: 0, interesMoratorio: 0, interesCorriente: 0, capital: 0, total: 0 },
                    estadoAntes: { ...antes, estado: "vigente", tramo: "al_dia", diasAtraso: 0, cuotasVencidas: 0 },
                    mensaje: `La clave ${clave} ya se habia registrado. El pago NO se volvio a aplicar y el saldo no se movio.`
                } as unknown as ResultadoPago;
                return responder(ruta, 200, r);
            }
            if (idCredito === CREDITO_INCOBRABLE) {
                return error(ruta, 409, "CREDITO_INCOBRABLE",
                    `El credito ${idCredito} lleva 130 dias de atraso y supera los 120 que obligan a la baja contable.`,
                    { diasAtraso: 130, estado: "en_mora", bajaPendiente: true });
            }
            if (exigibles.length === 0) {
                return error(ruta, 409, "CUOTA_YA_PAGADA", `El credito ${idCredito} no tiene cuotas vencidas.`, { cuotasVencidas: 0 });
            }
            if (monto.toFixed(2) !== desglose.total.toFixed(2)) {
                return error(ruta, 422, "MONTO_NO_EXACTO",
                    `El monto Q${monto.toFixed(2)} no corresponde a la deuda. El monto correcto es Q${desglose.total.toFixed(2)}.`,
                    { montoRecibido: monto, montoCorrecto: desglose.total, diferencia: 0, desglosePrelacion: desglose, cuotasCubiertas: exigibles });
            }
            if (b.confirmado !== true) {
                const r = {
                    ...comun,
                    aplicado: false,
                    duplicado: false,
                    cuotasCubiertas: exigibles,
                    desglosePrelacion: desglose,
                    estadoAntes: antes,
                    mensaje: "Vista previa. Requiere aprobacion humana."
                } as unknown as ResultadoPago;
                return responder(ruta, 200, r);
            }

            if (opciones.retrasoConfirmacionMs) {
                await new Promise(r => setTimeout(r, opciones.retrasoConfirmacionMs));
            }
            aplicadas.push(clave);

            if ((opciones.perderRespuestas ?? 0) > 0) {
                opciones.perderRespuestas = opciones.perderRespuestas! - 1;
                // El pago SÍ se aplicó, pero la respuesta nunca llega.
                return ruta.abort("connectionreset");
            }

            const r = {
                ...comun,
                aplicado: true,
                duplicado: false,
                cuotasCubiertas: exigibles,
                desglosePrelacion: desglose,
                estadoAntes: antes,
                estadoDespues: { estado: "vigente", tramo: "al_dia", diasAtraso: 0, saldoCapital: 1000, cuotasVencidas: 0 },
                mensaje: `Pago de Q${desglose.total.toFixed(2)} aplicado al credito ${idCredito}.`
            } as unknown as ResultadoPago;
            return responder(ruta, 201, r);
        }

        return error(ruta, 404, "RUTA_INEXISTENTE", `No existe la ruta ${metodo} ${p}.`);
    });

    return sim;
}
