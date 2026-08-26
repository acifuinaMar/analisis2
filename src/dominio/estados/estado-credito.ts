import { NombreEstado } from "../nombre-estado";

/**
 * Error de transicion no permitida.
 *
 * El enunciado exige que "las transiciones invalidas deben ser imposibles
 * por diseno (patron State), no evitadas con un if". Aqui no hay ningun
 * if que revise el estado: cada estado simplemente no ofrece un camino
 * legal para los eventos que no le corresponden.
 */
export class TransicionInvalida extends Error {

    constructor(
        public readonly estado: NombreEstado,
        public readonly evento: string
    ) {
        super(
            `Transicion invalida: un credito en estado '${estado}' `
            + `no admite el evento '${evento}'.`
        );
        this.name = "TransicionInvalida";
    }
}

/**
 * Datos con los que un estado decide a donde transitar tras un pago o
 * en una fecha de corte. Se pasan como dato para que el estado no tenga
 * que conocer al credito completo (bajo acoplamiento).
 */
export interface SituacionCredito {

    readonly saldoEnCero: boolean;

    readonly diasAtraso: number;

}

/**
 * Patron State (GoF) aplicado al ciclo de vida del credito (seccion 6.7).
 *
 * Cada estado es un objeto que sabe a que otro estado puede pasar y ante
 * que evento. El credito delega en el estado actual en vez de resolver
 * las transiciones con condicionales.
 */
export interface EstadoCredito {

    readonly nombre: NombreEstado;

    aprobar(): EstadoCredito;

    rechazar(): EstadoCredito;

    desembolsar(): EstadoCredito;

    anular(): EstadoCredito;

    registrarPago(situacion: SituacionCredito): EstadoCredito;

    evaluarAlCorte(situacion: SituacionCredito): EstadoCredito;

    reestructurar(): EstadoCredito;

    declararIncobrable(diasAtraso: number): EstadoCredito;

    admitePagos(): boolean;

    esTerminal(): boolean;

}

/**
 * Base comun: todo evento es invalido salvo que un estado concreto lo
 * habilite explicitamente.
 *
 * Esta es la pieza que hace que las transiciones invalidas sean
 * imposibles por omision, no por vigilancia: para permitir algo hay que
 * escribirlo, y lo que no se escribe queda prohibido.
 */
export abstract class EstadoBase implements EstadoCredito {

    public abstract readonly nombre: NombreEstado;

    public aprobar(): EstadoCredito {
        throw this.invalido("aprobar");
    }

    public rechazar(): EstadoCredito {
        throw this.invalido("rechazar");
    }

    public desembolsar(): EstadoCredito {
        throw this.invalido("desembolsar");
    }

    public anular(): EstadoCredito {
        throw this.invalido("anular");
    }

    public registrarPago(_situacion: SituacionCredito): EstadoCredito {
        throw this.invalido("registrarPago");
    }

    public reestructurar(): EstadoCredito {
        throw this.invalido("reestructurar");
    }

    public declararIncobrable(_diasAtraso: number): EstadoCredito {
        throw this.invalido("declararIncobrable");
    }

    /**
     * El paso del tiempo no es un evento que se pueda rechazar: un cierre
     * se ejecuta sobre toda la cartera. Por defecto el estado no cambia.
     */
    public evaluarAlCorte(_situacion: SituacionCredito): EstadoCredito {
        return this;
    }

    public admitePagos(): boolean {
        return false;
    }

    public esTerminal(): boolean {
        return false;
    }

    protected invalido(evento: string): TransicionInvalida {
        return new TransicionInvalida(this.nombre, evento);
    }
}
