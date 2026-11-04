/**
 * Acceso a sessionStorage a prueba de fallos.
 *
 * Solo guarda comodidades de la sesión del navegador (perfil elegido,
 * fecha de corte, panel abierto). Puede no estar disponible —ventana
 * privada, almacenamiento bloqueado— y la interfaz debe funcionar igual.
 */
export function leer(clave: string): string | null {
    try {
        return window.sessionStorage.getItem(clave);
    } catch {
        return null;
    }
}

export function escribir(clave: string, valor: string | null): void {
    try {
        if (valor === null) {
            window.sessionStorage.removeItem(clave);
        } else {
            window.sessionStorage.setItem(clave, valor);
        }
    } catch {
        // Sin almacenamiento: el valor vive solo en memoria.
    }
}
