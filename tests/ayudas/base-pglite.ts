import { PGlite } from "@electric-sql/pglite";

import type { BaseDatos, Consulta } from "../../src/persistencia/base-datos";

/**
 * Base de datos de PRUEBAS: PostgreSQL embebido (PGlite) en memoria.
 *
 * Es Postgres real (llaves foraneas, indices unicos parciales,
 * transacciones), asi que las pruebas ejercitan el mismo SQL que correra
 * contra Supabase, pero sin red ni credenciales. Es la contraparte, para
 * la base, de lo que RepositorioCarteraCsv es para el repositorio.
 *
 * NUNCA debe apuntar a la base real: vive solo en memoria.
 */
export async function crearBasePGlite(): Promise<BaseDatos> {

    const pg = new PGlite();
    await pg.waitReady;

    const consulta: Consulta["query"] = async <T>(
        sql: string,
        parametros?: readonly unknown[]
    ) => {
        const r = await pg.query<T>(sql, parametros as unknown[] | undefined);
        return { rows: r.rows };
    };

    return {
        query: consulta,

        ejecutar: async (sql) => {
            await pg.exec(sql);
        },

        transaccion: (trabajo) =>
            pg.transaction((tx) => trabajo({
                query: async <T>(
                    sql: string,
                    parametros?: readonly unknown[]
                ) => {
                    const r = await tx.query<T>(
                        sql, parametros as unknown[] | undefined
                    );
                    return { rows: r.rows };
                }
            })),

        cerrar: () => pg.close()
    };
}
