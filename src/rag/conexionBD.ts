
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

let pool: Pool | undefined;

/** Servidores en la propia maquina: el trafico no sale por la red. */
const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * TLS verificado contra el certificado de Supabase para todo servidor
 * remoto. Un PostgreSQL LOCAL (localhost) suele presentar un certificado
 * autofirmado que esa verificacion rechaza (DEPTH_ZERO_SELF_SIGNED_CERT),
 * y ademas el trafico no sale de la maquina, asi que ahi no se exige.
 * Un host remoto SIEMPRE usa TLS: no hay forma de desactivarlo por URL.
 */
export function debeUsarTls(url: URL): boolean {
  return !HOSTS_LOCALES.has(url.hostname);
}

export function obtenerPool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "Falta configurar DATABASE_URL en las variables de entorno."
    );
  }

  const url = new URL(connectionString);
  const usarTls = debeUsarTls(url);

  // Evitar conflictos entre los parámetros SSL de la URL
  // y la configuración TLS explícita de pg.
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslcert");
  url.searchParams.delete("sslkey");
  url.searchParams.delete("sslrootcert");

  let ssl: { ca: string; rejectUnauthorized: true } | false = false;

  if (usarTls) {
    const rutaCertificado = path.resolve(
      process.cwd(),
      "certificados",
      "prod-ca-2021.crt"
    );

    ssl = {
      ca: readFileSync(rutaCertificado, "utf8"),
      rejectUnauthorized: true,
    };
  }

  pool = new Pool({
    connectionString: url.toString(),
    ssl,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });

  return pool;
}

export async function cerrarPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
