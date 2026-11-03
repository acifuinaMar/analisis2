import { esTramoEnMora, obtenerCartera } from "../../api/gerencia";
import { useConsulta } from "../../api/useConsulta";
import { Enlace } from "../../app/enrutador";
import { useSesion } from "../../estado/sesion";
import {
    Aviso,
    AvisoError,
    BotonEnlace,
    Cargando,
    Chip,
    EncabezadoPagina,
    EncabezadoTarjeta,
    EstadoVacio,
    GraficaBarras,
    Tabla,
    TarjetaIndicador,
    Tarjeta
} from "../../ui";
import { cantidadCreditos, etiquetaCategoriaRiesgo, varianteTramo } from "../../utilidades/etiquetas";
import { formatoFechaLarga, formatoPorcentaje, formatoQuetzales } from "../../utilidades/formato";

/**
 * Tablero gerencial (G-1): GET /api/cartera?fechaCorte=.
 *
 * Cada cifra es un campo de EstadoCartera (src/servicios/consultas-cartera.ts):
 * cartera activa, en mora, en riesgo, dado por incobrable, candidatos a
 * incobrable y el desglose de la cartera en riesgo. La interfaz no suma,
 * no divide ni deriva indicadores: los porcentajes son los del servidor.
 *
 * Cartera en mora y cartera en riesgo son indicadores DISTINTOS (P2 7.8):
 * mora es todo crédito con al menos un día de atraso; riesgo, más de 30
 * días o reestructurado. Por eso van separados y explicados.
 */
export function Tablero() {
    const { api, fechaCorte } = useSesion();
    const r = useConsulta(s => obtenerCartera(api, fechaCorte, s), [fechaCorte]);
    const c = r.datos;

    return (
        <div className="space-y-6">
            <EncabezadoPagina
                titulo="Dashboard Gerencial"
                subtitulo={`Cartera al ${formatoFechaLarga(fechaCorte)}. Cifras calculadas por el núcleo.`}
                acciones={(
                    <>
                        <BotonEnlace a="/gerencia/mora" variante="secundario" icono="alerta">Cartera en mora</BotonEnlace>
                        <BotonEnlace a="/gerencia/cierre" variante="secundario" icono="cierre">Cierres</BotonEnlace>
                    </>
                )}
            />

            {r.cargando && !c ? <Cargando texto="Consultando la cartera…" /> : null}
            {r.error ? <AvisoError error={r.error} alReintentar={r.recargar} /> : null}

            {c && !r.error ? (
                <>
                    <section aria-label="Indicadores de la cartera" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <TarjetaIndicador
                            etiqueta="Cartera activa"
                            valor={formatoQuetzales(c.carteraActiva)}
                            icono="dinero"
                            variante="marca"
                            detalle={`${cantidadCreditos(c.creditosActivos)} ${c.creditosActivos === 1 ? "activo" : "activos"}`}
                        />
                        <TarjetaIndicador
                            etiqueta="Cartera en mora"
                            valor={formatoQuetzales(c.carteraEnMora)}
                            icono="alerta"
                            variante="alerta"
                            detalle={`${formatoPorcentaje(c.porcentajeEnMora)} de la activa · al menos un día de atraso`}
                        />
                        <TarjetaIndicador
                            etiqueta="Cartera en riesgo"
                            valor={formatoQuetzales(c.montoEnRiesgo)}
                            icono="alerta"
                            variante="peligro"
                            detalle={`${formatoPorcentaje(c.porcentajeEnRiesgo)} de la activa · más de 30 días o reestructurado`}
                        />
                        <TarjetaIndicador
                            etiqueta="Dado por incobrable"
                            valor={formatoQuetzales(c.dadoPorIncobrable)}
                            icono="documento"
                            variante="neutro"
                            detalle="Saldo ya dado de baja a la fecha de corte"
                        />
                    </section>

                    {c.candidatosAIncobrable > 0 ? (
                        <Aviso
                            tipo="alerta"
                            titulo={`${cantidadCreditos(c.candidatosAIncobrable)} con más de 120 días sin dar de baja`}
                            accion={<Enlace a="/gerencia/mora/vencido" className="text-sm font-semibold text-marca hover:underline">Ver el tramo Vencido</Enlace>}
                        >
                            Saldo de capital: {formatoQuetzales(c.saldoCandidatosAIncobrable)}. Declararlos incobrables
                            bajaría el porcentaje en riesgo sin haber cobrado nada; léalo junto con lo dado por incobrable.
                        </Aviso>
                    ) : null}

                    {c.creditosActivos === 0 ? (
                        <EstadoVacio icono="documento" titulo="Sin cartera activa">
                            No hay créditos activos a esta fecha de corte.
                        </EstadoVacio>
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-5">
                            <Tarjeta className="min-w-0 p-5 lg:col-span-2">
                                <EncabezadoTarjeta
                                    titulo="Saldo en riesgo por categoría"
                                    subtitulo="Altura proporcional al saldo que entrega el servidor."
                                    separador
                                />
                                <GraficaBarras
                                    className="mt-4"
                                    titulo="Saldo en riesgo por categoría"
                                    barras={c.desglosePorTramo.map(f => ({
                                        etiqueta: etiquetaCategoriaRiesgo(f.categoria),
                                        valor: f.saldo,
                                        rotulo: formatoQuetzales(f.saldo),
                                        destacada: f.categoria === "vencido"
                                    }))}
                                />
                            </Tarjeta>

                            <div className="min-w-0 lg:col-span-3">
                                <Tabla
                                    titulo="Cartera en riesgo por categoría"
                                    claveFila={f => f.categoria}
                                    filas={c.desglosePorTramo}
                                    columnas={[
                                        {
                                            clave: "c",
                                            titulo: "Categoría",
                                            celda: f => esTramoEnMora(f.categoria)
                                                ? (
                                                    <Enlace a={`/gerencia/mora/${f.categoria}`} className="font-medium text-marca hover:underline">
                                                        {etiquetaCategoriaRiesgo(f.categoria)}
                                                    </Enlace>
                                                )
                                                : <Chip variante={varianteTramo(f.categoria)}>{etiquetaCategoriaRiesgo(f.categoria)}</Chip>
                                        },
                                        { clave: "n", titulo: "Créditos", numerica: true, celda: f => f.creditos },
                                        { clave: "s", titulo: "Saldo", numerica: true, celda: f => formatoQuetzales(f.saldo) },
                                        { clave: "p", titulo: "% de la activa", numerica: true, celda: f => formatoPorcentaje(f.porcentaje) }
                                    ]}
                                    pie={(
                                        <tr>
                                            <td className="px-4 py-3 text-texto">Total en riesgo</td>
                                            <td />
                                            <td className="cifra px-4 py-3 text-right text-texto">{formatoQuetzales(c.montoEnRiesgo)}</td>
                                            <td className="cifra px-4 py-3 text-right text-texto">{formatoPorcentaje(c.porcentajeEnRiesgo)}</td>
                                        </tr>
                                    )}
                                />
                                <p className="mt-2 text-xs text-texto-suave">
                                    Entra a riesgo el crédito con más de 30 días de atraso o reestructurado (aunque esté al
                                    día). El enlace de cada tramo abre <strong>todos</strong> los créditos en mora de ese
                                    tramo, que en Mora 1 pueden ser más que los que cuentan como riesgo.
                                </p>
                            </div>
                        </div>
                    )}
                </>
            ) : null}
        </div>
    );
}
