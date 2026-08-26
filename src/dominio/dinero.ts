export class Dinero {

    private readonly valor: number;

    constructor(valor: number) {

        if (!Number.isFinite(valor)) {
            throw new Error("El monto debe ser un número válido.");
        }

        if (valor < 0) {
            throw new Error("El monto no puede ser negativo.");
        }

        // Redondeamos siempre a dos decimales
        this.valor = Number(valor.toFixed(2));
    }

    public obtenerValor(): number {
        return this.valor;
    }

    public sumar(otro: Dinero): Dinero {
        return new Dinero(this.valor + otro.valor);
    }

    public restar(otro: Dinero): Dinero {

        const resultado = this.valor - otro.valor;

        if (resultado < 0) {
            throw new Error("El resultado no puede ser negativo.");
        }

        return new Dinero(resultado);
    }

    public multiplicar(factor: number): Dinero {

        if (!Number.isFinite(factor)) {
            throw new Error("Factor inválido.");
        }

        return new Dinero(this.valor * factor);
    }

    public dividir(divisor: number): Dinero {

        if (divisor === 0) {
            throw new Error("No se puede dividir entre cero.");
        }

        return new Dinero(this.valor / divisor);
    }

    public esMayorQue(otro: Dinero): boolean {
        return this.valor > otro.valor;
    }

    public esMenorQue(otro: Dinero): boolean {
        return this.valor < otro.valor;
    }

    public esIgualA(otro: Dinero): boolean {
        return this.valor === otro.valor;
    }

    public esCero(): boolean {
        return this.valor === 0;
    }

    public toString(): string {
        return this.valor.toFixed(2);
    }

    public static cero(): Dinero {
        return new Dinero(0);
    }

    public porcentaje(porcentaje: number): Dinero {
        return new Dinero(this.valor * porcentaje);
    }

    public esMayorOIgualA(otro: Dinero): boolean {
        return this.valor >= otro.valor;
    }

    public esMenorOIgualA(otro: Dinero): boolean {
        return this.valor <= otro.valor;
    }

    public static desde(valor: number): Dinero{
        return new Dinero(valor);
    }
}