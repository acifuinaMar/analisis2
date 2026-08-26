import { Reloj } from "../dominio/reloj";

/**
 * ADAPTADOR de produccion: el unico punto de todo el sistema autorizado
 * a leer el reloj de la maquina.
 */
export class RelojSistema implements Reloj {

    public hoy(): Date {
        return new Date();
    }
}
