import { useEffect, useRef, useState } from "react";

import {
    aprobarPagoDelAsistente,
    preguntarAlAsistente,
    rechazarPagoDelAsistente,
    type RespuestaChat
} from "../api/chat";
import { ErrorApi, type Perfil } from "../api/cliente";
import { useSesion } from "../estado/sesion";
import { Aviso, Boton, cx, Icono } from "../ui";
import { formatoFechaLarga } from "../utilidades/formato";
import { MensajeChat } from "./MensajeChat";
import { TarjetaAprobacion, type VistaPreviaPago } from "./TarjetaAprobacion";

/**
 * Panel lateral del asistente gerencial (E5), dentro de la misma
 * aplicación del E1.
 *
 * Conversa contra POST /api/chat (src/api/app.ts), que sostiene un
 * orquestador por conversación. La memoria la guarda el SERVIDOR: aquí
 * solo se recuerda el `idSesion` para mandarlo en la pregunta siguiente,
 * que es lo que permite encadenar «¿y de ese crédito, cuánto debe?».
 *
 * Ninguna cifra se calcula aquí. Cada respuesta del asistente muestra las
 * herramientas MCP que usó, porque una cifra sin su origen no se puede
 * verificar (sección 7.1: «si una cifra aparece sin que se vea de dónde
 * salió, no cuenta»).
 *
 * EL PAGO. Si el asistente propone uno, el panel se detiene y muestra el
 * desglose de la prelación sin aplicar nada. El asesor puede aprobarlo
 * desde aquí; la gerencia ve el mismo desglose pero no puede aplicarlo, y
 * eso lo decide el servidor —la ruta de aprobar es solo del asesor y el
 * orquestador lo verifica otra vez—. Ocultar el botón es comodidad, no un
 * control de acceso.
 *
 * Distribución (preferencia del equipo):
 *   escritorio (lg+)  columna de 400 px a la derecha; el tablero sigue
 *                     visible para comparar pantalla y chat (Bloque 3).
 *   teléfono          ocupa toda la pantalla.
 */

interface PropsPanelAsistente {
    readonly abierto: boolean;
    readonly alCerrar: () => void;
    readonly perfil: Perfil;
}

interface Burbuja {
    readonly papel: "usuario" | "asistente";
    readonly texto: string;
    readonly herramientas?: ReadonlyArray<string>;
}

interface Pendiente {
    readonly vista: VistaPreviaPago;
    readonly puedeAprobar: boolean;
}

/** Lo que se le dice a la persona cuando la API responde con un error. */
function explicar(error: unknown): string {

    if (!(error instanceof ErrorApi)) {
        return "No se pudo hablar con el asistente. Revisá que la API esté "
            + "corriendo (npm run api) y volvé a intentar.";
    }

    switch (error.codigo) {
        case "CHAT_NO_DISPONIBLE":
            return "El asistente no está disponible: al servidor no se le "
                + "configuró un modelo de lenguaje (GEMINI_API_KEY).";
        case "SESION_INEXISTENTE":
            return "Esta conversación venció. Empezá una nueva: la próxima "
                + "pregunta abre otra.";
        case "PERFIL_SIN_PERMISO":
            return "Aplicar un pago le corresponde a un asesor.";
        default:
            return error.message;
    }
}

export function PanelAsistente({ abierto, alCerrar, perfil }: PropsPanelAsistente) {
    const { api, fechaCorte } = useSesion();
    const titulo = useRef<HTMLHeadingElement>(null);
    const finDelHilo = useRef<HTMLDivElement>(null);

    const [idSesion, setIdSesion] = useState<string | null>(null);
    const [burbujas, setBurbujas] = useState<ReadonlyArray<Burbuja>>([]);
    const [pendiente, setPendiente] = useState<Pendiente | null>(null);
    const [pregunta, setPregunta] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Al abrir, el foco va al panel; Escape lo cierra.
    useEffect(() => {
        if (!abierto) {
            return;
        }
        titulo.current?.focus();
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                alCerrar();
            }
        };
        window.addEventListener("keydown", alTeclear);
        return () => window.removeEventListener("keydown", alTeclear);
    }, [abierto, alCerrar]);

    // El hilo siempre muestra lo último.
    useEffect(() => {
        finDelHilo.current?.scrollIntoView({ block: "end" });
    }, [burbujas, pendiente]);

    /**
     * Aplica lo que devolvió el servidor.
     *
     * Una respuesta puede ser texto o una propuesta de pago, y aprobar
     * puede devolver OTRA propuesta: el asistente podría plantear un
     * segundo pago, y cada uno necesita su propia aprobación.
     */
    function asentar(r: RespuestaChat): void {
        setIdSesion(r.idSesion);
        if (r.tipo === "aprobacion_requerida") {
            setPendiente({
                vista: r.propuesta.vistaPrevia,
                puedeAprobar: r.puedeAprobar
            });
            return;
        }
        setPendiente(null);
        setBurbujas(previas => [...previas, {
            papel: "asistente",
            texto: r.texto,
            herramientas: r.herramientasUsadas
        }]);
    }

    async function enviar(): Promise<void> {

        const texto = pregunta.trim();

        if (!texto || enviando) {
            return;
        }

        setPregunta("");
        setError(null);
        setEnviando(true);
        setBurbujas(previas => [...previas, { papel: "usuario", texto }]);

        try {
            asentar(await preguntarAlAsistente(api, texto, idSesion));
        } catch (e) {
            // Si la sesión venció, la siguiente pregunta debe abrir otra.
            if (e instanceof ErrorApi && e.codigo === "SESION_INEXISTENTE") {
                setIdSesion(null);
            }
            setError(explicar(e));
        } finally {
            setEnviando(false);
        }
    }

    async function decidir(aprobar: boolean): Promise<void> {

        if (!idSesion || enviando) {
            return;
        }

        setError(null);
        setEnviando(true);

        try {
            asentar(aprobar
                ? await aprobarPagoDelAsistente(api, idSesion)
                : await rechazarPagoDelAsistente(api, idSesion));
        } catch (e) {
            setError(explicar(e));
        } finally {
            setEnviando(false);
        }
    }

    function empezarDeNuevo(): void {
        // La conversación anterior vence sola en el servidor.
        setIdSesion(null);
        setBurbujas([]);
        setPendiente(null);
        setError(null);
        setPregunta("");
    }

    if (!abierto) {
        return null;
    }

    const vacio = burbujas.length === 0 && pendiente === null;

    return (
        <aside
            id="panel-asistente"
            aria-label="Asistente gerencial"
            className={cx(
                "fixed inset-0 z-50 flex flex-col bg-superficie",
                "lg:sticky lg:top-0 lg:z-10 lg:h-dvh lg:w-[400px] lg:shrink-0 lg:border-l lg:border-borde"
            )}
        >
            <header className="flex h-16 items-center gap-3 border-b border-borde px-4">
                <span className="flex size-9 items-center justify-center rounded-lg bg-marca-suave text-marca">
                    <Icono nombre="chat" tamano={18} />
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                    <h2 ref={titulo} tabIndex={-1} className="text-base font-semibold text-texto outline-none">
                        Asistente gerencial
                    </h2>
                    <p className="truncate text-xs text-texto-suave">Cifras del núcleo · políticas con su fuente</p>
                </div>
                {!vacio ? (
                    <button
                        type="button"
                        onClick={empezarDeNuevo}
                        aria-label="Empezar una conversación nueva"
                        className="flex size-10 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-activa"
                    >
                        <Icono nombre="mas" tamano={18} />
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={alCerrar}
                    aria-label="Cerrar asistente"
                    className="flex size-10 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-activa"
                >
                    <Icono nombre="cerrar" tamano={20} />
                </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto bg-fondo p-4">
                {vacio ? (
                    <div className="rounded-tarjeta border border-borde bg-superficie p-4 text-sm text-texto-medio">
                        <p>
                            Preguntá en lenguaje natural sobre la cartera, un crédito, un cierre o una política. Las
                            cifras vienen del núcleo y las políticas con su fuente citada. La fecha de corte de esta
                            sesión es el <strong>{formatoFechaLarga(fechaCorte)}</strong>.
                        </p>
                        {perfil === "gerencia" ? (
                            <p className="mt-2 text-xs text-texto-suave">
                                Con el perfil gerencia el asistente solo consulta: puede mostrar el desglose de un pago
                                propuesto, pero no aplicarlo.
                            </p>
                        ) : null}
                    </div>
                ) : null}

                {burbujas.map((b, i) => (
                    <MensajeChat
                        key={i}
                        papel={b.papel}
                        texto={b.texto}
                        herramientas={b.herramientas}
                    />
                ))}

                {pendiente ? (
                    <TarjetaAprobacion
                        vista={pendiente.vista}
                        puedeAprobar={pendiente.puedeAprobar}
                        enviando={enviando}
                        alAprobar={() => void decidir(true)}
                        alRechazar={() => void decidir(false)}
                    />
                ) : null}

                {enviando && !pendiente ? (
                    <p className="text-sm text-texto-suave" role="status">
                        El asistente está consultando el núcleo…
                    </p>
                ) : null}

                {error ? <Aviso tipo="alerta" titulo="No se pudo responder">{error}</Aviso> : null}

                <div ref={finDelHilo} />
            </div>

            <form
                className="flex items-end gap-2 border-t border-borde bg-superficie p-3"
                onSubmit={e => {
                    e.preventDefault();
                    void enviar();
                }}
            >
                <label className="sr-only" htmlFor="pregunta-asistente">Pregunta para el asistente</label>
                <textarea
                    id="pregunta-asistente"
                    rows={2}
                    value={pregunta}
                    disabled={enviando}
                    placeholder="¿Cómo está la cartera al 31 de octubre?"
                    onChange={e => setPregunta(e.target.value)}
                    onKeyDown={e => {
                        // Enter envía; Mayús+Enter hace salto de línea.
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void enviar();
                        }
                    }}
                    className="min-h-[44px] flex-1 resize-none rounded-lg border border-borde bg-superficie px-3 py-2 text-sm text-texto outline-none placeholder:text-texto-suave focus:border-marca disabled:opacity-60"
                />
                <Boton
                    type="submit"
                    icono="enviar"
                    cargando={enviando}
                    disabled={!pregunta.trim()}
                    aria-label="Enviar pregunta"
                >
                    Enviar
                </Boton>
            </form>
        </aside>
    );
}
