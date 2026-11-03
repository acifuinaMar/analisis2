import { useNavegar } from "../../app/enrutador";
import { useSesion } from "../../estado/sesion";
import { SelectorFechaCorte } from "../../layouts/SelectorFechaCorte";
import { Aviso, Boton, EncabezadoPagina, ListaDatos, Tarjeta } from "../../ui";
import { formatoFechaLarga } from "../../utilidades/formato";

/** Ajustes de la sesión de demostración: perfil y fecha de corte. */
export function MasAsesor() {
    const { perfil, fechaCorte, salir } = useSesion();
    const navegar = useNavegar();

    return (
        <div className="space-y-5">
            <EncabezadoPagina titulo="Más" subtitulo="Perfil y fecha de corte de esta sesión." />

            <Tarjeta className="p-4">
                <ListaDatos
                    pares={[
                        { etiqueta: "Perfil", valor: perfil === "asesor" ? "Asesor de campo" : "—" },
                        { etiqueta: "Fecha de corte", valor: formatoFechaLarga(fechaCorte) }
                    ]}
                />
                <div className="mt-3">
                    <SelectorFechaCorte />
                </div>
            </Tarjeta>

            <Aviso tipo="info" titulo="Perfil de demostración">
                El perfil se elige, no se demuestra: no es un inicio de sesión. El servidor verifica en cada operación
                qué puede hacer cada perfil.
            </Aviso>

            <Boton
                variante="secundario"
                icono="salir"
                bloque
                onClick={() => {
                    salir();
                    navegar("/perfil", { reemplazar: true });
                }}
            >
                Cambiar perfil
            </Boton>
        </div>
    );
}
