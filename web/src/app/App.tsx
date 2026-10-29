import { useEffect } from "react";

import { LayoutAsesor } from "../layouts/LayoutAsesor";
import { LayoutGerencia } from "../layouts/LayoutGerencia";
import { NoEncontrada } from "../paginas/NoEncontrada";
import { SeleccionPerfil } from "../paginas/SeleccionPerfil";
import { ProveedorSesion, useSesion } from "../estado/sesion";
import { coincidir, Enrutador, ProveedorParametros, Redirigir, useUbicacion, type Parametros } from "./enrutador";
import { inicioDe, RUTAS, type DefinicionRuta } from "./rutas";

/**
 * Raíz de la aplicación: sesión de demostración + enrutador.
 */
export function App() {
    return (
        <ProveedorSesion>
            <Enrutador>
                <Vista />
            </Enrutador>
        </ProveedorSesion>
    );
}

function buscarRuta(ruta: string): { definicion: DefinicionRuta; parametros: Parametros } | null {
    for (const definicion of RUTAS) {
        const parametros = coincidir(definicion.patron, ruta);
        if (parametros) {
            return { definicion, parametros };
        }
    }
    return null;
}

function Vista() {
    const { ruta } = useUbicacion();
    const { perfil } = useSesion();

    const encontrada = buscarRuta(ruta);

    const titulo = encontrada
        ? (typeof encontrada.definicion.titulo === "function"
            ? encontrada.definicion.titulo(encontrada.parametros)
            : encontrada.definicion.titulo)
        : ruta === "/perfil" ? "Elegir perfil" : "Página no encontrada";

    useEffect(() => {
        document.title = `${titulo} · Crédito Vecino`;
    }, [titulo]);

    if (ruta === "/" || ruta === "") {
        return <Redirigir a={inicioDe(perfil)} />;
    }

    if (ruta === "/perfil") {
        return <SeleccionPerfil />;
    }

    if (!encontrada) {
        return <NoEncontrada inicio={inicioDe(perfil)} />;
    }

    const { definicion, parametros } = encontrada;

    // Guarda de NAVEGACIÓN (no de seguridad): sin perfil, a elegirlo; con
    // el perfil equivocado, a su propio inicio. El servidor responde 403
    // de todos modos si alguien llama a la API con otro perfil.
    if (!perfil) {
        return <Redirigir a={`/perfil?volver=${encodeURIComponent(ruta)}`} />;
    }
    if (perfil !== definicion.perfil) {
        return <Redirigir a={inicioDe(perfil)} />;
    }

    const pagina = (
        <ProveedorParametros valor={parametros}>
            {definicion.pagina()}
        </ProveedorParametros>
    );

    if (definicion.layout === "asesor") {
        return <LayoutAsesor atras={definicion.atras?.(parametros)}>{pagina}</LayoutAsesor>;
    }

    return <LayoutGerencia migas={definicion.migas?.(parametros)}>{pagina}</LayoutGerencia>;
}
