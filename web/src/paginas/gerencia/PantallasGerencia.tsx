import { useParametros } from "../../app/enrutador";
import { etiquetaTramoConExplicacion } from "../../utilidades/etiquetas";
import { PantallaPendiente } from "../PantallaPendiente";

/**
 * Pantallas de la gerencia (escritorio). Estructura de la Fase 1; los
 * datos se conectan en la Fase 4.
 */

export function Tablero() {
    return (
        <PantallaPendiente
            titulo="Dashboard Gerencial"
            subtitulo="Resumen general de la cartera a la fecha de corte."
            fase="Fase 4 · Consulta gerencial"
            referencia="dashboard-gerencial-pc.png"
            endpoints={["GET /api/cartera?fechaCorte="]}
            silueta="tablero"
            notas="Cartera activa, en mora, en riesgo por tramo e incobrable del mes (G-1). Los widgets del prototipo sin respaldo en el núcleo se reemplazan por el desglose por tramo (D9)."
        />
    );
}

export function CarteraEnMora() {
    const { tramo } = useParametros();
    return (
        <PantallaPendiente
            titulo={tramo ? "Créditos del tramo" : "Cartera en mora"}
            destacado={tramo ? etiquetaTramoConExplicacion(tramo) : undefined}
            subtitulo="Créditos con días de atraso, tramo y saldo."
            fase="Fase 4 · Consulta gerencial"
            referencia="creditos-del-tramo-mora-2.png"
            endpoints={[`GET /api/cartera/mora?fechaCorte=${tramo ? `&tramo=${tramo}` : ""}`]}
            silueta="tabla"
        />
    );
}

export function Cierre() {
    return (
        <PantallaPendiente
            titulo="Cierre diario y mensual"
            subtitulo="Desembolsos y recuperaciones por concepto."
            fase="Fase 4 · Consulta gerencial"
            referencia="cierre-mensual-pc.png (identidad visual; contenido según el enunciado)"
            endpoints={["GET /api/cierres/diario?fechaCorte=", "GET /api/cierres/mensual?periodo=AAAA-MM"]}
            silueta="cierre"
            notas="Recuperaciones por gastos, interés moratorio, interés corriente y capital (G-2, G-3)."
        />
    );
}

export function DetalleCreditoGerencia() {
    const { id = "" } = useParametros();
    return (
        <PantallaPendiente
            titulo="Detalle del crédito"
            subtitulo={`Estado del crédito ${id} y cómo se formó su mora (G-5).`}
            fase="Fase 4 · Consulta gerencial"
            referencia="detalle-credito.png y detalle-de-la-mora.png, en versión de escritorio"
            endpoints={[`GET /api/creditos/${id}?fechaCorte=`, `GET /api/creditos/${id}/cuotas/:numero/mora?fechaCorte=`]}
            silueta="detalle"
        />
    );
}
