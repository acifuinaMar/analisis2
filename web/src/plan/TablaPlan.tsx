import type { FilaPlan, FilaPlanCredito } from "../api/contratos";
import { Chip, Tabla, type Columna } from "../ui";
import { formatoFecha, formatoQuetzales } from "../utilidades/formato";

/**
 * Tabla del plan de amortización. Sirve para dos respuestas del servidor:
 *
 *   - el plan SIMULADO (POST /api/creditos/simulacion): filas FilaPlan;
 *   - el plan de un crédito (GET /api/creditos/:id/plan): FilaPlanCredito,
 *     que además trae lo pagado, el estado y si está vencida.
 *
 * Cada cifra es la del servidor. La tabla no suma, no recalcula saldos ni
 * deriva el estado: lo lee de `estado`, `vencida` y `diasAtraso`.
 */

function esFilaDeCredito(f: FilaPlan | FilaPlanCredito): f is FilaPlanCredito {
    return "estado" in f;
}

/** Chip de estado de una cuota del crédito, a partir de los campos del servidor. */
export function ChipEstadoCuota({ fila }: { fila: FilaPlanCredito }) {
    if (fila.estado === "pagada") {
        return <Chip variante="exito">Pagada</Chip>;
    }
    if (fila.vencida) {
        return (
            <span className="flex flex-wrap gap-1">
                <Chip variante="peligro">Vencida</Chip>
                {fila.diasAtraso > 0 ? <Chip variante="peligro">{fila.diasAtraso} d</Chip> : null}
                {fila.estado === "parcial" ? <Chip variante="alerta">Parcial</Chip> : null}
            </span>
        );
    }
    return fila.estado === "parcial"
        ? <Chip variante="alerta">Parcial</Chip>
        : <Chip variante="neutro">Pendiente</Chip>;
}

export function TablaPlan({ filas, titulo }: { filas: ReadonlyArray<FilaPlan | FilaPlanCredito>; titulo: string }) {

    const conEstado = filas.length > 0 && esFilaDeCredito(filas[0]!);

    const columnas: Array<Columna<FilaPlan | FilaPlanCredito>> = [
        { clave: "n", titulo: "N.º", celda: f => f.numero },
        { clave: "v", titulo: "Vence", celda: f => formatoFecha(f.fechaVencimiento) },
        { clave: "c", titulo: "Cuota", numerica: true, celda: f => <strong>{formatoQuetzales(f.cuota)}</strong> },
        { clave: "i", titulo: "Interés", numerica: true, ocultarEnMovil: true, celda: f => formatoQuetzales(f.interes) },
        { clave: "k", titulo: "Capital", numerica: true, ocultarEnMovil: true, celda: f => formatoQuetzales(f.capital) },
        { clave: "s", titulo: "Saldo final", numerica: true, ocultarEnMovil: true, celda: f => formatoQuetzales(f.saldoFinal) }
    ];

    if (conEstado) {
        columnas.push(
            {
                clave: "p",
                titulo: "Pagado (capital · interés)",
                numerica: true,
                ocultarEnMovil: true,
                celda: f => esFilaDeCredito(f)
                    ? `${formatoQuetzales(f.capitalPagado)} · ${formatoQuetzales(f.interesPagado)}`
                    : "—"
            },
            { clave: "e", titulo: "Estado", celda: f => (esFilaDeCredito(f) ? <ChipEstadoCuota fila={f} /> : null) }
        );
    }

    return (
        <Tabla
            titulo={titulo}
            claveFila={f => String(f.numero)}
            filas={filas}
            columnas={columnas}
            vacio="El plan no tiene cuotas."
        />
    );
}
