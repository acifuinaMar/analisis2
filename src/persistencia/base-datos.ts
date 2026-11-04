import type { Pool } from "pg";

import { obtenerPool, cerrarPool } from "../rag/conexionBD";
import { ESQUEMA_SQL, TABLAS_CARTERA } from "./esquema";

/**
 * Acceso a la base de datos (E2).
 *
 * El cargador y el adaptador del repositorio dependen de ESTA interfaz,
 * no de `pg` ni de PGlite. Tiene dos implementaciones:
 *
 *  - `abrirBaseDatos()`  -> PostgreSQL real (Supabase) con `pg`, usando
 *    el mismo pool y la misma configuracion TLS que el modulo del RAG
 *    (variable DATABASE_URL). Es la que usan la aplicacion y el video.
 *  - `tests/ayudas/base-pglite.ts` -> PostgreSQL embebido en memoria,
 *    solo para pruebas: corren con `npm test`, sin red ni credenciales.
 *
 * Es el mismo patron del repositorio de cartera (puerto + adaptadores):
 * cambiar el origen no obliga a cambiar a quien lo usa.
 */

export interface Consulta {
    query<T = Record<string, unknown>>(
        sql: string,
        parametros?: readonly unknown[]
    ): Promise<{ rows: T[] }>;
}

export interface BaseDatos extends Consulta {

    /**
     * Ejecuta `trabajo` dentro de una transaccion: si lanza, se
     * deshace todo; si termina, se confirma.
     */
    transaccion<T>(trabajo: (tx: Consulta) => Promise<T>): Promise<T>;

    /** Ejecuta sentencias sin parametros (DDL). */
    ejecutar(sql: string): Promise<void>;

    cerrar(): Promise<void>;
}

/** Envuelve un pool de `pg` en la interfaz BaseDatos. */
export function baseDatosDesdePool(
    pool: Pool,
    alCerrar: () => Promise<void> = () => pool.end()
): BaseDatos {

    const consulta: Consulta["query"] = async <T>(
        sql: string,
        parametros?: readonly unknown[]
    ) => {
        const r = await pool.query(sql, parametros as unknown[] | undefined);
        return { rows: r.rows as T[] };
    };

    return {
        query: consulta,

        ejecutar: async (sql) => {
            await pool.query(sql);
        },

        transaccion: async (trabajo) => {
            const cliente = await pool.connect();
            try {
                await cliente.query("BEGIN");
                const resultado = await trabajo({
                    query: async <T>(
                        sql: string,
                        parametros?: readonly unknown[]
                    ) => {
                        const r = await cliente.query(
                            sql, parametros as unknown[] | undefined
                        );
                        return { rows: r.rows as T[] };
                    }
                });
                await cliente.query("COMMIT");
                return resultado;
            } catch (error) {
                await cliente.query("ROLLBACK").catch(() => undefined);
                throw error;
            } finally {
                cliente.release();
            }
        },

        cerrar: alCerrar
    };
}

/** Abre la base real (DATABASE_URL). */
export function abrirBaseDatos(): BaseDatos {
    return baseDatosDesdePool(obtenerPool(), cerrarPool);
}

/** Aplica el esquema de la cartera. Es idempotente. */
export async function aplicarEsquema(db: BaseDatos): Promise<void> {
    await db.ejecutar(ESQUEMA_SQL);
}

/**
 * Borra SOLO las tablas de la cartera. No toca rag_fragmentos ni nada
 * que no haya creado este modulo. Es lo que usa `--reiniciar` para dejar
 * "la base vacia" sin destruir el RAG.
 */
export async function reiniciarCartera(db: BaseDatos): Promise<void> {
    await db.ejecutar(
        `DROP TABLE IF EXISTS ${TABLAS_CARTERA.join(", ")} CASCADE`
    );
}
