import { ErrorApi } from "../api/cliente";
import { Aviso, AvisoError } from "../ui";
import { formatoQuetzales } from "../utilidades/formato";

/**
 * Rechazos de la originación, tal como los explica el servidor
 * (src/api/errores.ts y src/servicios/originacion-credito.ts). Los límites
 * del producto no están escritos en la interfaz: llegan en `detalle`.
 */
export function RechazoOriginacion({ error }: { error: ErrorApi }) {
    const d = error.detalle ?? {};

    switch (error.codigo) {
        case "CAPITAL_FUERA_DE_RANGO": {
            const min = typeof d.minimo === "number" ? formatoQuetzales(d.minimo) : null;
            const max = typeof d.maximo === "number" ? formatoQuetzales(d.maximo) : null;
            return (
                <Aviso tipo="peligro" titulo="Monto fuera de lo que permite el producto">
                    {error.message}
                    {min && max ? <span className="mt-1 block">Rango permitido: {min} a {max}.</span> : null}
                </Aviso>
            );
        }
        case "PLAZO_FUERA_DE_RANGO":
            return (
                <Aviso tipo="peligro" titulo="Plazo fuera de lo que permite el producto">
                    {error.message}
                    {typeof d.minimo === "number" && typeof d.maximo === "number"
                        ? <span className="mt-1 block">Plazo permitido: {d.minimo} a {d.maximo} meses.</span>
                        : null}
                </Aviso>
            );
        case "TASA_INVALIDA":
            return <Aviso tipo="peligro" titulo="Tasa no válida">{error.message}</Aviso>;
        case "CLIENTE_DUPLICADO":
            return (
                <Aviso tipo="peligro" titulo="Ya existe un cliente con ese identificador">
                    {error.message} Elija otro identificador o use «Cliente existente».
                </Aviso>
            );
        case "DPI_DUPLICADO":
            return (
                <Aviso tipo="peligro" titulo="Ya existe un cliente con ese DPI">
                    {error.message} Búsquelo como «Cliente existente».
                </Aviso>
            );
        case "CREDITO_DUPLICADO":
            return (
                <Aviso tipo="peligro" titulo="Ya existe un crédito con ese identificador">
                    {error.message} Elija otro identificador de crédito.
                </Aviso>
            );
        case "CLIENTE_INEXISTENTE":
        case "ASESOR_INEXISTENTE":
        case "DATOS_INVALIDOS":
            return <Aviso tipo="peligro" titulo="Datos no válidos">{error.message}</Aviso>;
        case "VALIDACION": {
            const campos = (d.campos ?? []) as Array<{ campo: string; mensaje: string }>;
            return (
                <Aviso tipo="peligro" titulo="Datos no válidos">
                    <ul className="list-disc pl-4">
                        {campos.map(c => <li key={c.campo}>{c.campo}: {c.mensaje}</li>)}
                    </ul>
                </Aviso>
            );
        }
        default:
            return <AvisoError error={error} />;
    }
}
