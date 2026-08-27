import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { ClaveIdempotenciaEsquema, ErrorApiEsquema, FechaISOEsquema } from "./comun";
import { ClienteEsquema, CrearClienteEsquema } from "./clientes";
import {
    CrearSolicitudEsquema,
    RechazarSolicitudEsquema,
    SolicitudEsquema
} from "./solicitudes";
import {
    CreditoEsquema,
    DeclararIncobrableEsquema,
    DesembolsarCreditoEsquema,
    PlanAmortizacionEsquema,
    ReestructurarCreditoEsquema
} from "./creditos";
import { PagoEsquema, RegistrarPagoEsquema } from "./pagos";
import {
    CierreDiarioEsquema,
    CierreMensualEsquema,
    GenerarCierreDiarioEsquema,
    GenerarCierreMensualEsquema
} from "./cierres";
import { PosicionCarteraEsquema, ReporteCarteraEsquema } from "./cartera";

/**
 * Punto unico donde el contrato de la API se arma a partir de los
 * esquemas Zod. Nada aqui declara reglas de negocio (seccion 7.2, tabla
 * de modulos: "Contratos / API ... No le corresponde: contener reglas de
 * negocio"): solo describe forma, no comportamiento.
 */
export function construirRegistro(): OpenAPIRegistry {

    const registro = new OpenAPIRegistry();

    // ------------------------------------------------------------
    // Componentes reutilizables de respuesta de error
    // ------------------------------------------------------------
    const errorRef = registro.register("ErrorApi", ErrorApiEsquema);

    const respuestasError = {
        400: {
            description: "Peticion invalida (falla de validacion Zod "
                + "o de una guarda del dominio, p. ej. una tasa fuera de "
                + "la razonabilidad de la seccion 6.3.1).",
            content: { "application/json": { schema: errorRef } }
        },
        404: {
            description: "El recurso solicitado no existe.",
            content: { "application/json": { schema: errorRef } }
        },
        409: {
            description: "Conflicto de estado: la operacion no es valida "
                + "para el estado actual del recurso (patron State, "
                + "seccion 6.7 -- p. ej. registrar un pago sobre un "
                + "credito 'solicitado').",
            content: { "application/json": { schema: errorRef } }
        }
    };

    // ------------------------------------------------------------
    // Clientes
    // ------------------------------------------------------------
    const cliente = registro.register("Cliente", ClienteEsquema);
    const crearCliente = registro.register("CrearClienteRequest", CrearClienteEsquema);

    registro.registerPath({
        method: "post",
        path: "/clientes",
        tags: ["Clientes"],
        summary: "Registrar un cliente",
        request: {
            body: { content: { "application/json": { schema: crearCliente } } }
        },
        responses: {
            201: {
                description: "Cliente registrado.",
                content: { "application/json": { schema: cliente } }
            },
            ...respuestasError
        }
    });

    registro.registerPath({
        method: "get",
        path: "/clientes/{id}",
        tags: ["Clientes"],
        summary: "Consultar un cliente",
        request: { params: z.object({ id: z.string() }) },
        responses: {
            200: {
                description: "Cliente encontrado.",
                content: { "application/json": { schema: cliente } }
            },
            404: respuestasError[404]
        }
    });

    // ------------------------------------------------------------
    // Solicitudes
    // ------------------------------------------------------------
    const solicitud = registro.register("Solicitud", SolicitudEsquema);
    const crearSolicitud = registro.register("CrearSolicitudRequest", CrearSolicitudEsquema);
    const rechazarSolicitud = registro.register("RechazarSolicitudRequest", RechazarSolicitudEsquema);

    registro.registerPath({
        method: "post",
        path: "/solicitudes",
        tags: ["Solicitudes"],
        summary: "Registrar una solicitud de credito",
        description: "Valida los limites de monto (Q1,000-Q25,000) y "
            + "plazo (3-24 meses) de la seccion 2. Crea la solicitud en "
            + "estado 'solicitado'.",
        request: {
            body: { content: { "application/json": { schema: crearSolicitud } } }
        },
        responses: {
            201: {
                description: "Solicitud registrada en estado 'solicitado'.",
                content: { "application/json": { schema: solicitud } }
            },
            ...respuestasError
        }
    });

    registro.registerPath({
        method: "get",
        path: "/solicitudes/{id}",
        tags: ["Solicitudes"],
        summary: "Consultar una solicitud",
        request: { params: z.object({ id: z.string() }) },
        responses: {
            200: {
                description: "Solicitud encontrada.",
                content: { "application/json": { schema: solicitud } }
            },
            404: respuestasError[404]
        }
    });

    registro.registerPath({
        method: "post",
        path: "/solicitudes/{id}/aprobacion",
        tags: ["Solicitudes"],
        summary: "Aprobar una solicitud (evento 'Comite aprueba', tabla 6.7.1)",
        request: { params: z.object({ id: z.string() }) },
        responses: {
            200: {
                description: "Solicitud en estado 'aprobado'.",
                content: { "application/json": { schema: solicitud } }
            },
            409: respuestasError[409],
            404: respuestasError[404]
        }
    });

    registro.registerPath({
        method: "post",
        path: "/solicitudes/{id}/rechazo",
        tags: ["Solicitudes"],
        summary: "Rechazar una solicitud (evento 'Comite rechaza', tabla 6.7.1)",
        request: {
            params: z.object({ id: z.string() }),
            body: { content: { "application/json": { schema: rechazarSolicitud } } }
        },
        responses: {
            200: {
                description: "Solicitud en estado 'rechazado' (terminal).",
                content: { "application/json": { schema: solicitud } }
            },
            409: respuestasError[409],
            404: respuestasError[404]
        }
    });

    // ------------------------------------------------------------
    // Creditos
    // ------------------------------------------------------------
    const credito = registro.register("Credito", CreditoEsquema);
    const desembolsarCredito = registro.register("DesembolsarCreditoRequest", DesembolsarCreditoEsquema);
    const reestructurarCredito = registro.register("ReestructurarCreditoRequest", ReestructurarCreditoEsquema);
    const declararIncobrable = registro.register("DeclararIncobrableRequest", DeclararIncobrableEsquema);
    const planAmortizacion = registro.register("PlanAmortizacion", PlanAmortizacionEsquema);

    registro.registerPath({
        method: "post",
        path: "/creditos",
        tags: ["Creditos"],
        summary: "Desembolsar un credito a partir de una solicitud aprobada",
        description: "Evento 'Se desembolsa' (tabla 6.7.1): crea el "
            + "Credito, lo liga a la PoliticaCredito vigente en la fecha "
            + "de desembolso (seccion 6.3.1) y genera el plan de "
            + "amortizacion frances (seccion 6.4).",
        request: {
            body: { content: { "application/json": { schema: desembolsarCredito } } }
        },
        responses: {
            201: {
                description: "Credito desembolsado en estado 'vigente'.",
                content: { "application/json": { schema: credito } }
            },
            ...respuestasError
        }
    });

    registro.registerPath({
        method: "get",
        path: "/creditos/{id}",
        tags: ["Creditos"],
        summary: "Consultar un credito",
        description: "`tramoMora` y `diasAtraso` se calculan a la fecha "
            + "de corte indicada (clasificacion derivada, seccion 6.7.1); "
            + "si se omite, se usa la fecha de corte del ultimo cierre.",
        request: {
            params: z.object({ id: z.string() }),
            query: z.object({ fechaCorte: FechaISOEsquema.optional() })
        },
        responses: {
            200: {
                description: "Credito encontrado.",
                content: { "application/json": { schema: credito } }
            },
            404: respuestasError[404]
        }
    });

    registro.registerPath({
        method: "get",
        path: "/creditos/{id}/plan-amortizacion",
        tags: ["Creditos"],
        summary: "Consultar el plan de amortizacion de un credito",
        description: "Reproduce cuota por cuota la tabla de la seccion "
            + "6.4, incluido el ajuste de cuadre de la ultima cuota.",
        request: { params: z.object({ id: z.string() }) },
        responses: {
            200: {
                description: "Plan de amortizacion.",
                content: { "application/json": { schema: planAmortizacion } }
            },
            404: respuestasError[404]
        }
    });

    registro.registerPath({
        method: "post",
        path: "/creditos/{id}/reestructuraciones",
        tags: ["Creditos"],
        summary: "Reestructurar un credito (tabla 6.7.1: 'Acuerdo de nuevas condiciones')",
        description: "Solo valido con el credito en 'en_mora' (tabla "
            + "6.7.1). Deja la marca permanente `reestructuradoAlgunaVez` "
            + "en verdadero; esa marca nunca se borra (seccion 6.7).",
        request: {
            params: z.object({ id: z.string() }),
            body: { content: { "application/json": { schema: reestructurarCredito } } }
        },
        responses: {
            200: {
                description: "Credito en estado 'reestructurado' con nuevo plan.",
                content: { "application/json": { schema: credito } }
            },
            409: respuestasError[409],
            404: respuestasError[404]
        }
    });

    registro.registerPath({
        method: "post",
        path: "/creditos/{id}/incobrable",
        tags: ["Creditos"],
        summary: "Declarar incobrable un credito (baja contable, seccion 6.7)",
        description: "Solo valido si supera 120 dias de atraso sin "
            + "arreglo. Es una baja CONTABLE, no un perdon: el credito "
            + "sale de la cartera activa (seccion 6.8) y su cobro se "
            + "terceriza; no hay camino de vuelta a la cartera.",
        request: {
            params: z.object({ id: z.string() }),
            body: { content: { "application/json": { schema: declararIncobrable } } }
        },
        responses: {
            200: {
                description: "Credito en estado 'incobrable' (terminal).",
                content: { "application/json": { schema: credito } }
            },
            409: respuestasError[409],
            404: respuestasError[404]
        }
    });

    // ------------------------------------------------------------
    // Pagos
    // ------------------------------------------------------------
    const pago = registro.register("Pago", PagoEsquema);
    const registrarPago = registro.register("RegistrarPagoRequest", RegistrarPagoEsquema);

    registro.registerPath({
        method: "post",
        path: "/creditos/{id}/pagos",
        tags: ["Pagos"],
        summary: "Registrar un pago y aplicarlo segun la prelacion (seccion 6.6)",
        description: "Requiere el encabezado `Idempotency-Key`. Ver la "
            + "seccion 'Idempotencia' del documento E5: reintentar la "
            + "misma clave para el mismo credito devuelve 200 con el "
            + "pago ya existente, en vez de crear uno nuevo (invariante "
            + "6.10). Un pago nunca se rechaza por ser insuficiente "
            + "(seccion 6.6.4): siempre se registra y se aplica hasta "
            + "donde alcance.",
        request: {
            params: z.object({ id: z.string() }),
            headers: z.object({
                "Idempotency-Key": ClaveIdempotenciaEsquema
            }),
            body: { content: { "application/json": { schema: registrarPago } } }
        },
        responses: {
            201: {
                description: "Pago registrado y aplicado por primera vez.",
                content: { "application/json": { schema: pago } }
            },
            200: {
                description: "Reintento con una clave de idempotencia ya "
                    + "usada: se devuelve el pago original, sin volver a "
                    + "cobrarlo.",
                content: { "application/json": { schema: pago } }
            },
            ...respuestasError
        }
    });

    registro.registerPath({
        method: "get",
        path: "/pagos/{id}",
        tags: ["Pagos"],
        summary: "Consultar un pago y su desglose de aplicacion",
        request: { params: z.object({ id: z.string() }) },
        responses: {
            200: {
                description: "Pago encontrado, con el desglose completo "
                    + "por rubro (seccion 6.6.1).",
                content: { "application/json": { schema: pago } }
            },
            404: respuestasError[404]
        }
    });

    // ------------------------------------------------------------
    // Cierres
    // ------------------------------------------------------------
    const cierreDiario = registro.register("CierreDiario", CierreDiarioEsquema);
    const cierreMensual = registro.register("CierreMensual", CierreMensualEsquema);
    const generarCierreDiario = registro.register("GenerarCierreDiarioRequest", GenerarCierreDiarioEsquema);
    const generarCierreMensual = registro.register("GenerarCierreMensualRequest", GenerarCierreMensualEsquema);

    registro.registerPath({
        method: "post",
        path: "/cierres/diarios",
        tags: ["Cierres"],
        summary: "Generar el cierre diario (seccion 6.9)",
        description: "Idempotente: reejecutar el cierre de la misma "
            + "`fechaCorte` devuelve el mismo resultado y no duplica "
            + "movimientos en el mayor.",
        request: {
            body: { content: { "application/json": { schema: generarCierreDiario } } }
        },
        responses: {
            201: {
                description: "Cierre diario generado (o el ya existente "
                    + "para esa fecha de corte).",
                content: { "application/json": { schema: cierreDiario } }
            },
            ...respuestasError
        }
    });

    registro.registerPath({
        method: "post",
        path: "/cierres/mensuales",
        tags: ["Cierres"],
        summary: "Generar el cierre mensual (seccion 6.9)",
        description: "Consolida los cierres diarios del periodo y agrega "
            + "cartera en riesgo por tramo, provisiones y lo dado por "
            + "incobrable (seccion 6.8): ambas cifras siempre juntas.",
        request: {
            body: { content: { "application/json": { schema: generarCierreMensual } } }
        },
        responses: {
            201: {
                description: "Cierre mensual generado (o el ya existente "
                    + "para ese periodo).",
                content: { "application/json": { schema: cierreMensual } }
            },
            ...respuestasError
        }
    });

    registro.registerPath({
        method: "get",
        path: "/cierres/{id}",
        tags: ["Cierres"],
        summary: "Consultar un cierre (diario o mensual)",
        request: { params: z.object({ id: z.string() }) },
        responses: {
            200: {
                description: "Cierre encontrado.",
                content: {
                    "application/json": {
                        schema: z.union([cierreDiario, cierreMensual])
                    }
                }
            },
            404: respuestasError[404]
        }
    });

    // ------------------------------------------------------------
    // Cartera en riesgo
    // ------------------------------------------------------------
    const reporteCartera = registro.register("ReporteCartera", ReporteCarteraEsquema);
    const posicionCartera = registro.register("PosicionCartera", PosicionCarteraEsquema);

    registro.registerPath({
        method: "get",
        path: "/cartera/riesgo",
        tags: ["Cartera en riesgo"],
        summary: "Consultar la cartera en riesgo (seccion 6.8)",
        description: "El porcentaje SIEMPRE viene acompanado de "
            + "`dadoPorIncobrable` en el mismo objeto: el enunciado "
            + "prohibe reportarlo solo, porque el indicador puede "
            + "'mejorar' sin haber cobrado nada si se declaran "
            + "incobrables creditos malos.",
        request: {
            query: z.object({ fechaCorte: FechaISOEsquema })
        },
        responses: {
            200: {
                description: "Reporte de cartera en riesgo a la fecha de corte.",
                content: { "application/json": { schema: reporteCartera } }
            },
            ...respuestasError
        }
    });

    registro.registerPath({
        method: "get",
        path: "/cartera/posiciones",
        tags: ["Cartera en riesgo"],
        summary: "Listar las posiciones de cartera a una fecha de corte",
        description: "Detalle credito por credito detras del agregado de "
            + "/cartera/riesgo; equivalente a la tabla del ejemplo "
            + "resuelto de la seccion 6.8.1.",
        request: {
            query: z.object({ fechaCorte: FechaISOEsquema })
        },
        responses: {
            200: {
                description: "Posiciones de cartera a la fecha de corte.",
                content: {
                    "application/json": {
                        schema: z.array(posicionCartera)
                    }
                }
            },
            ...respuestasError
        }
    });

    return registro;
}
