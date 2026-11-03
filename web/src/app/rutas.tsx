import type { ReactNode } from "react";

import type { Perfil } from "../api/cliente";
import { Componentes } from "../paginas/Componentes";
import { InicioAsesor } from "../paginas/asesor/InicioAsesor";
import { MasAsesor } from "../paginas/asesor/MasAsesor";
import { BuscarCliente, DetalleCredito, DetalleMora } from "../paginas/asesor/CobroEnCampo";
import { PlanAmortizacion } from "../paginas/asesor/PlanAmortizacion";
import { SolicitudCredito } from "../paginas/asesor/SolicitudCredito";
import { Vencimientos } from "../paginas/asesor/Vencimientos";
import { RegistroPago } from "../paginas/asesor/RegistroPago";
import { CarteraEnMora } from "../paginas/gerencia/CarteraEnMora";
import { Cierre } from "../paginas/gerencia/Cierre";
import { DetalleCreditoGerencia, MoraGerencia, PlanGerencia } from "../paginas/gerencia/DetalleGerencia";
import { Tablero } from "../paginas/gerencia/Tablero";
import { etiquetaTramo } from "../utilidades/etiquetas";
import type { Parametros } from "./enrutador";

/**
 * Tabla de rutas del E1.
 *
 * Cada ruta declara qué perfil la usa y en qué layout se pinta. La guarda
 * de perfil (App.tsx) es comodidad de navegación: quien autoriza cada
 * operación es el servidor (src/api/perfiles.ts).
 *
 * Las siete pantallas obligatorias del enunciado (E1):
 *   Solicitud de crédito ........ /asesor/solicitud
 *   Detalle del crédito ......... /asesor/creditos/:id   (y /gerencia/creditos/:id, G-5)
 *   Registro de pago ............ /asesor/pagos
 *   Plan de amortización ........ /asesor/creditos/:id/plan
 *   Detalle de la mora .......... /asesor/creditos/:id/mora (y /gerencia/creditos/:id/mora)
 *   (la gerencia también ve el plan: /gerencia/creditos/:id/plan; todo en solo lectura)
 *   Tablero gerencial ........... /gerencia  (+ /gerencia/mora/:tramo, G-4)
 *   Cierre diario / mensual ..... /gerencia/cierre
 */

export type Layout = "asesor" | "gerencia";

export interface Miga {
    readonly etiqueta: string;
    readonly a?: string;
}

export interface DefinicionRuta {
    readonly patron: string;
    readonly titulo: string | ((p: Parametros) => string);
    readonly perfil: Perfil;
    readonly layout: Layout;
    readonly pagina: () => ReactNode;
    /** Destino del botón "atrás" del encabezado del asesor. */
    readonly atras?: (p: Parametros) => string;
    /** Migas del encabezado de gerencia. */
    readonly migas?: (p: Parametros) => ReadonlyArray<Miga>;
}

const enc = encodeURIComponent;

const RUTAS_BASE: ReadonlyArray<DefinicionRuta> = [
    // --- Asesor (teléfono) ------------------------------------------------
    { patron: "/asesor", titulo: "Inicio", perfil: "asesor", layout: "asesor", pagina: () => <InicioAsesor /> },
    { patron: "/asesor/clientes", titulo: "Buscar cliente", perfil: "asesor", layout: "asesor", pagina: () => <BuscarCliente /> },
    {
        patron: "/asesor/creditos/:id",
        titulo: p => `Crédito ${p.id ?? ""}`,
        perfil: "asesor", layout: "asesor",
        pagina: () => <DetalleCredito />,
        atras: () => "/asesor/clientes"
    },
    {
        patron: "/asesor/creditos/:id/mora",
        titulo: "Detalle de la mora",
        perfil: "asesor", layout: "asesor",
        pagina: () => <DetalleMora />,
        atras: p => `/asesor/creditos/${enc(p.id ?? "")}`
    },
    {
        patron: "/asesor/creditos/:id/plan",
        titulo: "Plan de amortización",
        perfil: "asesor", layout: "asesor",
        pagina: () => <PlanAmortizacion />,
        atras: p => `/asesor/creditos/${enc(p.id ?? "")}`
    },
    { patron: "/asesor/pagos", titulo: "Registro de pago", perfil: "asesor", layout: "asesor", pagina: () => <RegistroPago /> },
    {
        patron: "/asesor/solicitud",
        titulo: "Nueva solicitud",
        perfil: "asesor", layout: "asesor",
        pagina: () => <SolicitudCredito />,
        atras: () => "/asesor"
    },
    {
        patron: "/asesor/vencimientos",
        titulo: "Próximos vencimientos",
        perfil: "asesor", layout: "asesor",
        pagina: () => <Vencimientos />,
        atras: () => "/asesor"
    },
    { patron: "/asesor/mas", titulo: "Más", perfil: "asesor", layout: "asesor", pagina: () => <MasAsesor /> },

    // --- Gerencia (escritorio) --------------------------------------------
    { patron: "/gerencia", titulo: "Dashboard Gerencial", perfil: "gerencia", layout: "gerencia", pagina: () => <Tablero />, migas: () => [{ etiqueta: "Inicio" }] },
    {
        patron: "/gerencia/mora",
        titulo: "Cartera en mora",
        perfil: "gerencia", layout: "gerencia",
        pagina: () => <CarteraEnMora />,
        migas: () => [{ etiqueta: "Inicio", a: "/gerencia" }, { etiqueta: "Cartera en mora" }]
    },
    {
        patron: "/gerencia/mora/:tramo",
        titulo: p => `Créditos del tramo ${etiquetaTramo(p.tramo ?? "")}`,
        perfil: "gerencia", layout: "gerencia",
        pagina: () => <CarteraEnMora />,
        migas: p => [
            { etiqueta: "Inicio", a: "/gerencia" },
            { etiqueta: "Cartera en mora", a: "/gerencia/mora" },
            { etiqueta: etiquetaTramo(p.tramo ?? "") }
        ]
    },
    {
        patron: "/gerencia/creditos/:id",
        titulo: p => `Crédito ${p.id ?? ""}`,
        perfil: "gerencia", layout: "gerencia",
        pagina: () => <DetalleCreditoGerencia />,
        migas: p => [
            { etiqueta: "Inicio", a: "/gerencia" },
            { etiqueta: "Cartera en mora", a: "/gerencia/mora" },
            { etiqueta: `Crédito ${p.id ?? ""}` }
        ]
    },
    {
        patron: "/gerencia/creditos/:id/mora",
        titulo: "Detalle de la mora",
        perfil: "gerencia", layout: "gerencia",
        pagina: () => <MoraGerencia />,
        migas: p => [
            { etiqueta: "Inicio", a: "/gerencia" },
            { etiqueta: "Cartera en mora", a: "/gerencia/mora" },
            { etiqueta: `Crédito ${p.id ?? ""}`, a: `/gerencia/creditos/${enc(p.id ?? "")}` },
            { etiqueta: "Detalle de la mora" }
        ]
    },
    {
        patron: "/gerencia/creditos/:id/plan",
        titulo: "Plan de amortización",
        perfil: "gerencia", layout: "gerencia",
        pagina: () => <PlanGerencia />,
        migas: p => [
            { etiqueta: "Inicio", a: "/gerencia" },
            { etiqueta: "Cartera en mora", a: "/gerencia/mora" },
            { etiqueta: `Crédito ${p.id ?? ""}`, a: `/gerencia/creditos/${enc(p.id ?? "")}` },
            { etiqueta: "Plan de amortización" }
        ]
    },
    {
        patron: "/gerencia/cierre",
        titulo: "Cierres",
        perfil: "gerencia", layout: "gerencia",
        pagina: () => <Cierre />,
        migas: () => [{ etiqueta: "Inicio", a: "/gerencia" }, { etiqueta: "Cierres" }]
    }
];

/**
 * Galería de componentes: SOLO en desarrollo. `import.meta.env.DEV` es
 * falso en `vite build`, así que la ruta ni siquiera existe en producción.
 */
const RUTAS_DESARROLLO: ReadonlyArray<DefinicionRuta> = [
    {
        patron: "/gerencia/componentes",
        titulo: "Componentes",
        perfil: "gerencia", layout: "gerencia",
        pagina: () => <Componentes />,
        migas: () => [{ etiqueta: "Componentes (desarrollo)" }]
    }
];

export const RUTAS: ReadonlyArray<DefinicionRuta> = import.meta.env.DEV
    ? [...RUTAS_BASE, ...RUTAS_DESARROLLO]
    : RUTAS_BASE;

export function inicioDe(perfil: Perfil | null): string {
    return perfil === "asesor" ? "/asesor" : perfil === "gerencia" ? "/gerencia" : "/perfil";
}
