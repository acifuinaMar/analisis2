import { Credito } from "./dominio/credito";
import { Dinero } from "./dominio/dinero";
import { PlanAmortizacion } from "./dominio/plan-amortizacion";

import { CalculoFrances } from "./estrategias/calculo-frances";

import { CalculadoraMora } from "./servicios/calculadora-mora";
import { PrelacionPago } from "./servicios/prelacion-pago";
import { Cartera } from "./servicios/cartera";

import { PosicionCartera } from "./dominio/posicion-cartera";
import { RubrosAdeudados } from "./dominio/rubros-adeudados";
import { Pago } from "./dominio/pago";

import { addDays, addMonths } from "date-fns";
import { NombreEstado } from "./dominio/nombre-estado";
import { PoliticaCredito, BaseConteo } from "./dominio/politica-credito";

import { RelojSistema } from "./adaptadores/reloj-sistema";

// La politica vive fuera del codigo de calculo: version, tasas, base de
// conteo, autor y fecha de vigencia (seccion 6.3.1).
const POLITICA = new PoliticaCredito(
    "POL-2026-01",
    0.36,
    0.24,
    BaseConteo.ACTUAL_360,
    "Comite de Credito",
    new Date(2026, 0, 1)
);

// El reloj se usa aqui, en la capa de aplicacion. El nucleo nunca lo toca.
const reloj = new RelojSistema();

function titulo(texto: string) {

    console.log("\n");
    console.log("==================================================");
    console.log(texto);
    console.log("==================================================");

}

function demoPlanAmortizacion() {

    titulo("1. PLAN DE AMORTIZACIÓN FRANCÉS");
    const MONTO = 10000;
    const TASA_ANUAL = POLITICA.tasaAnual;
    const PLAZO_MESES = 12;

    console.log("Caso de referencia");
    console.log(`Monto : Q${MONTO.toFixed(2)}`);
    console.log(`Tasa  : ${(TASA_ANUAL * 100).toFixed(2)}% anual`);
    console.log(`Plazo : ${PLAZO_MESES} meses`);
    console.log(POLITICA.describir());
    console.log();
    const credito = new Credito(
        "CR-001",

        Dinero.desde(MONTO), //monto original

        Dinero.desde(MONTO), //Saldo inicial

        POLITICA, //politica vigente al otorgamiento

        PLAZO_MESES, //Plazo en meses

        reloj.hoy() //fecha de desembolso, inyectada desde el puerto Reloj

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

            Estado: c.obtenerEstado()

        }))

    );

}

function demoMora() {

    titulo("2. INTERÉS MORATORIO");

    const calculadora = new CalculadoraMora(POLITICA);

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

    // Rubros de la cuota 2 vencida hace 15 dias (seccion 6.6.1).
    const deuda = new RubrosAdeudados(

        Dinero.desde(0),      //gastos

        Dinero.desde(7.26),   //interes moratorio

        Dinero.desde(278.86), //interes corriente

        Dinero.desde(725.76)  //capital

    );

    const resultado = prelacion.aplicar(Dinero.desde(pago), deuda);

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

function demoCartera() {

    titulo("4. CARTERA EN RIESGO");

    const cartera = new Cartera([

        new PosicionCartera("C-001", Dinero.desde(620000), 0, NombreEstado.VIGENTE),

        new PosicionCartera("C-002", Dinero.desde(124000), 8, NombreEstado.EN_MORA),

        new PosicionCartera("C-003", Dinero.desde(24000), 45, NombreEstado.EN_MORA),

        new PosicionCartera("C-004", Dinero.desde(18000), 75, NombreEstado.EN_MORA),

        new PosicionCartera("C-005", Dinero.desde(8000), 100, NombreEstado.EN_MORA),

        new PosicionCartera("C-006", Dinero.desde(6000), 0, NombreEstado.VIGENTE, true),

        new PosicionCartera("C-007", Dinero.desde(15000), 210, NombreEstado.INCOBRABLE)

    ]);

    console.table(

        cartera.obtenerPosiciones().map(p => ({

            Credito: p.creditoId,

            Saldo: p.saldoCapital.obtenerValor().toFixed(2),

            Dias: p.diasAtraso,

            Reestructurado: p.marcadoReestructurado ? "Si" : "No",

            Estado: p.estado,

            EnRiesgo: p.estaEnRiesgo() ? "Si" : "No"

        }))

    );

    imprimirReporte("Antes de dar de baja", cartera);

    imprimirReporte(
        "Despues de declarar incobrable C-005",
        cartera.declararIncobrable("C-005")
    );

    console.log(
        "\nEl indicador bajo de 7.00% a 6.06% sin haber cobrado un solo quetzal:"
    );
    console.log(
        "solo se dio de baja el credito malo. Por eso nunca se reporta solo."
    );

}

function imprimirReporte(nombre: string, cartera: Cartera) {

    const reporte = cartera.generarReporte();

    console.log("\n" + nombre);

    console.table({

        CarteraActiva: reporte.carteraActiva.obtenerValor().toFixed(2),

        MontoEnRiesgo: reporte.montoEnRiesgo.obtenerValor().toFixed(2),

        PorcentajeEnRiesgo:
            (reporte.porcentajeEnRiesgo * 100).toFixed(2) + " %",

        DadoPorIncobrable:
            reporte.dadoPorIncobrable.obtenerValor().toFixed(2)

    });

}


function demoRegistroDePago() {

    titulo("5. REGISTRO DE PAGO (flujo completo)");

    const desembolso = reloj.hoy();

    const credito = new Credito(
        "CR-002",
        Dinero.desde(10000),
        Dinero.desde(10000),
        POLITICA,
        12,
        desembolso
    );

    const plan = new PlanAmortizacion(credito, new CalculoFrances());
    plan.generarPlan();

    // La cuota 1 ya se pago; el corte cae 15 dias despues del vencimiento
    // de la cuota 2.
    const cuota1 = plan.obtenerCuotas()[0];
    cuota1.abonar(cuota1.capitalPendiente(), cuota1.interesPendiente());
    plan.recalcularSaldo();

    const fechaCorte = addDays(addMonths(desembolso, 1), 15);

    // Marcacion de mora del cierre: el credito se evalua a la fecha de corte.
    plan.actualizarEstado(fechaCorte);

    console.log("Fecha de corte    : " + fechaCorte.toISOString().slice(0, 10));
    console.log("Estado inicial    : " + credito.nombreEstado());
    console.log("Saldo de capital  : Q" + credito.saldoCapital.obtenerValor().toFixed(2));
    console.log("Dias de atraso    : " + plan.diasAtrasoMaximo(fechaCorte));

    const aplicacion = plan.aplicarPago(
        new Pago(Dinero.desde(1011.88), fechaCorte, "efectivo"),
        fechaCorte
    );

    console.log("\nPago recibido     : Q1011.88");

    console.table({
        Gastos: aplicacion.gastos.obtenerValor().toFixed(2),
        Mora: aplicacion.interesMoratorio.obtenerValor().toFixed(2),
        InteresCorriente: aplicacion.interesCorriente.obtenerValor().toFixed(2),
        Capital: aplicacion.capital.obtenerValor().toFixed(2),
        Excedente: aplicacion.excedente.obtenerValor().toFixed(2)
    });

    console.log("Cuota 2           : " + plan.obtenerCuotas()[1].obtenerEstado());
    console.log("Estado final      : " + credito.nombreEstado());
    console.log("Saldo de capital  : Q" + credito.saldoCapital.obtenerValor().toFixed(2));
    console.log(
        "\nLa cuota quedo saldada y el credito regreso de EN MORA a VIGENTE."
    );
}


console.clear();

console.log("==============================================");
console.log(" SISTEMA DE CRÉDITOS - DEMO E4");
console.log("==============================================");

demoPlanAmortizacion();

demoMora();

demoPrelacion();

demoCartera();

demoRegistroDePago();

console.log("\n==============================================");
console.log(" Fin de la demostración");
console.log("==============================================");