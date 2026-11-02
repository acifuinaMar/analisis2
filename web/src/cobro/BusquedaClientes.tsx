import { useState } from "react";

import { buscarClientes } from "../api/cobro";
import type { ResultadoBusquedaClientes } from "../api/contratos";
import { ErrorApi } from "../api/cliente";
import { useSesion } from "../estado/sesion";
import { Aviso, AvisoError, Buscador, Cargando, EstadoVacio, Tarjeta } from "../ui";
import { TarjetaCreditoResumen } from "./TarjetaCreditoResumen";

/**
 * Búsqueda de clientes del cobro en campo (GET /api/clientes?buscar=).
 *
 * La última búsqueda se recuerda en MEMORIA (no en sessionStorage ni
 * localStorage) para que al volver del detalle de un crédito la lista
 * siga ahí, sin dejar nombres ni DPI guardados en el navegador.
 */
let ultima: { texto: string; resultado: ResultadoBusquedaClientes } | null = null;

const MINIMO = 2;

export function BusquedaClientes({ accion }: { accion: "detalle" | "cobro" }) {
    const { api } = useSesion();

    const [texto, setTexto] = useState(ultima?.texto ?? "");
    const [resultado, setResultado] = useState<ResultadoBusquedaClientes | null>(ultima?.resultado ?? null);
    const [error, setError] = useState<ErrorApi | null>(null);
    const [cargando, setCargando] = useState(false);
    const [aviso, setAviso] = useState<string | null>(null);

    const buscar = async () => {
        const limpio = texto.trim();
        if (limpio.length < MINIMO) {
            setAviso(`Escriba al menos ${MINIMO} caracteres.`);
            return;
        }
        setAviso(null);
        setError(null);
        setCargando(true);
        try {
            const r = await buscarClientes(api, limpio);
            ultima = { texto: limpio, resultado: r };
            setResultado(r);
        } catch (e) {
            setResultado(null);
            setError(e instanceof ErrorApi ? e : new ErrorApi(0, "ERROR_DESCONOCIDO", String(e)));
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="space-y-4">
            <Buscador
                valor={texto}
                alCambiar={setTexto}
                alBuscar={() => void buscar()}
                etiqueta="Buscar cliente"
                marcador="Nombre, DPI, CL-0000 o CV-2026-0000"
                textoBoton="Buscar"
            />
            {aviso ? <p role="alert" className="text-sm text-peligro">{aviso}</p> : null}

            {cargando ? <Cargando texto="Buscando clientes…" /> : null}

            {!cargando && error ? <AvisoError error={error} alReintentar={() => void buscar()} /> : null}

            {!cargando && !error && resultado === null ? (
                <p className="text-sm text-texto-suave">
                    Busque por nombre (sin importar tildes), identificador de cliente, DPI o identificador de crédito.
                </p>
            ) : null}

            {!cargando && !error && resultado && resultado.resultados.length === 0 ? (
                <EstadoVacio icono="buscar" titulo="Sin coincidencias">
                    No hay clientes que coincidan con «{resultado.buscar}».
                </EstadoVacio>
            ) : null}

            {!cargando && !error && resultado && resultado.resultados.length > 0 ? (
                <section aria-label="Resultados de la búsqueda" className="space-y-3">
                    <p className="text-sm font-semibold text-texto">
                        {resultado.total === 1 ? "1 cliente" : `${resultado.total} clientes`}
                    </p>
                    {resultado.truncado ? (
                        <Aviso tipo="info">
                            Se muestran los primeros {resultado.resultados.length}. Escriba más para afinar la búsqueda.
                        </Aviso>
                    ) : null}
                    <ul className="space-y-3">
                        {resultado.resultados.map(c => (
                            <li key={c.idCliente}>
                                <Tarjeta className="p-4">
                                    <p className="text-base font-semibold text-texto">{c.nombreCompleto}</p>
                                    <p className="mt-0.5 text-sm text-texto-suave">
                                        {c.idCliente} · DPI •••• {c.dpiTerminacion} · {c.municipio}
                                    </p>
                                    {c.creditos.length === 0 ? (
                                        <p className="mt-3 text-sm text-texto-suave">Sin créditos registrados.</p>
                                    ) : (
                                        <ul className="mt-3 space-y-2" aria-label={`Créditos de ${c.nombreCompleto}`}>
                                            {c.creditos.map(k => (
                                                <TarjetaCreditoResumen key={k.idCredito} idCredito={k.idCredito} accion={accion} />
                                            ))}
                                        </ul>
                                    )}
                                </Tarjeta>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
        </div>
    );
}
