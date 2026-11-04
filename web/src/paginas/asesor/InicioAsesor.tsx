import { obtenerVencimientos } from "../../api/cobro";
import { useConsulta } from "../../api/useConsulta";
import { Enlace } from "../../app/enrutador";
import { ListaVencimientos } from "../../cobro/ListaVencimientos";
import { useSesion } from "../../estado/sesion";
import { AvisoError, BotonEnlace, Cargando, Icono, Tarjeta, TituloSeccion, type NombreIcono } from "../../ui";
import { formatoFechaLarga, formatoQuetzales } from "../../utilidades/formato";

interface Accion {
    readonly a: string;
    readonly titulo: string;
    readonly descripcion: string;
    readonly icono: NombreIcono;
}

/** Las tres tareas del asesor en campo: los flujos de originación y cobro. */
const ACCIONES: ReadonlyArray<Accion> = [
    { a: "/asesor/solicitud", titulo: "Nueva solicitud", descripcion: "Alta del cliente y desembolso", icono: "agregar" },
    { a: "/asesor/pagos", titulo: "Registrar pago", descripcion: "Cobro de cuotas vencidas", icono: "tarjeta" },
    { a: "/asesor/clientes", titulo: "Buscar cliente", descripcion: "Detalle del crédito y su mora", icono: "buscar" }
];

export function InicioAsesor() {
    const { fechaCorte } = useSesion();

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold tracking-tight text-texto">Hola, asesor</h1>
                <p className="mt-1 text-sm text-texto-suave">
                    Operaciones con fecha de corte al <strong className="text-texto">{formatoFechaLarga(fechaCorte)}</strong>.
                </p>
            </header>

            <section>
                <TituloSeccion>¿Qué vas a hacer?</TituloSeccion>
                <ul className="space-y-3">
                    {ACCIONES.map(a => (
                        <li key={a.a}>
                            <Enlace a={a.a} className="block">
                                <Tarjeta className="flex items-center gap-4 p-4 transition-colors hover:border-marca">
                                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-marca-suave text-marca">
                                        <Icono nombre={a.icono} tamano={22} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-semibold text-texto">{a.titulo}</span>
                                        <span className="block text-sm text-texto-suave">{a.descripcion}</span>
                                    </span>
                                    <Icono nombre="adelante" tamano={18} className="text-texto-suave" />
                                </Tarjeta>
                            </Enlace>
                        </li>
                    ))}
                </ul>
            </section>

            <ResumenVencimientos />
        </div>
    );
}

/** Cuántas cuotas se muestran en el inicio; el resto, en la pantalla completa. */
const MAXIMO_EN_INICIO = 3;

/**
 * Resumen de los próximos 7 días (GET /api/vencimientos). Cantidad y monto
 * son los del servidor; aquí solo se recorta la lista para el inicio.
 */
function ResumenVencimientos() {
    const { api, fechaCorte } = useSesion();
    const r = useConsulta(s => obtenerVencimientos(api, fechaCorte, 7, s), [fechaCorte]);
    const d = r.datos;

    return (
        <section aria-labelledby="titulo-vencimientos">
            <TituloSeccion accion={<BotonEnlace a="/asesor/vencimientos?dias=7" variante="fantasma" tamano="sm">Ver todos</BotonEnlace>}>
                <span id="titulo-vencimientos">Próximos 7 días</span>
            </TituloSeccion>
            {r.cargando && !d ? <Cargando texto="Consultando vencimientos…" /> : null}
            {r.error ? <AvisoError error={r.error} alReintentar={r.recargar} /> : null}
            {d && !r.error ? (
                d.cantidadCuotas === 0 ? (
                    <p className="rounded-tarjeta border border-borde bg-superficie p-4 text-sm text-texto-suave">
                        Ninguna cuota vence en los próximos 7 días.
                    </p>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-texto-medio">
                            <strong className="text-texto">{d.cantidadCuotas}</strong> {d.cantidadCuotas === 1 ? "cuota" : "cuotas"} por{" "}
                            <strong className="cifra text-texto">{formatoQuetzales(d.montoTotal)}</strong>
                        </p>
                        <ListaVencimientos cuotas={d.cuotas.slice(0, MAXIMO_EN_INICIO)} />
                    </div>
                )
            ) : null}
        </section>
    );
}
