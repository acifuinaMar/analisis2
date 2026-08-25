import { Credito } from "./credito";
import { Cuota } from "./cuota";
import { Pago } from "./pago";
import { AplicacionPago } from "./aplicacion-pago";
import { Dinero } from "./dinero";

export class PlanAmortizacion {

    private cuotas: Cuota[] = [];

    constructor(
        private readonly credito: Credito
    ) {}

    public generarPlan(): Cuota[] {

        // PENDIENTE: Implementar algoritmo francés (6.4)

        return this.cuotas;

    }

    public aplicarPago(pago: Pago): AplicacionPago {

        // PENDIENTE: Implementar prelación (6.6)

        return new AplicacionPago(
            Dinero.cero(),
            Dinero.cero(),
            Dinero.cero(),
            pago.monto,
            Dinero.cero()
        );

    }

    public recalcularSaldo(): void {

        // PENDIENTE: Actualizar saldo del crédito

    }

    public actualizarEstado(): void {

        // PENDIENTE: Aplicar State

    }

    public obtenerCuotas(): Cuota[] {
        return [...this.cuotas];
    }
}