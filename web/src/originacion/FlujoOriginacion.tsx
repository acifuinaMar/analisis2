import { useEffect, useRef, useState } from "react";

import { ErrorApi } from "../api/cliente";
import { buscarClientes, obtenerCredito, obtenerPlan } from "../api/cobro";
import type {
    ClienteEncontrado,
    CuerpoDesembolso,
    CuerpoSimulacion,
    EstadoCredito,
    PlanDeCredito,
    ResultadoDesembolso
} from "../api/contratos";
import { altaCliente, desembolsarCredito, listarAsesores, simularCredito } from "../api/originacion";
import { useConsulta } from "../api/useConsulta";
import { BusquedaClientes } from "../cobro/BusquedaClientes";
import { useSesion } from "../estado/sesion";
import { TablaPlan } from "../plan/TablaPlan";
import {
    Aviso,
    AvisoError,
    Boton,
    BotonEnlace,
    CampoSeleccion,
    CampoTexto,
    Cargando,
    CifraDestacada,
    Dialogo,
    EncabezadoTarjeta,
    ListaDatos,
    Pasos,
    Pestanas,
    Tabla,
    Tarjeta
} from "../ui";
import { formatoFecha, formatoQuetzales } from "../utilidades/formato";
import {
    borrarOriginacionPendiente,
    clasificarError,
    cuerpoDesembolso,
    guardarOriginacionPendiente,
    leerImporte,
    leerPlazo,
    leerTna,
    mismaSimulacion,
    normalizarId,
    PATRON_ID_CLIENTE,
    PATRON_ID_CREDITO,
    tnaComoPorcentaje,
    verificarAlta,
    verificarDesembolso,
    type ComparacionCampo,
    type DatosClienteNuevo,
    type DatosCredito,
    type EstadoEscritura,
    type OriginacionPendiente,
    type ResultadoVerificacion
} from "./operacionOriginacion";
import { RechazoOriginacion } from "./RechazoOriginacion";

/**
 * Solicitud de crédito = originación (OP-3), decisión D2 del equipo:
 *
 *   Cliente   nuevo (el alta es el PRIMER paso, E1) o existente
 *   Datos     identificador, monto, plazo, TNA en % (D3) y asesor
 *   Revisión  POST /api/creditos/simulacion: plan del servidor, no guarda
 *   Resultado POST /api/clientes (si es nuevo) y POST /api/creditos
 *
 * Las reglas para respuestas perdidas están en operacionOriginacion.ts.
 * Lo esencial: solo un 201 confirma; con el alta incierta nunca se
 * desembolsa; nada se reintenta solo; verificar es solo lectura.
 *
 * No hay seguimiento de solicitudes ni estados inventados: el backend no
 * los tiene.
 */

const TIEMPO_MAXIMO_MS = 20_000;
const PASOS = ["Cliente", "Datos", "Revisión", "Resultado"];

interface Escritura {
    readonly estado: EstadoEscritura;
    readonly intentos: number;
    /** Hubo un envío sin respuesta: un "duplicado" posterior no prueba nada. */
    readonly huboIncierto: boolean;
    readonly error?: ErrorApi;
    readonly verificacion?: { resultado: ResultadoVerificacion; campos: ReadonlyArray<ComparacionCampo> };
    readonly errorVerificacion?: ErrorApi;
}

const SIN_ENVIAR: Escritura = { estado: "sin_enviar", intentos: 0, huboIncierto: false };

const CLIENTE_VACIO: DatosClienteNuevo = { idCliente: "", nombreCompleto: "", dpi: "", telefono: "", municipio: "" };

function comoErrorApi(e: unknown): ErrorApi {
    return e instanceof ErrorApi ? e : new ErrorApi(0, "SIN_RESPUESTA", "No llegó la respuesta del servidor.");
}

export function FlujoOriginacion({ pendienteInicial }: { pendienteInicial: OriginacionPendiente | null }) {
    const { api, fechaCorte } = useSesion();

    // --- Estado inicial (con o sin una operación pendiente de antes) -----
    const restaurada = pendienteInicial;
    const [paso, setPaso] = useState(restaurada ? 2 : 0);
    const [modo, setModo] = useState<"nuevo" | "existente">(restaurada?.paso === "desembolso" ? "existente" : "nuevo");
    const [existente, setExistente] = useState<ClienteEncontrado | null>(null);
    const [cliente, setCliente] = useState<DatosClienteNuevo>(
        restaurada?.paso === "alta" ? { ...CLIENTE_VACIO, idCliente: restaurada.idCliente } : CLIENTE_VACIO
    );
    const [credito, setCredito] = useState(() => restaurada
        ? {
            idCredito: restaurada.credito.idCredito,
            capital: restaurada.credito.capital.toFixed(2),
            plazo: String(restaurada.credito.plazoMeses),
            tna: tnaComoPorcentaje(restaurada.credito.tnaAnual).replace(" %", ""),
            idAsesor: restaurada.credito.idAsesor
        }
        : { idCredito: "", capital: "", plazo: "", tna: "", idAsesor: "" });
    const [errores, setErrores] = useState<Record<string, string>>({});

    const [alta, setAlta] = useState<Escritura>(
        restaurada?.paso === "alta" ? { estado: "incierta", intentos: 1, huboIncierto: true } : SIN_ENVIAR
    );
    const [desembolso, setDesembolso] = useState<Escritura>(
        restaurada?.paso === "desembolso" ? { estado: "incierta", intentos: 1, huboIncierto: true } : SIN_ENVIAR
    );
    /** Lo que se ENVIÓ (fijo). Los datos personales viven solo en memoria. */
    const [enviadoCliente, setEnviadoCliente] = useState<DatosClienteNuevo | null>(null);
    const [enviadoCredito, setEnviadoCredito] = useState<CuerpoDesembolso | null>(
        restaurada?.paso === "desembolso" ? cuerpoDesembolso(restaurada.idCliente, restaurada.credito) : null
    );
    /** Créditos del alta incierta (para un reintento manual del alta). */
    const [creditoDelAlta, setCreditoDelAlta] = useState<DatosCredito | null>(restaurada?.paso === "alta" ? restaurada.credito : null);
    const [resultado, setResultado] = useState<ResultadoDesembolso | null>(null);
    const [verificando, setVerificando] = useState(false);
    const [descartar, setDescartar] = useState(false);
    const enVuelo = useRef(false);

    const asesores = useConsulta(s => listarAsesores(api, s), []);

    // --- Datos derivados del formulario ---------------------------------
    const fecha = restaurada ? restaurada.credito.fechaDesembolso : fechaCorte;
    const capital = leerImporte(credito.capital);
    const plazo = leerPlazo(credito.plazo);
    const tna = leerTna(credito.tna);
    const cuerpoSimulacion: CuerpoSimulacion | null = capital !== null && plazo !== null && tna !== null
        ? { capital, plazoMeses: plazo, tnaAnual: tna, fechaDesembolso: fecha }
        : null;
    const datosCredito: DatosCredito | null = cuerpoSimulacion && PATRON_ID_CREDITO.test(normalizarId(credito.idCredito)) && credito.idAsesor
        ? { ...cuerpoSimulacion, idCredito: normalizarId(credito.idCredito), idAsesor: credito.idAsesor }
        : null;
    const datosCliente: DatosClienteNuevo = { ...cliente, idCliente: normalizarId(cliente.idCliente) };
    const idClienteObjetivo = modo === "existente" ? (existente?.idCliente ?? restaurada?.idCliente ?? "") : datosCliente.idCliente;

    const altaPendiente = alta.estado === "enviando" || alta.estado === "incierta";
    const desembolsoPendiente = desembolso.estado === "enviando" || desembolso.estado === "incierta";
    const bloqueado = altaPendiente || desembolsoPendiente;
    const altaHecha = alta.estado === "confirmada";

    // Simulación (solo lectura) en el paso de revisión.
    const simulacion = useConsulta(
        s => simularCredito(api, cuerpoSimulacion!, s),
        [JSON.stringify(cuerpoSimulacion)],
        paso === 2 && cuerpoSimulacion !== null && !bloqueado && desembolso.estado !== "confirmada"
    );
    const simulacionVigente = Boolean(
        simulacion.datos && cuerpoSimulacion && !simulacion.cargando && !simulacion.error
        && mismaSimulacion(simulacion.datos, cuerpoSimulacion)
    );

    // Cambiar el identificador del cliente es OTRA alta: se olvida el rechazo anterior.
    useEffect(() => {
        setAlta(a => (a.estado === "rechazada" ? SIN_ENVIAR : a));
    }, [datosCliente.idCliente]);
    useEffect(() => {
        setDesembolso(d => (d.estado === "rechazada" ? SIN_ENVIAR : d));
    }, [datosCredito?.idCredito]);

    // ------------------------------------------------------------------
    // Validación de formato antes de avanzar (los límites los decide el servidor)
    // ------------------------------------------------------------------

    const validarCliente = (): boolean => {
        const e: Record<string, string> = {};
        if (modo === "existente") {
            if (!existente) {
                e.existente = "Busque y elija un cliente.";
            }
        } else {
            if (!PATRON_ID_CLIENTE.test(datosCliente.idCliente)) e.idCliente = "Use la forma CL-NNNN.";
            if (!datosCliente.nombreCompleto.trim()) e.nombreCompleto = "Obligatorio.";
            if (!datosCliente.dpi.trim()) e.dpi = "Obligatorio.";
            if (!datosCliente.telefono.trim()) e.telefono = "Obligatorio.";
            if (!datosCliente.municipio.trim()) e.municipio = "Obligatorio.";
        }
        setErrores(e);
        return Object.keys(e).length === 0;
    };

    const validarCredito = (): boolean => {
        const e: Record<string, string> = {};
        if (!PATRON_ID_CREDITO.test(normalizarId(credito.idCredito))) e.idCredito = "Use la forma CV-AAAA-NNNN.";
        if (capital === null) e.capital = "Escriba un monto positivo con a lo sumo dos decimales.";
        if (plazo === null) e.plazo = "Escriba un número entero de meses.";
        if (tna === null) e.tna = "Escriba la tasa en porcentaje, por ejemplo 36.";
        if (!credito.idAsesor) e.idAsesor = "Elija el asesor.";
        setErrores(e);
        return Object.keys(e).length === 0;
    };

    // ------------------------------------------------------------------
    // Escrituras (solo por clic)
    // ------------------------------------------------------------------

    /** Alta del cliente. Devuelve true solo con 201. */
    const enviarAlta = async (datos: DatosClienteNuevo, terminos: DatosCredito): Promise<boolean> => {
        const previoIncierto = alta.huboIncierto;
        setEnviadoCliente(datos);
        setCreditoDelAlta(terminos);
        guardarOriginacionPendiente({ paso: "alta", estado: "enviando", idCliente: datos.idCliente, credito: terminos });
        setAlta(a => ({ ...a, estado: "enviando", intentos: a.intentos + 1, error: undefined, verificacion: undefined, errorVerificacion: undefined }));
        try {
            await altaCliente(api, { ...datos, fechaOperacion: terminos.fechaDesembolso }, AbortSignal.timeout(TIEMPO_MAXIMO_MS));
            borrarOriginacionPendiente();
            setAlta(a => ({ ...a, estado: "confirmada" }));
            return true;
        } catch (e) {
            const error = comoErrorApi(e);
            if (clasificarError(e, previoIncierto) === "incierta") {
                guardarOriginacionPendiente({ paso: "alta", estado: "incierta", idCliente: datos.idCliente, credito: terminos });
                setAlta(a => ({ ...a, estado: "incierta", huboIncierto: true, error }));
            } else {
                borrarOriginacionPendiente();
                setAlta(a => ({ ...a, estado: "rechazada", error }));
                // El rechazo del alta se corrige en el paso del cliente.
                setPaso(0);
            }
            return false;
        }
    };

    const enviarDesembolso = async (cuerpo: CuerpoDesembolso): Promise<void> => {
        const previoIncierto = desembolso.huboIncierto;
        const terminos: DatosCredito = {
            idCredito: cuerpo.idCredito, idAsesor: cuerpo.idAsesor, capital: cuerpo.capital,
            plazoMeses: cuerpo.plazoMeses, tnaAnual: cuerpo.tnaAnual, fechaDesembolso: cuerpo.fechaDesembolso
        };
        setEnviadoCredito(cuerpo);
        guardarOriginacionPendiente({ paso: "desembolso", estado: "enviando", idCliente: cuerpo.idCliente, credito: terminos });
        setDesembolso(d => ({ ...d, estado: "enviando", intentos: d.intentos + 1, error: undefined, verificacion: undefined, errorVerificacion: undefined }));
        try {
            const r = await desembolsarCredito(api, cuerpo, AbortSignal.timeout(TIEMPO_MAXIMO_MS));
            borrarOriginacionPendiente();
            setResultado(r);
            setDesembolso(d => ({ ...d, estado: "confirmada" }));
            setPaso(3);
        } catch (e) {
            const error = comoErrorApi(e);
            if (clasificarError(e, previoIncierto) === "incierta") {
                guardarOriginacionPendiente({ paso: "desembolso", estado: "incierta", idCliente: cuerpo.idCliente, credito: terminos });
                setDesembolso(d => ({ ...d, estado: "incierta", huboIncierto: true, error }));
            } else {
                borrarOriginacionPendiente();
                setDesembolso(d => ({ ...d, estado: "rechazada", error }));
            }
        }
    };

    /**
     * Confirmación de la solicitud: alta (si hace falta) y desembolso con
     * los datos SIMULADOS. Si el alta no se confirma con 201, se detiene.
     */
    const confirmar = async () => {
        if (enVuelo.current || bloqueado || !simulacionVigente || !datosCredito) {
            return;
        }
        enVuelo.current = true;
        try {
            if (modo === "nuevo" && !altaHecha) {
                const ok = await enviarAlta(datosCliente, datosCredito);
                if (!ok) {
                    return;
                }
            }
            await enviarDesembolso(cuerpoDesembolso(idClienteObjetivo, datosCredito));
        } finally {
            enVuelo.current = false;
        }
    };

    /** Reintento MANUAL tras verificar "no consta". Nunca encadena el desembolso. */
    const reintentarAlta = async () => {
        if (enVuelo.current || !enviadoCliente || !creditoDelAlta) {
            return;
        }
        enVuelo.current = true;
        try {
            await enviarAlta(enviadoCliente, creditoDelAlta);
        } finally {
            enVuelo.current = false;
        }
    };

    const reintentarDesembolso = async () => {
        if (enVuelo.current || !enviadoCredito) {
            return;
        }
        enVuelo.current = true;
        try {
            await enviarDesembolso(enviadoCredito);
        } finally {
            enVuelo.current = false;
        }
    };

    // ------------------------------------------------------------------
    // Verificación (solo lecturas)
    // ------------------------------------------------------------------

    const verificar = async () => {
        if (verificando) {
            return;
        }
        setVerificando(true);
        try {
            if (alta.estado === "incierta") {
                const id = enviadoCliente?.idCliente ?? cliente.idCliente;
                try {
                    const r = await buscarClientes(api, id);
                    const v = verificarAlta(id, enviadoCliente, r.resultados);
                    if (v.resultado === "conflicto") {
                        // El identificador es de otro cliente: esta alta no lo creó.
                        borrarOriginacionPendiente();
                        setAlta({ ...SIN_ENVIAR, estado: "rechazada", verificacion: v,
                            error: new ErrorApi(409, "CLIENTE_DUPLICADO", `El cliente ${id} ya existe con otros datos.`) });
                        setPaso(0);
                    } else {
                        setAlta(a => ({ ...a, verificacion: v, errorVerificacion: undefined }));
                    }
                } catch (e) {
                    setAlta(a => ({ ...a, errorVerificacion: comoErrorApi(e) }));
                }
            } else if (desembolso.estado === "incierta" && enviadoCredito) {
                try {
                    let estado: EstadoCredito | null = null;
                    let plan: PlanDeCredito | null = null;
                    try {
                        estado = await obtenerCredito(api, enviadoCredito.idCredito, enviadoCredito.fechaDesembolso);
                    } catch (e) {
                        if (!(e instanceof ErrorApi && e.codigo === "CREDITO_INEXISTENTE")) {
                            throw e;
                        }
                    }
                    if (estado) {
                        plan = await obtenerPlan(api, enviadoCredito.idCredito, enviadoCredito.fechaDesembolso);
                    }
                    const v = verificarDesembolso(enviadoCredito, estado, plan);
                    if (v.resultado === "conflicto") {
                        borrarOriginacionPendiente();
                        setDesembolso({ ...SIN_ENVIAR, estado: "rechazada", verificacion: v,
                            error: new ErrorApi(409, "CREDITO_DUPLICADO", `El crédito ${enviadoCredito.idCredito} ya existe con otros datos.`) });
                        setPaso(1);
                    } else {
                        setDesembolso(d => ({ ...d, verificacion: v, errorVerificacion: undefined }));
                    }
                } catch (e) {
                    setDesembolso(d => ({ ...d, errorVerificacion: comoErrorApi(e) }));
                }
            }
        } finally {
            setVerificando(false);
        }
    };

    const reiniciar = () => {
        borrarOriginacionPendiente();
        window.location.assign("/asesor/solicitud");
    };

    // ------------------------------------------------------------------
    // Pantalla
    // ------------------------------------------------------------------

    const pasoMostrado = desembolso.estado === "confirmada" ? 3 : bloqueado ? 2 : paso;

    return (
        <div className="space-y-5">
            <Tarjeta className="p-4">
                <Pasos pasos={PASOS} actual={pasoMostrado} />
            </Tarjeta>

            {bloqueado ? (
                <PanelIncierto
                    alta={alta}
                    desembolso={desembolso}
                    idCliente={enviadoCliente?.idCliente ?? (restaurada?.idCliente ?? idClienteObjetivo)}
                    idCredito={enviadoCredito?.idCredito ?? creditoDelAlta?.idCredito ?? datosCredito?.idCredito ?? ""}
                    restaurada={Boolean(restaurada) && !enviadoCliente}
                    verificando={verificando}
                    puedeReintentarAlta={Boolean(enviadoCliente) && alta.verificacion?.resultado === "no_consta"}
                    puedeReintentarDesembolso={desembolso.verificacion?.resultado === "no_consta"}
                    alVerificar={() => void verificar()}
                    alReintentarAlta={() => void reintentarAlta()}
                    alReintentarDesembolso={() => void reintentarDesembolso()}
                    alDescartar={() => setDescartar(true)}
                />
            ) : null}

            {!bloqueado && desembolso.estado === "confirmada" && resultado ? (
                <ResultadoOriginacion resultado={resultado} clienteNuevo={modo === "nuevo"} alNueva={reiniciar} />
            ) : null}

            {!bloqueado && desembolso.estado !== "confirmada" && paso === 0 ? (
                <Tarjeta className="space-y-4 p-4">
                    <EncabezadoTarjeta titulo="Cliente" subtitulo="El alta del cliente es el primer paso de la solicitud." />
                    {altaHecha ? (
                        <Aviso tipo="exito" titulo={`Cliente ${datosCliente.idCliente} registrado`}>
                            El alta ya se confirmó; no se volverá a enviar.
                        </Aviso>
                    ) : (
                        <>
                            <Pestanas
                                etiqueta="Tipo de cliente"
                                opciones={[{ valor: "nuevo", etiqueta: "Cliente nuevo" }, { valor: "existente", etiqueta: "Cliente existente" }] as const}
                                valor={modo}
                                alCambiar={v => { setModo(v); setErrores({}); }}
                            />
                            {modo === "nuevo" ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <CampoTexto etiqueta="Identificador del cliente" placeholder="CL-0000" autoComplete="off" maxLength={7}
                                        value={cliente.idCliente} error={errores.idCliente}
                                        onChange={e => setCliente({ ...cliente, idCliente: e.target.value })} />
                                    <CampoTexto etiqueta="Nombre completo" autoComplete="off" maxLength={120}
                                        value={cliente.nombreCompleto} error={errores.nombreCompleto}
                                        onChange={e => setCliente({ ...cliente, nombreCompleto: e.target.value })} />
                                    <CampoTexto etiqueta="DPI" autoComplete="off" maxLength={30}
                                        value={cliente.dpi} error={errores.dpi}
                                        onChange={e => setCliente({ ...cliente, dpi: e.target.value })} />
                                    <CampoTexto etiqueta="Teléfono" autoComplete="off" inputMode="tel" maxLength={30}
                                        value={cliente.telefono} error={errores.telefono}
                                        onChange={e => setCliente({ ...cliente, telefono: e.target.value })} />
                                    <CampoTexto etiqueta="Municipio" autoComplete="off" maxLength={80}
                                        value={cliente.municipio} error={errores.municipio}
                                        onChange={e => setCliente({ ...cliente, municipio: e.target.value })} />
                                </div>
                            ) : existente ? (
                                <div className="space-y-2">
                                    <ListaDatos pares={[
                                        { etiqueta: "Cliente", valor: existente.nombreCompleto },
                                        { etiqueta: "Identificador", valor: existente.idCliente },
                                        { etiqueta: "DPI", valor: `•••• ${existente.dpiTerminacion}` }
                                    ]} />
                                    <Boton variante="fantasma" tamano="sm" onClick={() => setExistente(null)}>Elegir otro cliente</Boton>
                                </div>
                            ) : (
                                <>
                                    <BusquedaClientes accion="detalle" alSeleccionar={c => { setExistente(c); setErrores({}); }} />
                                    {errores.existente ? <p role="alert" className="text-sm text-peligro">{errores.existente}</p> : null}
                                </>
                            )}
                        </>
                    )}
                    {alta.estado === "rechazada" && alta.error ? <RechazoOriginacion error={alta.error} /> : null}
                    <Boton bloque tamano="lg" onClick={() => { if (altaHecha || validarCliente()) setPaso(1); }}>Siguiente</Boton>
                </Tarjeta>
            ) : null}

            {!bloqueado && desembolso.estado !== "confirmada" && paso === 1 ? (
                <Tarjeta className="space-y-4 p-4">
                    <EncabezadoTarjeta
                        titulo="Datos del crédito"
                        subtitulo={`Cliente ${idClienteObjetivo}. Fecha de desembolso: ${formatoFecha(fecha)} (fecha de corte del encabezado).`}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <CampoTexto etiqueta="Identificador del crédito" placeholder="CV-2026-0000" autoComplete="off" maxLength={12}
                            value={credito.idCredito} error={errores.idCredito}
                            onChange={e => setCredito({ ...credito, idCredito: e.target.value })} />
                        <CampoTexto etiqueta="Monto solicitado" prefijo="Q" inputMode="decimal" autoComplete="off"
                            value={credito.capital} error={errores.capital}
                            onChange={e => setCredito({ ...credito, capital: e.target.value })} />
                        <CampoTexto etiqueta="Plazo (meses)" inputMode="numeric" autoComplete="off"
                            value={credito.plazo} error={errores.plazo}
                            onChange={e => setCredito({ ...credito, plazo: e.target.value })} />
                        <CampoTexto etiqueta="Tasa nominal anual (%)" inputMode="decimal" autoComplete="off" placeholder="36"
                            value={credito.tna} error={errores.tna}
                            ayuda="Se pacta con el cliente. 36 significa 36 % nominal anual."
                            onChange={e => setCredito({ ...credito, tna: e.target.value })} />
                        {asesores.error ? (
                            <AvisoError error={asesores.error} alReintentar={asesores.recargar} />
                        ) : (
                            <CampoSeleccion etiqueta="Asesor" vacia={asesores.cargando ? "Cargando…" : "Elija el asesor"}
                                value={credito.idAsesor} error={errores.idAsesor}
                                onChange={e => setCredito({ ...credito, idAsesor: e.target.value })}
                                opciones={(asesores.datos?.asesores ?? []).map(a => ({ valor: a.idAsesor, etiqueta: `${a.idAsesor} · ${a.nombreCompleto}` }))} />
                        )}
                    </div>
                    {desembolso.estado === "rechazada" && desembolso.error ? <RechazoOriginacion error={desembolso.error} /> : null}
                    {desembolso.verificacion?.resultado === "conflicto" ? <TablaComparacion campos={desembolso.verificacion.campos} /> : null}
                    <div className="flex flex-col gap-2 sm:flex-row-reverse">
                        <Boton bloque tamano="lg" onClick={() => { if (validarCredito()) setPaso(2); }}>Revisar la solicitud</Boton>
                        <Boton bloque variante="secundario" onClick={() => setPaso(0)}>Volver</Boton>
                    </div>
                </Tarjeta>
            ) : null}

            {!bloqueado && desembolso.estado !== "confirmada" && paso === 2 ? (
                <div className="space-y-4">
                    <Tarjeta className="space-y-4 p-4">
                        <EncabezadoTarjeta titulo="Revisión de la solicitud" subtitulo="Plan calculado por el servidor. Todavía no se ha guardado nada." separador />
                        {cuerpoSimulacion ? (
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                                <CifraDestacada etiqueta="Monto solicitado" valor={formatoQuetzales(cuerpoSimulacion.capital)} />
                                <CifraDestacada etiqueta="Plazo" valor={`${cuerpoSimulacion.plazoMeses} meses`} />
                                <CifraDestacada etiqueta="Tasa nominal anual" valor={tnaComoPorcentaje(cuerpoSimulacion.tnaAnual)} />
                            </div>
                        ) : null}
                        <ListaDatos pares={[
                            { etiqueta: "Cliente", valor: modo === "existente" ? `${existente?.nombreCompleto ?? ""} · ${idClienteObjetivo}` : `${datosCliente.nombreCompleto} · ${idClienteObjetivo} (nuevo)` },
                            { etiqueta: "Crédito", valor: datosCredito?.idCredito ?? "—" },
                            { etiqueta: "Asesor", valor: datosCredito?.idAsesor ?? "—" },
                            { etiqueta: "Desembolso", valor: formatoFecha(fecha) }
                        ]} />
                    </Tarjeta>

                    {simulacion.cargando ? <Cargando texto="Calculando el plan en el servidor…" /> : null}
                    {simulacion.error ? <RechazoOriginacion error={simulacion.error} /> : null}

                    {simulacionVigente && simulacion.datos ? (
                        <>
                            <Tarjeta className="p-4">
                                <EncabezadoTarjeta titulo="Resumen del plan" separador />
                                <ListaDatos pares={[
                                    { etiqueta: "Cuota mensual", valor: simulacion.datos.cuotas[0] ? formatoQuetzales(simulacion.datos.cuotas[0].cuota) : "—", enfasis: true },
                                    { etiqueta: "Total a pagar", valor: formatoQuetzales(simulacion.datos.totales.cuotas) },
                                    { etiqueta: "Interés total", valor: formatoQuetzales(simulacion.datos.totales.intereses) }
                                ]} />
                            </Tarjeta>
                            <TablaPlan titulo="Plan de amortización simulado" filas={simulacion.datos.cuotas} />
                        </>
                    ) : null}

                    {desembolso.estado === "rechazada" && desembolso.error ? <RechazoOriginacion error={desembolso.error} /> : null}

                    <div className="flex flex-col gap-2 sm:flex-row-reverse">
                        <Boton
                            bloque
                            tamano="lg"
                            icono="check"
                            disabled={!simulacionVigente || !datosCredito}
                            onClick={() => void confirmar()}
                        >
                            {modo === "nuevo" && !altaHecha ? "Confirmar: dar de alta y desembolsar" : "Confirmar el desembolso"}
                        </Boton>
                        <Boton bloque variante="secundario" onClick={() => setPaso(1)}>Corregir datos</Boton>
                    </div>
                </div>
            ) : null}

            <Dialogo
                abierto={descartar}
                titulo="¿Descartar esta solicitud?"
                alCerrar={() => setDescartar(false)}
                acciones={(
                    <>
                        <Boton variante="secundario" onClick={() => setDescartar(false)}>Volver</Boton>
                        <Boton variante="peligro" onClick={reiniciar}>Descartar</Boton>
                    </>
                )}
            >
                <p className="text-sm text-texto-medio">
                    No se sabe si la operación pendiente se registró. Si se registró y se vuelve a solicitar con otro
                    identificador, quedaría duplicada. Revise antes el cliente o el crédito.
                </p>
            </Dialogo>
        </div>
    );
}

// ----------------------------------------------------------------------

interface PropsPanelIncierto {
    readonly alta: Escritura;
    readonly desembolso: Escritura;
    readonly idCliente: string;
    readonly idCredito: string;
    readonly restaurada: boolean;
    readonly verificando: boolean;
    readonly puedeReintentarAlta: boolean;
    readonly puedeReintentarDesembolso: boolean;
    readonly alVerificar: () => void;
    readonly alReintentarAlta: () => void;
    readonly alReintentarDesembolso: () => void;
    readonly alDescartar: () => void;
}

/**
 * Lo que se ve cuando una escritura está en curso o es incierta. Bloquea
 * el formulario: mientras no se resuelva, no se envía nada más.
 */
function PanelIncierto(p: PropsPanelIncierto) {
    const enCurso = p.alta.estado === "enviando" || p.desembolso.estado === "enviando";
    if (enCurso) {
        return <Cargando texto={p.alta.estado === "enviando" ? "Registrando el cliente…" : "Registrando el desembolso…"} />;
    }

    const esAlta = p.alta.estado === "incierta";
    const escritura = esAlta ? p.alta : p.desembolso;
    const v = escritura.verificacion;

    return (
        <Tarjeta className="space-y-3 border-amber-300 p-4">
            <Aviso tipo="alerta" titulo="Resultado incierto">
                {esAlta ? (
                    <>
                        Se envió el alta del cliente <strong>{p.idCliente}</strong> y no llegó la respuesta. No se sabe si
                        quedó registrado. <strong>El desembolso no se enviará</strong> mientras esto no se resuelva.
                    </>
                ) : (
                    <>
                        Se envió el desembolso del crédito <strong>{p.idCredito}</strong> y no llegó la respuesta. No se
                        sabe si quedó registrado. No se reintentará solo.
                    </>
                )}
            </Aviso>

            {escritura.error ? (
                <p className="text-xs text-texto-suave">Último intento: {escritura.error.message} ({escritura.error.codigo})</p>
            ) : null}

            {!v ? (
                <p className="text-sm text-texto-medio">
                    Verifique el estado: solo se hacen consultas, no se escribe nada.
                </p>
            ) : v.resultado === "no_consta" ? (
                <Aviso tipo="info" titulo={esAlta ? `No se encontró el cliente ${p.idCliente}` : `No se encontró el crédito ${p.idCredito}`}>
                    {esAlta && p.restaurada
                        ? "Después de recargar, los datos personales no se conservan: descarte esta solicitud y vuelva a ingresarlos."
                        : "Puede reintentar el envío con los mismos datos. El identificador es único: un reintento no puede crear un segundo registro."}
                </Aviso>
            ) : (
                <Aviso tipo="alerta" titulo={esAlta ? `Existe un cliente ${p.idCliente}` : `Existe el crédito ${p.idCredito}`}>
                    {esAlta
                        ? (p.restaurada
                            ? "Tras recargar no se conservan los datos personales para compararlo. "
                            : "Coinciden el nombre, el municipio y los últimos 4 del DPI. ")
                          + "La API no muestra el DPI completo ni el teléfono, así que no se puede confirmar que sea esta alta. "
                          + "El resultado sigue incierto y no se desembolsará desde esta solicitud."
                        : "Coinciden el titular, el monto, el plazo, la tasa y la fecha. La API no muestra el asesor ni un "
                          + "identificador de la operación, así que no se puede confirmar que lo creó este envío. "
                          + "El resultado sigue incierto."}
                </Aviso>
            )}

            {v && v.campos.length > 0 ? <TablaComparacion campos={v.campos} /> : null}
            {escritura.errorVerificacion ? <AvisoError error={escritura.errorVerificacion} /> : null}

            <div className="flex flex-col gap-2">
                <Boton icono="buscar" bloque variante="secundario" cargando={p.verificando} onClick={p.alVerificar}>
                    Verificar el estado
                </Boton>
                {p.puedeReintentarAlta ? (
                    <Boton bloque onClick={p.alReintentarAlta}>Reintentar el alta (mismos datos)</Boton>
                ) : null}
                {p.puedeReintentarDesembolso ? (
                    <Boton bloque onClick={p.alReintentarDesembolso}>Reintentar el desembolso (mismos datos)</Boton>
                ) : null}
                {!esAlta && v?.resultado === "coincidencia" ? (
                    <BotonEnlace a={`/asesor/creditos/${encodeURIComponent(p.idCredito)}`} variante="fantasma" bloque>
                        Ver el crédito {p.idCredito}
                    </BotonEnlace>
                ) : null}
                <Boton variante="fantasma" bloque onClick={p.alDescartar}>Descartar esta solicitud</Boton>
            </div>
        </Tarjeta>
    );
}

function TablaComparacion({ campos }: { campos: ReadonlyArray<ComparacionCampo> }) {
    return (
        <Tabla
            titulo="Comparación con lo enviado"
            claveFila={c => c.campo}
            filas={campos}
            columnas={[
                { clave: "c", titulo: "Dato", celda: c => c.campo },
                { clave: "e", titulo: "Enviado", celda: c => c.enviado },
                { clave: "f", titulo: "Encontrado", celda: c => c.encontrado },
                { clave: "x", titulo: "", celda: c => (c.coincide ? "✓" : "✗ distinto") }
            ]}
        />
    );
}

function ResultadoOriginacion({ resultado, clienteNuevo, alNueva }: { resultado: ResultadoDesembolso; clienteNuevo: boolean; alNueva: () => void }) {
    const p = resultado.plan;
    const ruta = encodeURIComponent(resultado.idCredito);
    return (
        <section aria-label="Resultado de la solicitud" className="space-y-4">
            <Aviso tipo="exito" titulo="Crédito desembolsado">
                {clienteNuevo ? `Se dio de alta el cliente ${resultado.idCliente} y se desembolsó el crédito.` : "Se desembolsó el crédito."}
            </Aviso>
            <Tarjeta className="p-4">
                <EncabezadoTarjeta titulo="Detalle del desembolso" separador />
                <ListaDatos pares={[
                    { etiqueta: "Crédito", valor: resultado.idCredito },
                    { etiqueta: "Cliente", valor: resultado.idCliente },
                    { etiqueta: "Asesor", valor: resultado.idAsesor },
                    { etiqueta: "Monto desembolsado", valor: formatoQuetzales(p.capital), enfasis: true },
                    { etiqueta: "Plazo", valor: `${p.plazoMeses} meses` },
                    { etiqueta: "Tasa", valor: `${tnaComoPorcentaje(p.tnaAnual)} nominal anual` },
                    { etiqueta: "Fecha", valor: formatoFecha(p.fechaDesembolso) },
                    { etiqueta: "Cuota mensual", valor: p.cuotas[0] ? formatoQuetzales(p.cuotas[0].cuota) : "—" },
                    { etiqueta: "Total a pagar", valor: formatoQuetzales(p.totales.cuotas) },
                    { etiqueta: "Interés total", valor: formatoQuetzales(p.totales.intereses) }
                ]} />
            </Tarjeta>
            <TablaPlan titulo="Plan de amortización del crédito" filas={p.cuotas} />
            <div className="flex flex-col gap-2">
                <BotonEnlace a={`/asesor/creditos/${ruta}`} bloque>Ver el detalle del crédito</BotonEnlace>
                <BotonEnlace a={`/asesor/creditos/${ruta}/plan`} variante="secundario" bloque>Ver el plan con su estado</BotonEnlace>
                <Boton variante="fantasma" bloque onClick={alNueva}>Nueva solicitud</Boton>
            </div>
        </section>
    );
}
