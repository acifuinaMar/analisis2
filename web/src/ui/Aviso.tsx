import type { ReactNode } from "react";

import { ErrorApi } from "../api/cliente";
import type { Variante } from "../utilidades/etiquetas";
import { cx } from "./clases";
import { Icono, type NombreIcono } from "./Icono";

type TipoAviso = Extract<Variante, "info" | "exito" | "alerta" | "peligro">;

const ESTILO: Record<TipoAviso, { caja: string; icono: NombreIcono; color: string }> = {
    info: { caja: "border-blue-200 bg-info-suave", icono: "info", color: "text-info" },
    exito: { caja: "border-green-200 bg-exito-suave", icono: "exito", color: "text-exito" },
    alerta: { caja: "border-amber-300 bg-alerta-suave", icono: "alerta", color: "text-alerta" },
    peligro: { caja: "border-red-200 bg-peligro-suave", icono: "alerta", color: "text-peligro" }
};

interface PropsAviso {
    readonly tipo?: TipoAviso;
    readonly titulo?: string;
    readonly children?: ReactNode;
    readonly accion?: ReactNode;
    readonly className?: string;
}

/**
 * Aviso con ícono (prototipo, Detalle de la mora: "La mora se calcula por
 * tramos de 30 días..."). Los de peligro y alerta se anuncian a los
 * lectores de pantalla.
 */
export function Aviso({ tipo = "info", titulo, children, accion, className }: PropsAviso) {
    const e = ESTILO[tipo];
    return (
        <div
            role={tipo === "peligro" || tipo === "alerta" ? "alert" : "status"}
            className={cx("flex gap-3 rounded-lg border p-4 text-sm", e.caja, className)}
        >
            <Icono nombre={e.icono} tamano={20} className={cx("mt-0.5 shrink-0", e.color)} />
            <div className="min-w-0 flex-1 text-texto-medio">
                {titulo ? <p className="font-semibold text-texto">{titulo}</p> : null}
                {children ? <div className={titulo ? "mt-1" : undefined}>{children}</div> : null}
                {accion ? <div className="mt-3">{accion}</div> : null}
            </div>
        </div>
    );
}

/**
 * Muestra un error de la API con su código estable. El mensaje lo redacta
 * el servidor; aquí no se reinterpreta.
 */
export function AvisoError({ error, alReintentar }: { error: ErrorApi; alReintentar?: () => void }) {
    return (
        <Aviso
            tipo="peligro"
            titulo={error.codigo === "SIN_CONEXION" ? "Sin conexión con la API" : "No se pudo completar la consulta"}
            accion={alReintentar ? (
                <button type="button" onClick={alReintentar} className="text-sm font-semibold text-marca hover:underline">
                    Reintentar
                </button>
            ) : undefined}
        >
            <p>{error.message}</p>
            <p className="mt-1 font-mono text-xs text-texto-suave">{error.codigo}</p>
        </Aviso>
    );
}
