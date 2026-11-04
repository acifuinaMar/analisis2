
import { cerrarPool, obtenerPool } from "./conexionBD";

async function main(): Promise<void> {
  console.log("Conectando con PostgreSQL...");
    const url = new URL(process.env.DATABASE_URL ?? "");

    console.log("Usuario configurado:", decodeURIComponent(url.username));
    console.log("Servidor configurado:", url.hostname);
    console.log("Puerto configurado:", url.port);
    console.log("Base de datos:", url.pathname);
  const pool = obtenerPool();

  const resultado = await pool.query<{
    base_datos: string;
    version_vector: string;
    total_fragmentos: string;
  }>(`
    SELECT
      current_database() AS base_datos,
      (
        SELECT extversion
        FROM pg_extension
        WHERE extname = 'vector'
      ) AS version_vector,
      (
        SELECT COUNT(*)::text
        FROM public.rag_fragmentos
      ) AS total_fragmentos
  `);

  const datos = resultado.rows[0];

  console.log("Conexión exitosa.");
  console.log("Base de datos:", datos.base_datos);
  console.log("pgvector:", datos.version_vector);
  console.log("Fragmentos almacenados:", datos.total_fragmentos);
}

main()
  .catch((error: unknown) => {
    console.error(
      "Error de conexión:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await cerrarPool();
  });
