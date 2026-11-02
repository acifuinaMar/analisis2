import { useEffect, useRef, useState } from "react";

import { ErrorApi } from "../api/cliente";
import { obtenerCredito, obtenerDeuda, registrarPago } from "../api/cobro";
import type { CanalPago, ResultadoPago } from "../api/contratos";
import { useConsulta } from "../api/useConsulta";
import { TarjetaAprobacion } from "../chat/TarjetaAprobacion";
import { useSesion } from "../estado/sesion";
import {
    Aviso,
    AvisoError,
    Boton,
    BotonEnlace,
    CampoSeleccion,
    CampoTexto,
    Cargando,
    ChipEstado,
    Desglose,
    Dialogo,
    EncabezadoTarjeta,
    ListaDatos,
    Pasos,
    Tabla,
    Tarjeta
} from "../ui";
import { CANALES_PAGO, etiquetaTramo } from "../utilidades/etiquetas";
import { formatoFecha, formatoQuetzales } from "../utilidades/formato";
import {
    borrarPendiente,
    estaCerrada,
    estaPendiente,
    guardarPendiente,
    leerMonto,
    mismosDatos,
    operacionPara,
    type DatosPago,
    type OperacionPago
} from "./operacionPago";
import { RechazoPago } from "./RechazoPago";

/**
 * Registro de pago con aprobación humana (OP-1, OP-2, OP-4, OP-5, OP-6).
 *
 *   1. Datos      monto (precargado de GET /deuda), canal; la fecha de
 *                 operación es la fecha de corte del encabezado.
 *   2. Revisión   POST /pagos con confirmado:false -> desglose del servidor.
 *   3. Confirmar  POST /pagos con confirmado:true, con EXACTAMENTE los
 *                 datos y la clave que se previsualizaron.
 *   4. Resultado  aplicado, duplicado, rechazado o INCIERTO.
 *
 * Nada se envía con confirmado:true sin un clic explícito sobre una vista
 * previa vigente. Cualquier cambio de crédito, monto, fecha o canal
 * invalida la vista previa (la deja de mostrar y de aceptar).
 */

const TIEMPO_MAXIMO_CONFIRMACION_MS = 20_000;

const ETIQUETA_CANAL: Record<CanalPago, string> = Object.fromEntries(
    CANALES_PAGO.map(c => [c.valor, c.etiqueta])
) as Record<CanalPago, string>;

/** Errores 4xx: el servidor RESPONDIÓ que no; el pago no se aplicó. */
function esRechazoDefinitivo(e: unknown): boolean {
    return e instanceof ErrorApi && e.estado >= 400 && e.estado < 500;
}

interface PropsFlujoPago {
    readonly idCredito: string;
    /** Operación recuperada tras recargar (siempre "incierta"), si es de este crédito. */
    readonly pendienteInicial: OperacionPago | null;
}

export function FlujoPago({ idCredito, pendienteInicial }: PropsFlujoPago) {
    const { api, fechaCorte } = useSesion();

    const credito = useConsulta(s => obtenerCredito(api, idCredito, fechaCorte, s), [idCredito, fechaCorte]);
    const deuda = useConsulta(s => obtenerDeuda(api, idCredito, fechaCorte, s), [idCredito, fechaCorte]);

    const [op, setOp] = useState<OperacionPago | null>(pendienteInicial);
    const [montoTexto, setMontoTexto] = useState(pendienteInicial ? pendienteInicial.datos.monto.toFixed(2) : "");
    const [montoEditado, setMontoEditado] = useState(Boolean(pendienteInicial));
    const [canal, setCanal] = useState<CanalPago>(pendienteInicial?.datos.canal ?? "campo");

    /** Vista previa y la operación exacta a la que corresponde. */
    const [vista, setVista] = useState<{ op: OperacionPago; r: ResultadoPago } | null>(null);
    const [rechazo, setRechazo] = useState<ErrorApi | null>(null);
    const [respuestas, setRespuestas] = useState<ResultadoPago[]>([]);
    const [enviando, setEnviando] = useState<"vista" | "confirmacion" | null>(null);
    const [descartar, setDescartar] = useState(false);

    // Barrera contra el doble clic: el estado de React se actualiza después
    // del render, pero una referencia cambia al instante.
    const enVuelo = useRef(false);

    // Precarga el monto exacto que calculó el servidor, mientras la persona
    // no lo haya cambiado y no haya una operación pendiente.
    useEffect(() => {
        if (!montoEditado && deuda.datos && !estaPendiente(op)) {
            setMontoTexto(deuda.datos.cuotasExigibles.length > 0 ? deuda.datos.montoExacto.toFixed(2) : "");
        }
    }, [deuda.datos, montoEditado, op]);

    const pendiente = estaPendiente(op);
    const cerrada = estaCerrada(op);

    const monto = leerMonto(montoTexto);
    const datosFormulario: DatosPago | null = monto === null
        ? null
        : { idCredito, monto, fechaOperacion: fechaCorte, canal };

    // La vista previa vale solo si la operación sigue siendo la misma y
    // los datos del formulario no cambiaron desde que se pidió.
    const vistaVigente = vista !== null
        && op !== null
        && op.estado === "borrador"
        && vista.op.clave === op.clave
        && datosFormulario !== null
        && mismosDatos(vista.op.datos, datosFormulario);

    const paso = cerrada || respuestas.length > 0 ? 2 : vistaVigente || pendiente ? 1 : 0;

    // Un cambio en los datos descarta el rechazo anterior (era de otros
    // datos) y DESCARTA la vista previa: aunque luego se vuelva a escribir
    // el mismo monto, hay que pedir una vista previa nueva.
    const firma = datosFormulario ? `${datosFormulario.monto.toFixed(2)}|${datosFormulario.fechaOperacion}|${datosFormulario.canal}` : "";
    useEffect(() => {
        setRechazo(null);
        setVista(actual => actual && datosFormulario && mismosDatos(actual.op.datos, datosFormulario) ? actual : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firma]);

    // ------------------------------------------------------------------
    // Acciones (solo por clic; nada se envía al montar ni al cambiar la fecha)
    // ------------------------------------------------------------------

    const pedirVistaPrevia = async () => {
        if (!datosFormulario || enVuelo.current || pendiente) {
            return;
        }
        const operacion = operacionPara(op, datosFormulario);
        enVuelo.current = true;
        setEnviando("vista");
        setRechazo(null);
        setVista(null);
        setOp(operacion);
        try {
            const r = await registrarPago(api, idCredito, {
                ...cuerpo(operacion),
                confirmado: false
            });
            if (r.duplicado) {
                // La clave ya estaba registrada: esta operación ya se cobró.
                setOp({ ...operacion, estado: "duplicada" });
                setRespuestas([r]);
            } else {
                setVista({ op: operacion, r });
            }
        } catch (e) {
            setRechazo(e instanceof ErrorApi ? e : new ErrorApi(0, "SIN_CONEXION", "No se pudo obtener la vista previa."));
        } finally {
            enVuelo.current = false;
            setEnviando(null);
        }
    };

    /**
     * Envía la confirmación de `operacion` con SUS datos (no los del
     * formulario). Sirve para confirmar una vista previa y para reintentar
     * una operación incierta o ya cerrada: siempre la misma clave.
     */
    const enviarConfirmacion = async (operacion: OperacionPago) => {
        if (enVuelo.current) {
            return;
        }
        enVuelo.current = true;
        setEnviando("confirmacion");
        setRechazo(null);

        // Se anota ANTES de enviar: si la página se cierra a mitad de la
        // petición, al volver se sabe que hay un resultado incierto.
        const enCurso: OperacionPago = estaCerrada(operacion) ? operacion : { ...operacion, estado: "confirmando" };
        if (!estaCerrada(operacion)) {
            guardarPendiente(enCurso);
            setOp(enCurso);
        }

        try {
            const r = await registrarPago(
                api,
                operacion.datos.idCredito,
                { ...cuerpo(operacion), confirmado: true },
                AbortSignal.timeout(TIEMPO_MAXIMO_CONFIRMACION_MS)
            );
            setRespuestas(previas => [...previas, r]);
            if (r.aplicado || r.duplicado) {
                const final: OperacionPago = {
                    ...operacion,
                    estado: estaCerrada(operacion) ? operacion.estado : r.aplicado ? "aplicada" : "duplicada"
                };
                borrarPendiente();
                setOp(final);
                setVista(null);
                // El crédito cambió en el servidor: se vuelve a pedir, para
                // que la tarjeta de arriba no muestre el estado de antes.
                credito.recargar();
                deuda.recargar();
            } else {
                // Respuesta sin aplicar ni duplicar a una confirmación: no
                // debería ocurrir. Se trata como incierta, por seguridad.
                marcarIncierta(enCurso);
            }
        } catch (e) {
            if (e instanceof ErrorApi && esRechazoDefinitivo(e)) {
                // El servidor dijo que no: no se cobró nada con esta clave.
                if (!estaCerrada(operacion)) {
                    borrarPendiente();
                    setOp({ ...operacion, estado: "borrador" });
                }
                setVista(null);
                setRechazo(e);
            } else {
                // Sin respuesta, 5xx o tiempo agotado: NO se sabe si se cobró.
                if (!estaCerrada(operacion)) {
                    marcarIncierta(enCurso);
                }
                setRechazo(e instanceof ErrorApi ? e : new ErrorApi(0, "SIN_RESPUESTA", "No llegó la respuesta del servidor."));
            }
        } finally {
            enVuelo.current = false;
            setEnviando(null);
        }
    };

    const marcarIncierta = (operacion: OperacionPago) => {
        const incierta: OperacionPago = { ...operacion, estado: "incierta" };
        guardarPendiente(incierta);
        setOp(incierta);
    };

    const nuevoCobro = () => {
        setOp(null);
        setVista(null);
        setRechazo(null);
        setRespuestas([]);
        setMontoEditado(false);
        deuda.recargar();
        credito.recargar();
    };

    const descartarPendiente = () => {
        borrarPendiente();
        setDescartar(false);
        nuevoCobro();
    };

    // ------------------------------------------------------------------
    // Pantalla
    // ------------------------------------------------------------------

    const c = credito.datos;
    const d = deuda.datos;
    const aplicado = respuestas.find(r => r.aplicado);
    const ultima = respuestas[respuestas.length - 1];
    const sinDeuda = d !== undefined && d.cuotasExigibles.length === 0;

    return (
        <div className="space-y-5">
            <Tarjeta className="p-4">
                <Pasos pasos={["Pago", "Confirmación", "Comprobante"]} actual={paso} />
            </Tarjeta>

            {/* Crédito seleccionado */}
            <Tarjeta className="p-4">
                {credito.error ? (
                    <AvisoError error={credito.error} alReintentar={credito.recargar} />
                ) : c ? (
                    <>
                        <EncabezadoTarjeta
                            titulo={<span className="font-mono">{c.idCredito}</span>}
                            subtitulo={`${c.nombreCliente} · ${c.idCliente}`}
                            accion={<ChipEstado estado={c.estado} />}
                            separador
                        />
                        <ListaDatos
                            pares={[
                                { etiqueta: "Saldo de capital", valor: formatoQuetzales(c.saldoCapital) },
                                { etiqueta: "Atraso", valor: `${c.diasAtraso} días · ${etiquetaTramo(c.tramo)}` },
                                {
                                    etiqueta: "Próxima cuota",
                                    valor: c.proximaCuota
                                        ? `${formatoQuetzales(c.proximaCuota.monto)} · ${formatoFecha(c.proximaCuota.fechaVencimiento)}`
                                        : "—"
                                }
                            ]}
                        />
                        {!pendiente ? (
                            <BotonEnlace a="/asesor/pagos" variante="fantasma" tamano="sm" className="mt-2">
                                Cambiar de crédito
                            </BotonEnlace>
                        ) : null}
                    </>
                ) : <Cargando texto="Cargando el crédito…" />}
            </Tarjeta>

            {/* Resultado incierto: lo primero que se ve, y bloquea todo lo demás */}
            {op && op.estado === "incierta" ? (
                <Tarjeta className="space-y-3 border-amber-300 p-4">
                    <Aviso tipo="alerta" titulo="No sabemos si el pago se aplicó">
                        La confirmación se envió pero la respuesta no llegó. No cobre de nuevo con otra operación:
                        reintente esta misma, con la misma clave y los mismos datos. Si ya se había aplicado, el
                        servidor lo reconocerá y no cobrará dos veces.
                    </Aviso>
                    <ListaDatos
                        pares={[
                            { etiqueta: "Monto", valor: formatoQuetzales(op.datos.monto), enfasis: true },
                            { etiqueta: "Fecha de operación", valor: formatoFecha(op.datos.fechaOperacion) },
                            { etiqueta: "Medio de pago", valor: ETIQUETA_CANAL[op.datos.canal] },
                            { etiqueta: "Clave", valor: <span className="break-all font-mono text-xs">{op.clave}</span> }
                        ]}
                    />
                    {op.datos.fechaOperacion !== fechaCorte ? (
                        <p className="text-xs text-texto-suave">
                            La operación conserva su fecha ({formatoFecha(op.datos.fechaOperacion)}) aunque cambie la del encabezado.
                        </p>
                    ) : null}
                    {rechazo && !esRechazoDefinitivo(rechazo) ? (
                        <p className="text-xs text-texto-suave">Último intento: {rechazo.message} ({rechazo.codigo})</p>
                    ) : null}
                    <Boton
                        icono="check"
                        bloque
                        cargando={enviando === "confirmacion"}
                        onClick={() => void enviarConfirmacion(op)}
                    >
                        Reintentar con la misma clave
                    </Boton>
                    <Boton variante="fantasma" bloque onClick={() => setDescartar(true)} disabled={enviando !== null}>
                        Descartar operación pendiente
                    </Boton>
                </Tarjeta>
            ) : null}

            {op && op.estado === "confirmando" ? <Cargando texto="Registrando el pago…" /> : null}

            {/* Comprobante / resultado definitivo */}
            {cerrada && op && ultima ? (
                <Comprobante
                    op={op}
                    aplicado={aplicado}
                    ultima={ultima}
                    intentos={respuestas.length}
                    enviando={enviando === "confirmacion"}
                    alReintentar={() => void enviarConfirmacion(op)}
                    alNuevoCobro={nuevoCobro}
                />
            ) : null}

            {/* Datos del pago y vista previa */}
            {!pendiente && !cerrada ? (
                <>
                    {deuda.error ? <AvisoError error={deuda.error} alReintentar={deuda.recargar} /> : null}
                    {deuda.cargando && !d ? <Cargando texto="Consultando la deuda exigible…" /> : null}
                    {sinDeuda ? (
                        <Aviso tipo="exito" titulo="Sin cuotas vencidas">
                            Este crédito no tiene deuda exigible al {formatoFecha(fechaCorte)}: no hay nada que cobrar.
                        </Aviso>
                    ) : null}

                    {d && !sinDeuda ? (
                        <Tarjeta className="space-y-4 p-4">
                            <EncabezadoTarjeta
                                titulo="Datos del pago"
                                subtitulo={`Deuda exigible calculada por el servidor: ${formatoQuetzales(d.montoExacto)} (cuota N.º ${d.cuotasExigibles.join(", ")}).`}
                            />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <CampoTexto
                                    etiqueta="Monto a pagar"
                                    prefijo="Q"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    value={montoTexto}
                                    onChange={e => {
                                        setMontoEditado(true);
                                        setMontoTexto(e.target.value);
                                    }}
                                    error={montoTexto && monto === null ? "Escriba un monto positivo con a lo sumo dos decimales." : undefined}
                                    ayuda="Debe ser exactamente la deuda exigible; el servidor rechaza otro monto."
                                />
                                <CampoTexto
                                    etiqueta="Fecha de operación"
                                    value={formatoFecha(fechaCorte)}
                                    readOnly
                                    ayuda="Es la fecha de corte del encabezado."
                                />
                                <CampoSeleccion
                                    etiqueta="Medio de pago"
                                    value={canal}
                                    onChange={e => setCanal(e.target.value as CanalPago)}
                                    opciones={CANALES_PAGO.map(o => ({ valor: o.valor, etiqueta: o.etiqueta }))}
                                />
                            </div>
                            {!vistaVigente ? (
                                <Boton
                                    bloque
                                    tamano="lg"
                                    disabled={datosFormulario === null}
                                    cargando={enviando === "vista"}
                                    onClick={() => void pedirVistaPrevia()}
                                >
                                    Revisar el pago
                                </Boton>
                            ) : null}
                        </Tarjeta>
                    ) : null}

                    {rechazo ? (
                        <RechazoPago
                            error={rechazo}
                            alUsarMonto={m => {
                                setMontoEditado(true);
                                setMontoTexto(m.toFixed(2));
                            }}
                        />
                    ) : null}

                    {vistaVigente && vista ? (
                        <TarjetaAprobacion
                            vista={vista.r}
                            puedeAprobar
                            enviando={enviando === "confirmacion"}
                            textoAprobar="Confirmar y registrar el pago"
                            textoRechazar="Cancelar"
                            alAprobar={() => void enviarConfirmacion(vista.op)}
                            alRechazar={() => setVista(null)}
                        />
                    ) : null}
                </>
            ) : null}

            <Dialogo
                abierto={descartar}
                titulo="¿Descartar la operación pendiente?"
                alCerrar={() => setDescartar(false)}
                acciones={(
                    <>
                        <Boton variante="secundario" onClick={() => setDescartar(false)}>Volver</Boton>
                        <Boton variante="peligro" onClick={descartarPendiente}>Descartar</Boton>
                    </>
                )}
            >
                <p className="text-sm text-texto-medio">
                    No se sabe si este pago se aplicó. Si se aplicó y luego se cobra con otra operación, el cliente
                    pagaría dos veces. Antes de descartarla, revise el detalle del crédito.
                </p>
            </Dialogo>
        </div>
    );
}

function cuerpo(op: OperacionPago) {
    return {
        monto: op.datos.monto,
        claveIdempotencia: op.clave,
        fechaOperacion: op.datos.fechaOperacion,
        canal: op.datos.canal
    };
}

// ----------------------------------------------------------------------

interface PropsComprobante {
    readonly op: OperacionPago;
    /** La respuesta que aplicó el pago, si fue en esta sesión. */
    readonly aplicado: ResultadoPago | undefined;
    readonly ultima: ResultadoPago;
    readonly intentos: number;
    readonly enviando: boolean;
    readonly alReintentar: () => void;
    readonly alNuevoCobro: () => void;
}

function Comprobante({ op, aplicado, ultima, intentos, enviando, alReintentar, alNuevoCobro }: PropsComprobante) {
    const base = aplicado ?? ultima;
    const ruta = encodeURIComponent(op.datos.idCredito);

    return (
        <section aria-label="Resultado del pago" className="space-y-4">
            {ultima.duplicado ? (
                <Aviso tipo="info" titulo="Pago ya registrado: no se volvió a cobrar">{ultima.mensaje}</Aviso>
            ) : (
                <Aviso tipo="exito" titulo="Pago aplicado">{ultima.mensaje}</Aviso>
            )}

            <Tarjeta className="p-4">
                <EncabezadoTarjeta titulo="Comprobante de pago" separador />
                <ListaDatos
                    pares={[
                        { etiqueta: "Crédito", valor: base.idCredito },
                        { etiqueta: "Cliente", valor: base.nombreCliente },
                        { etiqueta: "Fecha de operación", valor: formatoFecha(base.fechaOperacion) },
                        { etiqueta: "Monto recibido", valor: formatoQuetzales(base.montoRecibido), enfasis: true },
                        { etiqueta: "Medio de pago", valor: ETIQUETA_CANAL[op.datos.canal] },
                        { etiqueta: "Cuota que cubre", valor: base.cuotasCubiertas.join(", ") || "—" },
                        { etiqueta: "Clave de idempotencia", valor: <span className="break-all font-mono text-xs">{op.clave}</span> },
                        { etiqueta: "Envíos con esta clave", valor: String(intentos) }
                    ]}
                />
            </Tarjeta>

            {aplicado ? (
                <Desglose
                    titulo="Cómo se aplicó (prelación)"
                    lineas={[
                        { concepto: "Gastos de gestión", monto: formatoQuetzales(aplicado.desglosePrelacion.gastos) },
                        { concepto: "Interés moratorio", monto: formatoQuetzales(aplicado.desglosePrelacion.interesMoratorio) },
                        { concepto: "Interés corriente", monto: formatoQuetzales(aplicado.desglosePrelacion.interesCorriente) },
                        { concepto: "Capital", monto: formatoQuetzales(aplicado.desglosePrelacion.capital) }
                    ]}
                    total={{ concepto: "Total aplicado", monto: formatoQuetzales(aplicado.desglosePrelacion.total) }}
                />
            ) : null}

            {aplicado?.estadoDespues ? (
                <Tabla
                    titulo="Estado del crédito antes y después"
                    claveFila={f => f.momento}
                    filas={[
                        { momento: "Antes", e: aplicado.estadoAntes },
                        { momento: "Después", e: aplicado.estadoDespues }
                    ]}
                    columnas={[
                        { clave: "m", titulo: "", celda: f => <strong>{f.momento}</strong> },
                        { clave: "e", titulo: "Estado", celda: f => <ChipEstado estado={f.e.estado} /> },
                        { clave: "d", titulo: "Atraso", numerica: true, celda: f => `${f.e.diasAtraso} d` },
                        { clave: "v", titulo: "Vencidas", numerica: true, ocultarEnMovil: true, celda: f => f.e.cuotasVencidas },
                        { clave: "s", titulo: "Saldo", numerica: true, celda: f => formatoQuetzales(f.e.saldoCapital) }
                    ]}
                />
            ) : null}

            <div className="flex flex-col gap-2">
                <Boton variante="secundario" bloque cargando={enviando} onClick={alReintentar}>
                    Reintentar con la misma clave
                </Boton>
                <p className="text-xs text-texto-suave">
                    Vuelve a enviar esta misma operación. El servidor la reconoce por su clave y no cobra dos veces (OP-4).
                </p>
                <Boton bloque onClick={alNuevoCobro}>Nuevo cobro</Boton>
                <BotonEnlace a={`/asesor/creditos/${ruta}`} variante="fantasma" bloque>Ver el detalle del crédito</BotonEnlace>
            </div>
        </section>
    );
}
