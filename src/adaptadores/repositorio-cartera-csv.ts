import { readFile } from "node:fs/promises";
import path from "node:path";

import { Dinero } from "../dominio/dinero";
import {
    AsesorRegistrado,
    ErrorRepositorio,
    ClienteRegistrado,
    CreditoRegistrado,
    PagoRegistrado,
    RepositorioCartera,
    ResultadoRegistroPago
} from "../dominio/repositorio-cartera";

/**
 * ADAPTADOR del repositorio sobre el paquete de datos canonico.
 *
 * Lee los CSV que entrega el docente y los deja en memoria. Sirve para dos
 * cosas, y ninguna es provisional:
 *
 * 1. Permite construir y probar el servidor MCP sin depender de que la base
 *    de datos exista, este levantada o tenga credenciales.
 * 2. Es el doble de pruebas del E6: las pruebas del MCP deben correr con
 *    `npm test`, rapido y sin red. Contra Postgres eso no se puede.
 *
 * Cuando el E2 agregue el adaptador de Postgres, este NO se tira: pasa a
 * ser el que usan las pruebas.
 *
 * Los pagos registrados en caliente viven solo en memoria. Este adaptador
 * no escribe en los CSV: el paquete canonico es inmutable por diseno, y el
 * propio LEEME lo dice — "no editarlo a mano nunca mas".
 */
/** Conteos de una carga, para reportarlos y verificarlos. */
export interface ResumenCarga {

    readonly clientes: number;

    readonly creditos: number;

    /** Eventos PAGO del paquete, duplicados incluidos. */
    readonly eventosPagoLeidos: number;

    /** Pagos que efectivamente afectan los saldos. */
    readonly pagosAplicados: number;

    readonly duplicadosIgnorados: number;

}

export class RepositorioCarteraCsv implements RepositorioCartera {

    private asesores = new Map<string, AsesorRegistrado>();

    private clientes = new Map<string, ClienteRegistrado>();

    private creditos = new Map<string, CreditoRegistrado>();

    private pagos: PagoRegistrado[] = [];

    private clavesUsadas = new Set<string>();

    private cargado = false;

    /** Eventos PAGO leidos del paquete, duplicados incluidos. */
    private eventosPagoLeidos = 0;

    /** Eventos PAGO descartados por clave repetida. */
    private duplicadosIgnorados = 0;

    constructor(private readonly directorioDatos: string) {}

    /**
     * Carga el paquete. Es idempotente: llamarla dos veces no duplica la
     * cartera, igual que exige el cargador del E2.
     */
    public async cargar(): Promise<void> {

        if (this.cargado) {
            return;
        }

        if (!this.directorioDatos.trim()) {
            throw new Error(
                "Falta indicar el directorio del paquete canonico "
                + "(CV_DATA_DIR)."
            );
        }

        await this.cargarAsesores();
        await this.cargarClientes();
        await this.cargarCreditos();
        await this.cargarPagos();

        this.cargado = true;
    }

    // ------------------------------------------------------------------
    // Lectura
    // ------------------------------------------------------------------

    public async listarCreditos(): Promise<CreditoRegistrado[]> {
        await this.cargar();
        return [...this.creditos.values()]
            .sort((a, b) => a.idCredito.localeCompare(b.idCredito));
    }

    public async obtenerCredito(
        idCredito: string
    ): Promise<CreditoRegistrado | undefined> {
        await this.cargar();
        return this.creditos.get(idCredito);
    }

    public async obtenerCliente(
        idCliente: string
    ): Promise<ClienteRegistrado | undefined> {
        await this.cargar();
        return this.clientes.get(idCliente);
    }

    public async pagosDe(idCredito: string): Promise<PagoRegistrado[]> {
        await this.cargar();
        return this.pagos
            .filter(pago => pago.idCredito === idCredito)
            .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    }

    public async listarPagos(): Promise<PagoRegistrado[]> {
        await this.cargar();
        return [...this.pagos]
            .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    }

    // ------------------------------------------------------------------
    // Escritura
    // ------------------------------------------------------------------

    /**
     * Idempotencia por clave (P1 6.10): si la clave ya se registro, se
     * devuelve el pago anterior y el saldo no se mueve. Reintentar un pago
     * por un corte de red no puede cobrar dos veces.
     */
    public async registrarPago(
        pago: PagoRegistrado
    ): Promise<ResultadoRegistroPago> {

        await this.cargar();

        if (this.clavesUsadas.has(pago.claveIdempotencia)) {

            const anterior = this.pagos.find(
                p => p.claveIdempotencia === pago.claveIdempotencia
            )!;

            return { registrado: false, duplicado: true, pago: anterior };
        }

        if (!this.creditos.has(pago.idCredito)) {
            throw new Error(`El credito ${pago.idCredito} no existe.`);
        }

        this.pagos.push(pago);
        this.clavesUsadas.add(pago.claveIdempotencia);

        return { registrado: true, duplicado: false, pago };
    }

    // ------------------------------------------------------------------
    // Lectura de los archivos
    public async listarClientes(): Promise<ClienteRegistrado[]> {
        await this.cargar();
        return [...this.clientes.values()]
            .sort((a, b) => a.idCliente.localeCompare(b.idCliente));
    }

    public async listarAsesores(): Promise<AsesorRegistrado[]> {
        await this.cargar();
        return [...this.asesores.values()]
            .sort((a, b) => a.idAsesor.localeCompare(b.idAsesor));
    }

    /**
     * Escritura en memoria: vive lo que dure el proceso. Mismas reglas
     * que el adaptador de Postgres (unicidad de id y DPI), para que sean
     * intercambiables.
     */
    public async registrarCliente(cliente: ClienteRegistrado): Promise<void> {

        await this.cargar();

        if (this.clientes.has(cliente.idCliente)) {
            throw new ErrorRepositorio(
                "CLIENTE_DUPLICADO",
                `El cliente ${cliente.idCliente} ya existe.`
            );
        }

        for (const existente of this.clientes.values()) {
            if (existente.dpi === cliente.dpi) {
                throw new ErrorRepositorio(
                    "DPI_DUPLICADO",
                    `Ya existe un cliente con el DPI ${cliente.dpi}.`
                );
            }
        }

        this.clientes.set(cliente.idCliente, cliente);
    }

    public async registrarCredito(credito: CreditoRegistrado): Promise<void> {

        await this.cargar();

        if (this.creditos.has(credito.idCredito)) {
            throw new ErrorRepositorio(
                "CREDITO_DUPLICADO",
                `El credito ${credito.idCredito} ya existe.`
            );
        }

        if (!this.clientes.has(credito.idCliente)) {
            throw new ErrorRepositorio(
                "CLIENTE_INEXISTENTE",
                `El cliente ${credito.idCliente} no existe.`
            );
        }

        if (!this.asesores.has(credito.idAsesor)) {
            throw new ErrorRepositorio(
                "ASESOR_INEXISTENTE",
                `El asesor ${credito.idAsesor} no existe.`
            );
        }

        this.creditos.set(credito.idCredito, credito);
    }

    // ------------------------------------------------------------------

    private async cargarAsesores(): Promise<void> {

        for (const fila of await this.leerCsv("asesores.csv")) {
            this.asesores.set(fila.id_asesor, {
                idAsesor: fila.id_asesor,
                nombreCompleto: fila.nombre_completo
            });
        }
    }

    private async cargarClientes(): Promise<void> {

        for (const fila of await this.leerCsv("clientes.csv")) {
            this.clientes.set(fila.id_cliente, {
                idCliente: fila.id_cliente,
                nombreCompleto: fila.nombre_completo,
                dpi: fila.dpi,
                telefono: fila.telefono,
                municipio: fila.municipio,
                fechaAlta: aFecha(fila.fecha_alta)
            });
        }
    }

    private async cargarCreditos(): Promise<void> {

        for (const fila of await this.leerCsv("creditos.csv")) {
            this.creditos.set(fila.id_credito, {
                idCredito: fila.id_credito,
                idCliente: fila.id_cliente,
                idAsesor: fila.id_asesor,
                fechaDesembolso: aFecha(fila.fecha),
                capital: Dinero.desdeCentavos(Number(fila.capital_centavos)),
                plazoMeses: Number(fila.plazo_meses),
                // Los basis points son centesimas de punto porcentual:
                // 3600 bps = 36.00 % = 0.36 en decimal.
                tnaAnual: Number(fila.tna_bps) / 10000,
                reestructurado: fila.reestructurado === "true"
            });
        }
    }

    /**
     * Carga los pagos aplicando la regla del contrato de datos: "los pagos
     * con clave_idempotencia repetida se ignoran (P1 6.10)".
     *
     * El paquete trae 228 eventos PAGO, de los cuales dos estan repetidos
     * a proposito —IDEM-000068 e IDEM-000127— para comprobar que el
     * cargador no los cuenta dos veces. Quedan 226 pagos efectivos.
     *
     * Se llevan los dos conteos por separado porque el video tiene que
     * poder mostrar la idempotencia funcionando, no solo el resultado.
     */
    private async cargarPagos(): Promise<void> {

        for (const fila of await this.leerCsv("pagos.csv")) {

            this.eventosPagoLeidos++;

            if (this.clavesUsadas.has(fila.clave_idempotencia)) {
                this.duplicadosIgnorados++;
                continue;
            }

            this.pagos.push({
                claveIdempotencia: fila.clave_idempotencia,
                idCredito: fila.id_credito,
                fecha: aFecha(fila.fecha),
                monto: Dinero.desdeCentavos(Number(fila.monto_centavos)),
                canal: fila.canal
            });

            this.clavesUsadas.add(fila.clave_idempotencia);
        }
    }

    /** Resumen de la carga, para que el cargador del E2 lo reporte. */
    public async resumenCarga(): Promise<ResumenCarga> {

        await this.cargar();

        return {
            clientes: this.clientes.size,
            creditos: this.creditos.size,
            eventosPagoLeidos: this.eventosPagoLeidos,
            pagosAplicados: this.pagos.length,
            duplicadosIgnorados: this.duplicadosIgnorados
        };
    }

    /**
     * Lector de CSV minimo. El paquete canonico no trae comas dentro de
     * los campos ni comillas, asi que no hace falta una libreria: una
     * dependencia menos que justificar.
     */
    private async leerCsv(
        archivo: string
    ): Promise<Array<Record<string, string>>> {

        const ruta = path.join(this.directorioDatos, archivo);
        const contenido = await readFile(ruta, "utf8");

        const lineas = contenido
            .split(/\r?\n/)
            .filter(linea => linea.trim() !== "");

        if (lineas.length === 0) {
            throw new Error(`El archivo ${archivo} esta vacio.`);
        }

        const cabeceras = lineas[0].split(",");

        return lineas.slice(1).map(linea => {

            const celdas = linea.split(",");

            if (celdas.length !== cabeceras.length) {
                throw new Error(
                    `Fila malformada en ${archivo}: se esperaban `
                    + `${cabeceras.length} columnas y vinieron ${celdas.length}.`
                );
            }

            return Object.fromEntries(
                cabeceras.map((cabecera, i) => [cabecera, celdas[i]])
            );
        });
    }
}

/**
 * Las fechas del paquete vienen como AAAA-MM-DD. Se construyen con
 * componentes y no con `new Date(texto)` porque esa forma las interpreta
 * como UTC y, en una zona con desfase negativo como Guatemala, el dia
 * retrocede uno. Un vencimiento corrido un dia altera los dias de atraso.
 */
function aFecha(texto: string): Date {

    const [anio, mes, dia] = texto.split("-").map(Number);

    if (!anio || !mes || !dia) {
        throw new Error(`Fecha invalida en el paquete canonico: "${texto}".`);
    }

    return new Date(anio, mes - 1, dia);
}
