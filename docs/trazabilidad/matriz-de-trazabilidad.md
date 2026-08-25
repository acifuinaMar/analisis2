# Matriz de Trazabilidad
Además de la trazabilidad solicitada entre requisitos, casos de uso y clases, se incorporan las columnas Actividad y Secuencia para evidenciar la consistencia entre todos los artefactos UML desarrollados durante el análisis.

| ID | Requisito | Caso de Uso | Actividad | Secuencia | Clase / Módulo |
|----|-----------|-------------|-----------|-----------|----------------|
| R1 | Registrar clientes | CU-01 – Registrarse | — | — | Cliente |
| R2 | Solicitar crédito | CU-01, CU-02 | AD-01 | SD-02 | SolicitudCredito |
| R3 | Evaluar solicitud | CU-01, CU-02 | AD-01 | SD-02 | SolicitudCredito |
| R4 | Aprobar/Rechazar solicitud | CU-01, CU-02 | AD-01 | SD-02 | SolicitudCredito |
| R5 | Desembolsar crédito | CU-01, CU-02 | AD-01 | SD-02 | Credito |
| R6 | Generar plan de amortización | CU-02 | AD-01 | SD-02 | PlanAmortizacion |
| R7 | Generar cuotas | CU-02 | AD-01 | SD-02 | Cuota |
| R8 | Registrar pago de cuota | CU-01, CU-03 | — | SD-01 | Pago |
| R9 | Aplicar prelación del pago | CU-03 | — | SD-01 | AplicacionPago, PlanAmortizacion |
| R10 | Actualizar estado del crédito | CU-03 | — | SD-01 | Credito |
| R11 | Registrar evento del pago | CU-03 | — | SD-01 | RegistroEvento |
| R12 | Solicitar reestructuración | CU-01, CU-03 | — | — | Credito |
| R13 | Reestructurar crédito | CU-01, CU-03 | — | — | PlanAmortizacion |
| R14 | Declarar crédito incobrable | CU-01, CU-03 | — | — | Credito |
| R15 | Generar cierre mensual | CU-01, CU-03 | — | — | RegistroEvento |
| R16 | Consultar cartera en riesgo | CU-01, CU-03 | — | — | Credito |
| R17 | Consultar reportes | CU-01, CU-03 | — | — | RegistroEvento |
| R18 | Administrar usuarios | CU-01 | — | — | Usuario |
| R19 | Administrar catálogos | CU-01 | — | — | Catalogos |