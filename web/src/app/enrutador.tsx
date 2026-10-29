import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type AnchorHTMLAttributes,
    type MouseEvent,
    type ReactNode
} from "react";

/**
 * Enrutador mínimo sobre la History API.
 *
 * Por qué uno propio y no React Router: la aplicación tiene una docena de
 * rutas, dos layouts y parámetros simples (`:id`, `:tramo`). Para eso
 * bastan ~150 líneas sin dependencias, y el equipo puede leerlas enteras.
 * Si más adelante hiciera falta algo más (carga de datos por ruta,
 * rutas anidadas profundas), la tabla de src/app/rutas.tsx se traslada a
 * React Router casi sin cambios.
 */

interface Ubicacion {
    readonly ruta: string;
    readonly consulta: URLSearchParams;
}

interface ValorEnrutador {
    readonly ubicacion: Ubicacion;
    readonly navegar: (destino: string, opciones?: { reemplazar?: boolean }) => void;
}

const ContextoEnrutador = createContext<ValorEnrutador | null>(null);

function leerUbicacion(): Ubicacion {
    return {
        ruta: window.location.pathname || "/",
        consulta: new URLSearchParams(window.location.search)
    };
}

export function Enrutador({ children }: { children: ReactNode }) {

    const [ubicacion, setUbicacion] = useState<Ubicacion>(leerUbicacion);

    useEffect(() => {
        const alVolver = () => setUbicacion(leerUbicacion());
        window.addEventListener("popstate", alVolver);
        return () => window.removeEventListener("popstate", alVolver);
    }, []);

    const navegar = useCallback((destino: string, opciones?: { reemplazar?: boolean }) => {
        const actual = window.location.pathname + window.location.search;
        if (destino !== actual) {
            if (opciones?.reemplazar) {
                window.history.replaceState(null, "", destino);
            } else {
                window.history.pushState(null, "", destino);
            }
        }
        setUbicacion(leerUbicacion());
        window.scrollTo({ top: 0 });
    }, []);

    const valor = useMemo(() => ({ ubicacion, navegar }), [ubicacion, navegar]);

    return <ContextoEnrutador.Provider value={valor}>{children}</ContextoEnrutador.Provider>;
}

function useEnrutador(): ValorEnrutador {
    const valor = useContext(ContextoEnrutador);
    if (!valor) {
        throw new Error("Los hooks de ruta deben usarse dentro de <Enrutador>.");
    }
    return valor;
}

export function useUbicacion(): Ubicacion {
    return useEnrutador().ubicacion;
}

export function useNavegar(): ValorEnrutador["navegar"] {
    return useEnrutador().navegar;
}

// ----------------------------------------------------------------------
// Coincidencia de rutas
// ----------------------------------------------------------------------

export type Parametros = Readonly<Record<string, string>>;

/**
 * "/asesor/creditos/:id" contra "/asesor/creditos/CV-2026-0030"
 * -> { id: "CV-2026-0030" }; null si no coincide.
 */
export function coincidir(patron: string, ruta: string): Parametros | null {
    const limpiar = (texto: string) => texto.replace(/\/+$/, "") || "/";
    const p = limpiar(patron).split("/");
    const r = limpiar(ruta).split("/");

    if (p.length !== r.length) {
        return null;
    }

    const parametros: Record<string, string> = {};

    for (let i = 0; i < p.length; i++) {
        const segmento = p[i]!;
        const valor = r[i]!;
        if (segmento.startsWith(":")) {
            if (!valor) {
                return null;
            }
            try {
                parametros[segmento.slice(1)] = decodeURIComponent(valor);
            } catch {
                return null;
            }
        } else if (segmento !== valor) {
            return null;
        }
    }

    return parametros;
}

const ContextoParametros = createContext<Parametros>({});

export function ProveedorParametros({ valor, children }: { valor: Parametros; children: ReactNode }) {
    return <ContextoParametros.Provider value={valor}>{children}</ContextoParametros.Provider>;
}

export function useParametros(): Parametros {
    return useContext(ContextoParametros);
}

/** ¿La ruta actual es `destino` o está debajo de él? Para el menú activo. */
export function useEstaActiva(destino: string, exacta = false): boolean {
    const { ruta } = useUbicacion();
    if (exacta) {
        return ruta === destino;
    }
    return ruta === destino || ruta.startsWith(`${destino}/`);
}

// ----------------------------------------------------------------------
// Enlaces y redirecciones
// ----------------------------------------------------------------------

interface PropsEnlace extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
    readonly a: string;
    readonly reemplazar?: boolean;
}

/**
 * <a> real (se puede abrir en otra pestaña, lo lee un lector de
 * pantalla) que navega sin recargar la página.
 */
export function Enlace({ a, reemplazar, onClick, children, ...resto }: PropsEnlace) {
    const navegar = useNavegar();

    const alHacerClic = (evento: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(evento);
        if (
            evento.defaultPrevented
            || evento.button !== 0
            || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey
            || resto.target === "_blank"
        ) {
            return;
        }
        evento.preventDefault();
        navegar(a, { reemplazar });
    };

    return <a href={a} onClick={alHacerClic} {...resto}>{children}</a>;
}

export function Redirigir({ a }: { a: string }) {
    const navegar = useNavegar();
    useEffect(() => {
        navegar(a, { reemplazar: true });
    }, [a, navegar]);
    return null;
}
