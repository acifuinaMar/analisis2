import { obtenerCredito, obtenerDeuda, obtenerDeudaCuota, obtenerMora, obtenerPlan } from "../../api/cobro";
import type { FilaPlanCredito } from "../../api/contratos";
import { useConsulta } from "../../api/useConsulta";
import { useNavegar, useParametros, useUbicacion } from "../../app/enrutador";
import { BusquedaClientes } from "../../cobro/BusquedaClientes";
import { useSesion } from "../../estado/sesion";
import {
    Aviso,
    AvisoError,
    BotonEnlace,
    Cargando,
    Chip,
    ChipEstado,
    ChipTramo,
    Dato,
    Desglose,
    EncabezadoPagina,
    EncabezadoTarjeta,
    EstadoVacio,
    RejillaDatos,
    Tabla,
    Tarjeta,
    TituloSeccion
} from "../../ui";
import { cantidadCuotasVencidas, etiquetaTramoConExplicacion } from "../../utilidades/etiquetas";
import { formatoFecha, formatoFechaLarga, formatoPorcentaje, formatoQuetzales } from "../../utilidades/formato";

/**
 * Cobro en campo (Fase 2): buscar cliente, detalle del crédito y detalle
 * de la mora. Cada cifra que aparece aquí viene de la API, consultada con
 * la fecha de corte del encabezado; la interfaz solo la formatea.
 */

/**
 * Las pantallas del crédito sirven a los dos perfiles (Fase 4, D2): la
 * gerencia las ve bajo /gerencia y en SOLO LECTURA, sin «Registrar pago».
 * El servidor rechaza igual un pago de gerencia; esto solo evita ofrecerlo.
 */
export function usePerfilCredito() {
    const { perfil } = useSesion();
    return {
        base: perfil === "gerencia" ? "/gerencia" : "/asesor",
        puedeCobrar: perfil === "asesor"
    };
}

// ----------------------------------------------------------------------
// Buscar cliente
// ----------------------------------------------------------------------

export function BuscarCliente() {
    return (
        <div>
            <EncabezadoPagina titulo="Buscar cliente" subtitulo="Busca por nombre, DPI, número de cliente o de crédito." />
            <BusquedaClientes accion="detalle" />
        </div>
    );
}

// ----------------------------------------------------------------------
// Detalle del crédito
// ----------------------------------------------------------------------

const ESTADO_CUOTA: Record<FilaPlanCredito["estado"], { etiqueta: string; variante: "exito" | "alerta" | "neutro" }> = {
    pagada: { etiqueta: "Pagada", variante: "exito" },
    parcial: { etiqueta: "Parcial", variante: "alerta" },
    pendiente: { etiqueta: "Pendiente", variante: "neutro" }
};

export function DetalleCredito() {
    const { id = "" } = useParametros();
    const { api, fechaCorte } = useSesion();
    const { base, puedeCobrar } = usePerfilCredito();

    const credito = useConsulta(s => obtenerCredito(api, id, fechaCorte, s), [id, fechaCorte]);
    const plan = useConsulta(s => obtenerPlan(api, id, fechaCorte, s), [id, fechaCorte]);
    const deuda = useConsulta(s => obtenerDeuda(api, id, fechaCorte, s), [id, fechaCorte]);

    if (credito.cargando && !credito.datos) {
        return <Cargando texto="Cargando el crédito…" />;
    }

    if (credito.error) {
        return credito.error.codigo === "CREDITO_INEXISTENTE"
            ? <EstadoVacio icono="alerta" titulo="El crédito no existe">No hay un crédito {id}.</EstadoVacio>
            : <AvisoError error={credito.error} alReintentar={credito.recargar} />;
    }

    const c = credito.datos;
    if (!c) {
        return null;
    }

    const ruta = encodeURIComponent(id);
    const p = plan.datos;
    const d = deuda.datos;
    const hayDeuda = Boolean(d && d.cuotasExigibles.length > 0);

    return (
        <div className="space-y-5">
            <EncabezadoPagina
                titulo="Detalle del crédito"
                subtitulo={`Al ${formatoFechaLarga(fechaCorte)}.`}
            />

            <Tarjeta className="p-4">
                <EncabezadoTarjeta
                    titulo={<span className="font-mono">{c.idCredito}</span>}
                    subtitulo={`${c.nombreCliente} · ${c.idCliente}`}
                    accion={<ChipEstado estado={c.estado} />}
                    separador
                />
                {p ? (
                    <RejillaDatos
                        className="mt-4"
                        pares={[
                            { etiqueta: "Monto original", valor: formatoQuetzales(p.capital), enfasis: true },
                            { etiqueta: "Tasa anual", valor: `${formatoPorcentaje(p.tnaAnual, 0)} nominal` },
                            { etiqueta: "Plazo", valor: `${p.plazoMeses} meses` },
                            { etiqueta: "Fecha de desembolso", valor: formatoFecha(p.fechaDesembolso) },
                            { etiqueta: "Cuota mensual", valor: p.cuotas[0] ? formatoQuetzales(p.cuotas[0].cuota) : "—", enfasis: true },
                            { etiqueta: "Reestructurado", valor: c.reestructurado ? "Sí" : "No" }
                        ]}
                    />
                ) : plan.error ? (
                    <div className="mt-3"><AvisoError error={plan.error} alReintentar={plan.recargar} /></div>
                ) : <Cargando texto="Cargando el plan…" />}
            </Tarjeta>

            <section>
                <TituloSeccion>Resumen actual</TituloSeccion>
                <div className="grid grid-cols-2 gap-3">
                    <Dato etiqueta="Saldo de capital" valor={formatoQuetzales(c.saldoCapital)} />
                    <Dato etiqueta="Cuotas pagadas" valor={p ? `${c.cuotasPagadas} de ${p.plazoMeses}` : c.cuotasPagadas} />
                    <Dato
                        etiqueta="Próxima cuota"
                        valor={c.proximaCuota ? formatoQuetzales(c.proximaCuota.monto) : "—"}
                        detalle={c.proximaCuota ? `N.º ${c.proximaCuota.numero} · ${formatoFecha(c.proximaCuota.fechaVencimiento)}` : "Sin cuotas pendientes"}
                    />
                    <Dato
                        etiqueta="Atraso"
                        valor={`${c.diasAtraso} días`}
                        enfasis={c.diasAtraso > 0 ? "peligro" : undefined}
                        detalle={cantidadCuotasVencidas(c.cuotasVencidas)}
                    />
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-texto-medio">
                    <ChipTramo tramo={c.tramo} />
                    <span>{etiquetaTramoConExplicacion(c.tramo)}</span>
                </p>
            </section>

            <section>
                <TituloSeccion>Deuda exigible al corte</TituloSeccion>
                {deuda.cargando && !d ? <Cargando texto="Consultando la deuda…" /> : null}
                {deuda.error ? <AvisoError error={deuda.error} alReintentar={deuda.recargar} /> : null}
                {d && !hayDeuda ? <Aviso tipo="exito" titulo="Sin cuotas vencidas">No hay deuda exigible a esta fecha.</Aviso> : null}
                {d && hayDeuda ? (
                    <Desglose
                        titulo={d.cuotasExigibles.length === 1
                            ? `Cuota exigible: N.º ${d.cuotasExigibles[0]}`
                            : `Cuotas exigibles: N.º ${d.cuotasExigibles.join(", ")}`}
                        lineas={[
                            { concepto: "Gastos de gestión", monto: formatoQuetzales(d.desglosePrelacion.gastos) },
                            { concepto: "Interés moratorio", monto: formatoQuetzales(d.desglosePrelacion.interesMoratorio) },
                            { concepto: "Interés corriente", monto: formatoQuetzales(d.desglosePrelacion.interesCorriente) },
                            { concepto: "Capital", monto: formatoQuetzales(d.desglosePrelacion.capital) }
                        ]}
                        total={{ concepto: "Total exigible", monto: formatoQuetzales(d.montoExacto) }}
                        totalEnPeligro
                    />
                ) : null}
            </section>

            {!puedeCobrar ? (
                <p className="text-sm text-texto-suave">Perfil gerencia: solo consulta. Los pagos los registra un asesor de campo.</p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
                {puedeCobrar ? <BotonEnlace a={`/asesor/pagos?credito=${ruta}`} icono="tarjeta" bloque>Registrar pago</BotonEnlace> : null}
                {hayDeuda ? (
                    <BotonEnlace a={`${base}/creditos/${ruta}/mora`} variante="secundario" bloque>Detalle de la mora</BotonEnlace>
                ) : null}
                <BotonEnlace a={`${base}/creditos/${ruta}/plan`} variante="secundario" bloque>Plan de amortización</BotonEnlace>
            </div>

            <section>
                <TituloSeccion>Estado de cuotas</TituloSeccion>
                {p ? (
                    <Tabla
                        titulo="Estado de cuotas"
                        claveFila={f => String(f.numero)}
                        filas={p.cuotas}
                        columnas={[
                            { clave: "n", titulo: "N.º", celda: f => f.numero },
                            { clave: "v", titulo: "Vence", celda: f => formatoFecha(f.fechaVencimiento) },
                            { clave: "c", titulo: "Cuota", numerica: true, celda: f => formatoQuetzales(f.cuota) },
                            { clave: "cp", titulo: "Capital pagado", numerica: true, ocultarEnMovil: true, celda: f => formatoQuetzales(f.capitalPagado) },
                            { clave: "ip", titulo: "Interés pagado", numerica: true, ocultarEnMovil: true, celda: f => formatoQuetzales(f.interesPagado) },
                            {
                                clave: "e",
                                titulo: "Estado",
                                celda: f => (
                                    <span className="flex flex-wrap gap-1">
                                        <Chip variante={ESTADO_CUOTA[f.estado].variante}>{ESTADO_CUOTA[f.estado].etiqueta}</Chip>
                                        {f.vencida && f.estado !== "pagada" ? <Chip variante="peligro">{f.diasAtraso} d</Chip> : null}
                                    </span>
                                )
                            }
                        ]}
                    />
                ) : plan.cargando ? <Cargando /> : null}
                <p className="mt-2 text-xs text-texto-suave">
                    Estado de cada cuota según el plan. No es un historial de transacciones.
                </p>
            </section>
        </div>
    );
}

// ----------------------------------------------------------------------
// Detalle de la mora
// ----------------------------------------------------------------------

export function DetalleMora() {
    const { id = "" } = useParametros();
    const { consulta } = useUbicacion();
    const navegar = useNavegar();
    const { api, fechaCorte } = useSesion();
    const { base, puedeCobrar } = usePerfilCredito();

    const deuda = useConsulta(s => obtenerDeuda(api, id, fechaCorte, s), [id, fechaCorte]);
    const exigibles = deuda.datos?.cuotasExigibles ?? [];

    const pedida = Number(consulta.get("cuota"));
    const cuota = Number.isInteger(pedida) && pedida > 0 ? pedida : exigibles[0];

    const mora = useConsulta(s => obtenerMora(api, id, cuota!, fechaCorte, s), [id, cuota, fechaCorte], cuota !== undefined);
    const deudaCuota = useConsulta(s => obtenerDeudaCuota(api, id, cuota!, fechaCorte, s), [id, cuota, fechaCorte], cuota !== undefined);

    const ruta = encodeURIComponent(id);

    if (deuda.cargando && !deuda.datos) {
        return <Cargando texto="Consultando la mora…" />;
    }
    if (deuda.error) {
        return deuda.error.codigo === "CREDITO_INEXISTENTE"
            ? <EstadoVacio icono="alerta" titulo="El crédito no existe">No hay un crédito {id}.</EstadoVacio>
            : <AvisoError error={deuda.error} alReintentar={deuda.recargar} />;
    }

    if (cuota === undefined) {
        return (
            <div>
                <EncabezadoPagina titulo="Detalle de la mora" subtitulo={`Crédito ${id} al ${formatoFechaLarga(fechaCorte)}.`} />
                <EstadoVacio icono="exito" titulo="Sin mora" accion={<BotonEnlace a={`${base}/creditos/${ruta}`} variante="secundario">Volver al crédito</BotonEnlace>}>
                    El crédito no tiene cuotas vencidas a esta fecha de corte.
                </EstadoVacio>
            </div>
        );
    }

    const m = mora.datos;
    const dc = deudaCuota.datos;

    return (
        <div className="space-y-5">
            <EncabezadoPagina titulo="Detalle de la mora" subtitulo={`Crédito ${id} al ${formatoFechaLarga(fechaCorte)}.`} />

            {exigibles.length > 1 ? (
                <div role="group" aria-label="Cuota vencida" className="flex flex-wrap gap-2">
                    {exigibles.map(n => (
                        <button
                            key={n}
                            type="button"
                            aria-pressed={n === cuota}
                            onClick={() => navegar(`${base}/creditos/${ruta}/mora?cuota=${n}`, { reemplazar: true })}
                            className={n === cuota
                                ? "h-9 rounded-lg bg-marca px-3 text-sm font-semibold text-white"
                                : "h-9 rounded-lg border border-borde-fuerte bg-superficie px-3 text-sm text-texto-medio hover:bg-superficie-activa"}
                        >
                            Cuota {n}
                        </button>
                    ))}
                </div>
            ) : null}

            {mora.error ? <AvisoError error={mora.error} alReintentar={mora.recargar} /> : null}
            {mora.cargando && !m ? <Cargando texto="Calculando en el servidor…" /> : null}

            {m ? (
                <>
                    <Tarjeta className="p-4">
                        <EncabezadoTarjeta
                            titulo={`Cuota ${m.numeroCuota}`}
                            subtitulo={`Política ${m.politica}`}
                            accion={<ChipTramo tramo={m.tramo} />}
                            separador
                        />
                        <div className="mt-3 grid grid-cols-3 gap-3">
                            <div>
                                <p className="text-xs text-texto-suave">Días de atraso</p>
                                <p className="cifra font-bold text-texto">{m.diasAtraso}</p>
                            </div>
                            <div>
                                <p className="text-xs text-texto-suave">Capital en mora</p>
                                <p className="cifra font-bold text-texto">{formatoQuetzales(m.capitalEnMora)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-texto-suave">Mora total</p>
                                <p className="cifra font-bold text-peligro">{formatoQuetzales(m.total)}</p>
                            </div>
                        </div>
                        <p className="mt-3 text-sm text-texto-medio">{etiquetaTramoConExplicacion(m.tramo)}</p>
                    </Tarjeta>

                    <section>
                        <TituloSeccion>Desglose por tramo recorrido</TituloSeccion>
                        <Tabla
                            titulo="Desglose de la mora por tramo"
                            claveFila={l => l.tramo}
                            filas={m.tramosRecorridos}
                            vacio="Sin tramos recorridos a esta fecha."
                            columnas={[
                                { clave: "t", titulo: "Tramo", celda: l => l.tramo },
                                { clave: "d", titulo: "Días", numerica: true, celda: l => l.dias },
                                { clave: "a", titulo: "Tasa anual", numerica: true, ocultarEnMovil: true, celda: l => l.tnaMoratoria },
                                { clave: "td", titulo: "Tasa diaria", numerica: true, celda: l => formatoPorcentaje(l.tasaDiaria, 4) },
                                { clave: "m", titulo: "Monto", numerica: true, celda: l => <strong>{formatoQuetzales(l.monto)}</strong> }
                            ]}
                            pie={(
                                <tr>
                                    <td className="px-4 py-3 text-texto" colSpan={2}>Total de mora</td>
                                    <td className="hidden sm:table-cell" />
                                    <td />
                                    <td className="cifra px-4 py-3 text-right text-peligro">{formatoQuetzales(m.total)}</td>
                                </tr>
                            )}
                        />
                        {m.hayDiferenciaPorRedondeo ? (
                            <Aviso tipo="info" className="mt-3">
                                Las líneas redondeadas suman {formatoQuetzales(m.sumaDeTramosRedondeados)}; el total que
                                calcula el núcleo es {formatoQuetzales(m.total)}. La diferencia es de redondeo y la
                                cifra que se cobra es el total.
                            </Aviso>
                        ) : null}
                    </section>
                </>
            ) : null}

            {dc ? (
                <Desglose
                    titulo={`Lo que se debe de la cuota ${dc.numeroCuota}`}
                    lineas={[
                        { concepto: "Gastos de gestión", monto: formatoQuetzales(dc.gastos) },
                        { concepto: "Interés moratorio", monto: formatoQuetzales(dc.interesMoratorio) },
                        { concepto: "Interés corriente", monto: formatoQuetzales(dc.interesCorriente) },
                        { concepto: "Capital", monto: formatoQuetzales(dc.capital) }
                    ]}
                    total={{ concepto: "Total de la cuota", monto: formatoQuetzales(dc.totalExigible) }}
                />
            ) : deudaCuota.error ? <AvisoError error={deudaCuota.error} alReintentar={deudaCuota.recargar} /> : null}

            <div className="flex flex-col gap-2 sm:flex-row">
                {puedeCobrar ? <BotonEnlace a={`/asesor/pagos?credito=${ruta}`} icono="tarjeta" bloque>Registrar pago</BotonEnlace> : null}
                <BotonEnlace a={`${base}/creditos/${ruta}`} variante="secundario" bloque>Volver al detalle del crédito</BotonEnlace>
            </div>
        </div>
    );
}
