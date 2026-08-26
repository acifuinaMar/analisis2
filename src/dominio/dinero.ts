/**
 * Monedas admitidas por el nucleo de dominio.
 */
export enum Moneda {

    GTQ = "GTQ",

    USD = "USD"

}

/**
 * Objeto de Valor (Value Object) que representa un importe monetario.
 *
 * Reglas obligatorias del enunciado (seccion 6.2):
 *  - El importe se guarda como ENTERO en la unidad minima (centavos),
 *    nunca como Number de punto flotante.
 *  - Lleva monto y moneda, y prohibe operar quetzales contra dolares.
 *  - Es inmutable: toda operacion devuelve un Dinero nuevo.
 *  - Redondeo a 2 decimales, medio hacia arriba, en cada operacion.
 *
 * El constructor es privado a proposito: un Value Object solo debe poder
 * crearse por sus fabricas, que son las que garantizan las invariantes.
 */
export class Dinero {

    private constructor(

        private readonly centavos: number,

        private readonly moneda: Moneda

    ) {}

    // ------------------------------------------------------------------
    // Construccion
    // ------------------------------------------------------------------

    /** Crea un Dinero a partir de un importe expresado en quetzales. */
    public static desde(
        valor: number,
        moneda: Moneda = Moneda.GTQ
    ): Dinero {
        return new Dinero(Dinero.aCentavos(valor), moneda);
    }

    /** Crea un Dinero a partir de la unidad minima (centavos). */
    public static desdeCentavos(
        centavos: number,
        moneda: Moneda = Moneda.GTQ
    ): Dinero {

        if (!Number.isInteger(centavos)) {
            throw new Error("Los centavos deben ser un numero entero.");
        }

        if (centavos < 0) {
            throw new Error("El monto no puede ser negativo.");
        }

        return new Dinero(centavos, moneda);
    }

    public static cero(moneda: Moneda = Moneda.GTQ): Dinero {
        return new Dinero(0, moneda);
    }

    /** Devuelve el menor de dos importes de la misma moneda. */
    public static minimo(a: Dinero, b: Dinero): Dinero {
        a.verificarMoneda(b);
        return a.centavos <= b.centavos ? a : b;
    }

    // ------------------------------------------------------------------
    // Aritmetica (siempre sobre enteros; siempre devuelve objetos nuevos)
    // ------------------------------------------------------------------

    public sumar(otro: Dinero): Dinero {
        this.verificarMoneda(otro);
        return new Dinero(this.centavos + otro.centavos, this.moneda);
    }

    public restar(otro: Dinero): Dinero {

        this.verificarMoneda(otro);

        const resultado = this.centavos - otro.centavos;

        // Invariante 6.10: ningun saldo de capital es negativo.
        if (resultado < 0) {
            throw new Error("El resultado no puede ser negativo.");
        }

        return new Dinero(resultado, this.moneda);
    }

    public multiplicar(factor: number): Dinero {

        if (!Number.isFinite(factor)) {
            throw new Error("Factor invalido.");
        }

        if (factor < 0) {
            throw new Error("El factor no puede ser negativo.");
        }

        return new Dinero(
            Dinero.redondearMedioArriba(this.centavos * factor),
            this.moneda
        );
    }

    public dividir(divisor: number): Dinero {

        if (!Number.isFinite(divisor)) {
            throw new Error("Divisor invalido.");
        }

        if (divisor === 0) {
            throw new Error("No se puede dividir entre cero.");
        }

        if (divisor < 0) {
            throw new Error("El divisor no puede ser negativo.");
        }

        return new Dinero(
            Dinero.redondearMedioArriba(this.centavos / divisor),
            this.moneda
        );
    }

    /** Aplica un porcentaje expresado como decimal (0.03 = 3%). */
    public porcentaje(porcentaje: number): Dinero {
        return this.multiplicar(porcentaje);
    }

    // ------------------------------------------------------------------
    // Comparacion
    // ------------------------------------------------------------------

    public esMayorQue(otro: Dinero): boolean {
        this.verificarMoneda(otro);
        return this.centavos > otro.centavos;
    }

    public esMenorQue(otro: Dinero): boolean {
        this.verificarMoneda(otro);
        return this.centavos < otro.centavos;
    }

    public esMayorOIgualA(otro: Dinero): boolean {
        this.verificarMoneda(otro);
        return this.centavos >= otro.centavos;
    }

    public esMenorOIgualA(otro: Dinero): boolean {
        this.verificarMoneda(otro);
        return this.centavos <= otro.centavos;
    }

    /**
     * Igualdad de Value Object: mismo importe Y misma moneda.
     * A diferencia de las comparaciones de orden, aqui distinta moneda
     * no es un error, simplemente significa "no son iguales".
     */
    public esIgualA(otro: Dinero): boolean {
        return this.centavos === otro.centavos
            && this.moneda === otro.moneda;
    }

    public esCero(): boolean {
        return this.centavos === 0;
    }

    // ------------------------------------------------------------------
    // Lectura
    // ------------------------------------------------------------------

    /** Importe en quetzales. Solo para presentacion y aserciones. */
    public obtenerValor(): number {
        return this.centavos / 100;
    }

    /** Importe en la unidad minima. Esta es la representacion real. */
    public obtenerCentavos(): number {
        return this.centavos;
    }

    public obtenerMoneda(): Moneda {
        return this.moneda;
    }

    public toString(): string {
        return `${this.moneda} ${this.obtenerValor().toFixed(2)}`;
    }

    // ------------------------------------------------------------------
    // Reglas internas
    // ------------------------------------------------------------------

    private verificarMoneda(otro: Dinero): void {

        if (this.moneda !== otro.moneda) {
            throw new Error(
                "No se pueden operar importes de distinta moneda: " +
                `${this.moneda} y ${otro.moneda}.`
            );
        }
    }

    private static aCentavos(valor: number): number {

        if (!Number.isFinite(valor)) {
            throw new Error("El monto debe ser un numero valido.");
        }

        if (valor < 0) {
            throw new Error("El monto no puede ser negativo.");
        }

        return Dinero.redondearMedioArriba(valor * 100);
    }

    /**
     * Redondeo medio hacia arriba (seccion 6.2).
     *
     * Math.round() ya rompe el empate hacia arriba, pero antes hay que
     * neutralizar el ruido binario de IEEE-754: 1.005 * 100 da
     * 100.49999999999999, que se redondearia hacia ABAJO por error.
     * toPrecision(12) descarta ese ruido sin alterar el valor real.
     */
    private static redondearMedioArriba(valor: number): number {
        return Math.round(Number(valor.toPrecision(12)));
    }
}
