import { Cuota } from "../dominio/cuota";
import { Credito } from "../dominio/credito";

export interface EstrategiaCalculo {

    generarPlan(credito: Credito): Cuota[];

}