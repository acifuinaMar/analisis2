import { obtenerVencimientos } from "../../api/cobro";
import { useConsulta } from "../../api/useConsulta";
import { useNavegar, useUbicacion } from "../../app/enrutador";
import { ListaVencimientos } from "../../cobro/ListaVencimientos";
import { useSesion } from "../../estado/sesion";
import { AvisoError, Cargando, Dato, EncabezadoPagina, EstadoVacio, Pestanas } from "../../ui";
import { formatoFecha, formatoFechaLarga, formatoQuetzales } from "../../utilidades/formato";

/**
 * Próximos vencimientos (complemento de G-6 para el asesor, decisión D1).
 *
 * GET /api/vencimientos?fechaCorte=&ventanaDias=. La ventana es
 * (corte, corte + días]: la cuota que vence el día del corte ya es
 * exigible y aparece en el cobro, no aquí. Cantidades y montos son los
 * del servidor; la interfaz no suma nada.
 *
 * La ventana vive en la URL (?dias=), así que "volver" la conserva.
 */
const VENTANAS = [
    { valor: "7", etiqueta: "7 días" },
    { valor: "15", etiqueta: "15 días" },
    { valor: "30", etiqueta: "30 días" }
] as const;

type Ventana = typeof VENTANAS[number]["valor"];

function esVentana(v: string | null): v is Ventana {
    return VENTANAS.some(o => o.valor === v);
}

export function Vencimientos() {
    const { api, fechaCorte } = useSesion();
    const { consulta } = useUbicacion();
    const navegar = useNavegar();

    const pedida = consulta.get("dias");
    const ventana: Ventana = esVentana(pedida) ? pedida : "7";
    const dias = Number(ventana);

    const r = useConsulta(s => obtenerVencimientos(api, fechaCorte, dias, s), [fechaCorte, dias]);
    const d = r.datos;

    return (
        <div className="space-y-5">
            <EncabezadoPagina
                titulo="Próximos vencimientos"
                subtitulo={`Cuotas que vencen después del ${formatoFechaLarga(fechaCorte)}, para planificar las visitas.`}
            />

            <Pestanas
                etiqueta="Ventana de días"
                opciones={VENTANAS}
                valor={ventana}
                alCambiar={v => navegar(`/asesor/vencimientos?dias=${v}`, { reemplazar: true })}
            />

            {r.cargando && !d ? <Cargando texto="Consultando vencimientos…" /> : null}
            {r.error ? <AvisoError error={r.error} alReintentar={r.recargar} /> : null}

            {d && !r.error ? (
                <>
                    <div className="grid grid-cols-3 gap-2">
                        <Dato etiqueta="Cuotas" valor={d.cantidadCuotas} />
                        <Dato etiqueta="Créditos" valor={d.creditosInvolucrados} />
                        <Dato etiqueta="Monto" valor={formatoQuetzales(d.montoTotal)} />
                    </div>
                    <p className="text-xs text-texto-suave">
                        Del {formatoFecha(d.fechaCorte)} (sin incluirlo) al {formatoFecha(d.hasta)}. Los montos son lo pendiente de cada cuota.
                    </p>
                    {d.cuotas.length === 0 ? (
                        <EstadoVacio icono="calendario" titulo="Sin vencimientos en esta ventana">
                            Ninguna cuota vence en los próximos {d.ventanaDias} días.
                        </EstadoVacio>
                    ) : (
                        <ListaVencimientos cuotas={d.cuotas} />
                    )}
                </>
            ) : null}
        </div>
    );
}
