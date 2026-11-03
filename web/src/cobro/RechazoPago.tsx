import { ErrorApi } from "../api/cliente";
import type { DetalleMontoNoExacto } from "../api/contratos";
import { Aviso, AvisoError, Boton, Desglose } from "../ui";
import { rotuloCuotas } from "../utilidades/etiquetas";
import { formatoQuetzales } from "../utilidades/formato";

/**
 * Muestra un rechazo de POST /pagos tal como lo explica el servidor
 * (convención uniforme de src/api/errores.ts). Los datos para reaccionar
 * —el monto correcto, su desglose— se toman de `detalle`, no del texto.
 */
export function RechazoPago({ error, alUsarMonto }: { error: ErrorApi; alUsarMonto?: (monto: number) => void }) {

    if (error.codigo === "MONTO_NO_EXACTO" && error.detalle) {
        const d = error.detalle as unknown as DetalleMontoNoExacto;
        return (
            <div className="space-y-3">
                <Aviso tipo="peligro" titulo="Monto no exacto">{error.message}</Aviso>
                <Desglose
                    titulo={`Monto correcto (${rotuloCuotas(d.cuotasCubiertas, false)})`}
                    lineas={[
                        { concepto: "Gastos de gestión", monto: formatoQuetzales(d.desglosePrelacion.gastos) },
                        { concepto: "Interés moratorio", monto: formatoQuetzales(d.desglosePrelacion.interesMoratorio) },
                        { concepto: "Interés corriente", monto: formatoQuetzales(d.desglosePrelacion.interesCorriente) },
                        { concepto: "Capital", monto: formatoQuetzales(d.desglosePrelacion.capital) }
                    ]}
                    total={{ concepto: "Monto correcto", monto: formatoQuetzales(d.montoCorrecto) }}
                />
                {alUsarMonto ? (
                    <Boton variante="secundario" bloque onClick={() => alUsarMonto(d.montoCorrecto)}>
                        Usar el monto correcto ({formatoQuetzales(d.montoCorrecto)})
                    </Boton>
                ) : null}
            </div>
        );
    }

    if (error.codigo === "CREDITO_INCOBRABLE") {
        return <Aviso tipo="peligro" titulo="Crédito incobrable: no se recibe el pago">{error.message}</Aviso>;
    }

    if (error.codigo === "CUOTA_YA_PAGADA") {
        return <Aviso tipo="alerta" titulo="No hay deuda exigible">{error.message}</Aviso>;
    }

    if (error.codigo === "PERFIL_SIN_PERMISO" || error.codigo === "PERFIL_REQUERIDO") {
        return <Aviso tipo="peligro" titulo="Este perfil no puede registrar pagos">{error.message}</Aviso>;
    }

    if (error.codigo === "VALIDACION") {
        const campos = (error.detalle?.campos ?? []) as Array<{ campo: string; mensaje: string }>;
        return (
            <Aviso tipo="peligro" titulo="Datos del pago no válidos">
                <ul className="list-disc pl-4">
                    {campos.map(c => <li key={c.campo}>{c.campo}: {c.mensaje}</li>)}
                </ul>
            </Aviso>
        );
    }

    return <AvisoError error={error} />;
}
