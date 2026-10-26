/**
 * PUERTO del modelo de lenguaje (E5).
 *
 * El orquestador del chat depende de esta interfaz y no de Gemini. Es la
 * misma leccion que el puerto del repositorio: se inyecta la capacidad,
 * no el proveedor.
 *
 * Aqui importa por dos razones concretas:
 *
 *  1. Las pruebas corren sin red ni clave de API. Toda la logica de
 *     orquestacion —elegir herramienta, encadenar resultados, detener la
 *     accion sensible— se ejercita con un modelo guionizado, de forma
 *     determinista. Sin esto, probar el chat exigiria llamar a un modelo
 *     real, que ni es gratis ni devuelve lo mismo dos veces.
 *  2. Cambiar de proveedor no toca el chat.
 *
 * El puerto NO expone el formato de Gemini: usa un vocabulario propio y
 * cada adaptador traduce. Si asomara el formato del proveedor, el
 * orquestador quedaria amarrado a el por la puerta de atras.
 */

/** Una herramienta, tal como se le describe al modelo. */
export interface DeclaracionHerramienta {

    readonly nombre: string;

    readonly descripcion: string;

    /** Esquema JSON de los parametros, tal como lo publica el servidor. */
    readonly esquema: Record<string, unknown>;

}

/** El modelo pide ejecutar una herramienta con estos argumentos. */
export interface LlamadaHerramienta {

    readonly nombre: string;

    readonly argumentos: Record<string, unknown>;

}

/**
 * Un turno de la conversacion.
 *
 * Se guardan tambien los turnos de herramienta, no solo el texto: son lo
 * que permite al modelo encadenar preguntas («y de ese credito, cuanto
 * debe la cuota 3?») sin volver a consultar lo que ya sabe.
 */
export type Mensaje =
    | { readonly papel: "usuario"; readonly texto: string }
    | { readonly papel: "asistente"; readonly texto: string }
    | {
        readonly papel: "asistente_llama";
        readonly llamadas: ReadonlyArray<LlamadaHerramienta>;
    }
    | {
        readonly papel: "resultado";
        readonly nombre: string;
        /** El JSON que devolvio la herramienta, en texto. */
        readonly contenido: string;
    };

/** Lo que el modelo responde: o habla, o pide herramientas. */
export type TurnoModelo =
    | { readonly tipo: "texto"; readonly texto: string }
    | {
        readonly tipo: "llamadas";
        readonly llamadas: ReadonlyArray<LlamadaHerramienta>;
    };

export interface ModeloLenguaje {

    /** Identificacion para la bitacora y el informe. */
    readonly nombre: string;

    responder(
        instruccionesSistema: string,
        historial: ReadonlyArray<Mensaje>,
        herramientas: ReadonlyArray<DeclaracionHerramienta>
    ): Promise<TurnoModelo>;

}

/**
 * PUERTO de la consulta documental (el RAG visto desde el chat).
 *
 * El orquestador no sabe que detras hay pgvector ni embeddings: pide una
 * respuesta con sus fuentes. Asi el chat se puede probar sin base de
 * datos vectorial, y el modulo del E4 se puede evolucionar sin tocar el
 * chat.
 */
export interface ConsultaDocumental {

    consultar(pregunta: string): Promise<{
        readonly respuesta: string;
        readonly fuentes: ReadonlyArray<string>;
    }>;

}
