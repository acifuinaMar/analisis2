import { iniciales } from "../utilidades/formato";
import { cx } from "./clases";

/** Logotipo "CV" del prototipo de escritorio. */
export function Logotipo({ tamano = "md" }: { tamano?: "sm" | "md" }) {
    return (
        <span
            aria-hidden="true"
            className={cx(
                "inline-flex shrink-0 items-center justify-center rounded-lg bg-marca font-bold text-white",
                tamano === "sm" ? "size-8 text-xs" : "size-9 text-sm"
            )}
        >
            CV
        </span>
    );
}

/** Círculo gris con iniciales (prototipo: "LA"). */
export function Avatar({ nombre, className }: { nombre: string; className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cx("inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-superficie-activa text-xs font-semibold text-texto-medio", className)}
        >
            {iniciales(nombre)}
        </span>
    );
}
