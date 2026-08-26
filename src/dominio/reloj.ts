/**
 * PUERTO Reloj.
 *
 * El nucleo de dominio no debe leer la fecha del sistema (criterio de
 * aceptacion del E4): "una prueba que falla maniana no es una prueba".
 *
 * La fecha entra siempre desde afuera, a traves de este puerto. El dominio
 * define la interfaz; la infraestructura provee la implementacion. Eso es
 * Inversion de Dependencias (DIP) en su forma mas directa.
 */
export interface Reloj {

    /** Fecha de corte con la que debe trabajar el calculo. */
    hoy(): Date;

}
