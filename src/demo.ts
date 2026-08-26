import { Credito } from "./dominio/credito";
import { Dinero } from "./dominio/dinero";
import { PlanAmortizacion } from "./dominio/plan-amortizacion";

import { CalculoFrances } from "./estrategias/calculo-frances";

import { CalculadoraMora } from "./servicios/calculadora-mora";
import { PrelacionPago } from "./servicios/prelacion-pago";

function titulo(texto: string) {

    console.log("\n");
    console.log("==================================================");
    console.log(texto);
    console.log("==================================================");

}

function demoPlanAmortizacion() {

    titulo("1. PLAN DE AMORTIZACIÓN FRANCÉS");
    const MONTO = 10000;
    const TASA_ANUAL = 0.36;
    const PLAZO_MESES = 12;

    console.log("Caso de referencia");
    console.log(`Monto : Q${MONTO.toFixed(2)}`);
    console.log(`Tasa  : ${(TASA_ANUAL * 100).toFixed(2)}% anual`);
    console.log(`Plazo : ${PLAZO_MESES} meses`);
    console.log();
    const credito = new Credito(
        "CR-001",

        Dinero.desde(MONTO), //monto original

        Dinero.desde(MONTO), //Saldo inicial

        TASA_ANUAL, //tasa anual

        PLAZO_MESES //Plazo en meses

    );

    const plan = new PlanAmortizacion(

        credito,

        new CalculoFrances()

    );

    const cuotas = plan.generarPlan();

    console.table(

        cuotas.map(c => ({

            Cuota: c.numero,

            Monto: c.monto.obtenerValor().toFixed(2),

            Capital: c.capital.obtenerValor().toFixed(2),

            Interes: c.interes.obtenerValor().toFixed(2),

            Estado: c.estado

        }))

    );

}

function demoMora() {

    titulo("2. INTERÉS MORATORIO");

    const calculadora = new CalculadoraMora();

    const mora = calculadora.calcular(

        Dinero.desde(725.76),

        15

    );

    console.log("Capital en mora : Q725.76");
    console.log("Días de atraso  : 15");
    console.log("Resultado       : Q" + mora.obtenerValor().toFixed(2));

}

function imprimirEscenario(nombre: string, pago: number) {

    const prelacion = new PrelacionPago();

    const resultado = prelacion.aplicar(

        Dinero.desde(pago),

        Dinero.desde(0),

        Dinero.desde(7.26),

        Dinero.desde(278.86),

        Dinero.desde(725.76)

    );

    console.log("\n" + nombre);

    console.table({

        Gastos: resultado.gastos.obtenerValor(),

        Mora: resultado.interesMoratorio.obtenerValor(),

        InteresCorriente: resultado.interesCorriente.obtenerValor(),

        Capital: resultado.capital.obtenerValor(),

        Excedente: resultado.excedente.obtenerValor()

    });

}

function demoPrelacion() {

    titulo("3. PRELACIÓN DE PAGOS");

    imprimirEscenario(
        "Escenario A - Pago exacto",
        1011.88
    );

    imprimirEscenario(
        "Escenario B - Pago parcial",
        500
    );

    imprimirEscenario(
        "Escenario C - Pago con excedente",
        3000
    );

}

console.clear();

console.log("==============================================");
console.log(" SISTEMA DE CRÉDITOS - DEMO E4");
console.log("==============================================");

demoPlanAmortizacion();

demoMora();

demoPrelacion();

console.log("\n==============================================");
console.log(" Fin de la demostración");
console.log("==============================================");