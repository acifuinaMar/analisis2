import { cx } from "../ui";

export interface PropsMensajeChat {
    readonly papel: "usuario" | "asistente";
    readonly texto: string;
    /** Herramientas MCP que usó el asistente: dice de dónde salió la cifra. */
    readonly herramientas?: ReadonlyArray<string>;
}

/**
 * Burbuja de conversación. La del usuario va en azul marino a la derecha;
 * la del asistente, blanca a la izquierda, con las herramientas que usó
 * para que se vea el origen de cada cifra (sección 7.1: "si una cifra
 * aparece sin que se vea de dónde salió, no cuenta").
 */
export function MensajeChat({ papel, texto, herramientas }: PropsMensajeChat) {
    const esUsuario = papel === "usuario";
    return (
        <div className={cx("flex", esUsuario ? "justify-end" : "justify-start")}>
            <div
                className={cx(
                    "max-w-[88%] rounded-2xl px-4 py-2.5 text-sm",
                    esUsuario
                        ? "rounded-br-md bg-marca text-white"
                        : "rounded-bl-md border border-borde bg-superficie text-texto"
                )}
            >
                <p className="whitespace-pre-wrap break-words">{texto}</p>
                {!esUsuario && herramientas && herramientas.length > 0 ? (
                    <p className="mt-2 border-t border-borde pt-1.5 font-mono text-[11px] text-texto-suave">
                        {herramientas.join(" · ")}
                    </p>
                ) : null}
            </div>
        </div>
    );
}
