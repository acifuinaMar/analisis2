import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

import { RepositorioCarteraCsv } from "../src/adaptadores/repositorio-cartera-csv";
import type { RepositorioCartera } from "../src/dominio/repositorio-cartera";
import { ConsultasCartera } from "../src/servicios/consultas-cartera";

/**
 * Guarda de rendimiento: los listados no deben ir a la base una vez por
 * credito.
 *
 * Con la base remota cada llamada al repositorio es un viaje de red. Antes
 * de este cambio, cargar el tablero hacia ~76 llamadas (una por credito) y
 * los vencimientos ~141: con 60 ms de red simulada, 4.6 s y 8.5 s. Ahora
 * son 2-3 llamadas, sin importar cuantos creditos haya. Esta prueba falla
 * si alguien vuelve a pedir pagos o clientes dentro de un bucle.
 */

const DATOS = resolve(process.env.CV_DATA_DIR ?? "./datos");
const CORTE = new Date(2026, 9, 31);

function contando(repo: RepositorioCartera): { repo: RepositorioCartera; llamadas: () => number } {
    let n = 0;
    const proxy = new Proxy(repo, {
        get(objetivo, propiedad, receptor) {
            const valor = Reflect.get(objetivo, propiedad, receptor);
            return typeof valor === "function"
                ? (...args: unknown[]) => { n++; return valor.apply(objetivo, args); }
                : valor;
        }
    });
    return { repo: proxy, llamadas: () => n };
}

describe("Consultas de cartera: numero de viajes a la base", () => {

    const casos: Array<[string, (c: ConsultasCartera) => Promise<unknown>]> = [
        ["tablero G-1", c => c.consultarCartera(CORTE)],
        ["morosos G-4", c => c.listarCreditosEnMora(CORTE)],
        ["vencimientos G-6", c => c.proximosVencimientos(CORTE, 30)],
        ["cierre diario G-3", c => c.consultarCierreDiario(CORTE)],
        ["cierre mensual G-2", c => c.consultarCierreMensual("2026-10")]
    ];

    for (const [nombre, consulta] of casos) {
        it(`${nombre} usa 5 llamadas o menos (hay 75 creditos)`, async () => {
            const base = new RepositorioCarteraCsv(DATOS);
            await base.cargar();
            const { repo, llamadas } = contando(base);

            await consulta(new ConsultasCartera(repo));

            expect(llamadas()).toBeLessThanOrEqual(5);
        });
    }

    it("listarClientes devuelve los 60 clientes en una llamada", async () => {
        const clientes = await new RepositorioCarteraCsv(DATOS).listarClientes();
        expect(clientes).toHaveLength(60);
    });
});
