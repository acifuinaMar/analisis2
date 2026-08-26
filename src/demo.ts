import { Credito } from "./dominio/credito";
import { Dinero } from "./dominio/dinero";
import { PlanAmortizacion } from "./dominio/plan-amortizacion";

import { CalculoFrances } from "./estrategias/calculo-frances";

import { CalculadoraMora } from "./servicios/calculadora-mora";
import { PrelacionPago } from "./servicios/prelacion-pago";
import { Cartera } from "./servicios/cartera";

import { PosicionCartera } from "./dominio/posicion-cartera";
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

            Estado: c.estado

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


console.clear();

console.log("==============================================");
console.log(" SISTEMA DE CRÉDITOS - DEMO E4");
console.log("==============================================");

demoPlanAmortizacion();

demoMora();

demoPrelacion();

demoCartera();

console.log("\n==============================================");
console.log(" Fin de la demostración");
console.log("==============================================");