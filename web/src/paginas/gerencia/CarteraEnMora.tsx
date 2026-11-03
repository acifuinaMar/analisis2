import { esTramoEnMora, listarCreditosEnMora, type TramoEnMora } from "../../api/gerencia";
import { useConsulta } from "../../api/useConsulta";
import { Enlace, useNavegar, useParametros } from "../../app/enrutador";
import { useSesion } from "../../estado/sesion";
import {
    AvisoError,
    BotonEnlace,
    Cargando,
    Chip,
    ChipEstado,
    ChipTramo,
    Dato,
    EncabezadoPagina,
    EstadoVacio,
    Pestanas,
    Tabla
} from "../../ui";
import { etiquetaTramoConExplicacion } from "../../utilidades/etiquetas";
import { formatoFechaLarga, formatoQuetzales } from "../../utilidades/formato";

/**
 * Cartera en mora (G-4): GET /api/cartera/mora?fechaCorte=&tramo=.
 *
 * Lista de ListadoCreditosEnMora tal como la ordena el servidor. La
 * cantidad y el saldo total son los del servidor (`cantidad`,
 * `saldoCapitalTotal`): la tabla no suma su columna.
 *
 * El tramo vive en la URL (/gerencia/mora/:tramo), así que las migas y
 * el botón "atrás" lo conservan.
 */

const PESTANAS = [
    { valor: "todos", etiqueta: "Todos" },
    { valor: "mora_1", etiqueta: "Mora 1" },
    { valor: "mora_2", etiqueta: "Mora 2" },
    { valor: "mora_3", etiqueta: "Mora 3" },
    { valor: "vencido", etiqueta: "Vencido" }
] as const;

type Pestana = typeof PESTANAS[number]["valor"];

export function CarteraEnMora() {
    const { tramo: pedido } = useParametros();
    const { api, fechaCorte } = useSesion();
    const navegar = useNavegar();

    const valido = pedido === undefined || esTramoEnMora(pedido);
    const tramo: TramoEnMora | undefined = esTramoEnMora(pedido) ? pedido : undefined;

    const r = useConsulta(s => listarCreditosEnMora(api, fechaCorte, tramo, s), [fechaCorte, tramo ?? ""], valido);
    const d = r.datos;

    const encabezado = (
        <EncabezadoPagina
            titulo={pedido ? "Créditos del tramo" : "Cartera en mora"}
            destacado={tramo ? etiquetaTramoConExplicacion(tramo) : undefined}
            subtitulo={`Créditos con al menos un día de atraso al ${formatoFechaLarga(fechaCorte)}, con días, tramo y saldo.`}
        />
    );

    if (!valido) {
        return (
            <div>
                {encabezado}
                <EstadoVacio
                    icono="alerta"
                    titulo="Tramo no válido"
                    accion={<BotonEnlace a="/gerencia/mora" variante="secundario">Ver toda la cartera en mora</BotonEnlace>}
                >
                    Los tramos de mora son Mora 1, Mora 2, Mora 3 y Vencido.
                </EstadoVacio>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {encabezado}

            <Pestanas<Pestana>
                etiqueta="Tramo de mora"
                opciones={PESTANAS}
                valor={tramo ?? "todos"}
                alCambiar={v => navegar(v === "todos" ? "/gerencia/mora" : `/gerencia/mora/${v}`)}
            />

            {r.cargando && !d ? <Cargando texto="Consultando la cartera en mora…" /> : null}
            {r.error ? <AvisoError error={r.error} alReintentar={r.recargar} /> : null}

            {d && !r.error ? (
                <>
                    <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                        <Dato etiqueta="Créditos" valor={d.cantidad} />
                        <Dato etiqueta="Saldo de capital" valor={formatoQuetzales(d.saldoCapitalTotal)} />
                    </div>

                    {d.cantidad === 0 ? (
                        <EstadoVacio icono="exito" titulo={tramo ? "Sin créditos en este tramo" : "Sin créditos en mora"}>
                            Ningún crédito {tramo ? "está en este tramo" : "tiene atraso"} a esta fecha de corte.
                        </EstadoVacio>
                    ) : (
                        <Tabla
                            titulo={tramo ? `Créditos del tramo ${etiquetaTramoConExplicacion(tramo)}` : "Créditos en mora"}
                            claveFila={k => k.idCredito}
                            filas={d.creditos}
                            alSeleccionar={k => navegar(`/gerencia/creditos/${encodeURIComponent(k.idCredito)}`)}
                            columnas={[
                                {
                                    clave: "id",
                                    titulo: "Crédito",
                                    celda: k => (
                                        <Enlace
                                            a={`/gerencia/creditos/${encodeURIComponent(k.idCredito)}`}
                                            className="whitespace-nowrap font-mono font-medium text-marca hover:underline"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            {k.idCredito}
                                        </Enlace>
                                    )
                                },
                                {
                                    clave: "cl",
                                    titulo: "Cliente",
                                    celda: k => (
                                        <span className="block min-w-36">
                                            {k.nombreCliente}
                                            <span className="block text-xs text-texto-suave">{k.idCliente}</span>
                                        </span>
                                    )
                                },
                                { clave: "d", titulo: "Días", numerica: true, celda: k => k.diasAtraso },
                                { clave: "t", titulo: "Tramo", celda: k => <ChipTramo tramo={k.tramo} /> },
                                {
                                    clave: "e",
                                    titulo: "Estado",
                                    ocultarEnMovil: true,
                                    celda: k => (
                                        <span className="flex flex-wrap gap-1">
                                            <ChipEstado estado={k.estado} />
                                            {k.reestructurado ? <Chip variante="alerta">Reestructurado</Chip> : null}
                                        </span>
                                    )
                                },
                                { clave: "cv", titulo: "Cuotas vencidas", numerica: true, ocultarEnMovil: true, celda: k => k.cuotasVencidas },
                                { clave: "s", titulo: "Saldo de capital", numerica: true, celda: k => formatoQuetzales(k.saldoCapital) }
                            ]}
                        />
                    )}
                </>
            ) : null}
        </div>
    );
}
