import {
    PERFIL_QUE_REGISTRA_PAGOS,
    puedeRegistrarPagos,
    type Perfil
} from "../acceso/perfil";
import { INSTRUCCIONES_ASISTENTE } from "./instrucciones-asistente";
import type { InvocadorHerramientas } from "./herramientas-mcp";
import type {
    ConsultaDocumental,
    DeclaracionHerramienta,
    LlamadaHerramienta,
    Mensaje,
    ModeloLenguaje
} from "./modelo-lenguaje";

/**
 * Orquestador del chat gerencial (E5).
 *
 * Decide, para cada pregunta, si hace falta el modulo documental, las
 * herramientas de calculo, las dos o ninguna; mantiene la memoria de la
 * sesion para que las preguntas encadenadas tengan contexto; y detiene la
 * unica accion sensible hasta que una persona la apruebe.
 *
 * Reparto de responsabilidades, que es el corazon del diseno: el modelo
 * decide QUE herramienta invocar y como redactar la respuesta; el nucleo
 * pone las cifras. El orquestador es el que hace cumplir esa frontera.
 *
 * No depende de la interfaz. La pantalla del E1 y el guion de pruebas
 * consumen el mismo objeto, asi que la logica del chat se prueba sin
 * navegador y sin llamar a un modelo real.
 *
 * DOS CONTROLES DISTINTOS protegen el pago, y conviene no confundirlos
 * porque responden preguntas diferentes:
 *
 *   aprobacion humana  responde "dijo una persona que si a ESTE monto?"
 *                      y la concede aprobarPago(), nunca el modelo.
 *
 *   perfil             responde "tiene esta persona permiso de mover
 *                      dinero?" y lo decide el perfil de la sesion.
 *
 * Hacen falta los dos. Un gerente que aprueba pasa el primero y falla el
 * segundo: si el chat solo exigiera la aprobacion, seria la puerta de
 * atras del modelo de permisos de la API --lo que el perfil no puede
 * hacer por REST lo haria pidiendoselo al asistente--. El perfil se
 * comparte con la API desde src/acceso/perfil.ts para que no haya dos
 * reglas que puedan divergir.
 */

/** Nombre de la herramienta sensible. Vive aqui porque hay que vigilarla. */
const HERRAMIENTA_PAGO = "registrar_pago";

/** Nombre con el que se le ofrece el modulo documental al modelo. */
const HERRAMIENTA_DOCUMENTAL = "consultar_politicas";

/**
 * Tope de rondas de herramientas por pregunta.
 *
 * Una pregunta encadenada legitima necesita tres o cuatro —consultar el
 * credito, su cuota, la politica—. Mas alla de seis, lo normal es que el
 * modelo este dando vueltas, y conviene cortar con un aviso antes que
 * gastar llamadas.
 */
const MAX_RONDAS = 6;

/**
 * El perfil que conversa no tiene permiso para la accion.
 *
 * Es una excepcion y no una respuesta del chat a proposito: equivale al
 * 403 de la API. Una negativa que redactara el modelo se podria matizar
 * -- "podria aplicarlo si..." --; una excepcion no se matiza.
 */
export class ErrorPerfilSinPermiso extends Error {

    public readonly codigo = "PERFIL_SIN_PERMISO";

    constructor(public readonly perfil: Perfil, mensaje: string) {
        super(mensaje);
        this.name = "ErrorPerfilSinPermiso";
    }
}

/**
 * Lo que se le dice al modelo sobre con quien habla.
 *
 * No es el control --el control es la verificacion en aprobarPago()--
 * sino cortesia: sin esto el asistente le ofreceria a la gerencia aplicar
 * un pago que luego le va a ser negado, y prometer algo que no se puede
 * cumplir es peor que no ofrecerlo.
 */
function notaDelPerfil(perfil: Perfil): string {

    if (puedeRegistrarPagos(perfil)) {
        return `

SOBRE QUIEN TE HABLA:

22. Hablas con el perfil ASESOR, que si puede registrar pagos. Cuando te
    pida uno, proponlo y espera su aprobacion segun las reglas 17 a 20.
`;
    }

    return `

SOBRE QUIEN TE HABLA:

22. Hablas con el perfil GERENCIA, que consulta la cartera pero NO
    registra pagos. Si te piden registrar uno, muestra el desglose de la
    prelacion para que lo revisen y aclara que la aplicacion la hace un
    asesor. No digas que quedo aplicado ni pidas que lo aprueben.
`;
}

export interface PropuestaPago {

    readonly idCredito: string;

    readonly monto: number;

    readonly claveIdempotencia: string;

    readonly fechaOperacion: string;

    readonly canal: string;

    /** La vista previa que devolvio la herramienta, tal cual. */
    readonly vistaPrevia: Record<string, unknown>;

}

export type RespuestaChat =
    | {
        readonly tipo: "respuesta";
        readonly texto: string;
        readonly herramientasUsadas: ReadonlyArray<string>;
    }
    | {
        /**
         * El asistente propone un pago y se detiene. La interfaz debe
         * mostrar el desglose y pedir aprobacion explicita.
         */
        readonly tipo: "aprobacion_requerida";
        readonly propuesta: PropuestaPago;
        readonly herramientasUsadas: ReadonlyArray<string>;
    };

export class Orquestador {

    private readonly mensajes: Mensaje[] = [];

    private catalogo: ReadonlyArray<DeclaracionHerramienta> | undefined;

    private pendiente: PropuestaPago | undefined;

    /** Las instrucciones del asistente mas la nota del perfil. */
    private readonly sistema: string;

    /**
     * El perfil es OBLIGATORIO y va antes de los parametros opcionales a
     * proposito: sin valor por omision no hay forma de abrir el chat sin
     * decidir quien habla, y por lo tanto no hay forma de exponer la
     * escritura por descuido.
     */
    constructor(
        private readonly modelo: ModeloLenguaje,
        private readonly herramientas: InvocadorHerramientas,
        private readonly perfil: Perfil,
        private readonly documental?: ConsultaDocumental,
        instrucciones: string = INSTRUCCIONES_ASISTENTE
    ) {
        this.sistema = instrucciones.trimEnd() + notaDelPerfil(perfil);
    }

    /** El perfil de la sesion, para que la interfaz sepa que pintar. */
    public perfilDeLaSesion(): Perfil {
        return this.perfil;
    }

    /** Si este perfil puede llegar a aplicar el pago que se proponga. */
    public puedeAprobar(): boolean {
        return puedeRegistrarPagos(this.perfil);
    }

    // ------------------------------------------------------------------
    // Conversacion
    // ------------------------------------------------------------------

    public async preguntar(texto: string): Promise<RespuestaChat> {

        if (!texto.trim()) {
            throw new Error("La pregunta no puede estar vacia.");
        }

        this.mensajes.push({ papel: "usuario", texto });

        return this.avanzar();
    }

    /**
     * Aprueba el pago propuesto y lo aplica.
     *
     * La confirmacion la pone el ORQUESTADOR, nunca el modelo: por eso
     * `confirmado` se fija aqui y no se toma de los argumentos que el
     * modelo propuso. Un modelo comprometido no tiene por donde activarla.
     *
     * Y la pone solo si el perfil puede. Son los dos controles del
     * encabezado, y este metodo es el unico punto donde se cruzan.
     */
    public async aprobarPago(): Promise<RespuestaChat> {

        // El perfil se verifica ANTES de mirar si hay algo pendiente: un
        // control de acceso no debe depender del estado que protege, ni
        // revelar en su mensaje de error si habia un pago en curso.
        if (!puedeRegistrarPagos(this.perfil)) {
            throw new ErrorPerfilSinPermiso(
                this.perfil,
                `El perfil '${this.perfil}' no puede registrar pagos. La `
                + `vista previa con el desglose queda disponible, pero `
                + `aplicar el pago le corresponde al perfil `
                + `'${PERFIL_QUE_REGISTRA_PAGOS}'.`
            );
        }

        const propuesta = this.pendiente;

        if (!propuesta) {
            throw new Error("No hay ningun pago pendiente de aprobacion.");
        }

        this.pendiente = undefined;

        const resultado = await this.herramientas.invocar(HERRAMIENTA_PAGO, {
            idCredito: propuesta.idCredito,
            monto: propuesta.monto,
            claveIdempotencia: propuesta.claveIdempotencia,
            fechaOperacion: propuesta.fechaOperacion,
            canal: propuesta.canal,
            confirmado: true
        });

        this.mensajes.push({
            papel: "resultado",
            nombre: HERRAMIENTA_PAGO,
            contenido: resultado
        });

        return this.avanzar([HERRAMIENTA_PAGO]);
    }

    /** Rechaza el pago propuesto. No se aplica nada. */
    public async rechazarPago(motivo?: string): Promise<RespuestaChat> {

        if (!this.pendiente) {
            throw new Error("No hay ningun pago pendiente de aprobacion.");
        }

        this.pendiente = undefined;

        this.mensajes.push({
            papel: "resultado",
            nombre: HERRAMIENTA_PAGO,
            contenido: JSON.stringify({
                aplicado: false,
                aprobado: false,
                mensaje: motivo?.trim()
                    ? `La persona no aprobo el pago: ${motivo.trim()}`
                    : "La persona no aprobo el pago. No se aplico nada."
            })
        });

        return this.avanzar([]);
    }

    /** La memoria de la sesion, para que la interfaz pueda pintarla. */
    public historial(): ReadonlyArray<Mensaje> {
        return [...this.mensajes];
    }

    public pagoPendiente(): PropuestaPago | undefined {
        return this.pendiente;
    }

    /** Empieza una conversacion nueva sin rearmar el orquestador. */
    public reiniciar(): void {
        this.mensajes.length = 0;
        this.pendiente = undefined;
    }

    // ------------------------------------------------------------------
    // El ciclo
    // ------------------------------------------------------------------

    private async avanzar(
        usadas: string[] = []
    ): Promise<RespuestaChat> {

        const catalogo = await this.obtenerCatalogo();

        for (let ronda = 0; ronda < MAX_RONDAS; ronda++) {

            const turno = await this.modelo.responder(
                this.sistema,
                this.mensajes,
                catalogo
            );

            if (turno.tipo === "texto") {
                this.mensajes.push({
                    papel: "asistente",
                    texto: turno.texto
                });
                return {
                    tipo: "respuesta",
                    texto: turno.texto,
                    herramientasUsadas: usadas
                };
            }

            this.mensajes.push({
                papel: "asistente_llama",
                llamadas: turno.llamadas
            });

            for (const llamada of turno.llamadas) {

                usadas.push(llamada.nombre);

                if (llamada.nombre === HERRAMIENTA_PAGO) {

                    const detencion = await this.prepararPago(llamada);

                    if (detencion) {
                        return {
                            tipo: "aprobacion_requerida",
                            propuesta: detencion,
                            herramientasUsadas: usadas
                        };
                    }

                    continue;
                }

                this.mensajes.push({
                    papel: "resultado",
                    nombre: llamada.nombre,
                    contenido: await this.ejecutar(llamada)
                });
            }
        }

        const aviso =
            "No pude cerrar la respuesta: consulte demasiadas veces sin "
            + "llegar a un resultado. Intente con una pregunta mas "
            + "concreta, indicando el credito y la fecha de corte.";

        this.mensajes.push({ papel: "asistente", texto: aviso });

        return {
            tipo: "respuesta",
            texto: aviso,
            herramientasUsadas: usadas
        };
    }

    /**
     * Ejecuta la herramienta sensible en modo VISTA PREVIA y decide si
     * hay que detenerse a pedir aprobacion.
     *
     * Devuelve la propuesta cuando hay que detenerse, o undefined cuando
     * el resultado se le devuelve al modelo para que lo explique: un
     * rechazo por monto no exacto o una clave repetida no necesitan la
     * aprobacion de nadie, porque no hay nada que aprobar.
     *
     * Esto corre para CUALQUIER perfil, y no es un descuido: la vista
     * previa no escribe nada, y ver el desglose de la prelacion antes de
     * que el pago ocurra es justo lo que la gerencia necesita poder
     * revisar. Lo que el perfil decide es quien puede aplicarlo despues.
     */
    private async prepararPago(
        llamada: LlamadaHerramienta
    ): Promise<PropuestaPago | undefined> {

        const a = llamada.argumentos;

        // `confirmado` se ignora venga como venga. La aprobacion no es
        // algo que el modelo pueda conceder.
        const argumentos = {
            idCredito: String(a.idCredito ?? ""),
            monto: Number(a.monto ?? 0),
            claveIdempotencia: String(a.claveIdempotencia ?? ""),
            fechaOperacion: String(a.fechaOperacion ?? ""),
            canal: typeof a.canal === "string" ? a.canal : "agencia",
            confirmado: false
        };

        const contenido = await this.herramientas.invocar(
            HERRAMIENTA_PAGO,
            argumentos
        );

        this.mensajes.push({
            papel: "resultado",
            nombre: HERRAMIENTA_PAGO,
            contenido
        });

        let vistaPrevia: Record<string, unknown>;

        try {
            vistaPrevia = JSON.parse(contenido) as Record<string, unknown>;
        } catch {
            return undefined;
        }

        const esVistaPrevia = vistaPrevia.error !== true
            && vistaPrevia.aplicado === false
            && vistaPrevia.duplicado === false;

        if (!esVistaPrevia) {
            return undefined;
        }

        this.pendiente = {
            idCredito: argumentos.idCredito,
            monto: argumentos.monto,
            claveIdempotencia: argumentos.claveIdempotencia,
            fechaOperacion: argumentos.fechaOperacion,
            canal: argumentos.canal,
            vistaPrevia
        };

        return this.pendiente;
    }

    private async ejecutar(llamada: LlamadaHerramienta): Promise<string> {

        if (llamada.nombre === HERRAMIENTA_DOCUMENTAL) {

            if (!this.documental) {
                return JSON.stringify({
                    error: true,
                    codigo: "SIN_MODULO_DOCUMENTAL",
                    mensaje:
                        "La consulta documental no esta disponible en esta "
                        + "sesion."
                });
            }

            const pregunta = String(llamada.argumentos.pregunta ?? "");

            if (!pregunta.trim()) {
                return JSON.stringify({
                    error: true,
                    codigo: "PREGUNTA_VACIA",
                    mensaje: "Indique que desea consultar en las politicas."
                });
            }

            try {
                const r = await this.documental.consultar(pregunta);
                return JSON.stringify(r);
            } catch (error) {
                return JSON.stringify({
                    error: true,
                    codigo: "ERROR_DOCUMENTAL",
                    mensaje: error instanceof Error
                        ? error.message
                        : String(error)
                });
            }
        }

        try {
            return await this.herramientas.invocar(
                llamada.nombre,
                llamada.argumentos
            );
        } catch (error) {
            return JSON.stringify({
                error: true,
                codigo: "ERROR_HERRAMIENTA",
                mensaje: error instanceof Error
                    ? error.message
                    : String(error)
            });
        }
    }

    /**
     * El catalogo se pide una vez por sesion: son las nueve herramientas
     * del servidor MCP mas la consulta documental, que no es una
     * herramienta MCP sino el modulo del E4.
     */
    private async obtenerCatalogo(): Promise<
        ReadonlyArray<DeclaracionHerramienta>
    > {

        if (this.catalogo) {
            return this.catalogo;
        }

        const delServidor = await this.herramientas.listar();

        const documental: DeclaracionHerramienta = {
            nombre: HERRAMIENTA_DOCUMENTAL,
            descripcion:
                "Consulta las politicas institucionales en el corpus "
                + "documental y devuelve una respuesta con las fuentes "
                + "citadas. Uselo para preguntas sobre REGLAS —como se "
                + "calcula la mora, que dice una politica, desde cuando "
                + "rige— y no para obtener cifras de un credito concreto.",
            esquema: {
                type: "object",
                properties: {
                    pregunta: {
                        type: "string",
                        description:
                            "La pregunta sobre politicas, en lenguaje "
                            + "natural."
                    }
                },
                required: ["pregunta"]
            }
        };

        this.catalogo = this.documental
            ? [...delServidor, documental]
            : [...delServidor];

        return this.catalogo;
    }
}
