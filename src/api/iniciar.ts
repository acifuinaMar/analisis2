import { RepositorioCarteraPostgres } from "../adaptadores/repositorio-cartera-postgres";
import { abrirBaseDatos } from "../persistencia/base-datos";
import { crearApp } from "./app";

/**
 * Punto de arranque de la API (composition root).
 *
 *   npm run api
 *
 * Aqui, y solo aqui, se decide QUE adaptadores usa la aplicacion: la
 * cartera sale de PostgreSQL (DATABASE_URL). El resto del codigo depende
 * del puerto RepositorioCartera y no sabe de donde vienen los datos.
 *
 * Variables de entorno (ver .env.example):
 *   DATABASE_URL  Cadena de conexion a PostgreSQL (obligatoria).
 *   PORT          Puerto de escucha (por defecto 3000).
 *   HOST          Interfaz de escucha (por defecto 127.0.0.1).
 *
 * Escucha solo en la maquina local por defecto: el perfil por
 * encabezado no es autenticacion, asi que no conviene exponer la API a
 * toda la red. Para probar desde un telefono, sirva la interfaz con el
 * servidor de Vite, que reenvia /api a este proceso.
 */
async function principal(): Promise<void> {

    const puerto = Number(process.env.PORT ?? 3000);
    const host = process.env.HOST ?? "127.0.0.1";

    const db = abrirBaseDatos();

    try {
        const carga = await db.query("SELECT 1 FROM carga_canonica WHERE id = 1");

        if (carga.rows.length === 0) {
            throw new Error("vacia");
        }
    } catch {
        await db.cerrar();
        console.error(
            "La base de datos no tiene la cartera cargada.\n"
            + "Ejecute primero: npm run cargar"
        );
        process.exit(1);
    }

    const app = crearApp({ repositorio: new RepositorioCarteraPostgres(db) });

    const servidor = app.listen(puerto, host, () => {
        console.log(`API de Credito Vecino escuchando en http://${host}:${puerto}`);
    });

    const apagar = () => {
        servidor.close(async () => {
            await db.cerrar();
            process.exit(0);
        });
    };

    process.on("SIGINT", apagar);
    process.on("SIGTERM", apagar);
}

principal().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});
