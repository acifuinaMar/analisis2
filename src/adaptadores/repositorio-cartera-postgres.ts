import type { Consulta } from "../persistencia/base-datos";
import { Dinero } from "../dominio/dinero";
import {
    ClienteRegistrado,
    CreditoRegistrado,
    PagoRegistrado,
    RepositorioCartera,
    ResultadoRegistroPago
} from "../dominio/repositorio-cartera";

/**
 * ADAPTADOR del repositorio de cartera sobre PostgreSQL (E2).
 *
 * Implementa el mismo puerto que RepositorioCarteraCsv. Los dos deben
 * ser INTERCAMBIABLES: el servidor MCP, las consultas y la API dependen
 * del puerto, no de donde salen los datos. Por eso tests/ comprueba que
 * ambos devuelven exactamente lo mismo para todo el paquete canonico.
 *
 * Diferencia de papel: el adaptador CSV vive en memoria y es el doble de
 * pruebas; este PERSISTE. Los pagos que entren por la interfaz quedan en
 * la base y sobreviven a reiniciar la aplicacion.
 *
 * Reglas que respeta, las mismas del adaptador CSV:
 *  - Solo cuentan los pagos aplicados (los eventos repetidos del paquete
 *    quedan en la bitacora, pero no mueven saldos).
 *  - registrarPago es idempotente por clave: si la clave ya existe,
 *    devuelve el pago anterior sin alterar nada (P1 6.10).
 *  - Registrar un pago de un credito inexistente es un error.
 *
 * Fechas: se piden a la base como TEXTO (AAAA-MM-DD) y se construyen con
 * componentes locales. Un `date` de Postgres que el driver convierte a
 * Date en UTC retrocederia un dia en Guatemala, y un vencimiento corrido
 * un dia altera los dias de atraso (ver aFecha en el adaptador CSV).
 */
export class RepositorioCarteraPostgres implements RepositorioCartera {

    constructor(private readonly db: Consulta) {}

    public async listarCreditos(): Promise<CreditoRegistrado[]> {

        const r = await this.db.query<FilaCredito>(
            `${SELECT_CREDITO} ORDER BY id_credito COLLATE "C"`
        );

        return r.rows.map(aCredito);
    }

    public async obtenerCredito(
        idCredito: string
    ): Promise<CreditoRegistrado | undefined> {

        const r = await this.db.query<FilaCredito>(
            `${SELECT_CREDITO} WHERE id_credito = $1`,
            [idCredito]
        );

        return r.rows[0] ? aCredito(r.rows[0]) : undefined;
    }

    public async obtenerCliente(
        idCliente: string
    ): Promise<ClienteRegistrado | undefined> {

        const r = await this.db.query<FilaCliente>(
            `SELECT id_cliente, nombre_completo, dpi, telefono, municipio,
                    fecha_alta::text AS fecha_alta
             FROM clientes WHERE id_cliente = $1`,
            [idCliente]
        );

        const f = r.rows[0];

        return f && {
            idCliente: f.id_cliente,
            nombreCompleto: f.nombre_completo,
            dpi: f.dpi,
            telefono: f.telefono,
            municipio: f.municipio,
            fechaAlta: aFecha(f.fecha_alta)
        };
    }

    public async pagosDe(idCredito: string): Promise<PagoRegistrado[]> {

        const r = await this.db.query<FilaPago>(
            `${SELECT_PAGO} AND id_credito = $1 ORDER BY fecha, id`,
            [idCredito]
        );

        return r.rows.map(aPago);
    }

    public async listarPagos(): Promise<PagoRegistrado[]> {

        const r = await this.db.query<FilaPago>(
            `${SELECT_PAGO} ORDER BY fecha, id`
        );

        return r.rows.map(aPago);
    }

    /**
     * Idempotente por clave. La garantia final la da el indice unico
     * parcial (clave_idempotencia WHERE aplicado): aunque dos
     * peticiones lleguen a la vez, solo una inserta.
     */
    public async registrarPago(
        pago: PagoRegistrado
    ): Promise<ResultadoRegistroPago> {

        const anterior = await this.pagoPorClave(pago.claveIdempotencia);

        if (anterior) {
            return { registrado: false, duplicado: true, pago: anterior };
        }

        const credito = await this.db.query(
            "SELECT 1 FROM creditos WHERE id_credito = $1",
            [pago.idCredito]
        );

        if (credito.rows.length === 0) {
            throw new Error(`El credito ${pago.idCredito} no existe.`);
        }

        const r = await this.db.query(
            `INSERT INTO pagos
                 (clave_idempotencia, id_credito, fecha, monto_centavos, canal)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (clave_idempotencia) WHERE aplicado DO NOTHING
             RETURNING id`,
            [
                pago.claveIdempotencia,
                pago.idCredito,
                aTextoFecha(pago.fecha),
                pago.monto.obtenerCentavos(),
                pago.canal
            ]
        );

        if (r.rows.length === 0) {
            // Otra peticion con la misma clave gano la carrera.
            const ganador = await this.pagoPorClave(pago.claveIdempotencia);
            return { registrado: false, duplicado: true, pago: ganador! };
        }

        return { registrado: true, duplicado: false, pago };
    }

    private async pagoPorClave(
        clave: string
    ): Promise<PagoRegistrado | undefined> {

        const r = await this.db.query<FilaPago>(
            `${SELECT_PAGO} AND clave_idempotencia = $1`,
            [clave]
        );

        return r.rows[0] ? aPago(r.rows[0]) : undefined;
    }
}

// ----------------------------------------------------------------------
// Consultas y conversion de filas
// ----------------------------------------------------------------------

interface FilaCredito {
    id_credito: string;
    id_cliente: string;
    id_asesor: string;
    fecha_desembolso: string;
    capital_centavos: number;
    plazo_meses: number;
    tna_bps: number;
    reestructurado: boolean;
}

interface FilaCliente {
    id_cliente: string;
    nombre_completo: string;
    dpi: string;
    telefono: string;
    municipio: string;
    fecha_alta: string;
}

interface FilaPago {
    clave_idempotencia: string;
    id_credito: string;
    fecha: string;
    monto_centavos: number;
    canal: string;
}

const SELECT_CREDITO = `
    SELECT id_credito, id_cliente, id_asesor,
           fecha_desembolso::text AS fecha_desembolso,
           capital_centavos, plazo_meses, tna_bps, reestructurado
    FROM creditos`;

/** Solo pagos aplicados; termina en WHERE para poder encadenar AND. */
const SELECT_PAGO = `
    SELECT clave_idempotencia, id_credito, fecha::text AS fecha,
           monto_centavos, canal, id
    FROM pagos
    WHERE aplicado`;

function aCredito(f: FilaCredito): CreditoRegistrado {
    return {
        idCredito: f.id_credito,
        idCliente: f.id_cliente,
        idAsesor: f.id_asesor,
        fechaDesembolso: aFecha(f.fecha_desembolso),
        capital: Dinero.desdeCentavos(f.capital_centavos),
        plazoMeses: f.plazo_meses,
        // Los basis points son centesimas de punto porcentual:
        // 3600 bps = 36.00 % = 0.36 en decimal.
        tnaAnual: f.tna_bps / 10000,
        reestructurado: f.reestructurado
    };
}

function aPago(f: FilaPago): PagoRegistrado {
    return {
        claveIdempotencia: f.clave_idempotencia,
        idCredito: f.id_credito,
        fecha: aFecha(f.fecha),
        monto: Dinero.desdeCentavos(f.monto_centavos),
        canal: f.canal
    };
}

/** AAAA-MM-DD -> Date a medianoche LOCAL (igual que el adaptador CSV). */
function aFecha(texto: string): Date {

    const [anio, mes, dia] = texto.split("-").map(Number);

    if (!anio || !mes || !dia) {
        throw new Error(`Fecha invalida leida de la base: "${texto}".`);
    }

    return new Date(anio, mes - 1, dia);
}

/** Date local -> AAAA-MM-DD, sin pasar por UTC. */
function aTextoFecha(fecha: Date): string {

    const dos = (n: number) => String(n).padStart(2, "0");

    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}
