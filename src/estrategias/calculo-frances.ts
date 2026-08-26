import { Credito } from "../dominio/credito";
import { Cuota } from "../dominio/cuota";
import { Dinero } from "../dominio/dinero";
import { EstrategiaCalculo } from "./estrategia-calculo";

export class CalculoFrances implements EstrategiaCalculo {
    private redondear(valor: number): number {
        return Number(valor.toFixed(2));
    }
    public generarPlan(credito: Credito): Cuota[] {
        const cuotas: Cuota[] = [];

        let saldo = credito.monto.obtenerValor();

        const tasaMensual = credito.tasaAnual / 12;
        const plazo = credito.plazoMeses;

        // Fórmula francesa
        const cuotaFija =
            saldo *
            (tasaMensual /
                (1 - Math.pow(1 + tasaMensual, -plazo)));

        let fecha = new Date();

        for (let numero = 1; numero <= plazo; numero++) {

            let interes = this.redondear(saldo * tasaMensual);
            let capital = this.redondear(cuotaFija - interes);
            let montoCuota = cuotaFija;

            //Ajuste última cuota
            if (numero=== plazo){
                capital = saldo;
                montoCuota = capital + interes;
            }
            saldo = this.redondear(saldo - capital);

            // Evitar errores acumulados de redondeo
            if (numero === plazo && saldo < 0.01) {
                saldo = 0;
            }

            cuotas.push(

                new Cuota(
                    numero,
                    Dinero.desde(montoCuota),
                    Dinero.desde(capital),
                    Dinero.desde(interes),
                    new Date(fecha)
                )

            );
            fecha.setMonth(fecha.getMonth() + 1);
        }
        return cuotas;
    }

}