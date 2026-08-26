import { Reloj } from "../dominio/reloj";

/**
 * ADAPTADOR de pruebas: devuelve siempre la misma fecha de corte.
 *
 * Es lo que hace que una prueba de mora de el mismo resultado hoy, maniana
 * y el dia de la revision.
 */
export class RelojFijo implements Reloj {

    constructor(private readonly fecha: Date) {}

    public hoy(): Date {
        // Se devuelve una copia: si el llamador mutara la fecha recibida,
        // contaminaria al reloj y las pruebas dejarian de ser reproducibles.
        return new Date(this.fecha);
    }
}
