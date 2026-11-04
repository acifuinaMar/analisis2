import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { crearClienteApi, esPerfil, type ClienteApi, type Perfil } from "../api/cliente";
import { esFechaValida, fechaCorteInicial } from "../utilidades/fechas";
import { escribir, leer } from "./almacen";

/**
 * Estado de la sesión de demostración: perfil elegido y fecha de corte.
 *
 * PERFIL. Es la selección prevista para la demostración (decisión del
 * equipo): se declara, no se demuestra. El servidor la verifica en cada
 * operación; la interfaz solo la usa para elegir qué pintar.
 *
 * FECHA DE CORTE. Una sola para toda la aplicación, porque el tablero y
 * el chat deben responder a la MISMA fecha (Bloque 3 del video). Viaja a
 * la API en cada consulta; la interfaz nunca usa el reloj para calcular.
 */

const CLAVE_PERFIL = "cv.perfil";
const CLAVE_FECHA = "cv.fechaCorte";

interface ValorSesion {
    readonly perfil: Perfil | null;
    readonly elegirPerfil: (perfil: Perfil) => void;
    readonly salir: () => void;
    readonly fechaCorte: string;
    readonly cambiarFechaCorte: (fecha: string) => boolean;
    readonly api: ClienteApi;
}

const ContextoSesion = createContext<ValorSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {

    const [perfil, setPerfil] = useState<Perfil | null>(() => {
        const guardado = leer(CLAVE_PERFIL);
        return esPerfil(guardado) ? guardado : null;
    });

    const [fechaCorte, setFechaCorte] = useState<string>(() => {
        const guardada = leer(CLAVE_FECHA);
        return guardada && esFechaValida(guardada)
            ? guardada
            : fechaCorteInicial(import.meta.env.VITE_FECHA_CORTE_INICIAL);
    });

    // El cliente lee el perfil en cada petición desde una referencia, para
    // que nunca mande un perfil viejo después de cambiarlo.
    const perfilActual = useRef(perfil);
    perfilActual.current = perfil;

    const api = useMemo(
        () => crearClienteApi({ obtenerPerfil: () => perfilActual.current }),
        []
    );

    const elegirPerfil = useCallback((nuevo: Perfil) => {
        escribir(CLAVE_PERFIL, nuevo);
        setPerfil(nuevo);
    }, []);

    const salir = useCallback(() => {
        escribir(CLAVE_PERFIL, null);
        setPerfil(null);
    }, []);

    const cambiarFechaCorte = useCallback((fecha: string) => {
        if (!esFechaValida(fecha)) {
            return false;
        }
        escribir(CLAVE_FECHA, fecha);
        setFechaCorte(fecha);
        return true;
    }, []);

    const valor = useMemo<ValorSesion>(
        () => ({ perfil, elegirPerfil, salir, fechaCorte, cambiarFechaCorte, api }),
        [perfil, elegirPerfil, salir, fechaCorte, cambiarFechaCorte, api]
    );

    return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): ValorSesion {
    const valor = useContext(ContextoSesion);
    if (!valor) {
        throw new Error("useSesion debe usarse dentro de <ProveedorSesion>.");
    }
    return valor;
}
