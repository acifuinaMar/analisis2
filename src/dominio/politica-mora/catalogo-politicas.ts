import { TramoMora } from "../tramo-mora";
import { BaseConteoMora, PoliticaMora } from "./politica-mora";
import { PoliticaMoraPlana } from "./politica-mora-plana";
import {
    PoliticaMoraEscalonada,
    TramoTasa
} from "./politica-mora-escalonada";

/**
 * Tabla de la politica escalonada (CP-01, seccion 7.2).
 *
 * Estas cinco cifras son POLITICA INSTITUCIONAL, no constantes de calculo.
 * Viven aqui, en el catalogo, y no dentro del motor: cambiar el 30 % de
 * Mora 3 se hace editando esta tabla, sin abrir calculadora-mora.ts.
 *
 * Mas de 120 dias no aparece porque el credito pasa a incobrable: sale de
 * la cartera y deja de generar moratorio (P1, 6.7). Al no haber tramo, la
 * formula deja de acumular sola.
 */
export const TRAMOS_CP01: ReadonlyArray<TramoTasa> = [
    { tramo: TramoMora.MORA_1,  desde: 1,  hasta: 30,  tnaMoratoria: 0.18 },
    { tramo: TramoMora.MORA_2,  desde: 31, hasta: 60,  tnaMoratoria: 0.24 },
    { tramo: TramoMora.MORA_3,  desde: 61, hasta: 90,  tnaMoratoria: 0.30 },
    { tramo: TramoMora.VENCIDO, desde: 91, hasta: 120, tnaMoratoria: 0.36 }
];

/** Politica vigente para los creditos otorgados antes del 1/10/2026. */
export const POLITICA_PLANA_2024 = new PoliticaMoraPlana(
    "POL-2024-01",
    0.24,
    BaseConteoMora.ACTUAL_360
);

/** Politica vigente para los creditos otorgados desde el 1/10/2026. */
export const POLITICA_ESCALONADA_2026 = new PoliticaMoraEscalonada(
    "POL-2026-10",
    TRAMOS_CP01,
    BaseConteoMora.ACTUAL_360
);

/** Fecha en que entra en vigor la politica escalonada (Acta 09-2026). */
export const VIGENCIA_ESCALONADA = new Date(2026, 9, 1);

/** Una politica y la fecha desde la cual rige. */
export interface EntradaCatalogo {

    readonly vigenteDesde: Date;

    readonly politica: PoliticaMora;

}

/**
 * Resuelve QUE politica moratoria le corresponde a un credito segun su
 * fecha de otorgamiento (CP-03, seccion 7.6).
 *
 * El comite fue explicito: la politica escalonada rige "sin alterar los
 * creditos ya otorgados, que conservan la politica vigente a su fecha de
 * otorgamiento". Por eso la resolucion depende de la fecha del credito y
 * NO de la fecha de corte: un credito de agosto sigue en la plana aunque
 * se le calcule mora en diciembre.
 *
 * Ambas politicas conviven en el mismo sistema y en el mismo cierre.
 */
export class CatalogoPoliticasMora {

    private readonly entradas: ReadonlyArray<EntradaCatalogo>;

    constructor(entradas: ReadonlyArray<EntradaCatalogo>) {

        if (entradas.length === 0) {
            throw new Error("El catalogo debe tener al menos una politica.");
        }

        // De la mas reciente a la mas antigua: la primera que aplique gana.
        this.entradas = [...entradas].sort(
            (a, b) => b.vigenteDesde.getTime() - a.vigenteDesde.getTime()
        );
    }

    /** El catalogo real de Credito Vecino, S. A. */
    public static vigente(): CatalogoPoliticasMora {
        return new CatalogoPoliticasMora([
            {
                vigenteDesde: new Date(2024, 0, 1),
                politica: POLITICA_PLANA_2024
            },
            {
                vigenteDesde: VIGENCIA_ESCALONADA,
                politica: POLITICA_ESCALONADA_2026
            }
        ]);
    }

    public resolver(fechaOtorgamiento: Date): PoliticaMora {

        const entrada = this.entradas.find(
            e => fechaOtorgamiento.getTime() >= e.vigenteDesde.getTime()
        );

        if (!entrada) {
            throw new Error(
                "No hay politica moratoria vigente para la fecha de "
                + `otorgamiento ${fechaOtorgamiento.toISOString().slice(0, 10)}.`
            );
        }

        return entrada.politica;
    }
}
