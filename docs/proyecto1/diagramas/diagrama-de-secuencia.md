# Diagrama de secuencia

## SD-01-Registrar pago de Cuota
@startuml
title SD-01 - Registrar Pago de Cuota

skinparam Shadowing false
skinparam ResponseMessageBelowArrow true

actor Cliente

boundary PagoController
control RegistrarPagoService

entity "credito:Credito" as Credito
entity "plan:PlanAmortizacion" as Plan
entity "pago:Pago" as Pago
entity "aplicacion:AplicacionPago" as Aplicacion
entity "evento:RegistroEvento" as Evento

Cliente -> PagoController : registrarPago(creditoId, monto)
activate PagoController

PagoController -> RegistrarPagoService : registrarPago(creditoId, monto)
activate RegistrarPagoService

RegistrarPagoService -> Credito : registrarPago(monto)
activate Credito

Credito -> Plan : registrarPago(monto)
activate Plan

create Pago
Plan -> Pago : <<create>>(monto)
activate Pago
Pago --> Plan
deactivate Pago

Plan -> Plan : calcularPrelacion()

alt Pago suficiente

    create Aplicacion
    Plan -> Aplicacion : <<create>>()
    activate Aplicacion
    Aplicacion --> Plan
    deactivate Aplicacion

    Plan -> Plan : actualizarCuotas()
    Plan -> Plan : recalcularSaldo()

else Pago parcial

    create Aplicacion
    Plan -> Aplicacion : <<create>>()
    activate Aplicacion
    Aplicacion --> Plan
    deactivate Aplicacion

    Plan -> Plan : actualizarCuotas()
    Plan -> Plan : recalcularSaldo()

end

Plan --> Credito : ResultadoPago
deactivate Plan

Credito -> Credito : actualizarEstado(resultadoPago)

create Evento
Credito -> Evento : <<create>>(resultadoPago)
activate Evento
Evento --> Credito
deactivate Evento

Credito --> RegistrarPagoService : Pago aplicado
deactivate Credito

RegistrarPagoService --> PagoController : Confirmación
deactivate RegistrarPagoService

PagoController --> Cliente : Pago registrado exitosamente
deactivate PagoController

@enduml

## SD-02- Solicitar y desembolsar crédito
@startuml
title SD-02 - Solicitar y Desembolsar Crédito

skinparam Shadowing false
skinparam ResponseMessageBelowArrow true

actor Cliente
actor "Analista / Gerente" as Analista

boundary SolicitudController
control SolicitarCreditoService

entity "solicitud:SolicitudCredito" as Solicitud
entity "credito:Credito" as Credito
entity "plan:PlanAmortizacion" as Plan
entity "cuota:Cuota" as Cuota

Cliente -> SolicitudController : solicitarCredito(datosSolicitud)
activate SolicitudController

SolicitudController -> SolicitarCreditoService : solicitarCredito(datosSolicitud)
activate SolicitarCreditoService

create Solicitud
SolicitarCreditoService -> Solicitud : <<create>>(datosSolicitud)
activate Solicitud

Solicitud --> SolicitarCreditoService : Solicitud creada

SolicitarCreditoService -> Analista : evaluarSolicitud(solicitud)

activate Analista

Analista --> SolicitarCreditoService : solicitudAprobada

deactivate Analista

SolicitarCreditoService -> Solicitud : desembolsar()
activate Solicitud

create Credito
Solicitud -> Credito : <<create>>()

activate Credito

create Plan
Credito -> Plan : <<create>>()

activate Plan

Plan -> Plan : generarCuotas()

loop Por cada cuota

    create Cuota

    Plan -> Cuota : <<create>>()

    activate Cuota

    Cuota --> Plan

    deactivate Cuota

end

Plan --> Credito : Plan generado

deactivate Plan

Credito --> Solicitud

deactivate Credito

Solicitud --> SolicitarCreditoService : Crédito creado

deactivate Solicitud

SolicitarCreditoService --> SolicitudController : Solicitud desembolsada

deactivate SolicitarCreditoService

SolicitudController --> Cliente : Crédito aprobado y desembolsado

deactivate SolicitudController

@enduml