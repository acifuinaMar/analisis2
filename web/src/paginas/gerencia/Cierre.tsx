import { obtenerCierreDiario, obtenerCierreMensual } from "../../api/gerencia";
import type { Cierre as CierreApi } from "../../api/contratos";
import { useConsulta } from "../../api/useConsulta";
import { useNavegar, useUbicacion } from "../../app/enrutador";
import { useSesion } from "../../estado/sesion";
import {
    Aviso,
    AvisoError,
    Cargando,
    CampoTexto,
    Desglose,
    EncabezadoPagina,
    EncabezadoTarjeta,
    Pestanas,
    Tarjeta,
    TarjetaIndicador
} from "../../ui";
import { periodoDe } from "../../utilidades/fechas";
import { formatoFecha, formatoFechaLarga, formatoPeriodo, formatoQuetzales } from "../../utilidades/formato";

/**
 * Cierre diario (G-3) y mensual (G-2).
 *
 *   diario   GET /api/cierres/diario?fechaCorte=  (la fecha del encabezado)
 *   mensual  GET /api/cierres/mensual?periodo=AAAA-MM
 *
 * El mensual abre en el mes de la fecha de corte (decisión D3) y se puede
 * elegir otro; el tipo y el mes viven en la URL (?tipo=&periodo=).
 *
 * Las recuperaciones van en el orden de la prelación y su total es el del
 * servidor (`recuperaciones.total`). El flujo neto es el único campo que
 * puede ser negativo: se presta más de lo que entra.
 */

const TIPOS = [
    { valor: "diario", etiqueta: "Cierre diario" },
    { valor: "mensual", etiqueta: "Cierre mensual" }
] as const;

type Tipo = typeof TIPOS[number]["valor"];

const PATRON_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

export function Cierre() {
    const { api, fechaCorte } = useSesion();
    const { consulta } = useUbicacion();
    const navegar = useNavegar();

    const tipo: Tipo = consulta.get("tipo") === "mensual" ? "mensual" : "diario";
    const pedido = consulta.get("periodo");
    const periodo = pedido && PATRON_PERIODO.test(pedido) ? pedido : periodoDe(fechaCorte);

    const r = useConsulta(
        s => (tipo === "diario" ? obtenerCierreDiario(api, fechaCorte, s) : obtenerCierreMensual(api, periodo, s)),
        [tipo, tipo === "diario" ? fechaCorte : periodo]
    );
    const c = r.datos;

    const ir = (t: Tipo, p?: string) =>
        navegar(t === "diario" ? "/gerencia/cierre" : `/gerencia/cierre?tipo=mensual${p ? `&periodo=${p}` : ""}`, { reemplazar: true });

    return (
        <div className="space-y-5">
            <EncabezadoPagina titulo="Cierre diario y mensual" subtitulo="Desembolsos y recuperaciones por concepto, calculados por el núcleo." />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="sm:w-96">
                    <Pestanas<Tipo> etiqueta="Tipo de cierre" opciones={TIPOS} valor={tipo} alCambiar={t => ir(t)} />
                </div>
                {tipo === "mensual" ? (
                    <CampoTexto
                        etiqueta="Mes del cierre"
                        type="month"
                        className="sm:w-56"
                        value={periodo}
                        onChange={e => {
                            if (PATRON_PERIODO.test(e.target.value)) {
                                ir("mensual", e.target.value);
                            }
                        }}
                    />
                ) : (
                    <p className="text-sm text-texto-suave">
                        Día: <strong className="text-texto">{formatoFechaLarga(fechaCorte)}</strong>. Para otro día, cambie la
                        fecha de corte del encabezado.
                    </p>
                )}
            </div>

            {r.cargando && !c ? <Cargando texto="Consultando el cierre…" /> : null}
            {r.error ? <AvisoError error={r.error} alReintentar={r.recargar} /> : null}
            {c && !r.error ? <ResultadoCierre cierre={c} /> : null}
        </div>
    );
}

function ResultadoCierre({ cierre: c }: { cierre: CierreApi }) {
    const rec = c.recuperaciones;
    const sinMovimientos = c.desembolsos.cantidad === 0 && c.pagos.cantidad === 0;
    const titulo = c.tipo === "diario"
        ? `Cierre del ${formatoFechaLarga(c.desde)}`
        : `Cierre de ${formatoPeriodo(c.desde.slice(0, 7))}`;

    return (
        <section aria-label={titulo} className="space-y-4">
            <Tarjeta className="p-4">
                <EncabezadoTarjeta
                    titulo={titulo}
                    subtitulo={`${c.id} · del ${formatoFecha(c.desde)} al ${formatoFecha(c.hasta)}`}
                />
            </Tarjeta>

            {sinMovimientos ? (
                <Aviso tipo="info" titulo="Sin movimientos en el periodo">
                    No hubo desembolsos ni pagos {c.tipo === "diario" ? "ese día" : "ese mes"}. Las cifras en cero son las
                    que devuelve el servidor.
                </Aviso>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <TarjetaIndicador
                    etiqueta="Desembolsos"
                    valor={formatoQuetzales(c.desembolsos.monto)}
                    icono="dinero"
                    variante="marca"
                    detalle={`${c.desembolsos.cantidad} ${c.desembolsos.cantidad === 1 ? "desembolso" : "desembolsos"}`}
                />
                <TarjetaIndicador
                    etiqueta="Pagos recibidos"
                    valor={formatoQuetzales(c.pagos.monto)}
                    icono="tarjeta"
                    variante="exito"
                    detalle={`${c.pagos.cantidad} ${c.pagos.cantidad === 1 ? "pago" : "pagos"}`}
                />
                <TarjetaIndicador
                    etiqueta="Flujo neto"
                    valor={formatoQuetzales(c.flujoNeto)}
                    icono="grafica"
                    variante={c.flujoNeto < 0 ? "alerta" : "info"}
                    detalle={c.flujoNeto < 0
                        ? "Negativo: se desembolsó más de lo que se recuperó"
                        : "Lo recuperado menos lo desembolsado"}
                />
            </div>

            <Desglose
                titulo="Recuperaciones por concepto (orden de la prelación)"
                className="lg:max-w-2xl"
                lineas={[
                    { concepto: "Gastos de gestión", monto: formatoQuetzales(rec.gastos) },
                    { concepto: "Interés moratorio", monto: formatoQuetzales(rec.interesMoratorio) },
                    { concepto: "Interés corriente", monto: formatoQuetzales(rec.interesCorriente) },
                    { concepto: "Capital", monto: formatoQuetzales(rec.capital) },
                    {
                        concepto: "Excedente abonado a capital",
                        monto: formatoQuetzales(rec.excedenteACapital),
                        nota: "Adelantos aplicados al capital de cuotas futuras"
                    }
                ]}
                total={{ concepto: "Total recuperado", monto: formatoQuetzales(rec.total) }}
            />
        </section>
    );
}
