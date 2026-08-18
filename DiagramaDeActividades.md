# Diagrama de actividades

# AD-01-Originación del Crédito
@startuml
title AD-01 - Originación del Crédito

skinparam Shadowing false
skinparam ActivityBorderColor Black
skinparam ActivityBackgroundColor White
skinparam DiamondBackgroundColor White
skinparam DiamondBorderColor Black

start

partition Cliente {

    :Solicitar crédito;

}

partition Sistema {

    :Registrar solicitud;

}

partition "Analista / Gerente" {

    :Evaluar solicitud;

    if (¿Solicitud aprobada?) then (Sí)

    else (No)

        :Rechazar solicitud;

        stop

    endif

}

partition Sistema {

    :Desembolsar crédito;

    :Crear entidad Crédito;

    :Crear entidad Plan de Amortización;

    :Generar Cuotas;

    :Notificar al Cliente;

}

stop

@enduml