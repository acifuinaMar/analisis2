import { Dinero } from "../dominio/dinero";
import { PoliticaMora } from "../dominio/politica-mora/politica-mora";

/**
 * Motor de calculo del interes moratorio (P1 seccion 6.5).
 *
 * El Proyecto 1 recibia la TASA inyectada pero tenia la FORMULA escrita
 * aqui dentro: capital x tasa diaria x dias. Eso alcanzaba mientras todas
 * las politicas fueran planas.
 *
 * La politica escalonada del Proyecto 2 no es otra tasa, es otra formula:
 * una suma sobre los tramos recorridos. Por eso lo que se inyecta ahora es
 * el calculo completo, a traves del puerto PoliticaMora.
 *
 * A partir de este punto el motor no vuelve a cambiar: agregar una politica
 * nueva es escribir una implementacion nueva del puerto. La politica
 * retroactiva se agrego despues, sin tocar este archivo.
 *
 * Se mantienen las dos reglas irrenunciables del dominio: el moratorio se
 * calcula solo sobre capital en mora —el Codigo Civil prohibe el
 * anatocismo— y cada cuota vencida se calcula por separado, con su propio
 * capital y sus propios dias.
 */
export class CalculadoraMora {

    constructor(private readonly politica: PoliticaMora) {}

    public calcular(
        capitalEnMora: Dinero,
        diasAtraso: number
    ): Dinero {
        return this.politica.calcular(capitalEnMora, diasAtraso);
    }

    /** Version de la politica aplicada, para la trazabilidad del cierre. */
    public versionPolitica(): string {
        return this.politica.version;
    }
}
