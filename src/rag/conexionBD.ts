
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

let pool: Pool | undefined;

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

  const rutaCertificado = path.resolve(
    process.cwd(),
    "certificados",
    "prod-ca-2021.crt"
  );

  const certificado = readFileSync(
    rutaCertificado,
    "utf8"
  );

  // Evitar conflictos entre los parámetros SSL de la URL
  // y la configuración TLS explícita de pg.
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslcert");
  url.searchParams.delete("sslkey");
  url.searchParams.delete("sslrootcert");

  pool = new Pool({
    connectionString: url.toString(),
    ssl: {
      ca: certificado,
      rejectUnauthorized: true,
    },
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
