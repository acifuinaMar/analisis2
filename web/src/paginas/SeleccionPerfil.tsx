import type { Perfil } from "../api/cliente";
import { useConsulta } from "../api/useConsulta";
import { useNavegar, useUbicacion } from "../app/enrutador";
import { useSesion } from "../estado/sesion";
import { Aviso, cx, Icono, Logotipo, type NombreIcono } from "../ui";

/**
 * Selección de perfil para la demostración.
 *
 * Decisión del equipo: no hay autenticación (sección 3.1 del enunciado:
 * "basta con distinguir el perfil asesor del perfil gerencia"). Esta
 * pantalla lo dice abiertamente para que nadie la confunda con un inicio
 * de sesión seguro. Lo que sí se cumple: el SERVIDOR verifica el perfil en
 * cada operación (src/api/perfiles.ts).
 */

interface OpcionPerfil {
    readonly perfil: Perfil;
    readonly titulo: string;
    readonly descripcion: string;
    readonly detalle: string;
    readonly icono: NombreIcono;
}

const OPCIONES: ReadonlyArray<OpcionPerfil> = [
    {
        perfil: "asesor",
        titulo: "Asesor de campo",
        descripcion: "Origina créditos y registra pagos.",
        detalle: "Pensado para el teléfono.",
        icono: "maletin"
    },
    {
        perfil: "gerencia",
        titulo: "Gerencia",
        descripcion: "Tablero, cartera en mora, cierres y asistente.",
        detalle: "Pensado para escritorio. No registra pagos.",
        icono: "grafica"
    }
];

export function SeleccionPerfil() {
    const { elegirPerfil, api } = useSesion();
    const navegar = useNavegar();
    const { consulta } = useUbicacion();

    const salud = useConsulta(senal => api.get<{ estado: string }>("/salud", undefined, senal), []);

    const elegir = (perfil: Perfil) => {
        elegirPerfil(perfil);
        const volver = consulta.get("volver");
        const destinoPropio = perfil === "asesor" ? "/asesor" : "/gerencia";
        // Solo se vuelve a una ruta del mismo perfil y de esta aplicación.
        const valido = volver !== null
            && (volver === destinoPropio || volver.startsWith(`${destinoPropio}/`));
        navegar(valido ? volver : destinoPropio, { reemplazar: true });
    };

    return (
        <div className="flex min-h-dvh items-center justify-center bg-fondo px-4 py-10">
            <main className="w-full max-w-xl">
                <div className="mb-8 flex items-center gap-3">
                    <Logotipo />
                    <div className="leading-tight">
                        <p className="text-lg font-bold text-texto">Crédito Vecino</p>
                        <p className="text-sm text-texto-suave">Sistema de Gestión</p>
                    </div>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-texto sm:text-3xl">Elegí un perfil</h1>
                <p className="mt-1 text-texto-suave">Cada perfil ve y puede hacer cosas distintas.</p>

                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    {OPCIONES.map(o => (
                        <li key={o.perfil}>
                            <button
                                type="button"
                                onClick={() => elegir(o.perfil)}
                                className={cx(
                                    "group flex h-full w-full flex-col rounded-tarjeta border border-borde bg-superficie p-5 text-left shadow-tarjeta",
                                    "transition-colors hover:border-marca hover:bg-marca-suave/40"
                                )}
                            >
                                <span className="flex size-11 items-center justify-center rounded-lg bg-marca-suave text-marca">
                                    <Icono nombre={o.icono} tamano={22} />
                                </span>
                                <span className="mt-4 text-lg font-semibold text-texto">{o.titulo}</span>
                                <span className="mt-1 text-sm text-texto-medio">{o.descripcion}</span>
                                <span className="mt-1 text-xs text-texto-suave">{o.detalle}</span>
                                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-marca">
                                    Entrar
                                    <Icono nombre="adelante" tamano={16} className="transition-transform group-hover:translate-x-0.5" />
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>

                <Aviso tipo="info" titulo="Selección de perfil para la demostración" className="mt-6">
                    No es un inicio de sesión: cualquiera puede elegir un perfil. El servidor verifica el perfil en cada
                    operación, y por eso la API escucha solo en esta computadora (127.0.0.1). No debe usarse así en
                    producción.
                </Aviso>

                <p className="mt-4 flex items-center gap-2 text-sm text-texto-suave" role="status">
                    <span
                        aria-hidden="true"
                        className={cx(
                            "size-2.5 rounded-full",
                            salud.cargando ? "bg-borde-fuerte" : salud.error ? "bg-peligro" : "bg-exito"
                        )}
                    />
                    {salud.cargando
                        ? "Comprobando la API…"
                        : salud.error
                            ? "La API no responde. Ejecute `npm run api` en la raíz del proyecto."
                            : "API conectada."}
                </p>
            </main>
        </div>
    );
}
