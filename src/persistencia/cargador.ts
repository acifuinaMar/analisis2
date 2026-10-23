import { aplicarEsquema, type BaseDatos, type Consulta } from "./base-datos";
import { ErrorCarga } from "./errores";
import {
    leerPaquete,
    type EventoClienteT,
    type EventoDesembolsoT,
    type EventoPagoT,
    type PaqueteCanonico
} from "./paquete";

/**
 * Cargador canonico (E2).
 *
 * Carga masiva, una sola vez, del paquete de datos. Garantias:
 *
 *  1. Huella: verifica el SHA-256 de eventos.jsonl ANTES de tocar la
 *     base; si no coincide, se detiene sin escribir nada.
 *  2. Atomico: todo ocurre en una transaccion; si algo falla (incluida
 *     la verificacion de conteos), no queda nada a medias.
 *  3. Idempotente: ejecutarlo dos veces no duplica la cartera. La
 *     segunda ejecucion detecta la carga previa por su huella y no
 *     escribe. Si la base ya tiene una carga con OTRA huella, se niega:
 *     el paquete canonico no se altera ni se mezcla.
 *  4. Claves de idempotencia repetidas: la bitacora trae pagos con una
 *     clave ya vista. Se conservan (para que los 228 eventos de pago
 *     queden registrados) pero se marcan aplicado = FALSE: no cuentan
 *     como pago ni mueven saldos (P1 6.10). Es el mismo criterio que
 *     RepositorioCarteraCsv: 228 leidos, 226 aplicados.
 *  5. Por lotes: cada tabla se llena con UNA sentencia (unnest), no con
 *     una por fila. Contra una base remota son ~10 viajes de red en vez
 *     de cientos, y el Bloque 1 del video dura 2-3 minutos.
 *
 * El cargador NO calcula nada financiero: no hay saldos, mora ni
 * politicas aplicadas. Solo traslada los datos; el calculo es del nucleo.
 */

export type EstadoCarga = "cargado" | "ya_cargado";

export interface ResultadoCarga {
    readonly estado: EstadoCarga;
    readonly huella: string;
    readonly clientes: number;
    readonly creditos: number;
    /** Eventos de pago registrados (incluye los repetidos). */
    readonly pagos: number;
    /** Pagos que cuentan (primera aparicion de cada clave). */
    readonly pagosAplicados: number;
    /** Eventos de pago con clave ya vista, ignorados al aplicar. */
    readonly pagosDuplicados: number;
}

export type Progreso = (mensaje: PasoCarga) => void;

export type PasoCarga =
    | { paso: "huella"; huella: string }
    | { paso: "esquema" }
    | { paso: "cargando" }
    | { paso: "conteos"; resultado: ResultadoCarga };

export async function cargarPaqueteCanonico(
    db: BaseDatos,
    directorio: string,
    progreso: Progreso = () => undefined
): Promise<ResultadoCarga> {

    // 1. Huella (lanza si no coincide; no se ha tocado la base).
    const paquete = leerPaquete(directorio);
    progreso({ paso: "huella", huella: paquete.huella });

    // 2. Esquema (idempotente).
    await aplicarEsquema(db);
    progreso({ paso: "esquema" });

    // 3. Carga previa?
    const previa = await db.query<{ sha256: string }>(
        "SELECT sha256 FROM carga_canonica WHERE id = 1"
    );

    if (previa.rows.length > 0) {

        if (previa.rows[0]!.sha256 !== paquete.huella) {
            throw new ErrorCarga(
                "CARGA_PREVIA_DISTINTA",
                "La base ya contiene una carga canonica con otra huella "
                + "SHA-256. El paquete canonico no se altera ni se mezcla: "
                + "use una base vacia (npm run cargar -- --reiniciar)."
            );
        }

        const resultado = await leerConteos(db, paquete.huella, "ya_cargado");
        progreso({ paso: "conteos", resultado });
        return resultado;
    }

    // 4. Carga atomica.
    progreso({ paso: "cargando" });
    await db.transaccion((tx) => insertarPaquete(tx, paquete));

    const resultado = await leerConteos(db, paquete.huella, "cargado");
    progreso({ paso: "conteos", resultado });
    return resultado;
}

async function insertarPaquete(
    tx: Consulta,
    paquete: PaqueteCanonico
): Promise<void> {

    const { eventos, asesores, politicas } = paquete;

    const clientes = eventos.filter(
        (e): e is EventoClienteT => e.tipo === "CLIENTE"
    );
    const creditos = eventos.filter(
        (e): e is EventoDesembolsoT => e.tipo === "DESEMBOLSO"
    );
    const pagos = eventos.filter(
        (e): e is EventoPagoT => e.tipo === "PAGO"
    );

    // Primera aparicion de cada clave = aplicado; las siguientes, no.
    const vistas = new Set<string>();
    const aplicado = pagos.map((p) => {
        const nueva = !vistas.has(p.clave_idempotencia);
        vistas.add(p.clave_idempotencia);
        return nueva;
    });

    // Orden de insercion = orden de seq (los clientes preceden a sus
    // creditos y los creditos a sus pagos; las llaves foraneas lo
    // verifican). WITH ORDINALITY + ORDER BY fija el orden en que la
    // base asigna los identificadores.

    await tx.query(
        `INSERT INTO asesores (id_asesor, nombre_completo)
         SELECT * FROM unnest($1::text[], $2::text[])`,
        [asesores.map((a) => a.id_asesor), asesores.map((a) => a.nombre_completo)]
    );

    await tx.query(
        `INSERT INTO eventos (seq, tipo, payload)
         SELECT seq, tipo, payload::jsonb
         FROM unnest($1::int[], $2::text[], $3::text[]) AS t(seq, tipo, payload)`,
        [
            eventos.map((e) => e.seq),
            eventos.map((e) => e.tipo),
            eventos.map((e) => JSON.stringify(e))
        ]
    );

    await tx.query(
        `INSERT INTO clientes
             (id_cliente, nombre_completo, dpi, telefono, municipio, fecha_alta)
         SELECT * FROM unnest(
             $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::date[])`,
        [
            clientes.map((c) => c.id_cliente),
            clientes.map((c) => c.nombre_completo),
            clientes.map((c) => c.dpi),
            clientes.map((c) => c.telefono),
            clientes.map((c) => c.municipio),
            clientes.map((c) => c.fecha_alta)
        ]
    );

    await tx.query(
        `INSERT INTO creditos
             (id_credito, id_cliente, id_asesor, fecha_desembolso,
              capital_centavos, plazo_meses, tna_bps, reestructurado)
         SELECT * FROM unnest(
             $1::text[], $2::text[], $3::text[], $4::date[],
             $5::int[], $6::int[], $7::int[], $8::boolean[])`,
        [
            creditos.map((c) => c.id_credito),
            creditos.map((c) => c.id_cliente),
            creditos.map((c) => c.id_asesor),
            creditos.map((c) => c.fecha),
            creditos.map((c) => c.capital_centavos),
            creditos.map((c) => c.plazo_meses),
            creditos.map((c) => c.tna_bps),
            creditos.map((c) => c.reestructurado)
        ]
    );

    await tx.query(
        `INSERT INTO pagos
             (seq_evento, clave_idempotencia, id_credito, fecha,
              monto_centavos, canal, aplicado)
         SELECT seq_evento, clave, id_credito, fecha, monto, canal, aplicado
         FROM unnest(
             $1::int[], $2::text[], $3::text[], $4::date[],
             $5::int[], $6::text[], $7::boolean[])
             WITH ORDINALITY AS t(seq_evento, clave, id_credito, fecha,
                                  monto, canal, aplicado, ord)
         ORDER BY ord`,
        [
            pagos.map((p) => p.seq),
            pagos.map((p) => p.clave_idempotencia),
            pagos.map((p) => p.id_credito),
            pagos.map((p) => p.fecha),
            pagos.map((p) => p.monto_centavos),
            pagos.map((p) => p.canal),
            aplicado
        ]
    );

    await tx.query(
        `INSERT INTO politicas_mora (id, definicion)
         SELECT id, definicion::jsonb FROM unnest($1::text[], $2::text[])
             AS t(id, definicion)`,
        [
            Object.keys(politicas.politicas_mora),
            Object.values(politicas.politicas_mora).map((d) => JSON.stringify(d))
        ]
    );

    const parametros: Record<string, unknown> = {
        version: politicas.version,
        moneda: politicas.moneda,
        base_conteo: politicas.base_conteo,
        gasto_gestion_cobro: politicas.gasto_gestion_cobro,
        regla_incobrable_dias: politicas.regla_incobrable_dias,
        regla_riesgo_dias: politicas.regla_riesgo_dias
    };

    await tx.query(
        `INSERT INTO parametros (clave, valor)
         SELECT clave, valor::jsonb FROM unnest($1::text[], $2::text[])
             AS t(clave, valor)`,
        [
            Object.keys(parametros),
            Object.values(parametros).map((v) => JSON.stringify(v))
        ]
    );

    // Verificacion de conteos contra la propia bitacora: si no cuadra,
    // se lanza y la transaccion completa se deshace.
    const esperado = {
        clientes: clientes.length,
        creditos: creditos.length,
        pagos: pagos.length
    };

    const real = await contar(tx);

    for (const k of ["clientes", "creditos", "pagos"] as const) {
        if (real[k] !== esperado[k]) {
            throw new ErrorCarga(
                "CONTEO_INESPERADO",
                `Tras la carga, '${k}' tiene ${real[k]} filas y la `
                + `bitacora ${esperado[k]}. Se deshizo la carga.`
            );
        }
    }

    await tx.query(
        `INSERT INTO carga_canonica
             (id, sha256, clientes, creditos, pagos, pagos_aplicados)
         VALUES (1, $1, $2, $3, $4, $5)`,
        [paquete.huella, real.clientes, real.creditos, real.pagos, real.pagosAplicados]
    );
}

async function contar(tx: Consulta) {

    const r = await tx.query<{
        clientes: number; creditos: number; pagos: number; aplicados: number;
    }>(`
        SELECT
            (SELECT count(*) FROM clientes)::int             AS clientes,
            (SELECT count(*) FROM creditos)::int             AS creditos,
            (SELECT count(*) FROM pagos)::int                AS pagos,
            (SELECT count(*) FROM pagos WHERE aplicado)::int AS aplicados
    `);

    const f = r.rows[0]!;

    return {
        clientes: f.clientes,
        creditos: f.creditos,
        pagos: f.pagos,
        pagosAplicados: f.aplicados
    };
}

async function leerConteos(
    db: Consulta,
    huella: string,
    estado: EstadoCarga
): Promise<ResultadoCarga> {

    const c = await contar(db);

    return {
        estado,
        huella,
        clientes: c.clientes,
        creditos: c.creditos,
        pagos: c.pagos,
        pagosAplicados: c.pagosAplicados,
        pagosDuplicados: c.pagos - c.pagosAplicados
    };
}
