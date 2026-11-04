import { useId, useState } from "react";

import { useSesion } from "../estado/sesion";
import { cx, Icono } from "../ui";
import { formatoFecha } from "../utilidades/formato";

/**
 * Fecha de corte de toda la aplicación (prototipo: botón "Septiembre
 * 2026" con calendario en la esquina del tablero).
 *
 * El prototipo elige un MES; el enunciado exige una FECHA: todas las
 * consultas son "al 31 de octubre de 2026" y G-7 pide otra fecha a
 * propósito. Por eso se elige día, con el mismo aspecto de botón.
 *
 * Usa el selector nativo del navegador: accesible por teclado y con el
 * calendario del teléfono, sin librerías.
 */
export function SelectorFechaCorte({ compacto }: { compacto?: boolean }) {
    const { fechaCorte, cambiarFechaCorte } = useSesion();
    const id = useId();
    const [invalida, setInvalida] = useState(false);

    return (
        <label
            htmlFor={id}
            title="Fecha de corte de todas las consultas"
            className={cx(
                "relative inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border bg-superficie text-sm font-medium text-texto",
                "focus-within:ring-2 focus-within:ring-marca-suave hover:bg-fondo",
                invalida ? "border-peligro" : "border-borde-fuerte",
                compacto ? "px-2.5" : "px-3"
            )}
        >
            <Icono nombre="calendario" tamano={18} className="text-texto-suave" />
            <span className={compacto ? "sr-only" : "text-texto-suave"}>Corte</span>
            <span className="cifra" aria-hidden="true">{formatoFecha(fechaCorte)}</span>
            <Icono nombre="abajo" tamano={16} className="text-texto-suave" />
            <input
                id={id}
                type="date"
                aria-label="Fecha de corte"
                value={fechaCorte}
                required
                onChange={e => setInvalida(!cambiarFechaCorte(e.target.value))}
                onClick={e => {
                    // Abre el calendario al tocar cualquier parte del botón.
                    try {
                        e.currentTarget.showPicker?.();
                    } catch {
                        // Navegadores sin showPicker: el campo sigue editable.
                    }
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
            />
        </label>
    );
}
