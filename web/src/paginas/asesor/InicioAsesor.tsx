import { Enlace } from "../../app/enrutador";
import { useSesion } from "../../estado/sesion";
import { Icono, Tarjeta, TituloSeccion, type NombreIcono } from "../../ui";
import { formatoFechaLarga } from "../../utilidades/formato";
import { PantallaPendiente } from "../PantallaPendiente";

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

            <PantallaPendiente
                titulo="Próximos vencimientos"
                subtitulo="Cuotas que vencen en los próximos días, para planificar las visitas."
                fase="Fase posterior"
                referencia="capacidad «Ver próximos vencimientos» (G-6)"
                endpoints={["GET /api/vencimientos?fechaCorte=&ventanaDias=7"]}
                silueta="tabla"
            />
        </div>
    );
}
