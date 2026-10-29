import { Aviso, Boton, ChipEstado, Desglose, ListaDatos } from "../ui";
import { formatoFecha, formatoQuetzales } from "../utilidades/formato";

/**
 * Vista previa de un pago propuesto por el asistente.
 *
 * Es la forma de `PropuestaPago.vistaPrevia` del orquestador
 * (src/asistente/orquestador.ts), que a su vez es el ResultadoPago de
 * registrarPago con `confirmado` en falso. Todas las cifras vienen de
 * ahí; esta tarjeta no calcula nada.
 */
export interface VistaPreviaPago {
    readonly idCredito: string;
    readonly nombreCliente: string;
    readonly fechaOperacion: string;
    readonly claveIdempotencia: string;
    readonly cuotasCubiertas: ReadonlyArray<number>;
    readonly desglosePrelacion: {
        readonly gastos: number;
        readonly interesMoratorio: number;
        readonly interesCorriente: number;
        readonly capital: number;
        readonly total: number;
    };
    readonly estadoAntes: {
        readonly estado: string;
        readonly diasAtraso: number;
        readonly saldoCapital: number;
    };
}

interface PropsTarjetaAprobacion {
    readonly vista: VistaPreviaPago;
    /**
     * Si este perfil puede aplicar el pago. Lo decide el SERVIDOR
     * (Orquestador.puedeAprobar, src/acceso/perfil.ts); la interfaz solo lo
     * refleja. Aunque alguien forzara el botón, aprobarPago() lanza
     * ErrorPerfilSinPermiso para la gerencia.
     */
    readonly puedeAprobar: boolean;
    readonly alAprobar?: () => void;
    readonly alRechazar?: () => void;
    readonly enviando?: boolean;
}

/**
 * Paso de aprobación humana visible en la interfaz (E3, E5; OP-1).
 *
 * Muestra el desglose de la prelación ANTES de aplicar nada. El asesor ve
 * "Aprobar y aplicar" y "Rechazar"; la gerencia ve el mismo desglose, pero
 * sin botón de aplicar: solo puede descartar la propuesta.
 */
export function TarjetaAprobacion({ vista, puedeAprobar, alAprobar, alRechazar, enviando }: PropsTarjetaAprobacion) {
    const d = vista.desglosePrelacion;

    return (
        <section
            aria-label="Pago propuesto: requiere aprobación"
            className="overflow-hidden rounded-tarjeta border border-amber-300 bg-superficie"
        >
            <div className="flex items-center gap-2 border-b border-amber-300 bg-alerta-suave px-4 py-2.5">
                <span className="text-sm font-semibold text-alerta">Aprobación requerida</span>
                <span className="text-xs text-alerta">· no se ha aplicado nada</span>
            </div>

            <div className="space-y-3 p-4">
                <ListaDatos
                    pares={[
                        { etiqueta: "Crédito", valor: vista.idCredito },
                        { etiqueta: "Cliente", valor: vista.nombreCliente },
                        { etiqueta: "Fecha de operación", valor: formatoFecha(vista.fechaOperacion) },
                        { etiqueta: "Cuotas que cubre", valor: vista.cuotasCubiertas.join(", ") || "—" },
                        { etiqueta: "Estado actual", valor: <ChipEstado estado={vista.estadoAntes.estado} /> }
                    ]}
                />

                <Desglose
                    titulo="Desglose de la prelación"
                    lineas={[
                        { concepto: "Gastos de gestión", monto: formatoQuetzales(d.gastos) },
                        { concepto: "Interés moratorio", monto: formatoQuetzales(d.interesMoratorio) },
                        { concepto: "Interés corriente", monto: formatoQuetzales(d.interesCorriente) },
                        { concepto: "Capital", monto: formatoQuetzales(d.capital) }
                    ]}
                    total={{ concepto: "Total a recibir", monto: formatoQuetzales(d.total) }}
                />

                <p className="font-mono text-xs text-texto-suave">Clave de idempotencia: {vista.claveIdempotencia}</p>

                {puedeAprobar ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Boton icono="check" bloque onClick={alAprobar} cargando={enviando}>
                            Aprobar y aplicar
                        </Boton>
                        <Boton variante="secundario" bloque onClick={alRechazar} disabled={enviando}>
                            Rechazar
                        </Boton>
                    </div>
                ) : (
                    <>
                        <Aviso tipo="info">
                            Con el perfil <strong>gerencia</strong> podés revisar este desglose, pero aplicar el pago le
                            corresponde a un asesor.
                        </Aviso>
                        <Boton variante="secundario" bloque onClick={alRechazar} disabled={enviando}>
                            Descartar propuesta
                        </Boton>
                    </>
                )}
            </div>
        </section>
    );
}
