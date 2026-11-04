/**
 * Esquema de la cartera (E2).
 *
 * Una sola base guarda los datos del sistema Y los vectores del RAG
 * (seccion 4 del enunciado). Las tablas del RAG (rag_fragmentos) las
 * crea y mantiene el modulo src/rag: este esquema NO las toca, para no
 * pisar lo que ya existe en la base compartida.
 *
 * Decisiones de modelado:
 *
 * - Dinero siempre en centavos enteros (ADR-002), nunca NUMERIC ni float.
 * - Tasas en puntos basicos (tna_bps), como en el contrato de datos.
 * - `eventos` conserva la bitacora tal como llego: es la fuente de
 *   verdad y permite reconstruir la cartera reproduciendola. Las tablas
 *   clientes / creditos / pagos son su proyeccion relacional.
 * - Los saldos NO se guardan: son el resultado de acumular movimientos
 *   (regla de mayor, seccion 6.9 del P1). El estado de un credito lo
 *   reconstruye el nucleo reproduciendo sus pagos.
 * - La politica de mora de un credito NO es una columna: se deriva de su
 *   fecha de desembolso contra `politicas_mora` (datos, no constantes).
 * - Idempotencia de pagos reforzada en la base: el indice unico parcial
 *   impide dos pagos APLICADOS con la misma clave, aunque falle la capa
 *   de aplicacion (invariante 6.10).
 *
 * Todo es CREATE ... IF NOT EXISTS: aplicar el esquema dos veces es
 * inofensivo.
 */

/** Tablas de la cartera, en orden de borrado seguro (hijas primero). */
export const TABLAS_CARTERA = [
    "pagos",
    "creditos",
    "clientes",
    "asesores",
    "eventos",
    "politicas_mora",
    "parametros",
    "carga_canonica"
] as const;

export const ESQUEMA_SQL = `
-- Registro de la carga canonica (una sola fila: id = 1).
CREATE TABLE IF NOT EXISTS carga_canonica (
    id               SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    sha256           TEXT        NOT NULL,
    cargado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    clientes         INTEGER     NOT NULL,
    creditos         INTEGER     NOT NULL,
    pagos            INTEGER     NOT NULL,
    pagos_aplicados  INTEGER     NOT NULL
);

-- Bitacora de eventos: fuente de verdad.
CREATE TABLE IF NOT EXISTS eventos (
    seq      INTEGER PRIMARY KEY,
    tipo     TEXT    NOT NULL CHECK (tipo IN ('CLIENTE', 'DESEMBOLSO', 'PAGO')),
    payload  JSONB   NOT NULL
);

CREATE TABLE IF NOT EXISTS asesores (
    id_asesor        TEXT PRIMARY KEY,
    nombre_completo  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clientes (
    id_cliente       TEXT PRIMARY KEY,
    nombre_completo  TEXT NOT NULL,
    dpi              TEXT NOT NULL UNIQUE,
    telefono         TEXT NOT NULL,
    municipio        TEXT NOT NULL,
    fecha_alta       DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS creditos (
    id_credito        TEXT    PRIMARY KEY,
    id_cliente        TEXT    NOT NULL REFERENCES clientes (id_cliente),
    id_asesor         TEXT    NOT NULL REFERENCES asesores (id_asesor),
    fecha_desembolso  DATE    NOT NULL,
    capital_centavos  INTEGER NOT NULL CHECK (capital_centavos > 0),
    plazo_meses       INTEGER NOT NULL CHECK (plazo_meses > 0),
    tna_bps           INTEGER NOT NULL CHECK (tna_bps >= 0),
    reestructurado    BOOLEAN NOT NULL
);
CREATE INDEX IF NOT EXISTS creditos_cliente_idx ON creditos (id_cliente);

-- Pagos. 'id' es propio de la tabla (los pagos nuevos que entren por la
-- interfaz lo generan solos); 'seq_evento' enlaza con la bitacora y es
-- NULL en pagos posteriores a la carga.
-- 'aplicado' = FALSE marca un evento repetido (misma clave de
-- idempotencia que uno anterior): se conserva para que el conteo de la
-- bitacora cuadre, pero no cuenta como pago ni mueve saldos (P1 6.10).
CREATE TABLE IF NOT EXISTS pagos (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    seq_evento          INTEGER UNIQUE REFERENCES eventos (seq),
    clave_idempotencia  TEXT    NOT NULL,
    id_credito          TEXT    NOT NULL REFERENCES creditos (id_credito),
    fecha               DATE    NOT NULL,
    monto_centavos      INTEGER NOT NULL CHECK (monto_centavos > 0),
    canal               TEXT    NOT NULL,
    aplicado            BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX IF NOT EXISTS pagos_clave_aplicada_uq
    ON pagos (clave_idempotencia) WHERE aplicado;
CREATE INDEX IF NOT EXISTS pagos_credito_idx ON pagos (id_credito, fecha);

-- Politicas y parametros: datos versionados, no constantes de codigo.
CREATE TABLE IF NOT EXISTS politicas_mora (
    id          TEXT  PRIMARY KEY,
    definicion  JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS parametros (
    clave  TEXT  PRIMARY KEY,
    valor  JSONB NOT NULL
);
`;
