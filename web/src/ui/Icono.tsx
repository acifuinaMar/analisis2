import type { SVGProps } from "react";

/**
 * Íconos de línea del prototipo.
 *
 * El prototipo usa el estilo de Lucide (trazo de 2 px, esquinas
 * redondeadas, rejilla de 24). Los trazos de abajo siguen ese estilo y
 * los de Lucide (licencia ISC). Se incluyen solo los que la interfaz usa,
 * sin agregar una dependencia.
 */
const TRAZOS = {
    inicio: (
        <>
            <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
            <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </>
    ),
    clientes: (
        <>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
    ),
    usuario: (
        <>
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </>
    ),
    tarjeta: (
        <>
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <path d="M2 10h20" />
        </>
    ),
    mas: (
        <>
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
        </>
    ),
    atras: <path d="m15 18-6-6 6-6" />,
    adelante: <path d="m9 18 6-6-6-6" />,
    abajo: <path d="m6 9 6 6 6-6" />,
    buscar: (
        <>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </>
    ),
    calendario: (
        <>
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M3 10h18" />
        </>
    ),
    cierre: (
        <>
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M3 10h18" />
            <path d="m9 16 2 2 4-4" />
        </>
    ),
    info: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
        </>
    ),
    alerta: (
        <>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
        </>
    ),
    exito: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
        </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    cerrar: (
        <>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </>
    ),
    chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    enviar: (
        <>
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
        </>
    ),
    documento: (
        <>
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
        </>
    ),
    salir: (
        <>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5" />
            <path d="M21 12H9" />
        </>
    ),
    grafica: (
        <>
            <path d="M3 3v16a2 2 0 0 0 2 2h16" />
            <path d="M18 17V9" />
            <path d="M13 17V5" />
            <path d="M8 17v-3" />
        </>
    ),
    dinero: (
        <>
            <path d="M12 2v20" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </>
    ),
    base: (
        <>
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14a9 3 0 0 0 18 0V5" />
            <path d="M3 12a9 3 0 0 0 18 0" />
        </>
    ),
    maletin: (
        <>
            <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            <rect width="20" height="14" x="2" y="6" rx="2" />
        </>
    ),
    agregar: (
        <>
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </>
    ),
    escudo: <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />,
    cargando: <path d="M21 12a9 9 0 1 1-6.219-8.56" />
} as const;

export type NombreIcono = keyof typeof TRAZOS;

interface PropsIcono extends Omit<SVGProps<SVGSVGElement>, "name"> {
    readonly nombre: NombreIcono;
    readonly tamano?: number;
    /** Texto para lectores de pantalla. Sin él, el ícono es decorativo. */
    readonly titulo?: string;
}

export function Icono({ nombre, tamano = 20, titulo, className, ...resto }: PropsIcono) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={tamano}
            height={tamano}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden={titulo ? undefined : true}
            role={titulo ? "img" : undefined}
            focusable="false"
            {...resto}
        >
            {titulo ? <title>{titulo}</title> : null}
            {TRAZOS[nombre]}
        </svg>
    );
}
