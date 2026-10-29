import { BotonEnlace, EstadoVacio } from "../ui";

export function NoEncontrada({ inicio }: { inicio: string }) {
    return (
        <div className="flex min-h-[60dvh] items-center justify-center px-4">
            <EstadoVacio
                icono="alerta"
                titulo="Esta página no existe"
                accion={<BotonEnlace a={inicio} icono="inicio">Ir al inicio</BotonEnlace>}
            >
                Revise la dirección o vuelva al inicio de su perfil.
            </EstadoVacio>
        </div>
    );
}
