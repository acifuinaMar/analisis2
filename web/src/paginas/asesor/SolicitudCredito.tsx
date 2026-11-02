import { useState } from "react";

import { useSesion } from "../../estado/sesion";
import { FlujoOriginacion } from "../../originacion/FlujoOriginacion";
import { leerOriginacionPendiente } from "../../originacion/operacionOriginacion";
import { EncabezadoPagina } from "../../ui";
import { formatoFechaLarga } from "../../utilidades/formato";

/**
 * Nueva solicitud de crédito (pantalla obligatoria del E1, flujo de
 * originación, OP-3). Si quedó una escritura incierta en esta pestaña, se
 * retoma: hasta resolverla no se puede empezar otra solicitud.
 */
export function SolicitudCredito() {
    const { fechaCorte } = useSesion();
    // Se lee una sola vez, al entrar.
    const [pendiente] = useState(leerOriginacionPendiente);

    return (
        <div>
            <EncabezadoPagina
                titulo="Nueva solicitud de crédito"
                subtitulo={`Alta del cliente, plan simulado y desembolso al ${formatoFechaLarga(pendiente?.credito.fechaDesembolso ?? fechaCorte)}.`}
            />
            <FlujoOriginacion pendienteInicial={pendiente} />
        </div>
    );
}
