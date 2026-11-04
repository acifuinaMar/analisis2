import { useState, type ReactNode } from "react";

import { MensajeChat } from "../chat/MensajeChat";
import { TarjetaAprobacion, type VistaPreviaPago } from "../chat/TarjetaAprobacion";
import {
    Aviso,
    Boton,
    Buscador,
    CampoSeleccion,
    CampoTexto,
    Cargando,
    Chip,
    ChipEstado,
    ChipTramo,
    CifraDestacada,
    Dato,
    Desglose,
    Dialogo,
    EncabezadoPagina,
    EncabezadoTarjeta,
    Esqueleto,
    EstadoVacio,
    GraficaBarras,
    ListaDatos,
    Pasos,
    Pestanas,
    RejillaDatos,
    Tabla,
    Tarjeta,
    TarjetaIndicador
} from "../ui";
import { CANALES_PAGO, etiquetaTramoConExplicacion } from "../utilidades/etiquetas";
import { formatoPorcentaje, formatoQuetzales } from "../utilidades/formato";

/**
 * Galería de componentes (solo en desarrollo: `npm run dev`).
 *
 * Sirve para revisar la Fase 1 contra el prototipo. TODOS los valores de
 * esta página son de ejemplo, escritos a mano para ver el diseño; no
 * salen del núcleo ni deben copiarse a ninguna pantalla. La ruta no
 * existe en la compilación de producción.
 */

// Valores de ejemplo, deliberadamente redondos para que no se confundan
// con cifras reales de la cartera.
const EJ = {
    a: 1000,
    b: 250.5,
    c: 12.25,
    d: 0.1234
};

const VISTA_EJEMPLO: VistaPreviaPago = {
    idCredito: "CV-0000-0000",
    nombreCliente: "Cliente de ejemplo",
    fechaOperacion: "2026-10-31",
    claveIdempotencia: "EJEMPLO-0001",
    cuotasCubiertas: [1],
    desglosePrelacion: { gastos: 0, interesMoratorio: EJ.c, interesCorriente: EJ.b, capital: EJ.a, total: 1262.75 },
    estadoAntes: { estado: "en_mora", diasAtraso: 10, saldoCapital: 5000 }
};

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
    return (
        <section className="space-y-3">
            <h2 className="border-b border-borde pb-2 text-lg font-semibold text-texto">{titulo}</h2>
            {children}
        </section>
    );
}

export function Componentes() {
    const [pestana, setPestana] = useState<"diario" | "mensual">("mensual");
    const [busqueda, setBusqueda] = useState("");
    const [dialogo, setDialogo] = useState(false);

    return (
        <div className="space-y-10">
            <EncabezadoPagina
                titulo="Componentes"
                subtitulo="Galería de la Fase 1 para revisar el diseño contra el prototipo."
            />

            <Aviso tipo="alerta" titulo="Datos de ejemplo">
                Todas las cifras de esta página están escritas a mano para revisar el diseño. No provienen del núcleo.
                Esta ruta solo existe en desarrollo.
            </Aviso>

            <Seccion titulo="Botones">
                <div className="flex flex-wrap gap-2">
                    <Boton icono="tarjeta">Registrar pago</Boton>
                    <Boton variante="secundario" icono="documento">Comprobante</Boton>
                    <Boton variante="fantasma">Ver todos</Boton>
                    <Boton variante="peligro">Rechazar</Boton>
                    <Boton cargando>Enviando</Boton>
                    <Boton disabled>Deshabilitado</Boton>
                </div>
                <div className="max-w-sm"><Boton tamano="lg" bloque>Siguiente</Boton></div>
            </Seccion>

            <Seccion titulo="Chips de estado y tramo">
                <div className="flex flex-wrap gap-2">
                    {["vigente", "en_mora", "reestructurado", "cancelado", "incobrable"].map(e => <ChipEstado key={e} estado={e} />)}
                </div>
                <div className="flex flex-wrap gap-2">
                    {["al_dia", "mora_1", "mora_2", "mora_3", "vencido"].map(t => <ChipTramo key={t} tramo={t} />)}
                    <Chip variante="alerta">Seguimiento</Chip>
                </div>
                <p className="text-sm text-texto-suave">{etiquetaTramoConExplicacion("mora_2")}</p>
            </Seccion>

            <Seccion titulo="Indicadores del tablero">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <TarjetaIndicador etiqueta="Cartera activa" valor={formatoQuetzales(EJ.a * 100)} icono="clientes" variante="marca" detalle="Ejemplo" />
                    <TarjetaIndicador etiqueta="Cartera en mora" valor={formatoQuetzales(EJ.a)} icono="documento" variante="info" detalle={formatoPorcentaje(EJ.d)} />
                    <TarjetaIndicador etiqueta="Cartera en riesgo" valor={formatoQuetzales(EJ.a * 2)} icono="base" variante="alerta" detalle={formatoPorcentaje(EJ.d)} />
                    <TarjetaIndicador etiqueta="Incobrable del mes" valor={formatoQuetzales(0)} icono="alerta" variante="peligro" />
                </div>
                <div className="grid max-w-md grid-cols-2 gap-3">
                    <Dato etiqueta="Saldo pendiente" valor={formatoQuetzales(EJ.a)} />
                    <Dato etiqueta="Cuotas pagadas" valor="1 de 12" />
                    <Dato etiqueta="Próxima cuota" valor={formatoQuetzales(EJ.b)} detalle="31/10/2026" />
                    <Dato etiqueta="Estado actual" valor="En mora" enfasis="peligro" />
                </div>
                <Tarjeta className="max-w-md space-y-4 p-4">
                    <CifraDestacada etiqueta="Monto solicitado" valor={formatoQuetzales(EJ.a)} />
                    <RejillaDatos pares={[
                        { etiqueta: "Monto original", valor: formatoQuetzales(EJ.a) },
                        { etiqueta: "Tasa anual", valor: "36 % nominal" },
                        { etiqueta: "Plazo", valor: "12 meses" }
                    ]} />
                </Tarjeta>
            </Seccion>

            <Seccion titulo="Desglose, lista y tabla">
                <div className="grid gap-4 lg:grid-cols-2">
                    <Desglose
                        titulo="Desglose de la prelación"
                        lineas={[
                            { concepto: "Gastos de gestión", monto: formatoQuetzales(0) },
                            { concepto: "Interés moratorio", monto: formatoQuetzales(EJ.c) },
                            { concepto: "Interés corriente", monto: formatoQuetzales(EJ.b) },
                            { concepto: "Capital", monto: formatoQuetzales(EJ.a) }
                        ]}
                        total={{ concepto: "Total a pagar", monto: formatoQuetzales(1262.75) }}
                    />
                    <Tarjeta className="p-4">
                        <EncabezadoTarjeta titulo="Comprobante" separador />
                        <ListaDatos pares={[
                            { etiqueta: "Crédito", valor: "CV-0000-0000" },
                            { etiqueta: "Monto pagado", valor: formatoQuetzales(EJ.a), enfasis: true },
                            { etiqueta: "Medio de pago", valor: CANALES_PAGO[0].etiqueta }
                        ]} />
                    </Tarjeta>
                </div>
                <Tabla
                    titulo="Tabla de ejemplo"
                    columnas={[
                        { clave: "c", titulo: "Cliente", celda: (f: { c: string; s: number; d: number; t: string }) => f.c },
                        { clave: "s", titulo: "Saldo", numerica: true, celda: f => <strong>{formatoQuetzales(f.s)}</strong> },
                        { clave: "d", titulo: "Días de atraso", numerica: true, celda: f => f.d },
                        { clave: "t", titulo: "Tramo", celda: f => <ChipTramo tramo={f.t} />, ocultarEnMovil: true }
                    ]}
                    filas={[
                        { c: "Cliente de ejemplo A", s: EJ.a, d: 35, t: "mora_2" },
                        { c: "Cliente de ejemplo B", s: EJ.b, d: 5, t: "mora_1" }
                    ]}
                    claveFila={f => f.c}
                />
            </Seccion>

            <Seccion titulo="Navegación: pasos, pestañas">
                <Tarjeta className="max-w-md p-4"><Pasos pasos={["Datos", "Revisión", "Resultado"]} actual={1} /></Tarjeta>
                <div className="max-w-sm">
                    <Pestanas etiqueta="Tipo de cierre" valor={pestana} alCambiar={setPestana} opciones={[
                        { valor: "diario", etiqueta: "Diario" },
                        { valor: "mensual", etiqueta: "Mensual" }
                    ]} />
                </div>
            </Seccion>

            <Seccion titulo="Avisos">
                <Aviso tipo="info">La mora se calcula por tramos de 30 días, con una tasa según el nivel de atraso.</Aviso>
                <Aviso tipo="exito" titulo="Pago aplicado">El crédito quedó al día.</Aviso>
                <Aviso tipo="peligro" titulo="Monto no exacto">El monto correcto lo indica el servidor en el rechazo.</Aviso>
            </Seccion>

            <Seccion titulo="Formulario">
                <div className="grid max-w-xl gap-4 sm:grid-cols-2">
                    <CampoTexto etiqueta="Monto a pagar" prefijo="Q" inputMode="decimal" placeholder="0.00" />
                    <CampoTexto etiqueta="Fecha de pago" type="date" defaultValue="2026-10-31" />
                    <CampoSeleccion etiqueta="Medio de pago" opciones={CANALES_PAGO.map(c => ({ valor: c.valor, etiqueta: c.etiqueta }))} />
                    <CampoTexto etiqueta="Identificador del cliente" error="Use la forma CL-NNNN." defaultValue="CL-9" />
                </div>
                <div className="max-w-xl">
                    <Buscador valor={busqueda} alCambiar={setBusqueda} alBuscar={() => undefined} etiqueta="Buscar cliente" marcador="Ingrese DPI, nombre o número de cliente" textoBoton="Buscar" />
                </div>
                <Boton variante="secundario" onClick={() => setDialogo(true)}>Abrir diálogo</Boton>
                <Dialogo
                    abierto={dialogo}
                    titulo="Confirmar"
                    alCerrar={() => setDialogo(false)}
                    acciones={<>
                        <Boton variante="secundario" onClick={() => setDialogo(false)}>Cancelar</Boton>
                        <Boton onClick={() => setDialogo(false)}>Aceptar</Boton>
                    </>}
                >
                    <p className="text-sm text-texto-medio">Diálogo modal nativo: cierra con Escape y devuelve el foco.</p>
                </Dialogo>
            </Seccion>

            <Seccion titulo="Gráfica">
                <Tarjeta className="max-w-lg p-5">
                    <EncabezadoTarjeta titulo="Saldo por tramo (ejemplo)" className="mb-4" />
                    <GraficaBarras titulo="Saldo por tramo (ejemplo)" barras={[
                        { etiqueta: "Mora 1", valor: 3, rotulo: "3" },
                        { etiqueta: "Mora 2", valor: 5, rotulo: "5" },
                        { etiqueta: "Mora 3", valor: 2, rotulo: "2" },
                        { etiqueta: "Vencido", valor: 8, rotulo: "8", destacada: true }
                    ]} />
                </Tarjeta>
            </Seccion>

            <Seccion titulo="Estados">
                <div className="grid gap-4 lg:grid-cols-3">
                    <Tarjeta className="space-y-2 p-4"><Esqueleto className="h-4 w-24" /><Esqueleto className="h-7 w-40" /></Tarjeta>
                    <Tarjeta><Cargando /></Tarjeta>
                    <EstadoVacio titulo="Sin créditos en este tramo">No hay créditos con ese atraso a la fecha de corte.</EstadoVacio>
                </div>
            </Seccion>

            <Seccion titulo="Chat (asistente)">
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-3 rounded-tarjeta bg-fondo p-4 ring-1 ring-borde">
                        <MensajeChat papel="usuario" texto="Pregunta de ejemplo sobre un crédito." />
                        <MensajeChat papel="asistente" texto="Respuesta de ejemplo del asistente." herramientas={["consultar_credito", "explicar_mora"]} />
                        <p className="text-xs font-semibold text-texto-suave">Perfil asesor: puede aprobar</p>
                        <TarjetaAprobacion vista={VISTA_EJEMPLO} puedeAprobar alAprobar={() => undefined} alRechazar={() => undefined} />
                    </div>
                    <div className="space-y-3 rounded-tarjeta bg-fondo p-4 ring-1 ring-borde">
                        <p className="text-xs font-semibold text-texto-suave">Perfil gerencia: solo revisa el desglose</p>
                        <TarjetaAprobacion vista={VISTA_EJEMPLO} puedeAprobar={false} alRechazar={() => undefined} />
                    </div>
                </div>
            </Seccion>
        </div>
    );
}
