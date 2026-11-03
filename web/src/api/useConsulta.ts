import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorApi } from "./cliente";

/**
 * Estado de una consulta a la API: cargando, error o datos.
 *
 * Cancela la petición anterior si cambian las dependencias (por ejemplo,
 * la fecha de corte), para que una respuesta lenta y vieja no pise a la
 * nueva y el tablero muestre cifras de otra fecha.
 */
export interface EstadoConsulta<T> {
    readonly datos: T | undefined;
    readonly error: ErrorApi | undefined;
    readonly cargando: boolean;
    readonly recargar: () => void;
}

export function useConsulta<T>(
    consultar: (senal: AbortSignal) => Promise<T>,
    dependencias: readonly unknown[],
    activa = true
): EstadoConsulta<T> {

    const [datos, setDatos] = useState<T | undefined>(undefined);
    const [error, setError] = useState<ErrorApi | undefined>(undefined);
    const [cargando, setCargando] = useState(activa);
    const [vuelta, setVuelta] = useState(0);

    const consultarRef = useRef(consultar);
    consultarRef.current = consultar;

    useEffect(() => {
        if (!activa) {
            setCargando(false);
            return;
        }

        const control = new AbortController();
        setCargando(true);
        setError(undefined);

        consultarRef.current(control.signal)
            .then(resultado => {
                if (!control.signal.aborted) {
                    setDatos(resultado);
                }
            })
            .catch((e: unknown) => {
                if (control.signal.aborted) {
                    return;
                }
                setDatos(undefined);
                setError(e instanceof ErrorApi
                    ? e
                    : new ErrorApi(0, "ERROR_DESCONOCIDO", e instanceof Error ? e.message : String(e)));
            })
            .finally(() => {
                if (!control.signal.aborted) {
                    setCargando(false);
                }
            });

        return () => control.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activa, vuelta, ...dependencias]);

    const recargar = useCallback(() => setVuelta(v => v + 1), []);

    return { datos, error, cargando, recargar };
}
