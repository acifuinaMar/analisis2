/**
 * Perfiles de uso del sistema.
 *
 * Vive aqui, y no dentro de un adaptador, porque el perfil lo necesitan
 * DOS entradas distintas: la API REST del E1 y el chat gerencial del E5.
 * Si cada una definiera su propia lista, un dia divergirian y el chat
 * permitiria algo que la API prohibe —o al contrario—, que es
 * exactamente el agujero que este modulo existe para cerrar.
 *
 *   asesor    origina creditos y registra pagos; no ve tablero ni cierres
 *   gerencia  consulta todo; no mueve dinero ni origina
 *
 * ALCANCE, y conviene ser explicito: esto NO es autenticacion. El
 * enunciado la deja expresamente fuera en su seccion 3.1 —«basta con
 * distinguir el perfil asesor del perfil gerencia»— asi que el perfil se
 * declara y no se demuestra: en la API viaja en un encabezado que
 * cualquiera podria falsificar. Lo que si se exige, y si se cumple, es
 * que la decision se tome en el SERVIDOR: ocultar un boton en la
 * interfaz no es un control de acceso.
 *
 * No pertenece al nucleo. El nucleo no sabe quien lo invoca, y el
 * enunciado le prohibe saberlo.
 */

export const PERFILES = ["asesor", "gerencia"] as const;

export type Perfil = typeof PERFILES[number];

/**
 * El perfil que puede mover dinero. Uno solo, y nombrado una vez: las
 * dos entradas preguntan contra esta constante en vez de repetir la
 * cadena "asesor" cada una por su lado.
 */
export const PERFIL_QUE_REGISTRA_PAGOS: Perfil = "asesor";

export function puedeRegistrarPagos(perfil: Perfil): boolean {
    return perfil === PERFIL_QUE_REGISTRA_PAGOS;
}
