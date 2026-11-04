import { AplicacionPago } from "../dominio/aplicacion-pago";
import { Credito } from "../dominio/credito";
import { PlanAmortizacion } from "../dominio/plan-amortizacion";
import {
    BaseConteo,
    PoliticaCredito
} from "../dominio/politica-credito";
import {
    CreditoRegistrado,
    PagoRegistrado
} from "../dominio/repositorio-cartera";
import { CalculoFrances } from "../estrategias/calculo-frances";

/**
 * Reconstruye el estado vivo de un credito a partir de los hechos
 * registrados.
 *
 * El paquete canonico lo plantea asi: "la cartera se reconstruye
 * reproduciendo estos eventos". El repositorio entrega lo que ocurrio —un
 * desembolso y sus pagos— y este servicio los reproduce sobre el nucleo
 * para obtener saldo, estado, tramo y cuotas vencidas.
 *
 * Importa que sea una reconstruccion y no una lectura de campos
 * guardados: el saldo nunca se almacena, se deriva de acumular
 * movimientos (regla de mayor, P1 6.9). Asi cualquier cifra del cierre se
 * puede auditar meses despues reproduciendo la bitacora.
 */
/**
 * Un pago reproducido, junto con el desglose de como se imputo.
 *
 * El cierre por periodo necesita saber a QUE se aplico cada pago —gasto,
 * mora, interes, capital— y eso solo lo sabe la cadena de prelacion en el
 * momento de aplicarlo. Reconstruirlo despues seria repetir la formula, y
 * dos formulas de lo mismo siempre divergen.
 */
export interface PagoAplicado {

    readonly pago: PagoRegistrado;

    readonly aplicacion: AplicacionPago;

}

export interface CreditoVivo {

    readonly credito: Credito;

    readonly plan: PlanAmortizacion;

    readonly registro: CreditoRegistrado;

    /** Los pagos reproducidos, en orden cronologico, con su imputacion. */
    readonly aplicaciones: ReadonlyArray<PagoAplicado>;

}

export class ReconstructorCredito {

    /**
     * Arma el plan del credito y le aplica sus pagos en orden
     * cronologico, cada uno con su propia fecha como fecha de corte.
     *
     * Los pagos se aplican con la fecha en que ocurrieron, no con la
     * fecha de corte de la consulta: la mora de un pago de julio se
     * calculo en julio, no hoy.
     */
    public reconstruir(
        registro: CreditoRegistrado,
        pagos: ReadonlyArray<PagoRegistrado>
    ): CreditoVivo {

        const credito = new Credito(
            registro.idCredito,
            registro.capital,
            registro.capital,
            this.politicaDe(registro),
            registro.plazoMeses,
            registro.fechaDesembolso
        );

        const plan = new PlanAmortizacion(credito, new CalculoFrances());
        plan.generarPlan();

        const enOrden = [...pagos]
            .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

        const aplicaciones: PagoAplicado[] = [];

        for (const pago of enOrden) {

            const aplicacion = plan.aplicarPago(
                {
                    monto: pago.monto,
                    fecha: pago.fecha,
                    medioPago: pago.canal,
                    referencia: pago.claveIdempotencia
                },
                pago.fecha
            );

            aplicaciones.push({ pago, aplicacion });
        }

        return { credito, plan, registro, aplicaciones };
    }

    /**
     * Politica del credito a partir de su registro.
     *
     * La tasa corriente viene del desembolso (tna_bps del paquete). La
     * moratoria ya no se toma de aqui: la resuelve el catalogo de
     * politicas de mora segun la fecha de otorgamiento, que es lo que
     * permite que convivan la plana y la escalonada (P2 CP-03).
     */
    private politicaDe(registro: CreditoRegistrado): PoliticaCredito {

        return new PoliticaCredito(
            `DESEMBOLSO-${registro.idCredito}`,
            registro.tnaAnual,
            // Valor nominal: el calculo moratorio no lo usa. Se conserva
            // porque PoliticaCredito lo exige desde el Proyecto 1.
            0.24,
            BaseConteo.ACTUAL_360,
            registro.idAsesor,
            registro.fechaDesembolso
        );
    }
}
