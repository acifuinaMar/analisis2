import { Credito } from "../dominio/credito";
import { Cuota } from "../dominio/cuota";
import { Dinero } from "../dominio/dinero";
import { EstrategiaCalculo } from "./estrategia-calculo";

export class CalculoFrances implements EstrategiaCalculo {

    public generarPlan(credito: Credito): Cuota[] {

        const cuotas: Cuota[] = [];

        const cuota = new Cuota(
            1,
            credito.monto,
            credito.monto,
            Dinero.cero(),
            new Date()
        );

        cuotas.push(cuota);

        return cuotas;

    }

}