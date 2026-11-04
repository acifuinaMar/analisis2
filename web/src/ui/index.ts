/**
 * Componentes visuales reutilizables del prototipo (Figma de alta
 * fidelidad, docs/proyecto2/E5/img). Ninguno consulta la API ni calcula
 * cifras: reciben datos ya listos y solo los presentan.
 */
export { Aviso, AvisoError } from "./Aviso";
export { Boton, BotonEnlace, type VarianteBoton } from "./Boton";
export { Buscador, Campo, CampoAreaTexto, CampoSeleccion, CampoTexto } from "./Campos";
export { Chip, ChipEstado, ChipTramo } from "./Chip";
export { cx } from "./clases";
export { Dialogo } from "./Dialogo";
export { EncabezadoPagina } from "./EncabezadoPagina";
export { Cargando, EstadoVacio, Esqueleto } from "./Estados";
export { GraficaBarras, type Barra } from "./GraficaBarras";
export { Icono, type NombreIcono } from "./Icono";
export { CifraDestacada, Dato, TarjetaIndicador } from "./Indicadores";
export { Desglose, ListaDatos, RejillaDatos, type LineaDesglose, type Par } from "./Listas";
export { Avatar, Logotipo } from "./Marca";
export { Migas, Pasos, Pestanas, type OpcionPestana } from "./Navegacion";
export { Tabla, type Columna } from "./Tabla";
export { EncabezadoTarjeta, Tarjeta, TituloSeccion } from "./Tarjeta";
