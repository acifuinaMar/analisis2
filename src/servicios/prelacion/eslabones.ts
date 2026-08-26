import { Dinero } from "../../dominio/dinero";
import { Rubro, RubrosAdeudados } from "../../dominio/rubros-adeudados";

/**
 * Lo aplicado por la cadena, rubro por rubro, mas el excedente final.
 * Inmutable: cada eslabon devuelve una copia con su aporte agregado.
 */
export class ResultadoPrelacion {

    constructor(

        private readonly aplicado: ReadonlyMap<Rubro, Dinero>,

        public readonly excedente: Dinero

    ) {}

    public static soloExcedente(excedente: Dinero): ResultadoPrelacion {
        return new ResultadoPrelacion(new Map(), excedente);
    }

    public con(rubro: Rubro, monto: Dinero): ResultadoPrelacion {

        const nuevo = new Map(this.aplicado);
        nuevo.set(rubro, monto);

        return new ResultadoPrelacion(nuevo, this.excedente);
    }

    public de(rubro: Rubro): Dinero {
        return this.aplicado.get(rubro) ?? Dinero.cero();
    }
}

/**
 * Patron Chain of Responsibility (GoF) aplicado a la prelacion (6.6.2).
 *
 * Cada eslabon consume lo que le corresponde de su rubro y pasa el
 * remanente al siguiente. Ningun eslabon sabe quien viene despues ni
 * cuantos hay: solo conoce a su sucesor.
 *
 * La ganancia real no es estetica. El enunciado advierte que "el orden de
 * aplicacion es una regla de negocio, no un detalle de implementacion:
 * cambiarlo altera cuanto debe el cliente". Con la cadena, cambiar ese
 * orden es rearmar eslabones, no editar el cuerpo de un metodo (OCP).
 */
export abstract class EslabonPrelacion {

    private siguiente?: EslabonPrelacion;

    /** Devuelve el sucesor para poder encadenar de corrido. */
    public encadenarCon(siguiente: EslabonPrelacion): EslabonPrelacion {
        this.siguiente = siguiente;
        return siguiente;
    }

    public procesar(
        disponible: Dinero,
        deuda: RubrosAdeudados
    ): ResultadoPrelacion {

        const adeudado = deuda.obtener(this.rubro);

        // Este eslabon toma lo suyo, o lo que alcance.
        const aplicado = Dinero.minimo(disponible, adeudado);

        const remanente = disponible.restar(aplicado);

        // El remanente sigue su camino; al final del recorrido lo que
        // sobre es el excedente del cliente, que nunca se pierde (6.6.5).
        const resultado = this.siguiente
            ? this.siguiente.procesar(remanente, deuda)
            : ResultadoPrelacion.soloExcedente(remanente);

        return resultado.con(this.rubro, aplicado);
    }

    /** Rubro del que se hace cargo este eslabon. */
    protected abstract readonly rubro: Rubro;
}

/** 1. Gastos y comisiones: lo accesorio primero. */
export class EslabonGastos extends EslabonPrelacion {
    protected readonly rubro = Rubro.GASTOS;
}

/** 2. Interes moratorio: la penalizacion por el atraso. */
export class EslabonInteresMoratorio extends EslabonPrelacion {
    protected readonly rubro = Rubro.INTERES_MORATORIO;
}

/** 3. Interes corriente: el interes del periodo. */
export class EslabonInteresCorriente extends EslabonPrelacion {
    protected readonly rubro = Rubro.INTERES_CORRIENTE;
}

/** 4. Capital: lo unico que reduce el saldo de la deuda. */
export class EslabonCapital extends EslabonPrelacion {
    protected readonly rubro = Rubro.CAPITAL;
}
