import type {
    DeclaracionHerramienta,
    Mensaje,
    ModeloLenguaje,
    TurnoModelo
} from "../../src/asistente/modelo-lenguaje";

/**
 * Modelo de lenguaje GUIONIZADO, para las pruebas del chat.
 *
 * Devuelve los turnos que se le pasan, en orden. Es la contraparte, para
 * el modelo, de lo que PGlite es para la base: permite ejercitar toda la
 * orquestacion —elegir herramienta, encadenar resultados, detener la
 * accion sensible— de forma determinista, sin red ni clave de API.
 *
 * Lo que se prueba con esto NO es si el modelo elige bien la herramienta:
 * eso depende del proveedor y se mide con las evaluaciones. Lo que se
 * prueba es que el orquestador haga lo correcto con lo que el modelo
 * pida, incluido cuando pide algo que no debe.
 *
 * Guarda lo que se le pregunto, para que las pruebas puedan comprobar que
 * se le ofrecio el catalogo completo y que el historial crecio.
 */
export class ModeloGuionizado implements ModeloLenguaje {

    public readonly nombre = "guionizado";

    /** Una entrada por llamada: instrucciones, historial y catalogo. */
    public readonly llamadas: Array<{
        instrucciones: string;
        historial: ReadonlyArray<Mensaje>;
        herramientas: ReadonlyArray<DeclaracionHerramienta>;
    }> = [];

    private siguiente = 0;

    constructor(private readonly guion: ReadonlyArray<TurnoModelo>) {}

    public async responder(
        instruccionesSistema: string,
        historial: ReadonlyArray<Mensaje>,
        herramientas: ReadonlyArray<DeclaracionHerramienta>
    ): Promise<TurnoModelo> {

        this.llamadas.push({
            instrucciones: instruccionesSistema,
            // Copia: el orquestador sigue mutando el suyo.
            historial: [...historial],
            herramientas
        });

        const turno = this.guion[this.siguiente];

        if (!turno) {
            throw new Error(
                `El guion se agoto: se pidio el turno `
                + `${this.siguiente + 1} y solo hay ${this.guion.length}.`
            );
        }

        this.siguiente++;

        return turno;
    }

    /** Turnos del guion que quedaron sin usar. */
    public turnosSinUsar(): number {
        return this.guion.length - this.siguiente;
    }
}

/** Atajos para armar guiones legibles. */
export const dice = (texto: string): TurnoModelo => ({
    tipo: "texto",
    texto
});

export const llama = (
    nombre: string,
    argumentos: Record<string, unknown> = {}
): TurnoModelo => ({
    tipo: "llamadas",
    llamadas: [{ nombre, argumentos }]
});
