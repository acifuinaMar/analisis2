import type { Interface } from "node:readline";
import { stdout } from "node:process";

/**
 * Lector de lineas con COLA.
 *
 * `readline/promises` solo entrega una linea si hay una pregunta
 * esperando; lo que se escribe (o se pega) mientras el modelo piensa se
 * pierde. Aqui cada linea entra a una cola y se consume en orden. Devuelve
 * undefined cuando la entrada se cerro (Ctrl+C, Ctrl+D / Ctrl+Z, fin del
 * archivo): es la senal de salir, no un error.
 */
export function crearLector(consola: Interface, salida: NodeJS.WritableStream = stdout) {

    const cola: string[] = [];
    let esperando: ((linea: string | undefined) => void) | undefined;
    let cerrada = false;

    consola.on("line", (linea) => {
        if (esperando) {
            const entregar = esperando;
            esperando = undefined;
            entregar(linea);
        } else {
            cola.push(linea);
        }
    });

    consola.on("close", () => {
        cerrada = true;
        if (esperando) {
            const entregar = esperando;
            esperando = undefined;
            entregar(undefined);
        }
    });

    return (indicacion: string): Promise<string | undefined> => {
        const siguiente = cola.shift();
        if (siguiente !== undefined) {
            salida.write(indicacion);
            return Promise.resolve(siguiente.trim());
        }
        if (cerrada) {
            return Promise.resolve(undefined);
        }
        consola.setPrompt(indicacion);
        consola.prompt();
        return new Promise((resolver) => {
            esperando = (linea) => resolver(linea?.trim());
        });
    };
}
