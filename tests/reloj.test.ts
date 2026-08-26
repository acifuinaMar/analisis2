import { describe, expect, it } from "vitest";

import { RelojFijo } from "../src/adaptadores/reloj-fijo";
import { RelojSistema } from "../src/adaptadores/reloj-sistema";
import { Reloj } from "../src/dominio/reloj";

describe("Puerto Reloj (aceptacion E4)", () => {

    it("RelojFijo devuelve siempre la misma fecha de corte", () => {

        const reloj = new RelojFijo(new Date(2026, 0, 15));

        expect(reloj.hoy().toISOString()).toBe(reloj.hoy().toISOString());
        expect(reloj.hoy().getDate()).toBe(15);
    });

    it("Mutar la fecha recibida no contamina el reloj", () => {

        const reloj = new RelojFijo(new Date(2026, 0, 15));

        const fecha = reloj.hoy();
        fecha.setFullYear(1999);

        expect(reloj.hoy().getFullYear()).toBe(2026);
    });

    it("Ambos adaptadores son intercambiables (LSP)", () => {

        const relojes: Reloj[] = [
            new RelojFijo(new Date(2026, 0, 15)),
            new RelojSistema()
        ];

        for (const reloj of relojes) {
            expect(reloj.hoy()).toBeInstanceOf(Date);
        }
    });
});
