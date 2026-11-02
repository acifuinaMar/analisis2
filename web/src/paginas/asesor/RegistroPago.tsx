import { useState } from "react";

import { useUbicacion } from "../../app/enrutador";
import { BusquedaClientes } from "../../cobro/BusquedaClientes";
import { FlujoPago } from "../../cobro/FlujoPago";
import { leerPendiente } from "../../cobro/operacionPago";
import { Aviso, BotonEnlace, EncabezadoPagina } from "../../ui";
import { formatoQuetzales } from "../../utilidades/formato";

/**
 * Registro de pago (/asesor/pagos?credito=CV-AAAA-NNNN).
 *
 * El crédito viaja en la URL: sobrevive a una recarga sin guardar nada.
 * Si hay una confirmación con resultado incierto (de esta pestaña), se
 * resuelve primero: mientras no se sepa si se cobró, no se abre otro cobro.
 */
export function RegistroPago() {
    const { consulta } = useUbicacion();
    const credito = consulta.get("credito")?.trim() || null;

    // Se lee una sola vez, al entrar: es la operación que quedó pendiente.
    const [pendiente] = useState(leerPendiente);

    const otroCredito = pendiente !== null && pendiente.datos.idCredito !== credito;

    return (
        <div>
            <EncabezadoPagina titulo="Registro de pago" subtitulo="Registra un pago realizado por el cliente." />

            {otroCredito && pendiente ? (
                <Aviso
                    tipo="alerta"
                    titulo="Hay un pago con resultado incierto"
                    accion={(
                        <BotonEnlace a={`/asesor/pagos?credito=${encodeURIComponent(pendiente.datos.idCredito)}`} tamano="sm">
                            Resolver el pago pendiente
                        </BotonEnlace>
                    )}
                >
                    El pago de {formatoQuetzales(pendiente.datos.monto)} al crédito {pendiente.datos.idCredito} se envió y no
                    llegó la respuesta. Resuélvalo antes de registrar otro cobro.
                </Aviso>
            ) : credito ? (
                <FlujoPago key={credito} idCredito={credito} pendienteInicial={pendiente} />
            ) : (
                <div className="space-y-3">
                    <p className="text-sm text-texto-medio">Busque al cliente y elija el crédito que va a cobrar.</p>
                    <BusquedaClientes accion="cobro" />
                </div>
            )}
        </div>
    );
}
