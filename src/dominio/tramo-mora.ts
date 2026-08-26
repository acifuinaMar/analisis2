/**
 * Tramos de mora (seccion 6.5).
 *
 * OJO: los tramos NO son estados del credito. El estado es uno solo,
 * EN_MORA; el tramo es una clasificacion DERIVADA de los dias de atraso,
 * que sube si el cliente no paga y baja si paga. El enunciado lo advierte
 * dos veces: "no modele como estado lo que puede calcularse".
 *
 * Modelarlos como estados obligaria a definir transiciones entre todos los
 * pares de tramos en ambos sentidos, y ademas crearia una segunda fuente
 * de verdad que tarde o temprano diverge de los dias de atraso reales.
 */
export enum TramoMora {

    AL_DIA = "al_dia",

    MORA_1 = "mora_1",

    MORA_2 = "mora_2",

    MORA_3 = "mora_3",

    VENCIDO = "vencido"

}

/**
 * Traduce dias de atraso a tramo. Funcion pura y reversible: el mismo
 * numero de dias siempre da el mismo tramo, sin importar por donde paso
 * el credito antes.
 */
export class ClasificadorTramoMora {

    /** Limite superior de cada tramo, en dias (seccion 6.5). */
    private static readonly LIMITE_MORA_1 = 30;
    private static readonly LIMITE_MORA_2 = 60;
    private static readonly LIMITE_MORA_3 = 90;
    private static readonly LIMITE_VENCIDO = 120;

    /** Pasados los 90 dias se suspende el devengo de interes corriente. */
    private static readonly DIAS_SUSPENSION_DEVENGO = 90;

    public clasificar(diasAtraso: number): TramoMora {

        this.validar(diasAtraso);

        if (diasAtraso === 0) {
            return TramoMora.AL_DIA;
        }

        if (diasAtraso <= ClasificadorTramoMora.LIMITE_MORA_1) {
            return TramoMora.MORA_1;
        }

        if (diasAtraso <= ClasificadorTramoMora.LIMITE_MORA_2) {
            return TramoMora.MORA_2;
        }

        if (diasAtraso <= ClasificadorTramoMora.LIMITE_MORA_3) {
            return TramoMora.MORA_3;
        }

        // Mas alla de 120 dias el credito sigue en el peor tramo; lo que
        // cambia es que ya es candidato a baja contable, y eso es una
        // decision de estado, no una clasificacion.
        return TramoMora.VENCIDO;
    }

    /**
     * Guarda de la transicion a incobrable (tabla 6.7.1): superar los 120
     * dias sin arreglo. No la ejecuta: solo dice si se cumple la condicion.
     */
    public superaPlazoParaIncobrable(diasAtraso: number): boolean {
        this.validar(diasAtraso);
        return diasAtraso > ClasificadorTramoMora.LIMITE_VENCIDO;
    }

    /**
     * Suspension de devengo (seccion 6.5): pasados los 90 dias se deja de
     * reconocer como ingreso el interes corriente. Si el credito se
     * regulariza, el devengo se reactiva, por eso esto se calcula y no se
     * guarda.
     */
    public suspendeDevengo(diasAtraso: number): boolean {
        this.validar(diasAtraso);
        return diasAtraso > ClasificadorTramoMora.DIAS_SUSPENSION_DEVENGO;
    }

    private validar(diasAtraso: number): void {

        if (!Number.isInteger(diasAtraso)) {
            throw new Error("Los dias de atraso deben ser un numero entero.");
        }

        if (diasAtraso < 0) {
            throw new Error("Los dias de atraso no pueden ser negativos.");
        }
    }
}
