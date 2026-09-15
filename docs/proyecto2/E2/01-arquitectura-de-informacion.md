# E2 · Arquitectura de Información
# Tabla de Correspondencia Pantalla ↔ Caso de Uso

## Introducción

La siguiente tabla establece la correspondencia entre los casos de uso definidos durante el Proyecto 1 y las pantallas que los implementarán en la interfaz de usuario propuesta para el Proyecto 2.

Las pantallas fueron diseñadas tomando como referencia las personas definidas durante la investigación de usuarios (E1). Esto permite que la arquitectura de información responda a necesidades reales de cada perfil de usuario y no únicamente a la estructura funcional del sistema.

Es importante señalar que algunos aspectos del negocio, como el mecanismo mediante el cual se aprueba una solicitud de crédito (evaluación humana, algoritmo o un proceso híbrido), aún no han sido definidos. En consecuencia, esta propuesta evita asumir decisiones funcionales que no forman parte del alcance actual del proyecto y únicamente modela las funcionalidades confirmadas.

Asimismo, la correspondencia entre pantallas y casos de uso no necesariamente es uno a uno. Un mismo caso de uso puede materializarse en varias pantallas cuando el flujo de interacción así lo requiera, mientras que una sola pantalla puede implementar varios casos de uso relacionados.

---

| Persona (E1) | Caso de uso (Proyecto 1) | Pantalla propuesta | Justificación |
|:-------------|:-------------------------|:-------------------|:--------------|
| **Marta López** | Registrarse | Registro de cliente | Permite crear una cuenta antes de utilizar los servicios de la plataforma. |
| **Marta López** | Solicitar crédito | Nueva solicitud de crédito | Centraliza la captura de la información requerida para solicitar un crédito. |
| **Marta López** | Consultar estado de la solicitud | Estado de la solicitud | Permite conocer el avance del trámite sin necesidad de contactar a un asesor. |
| **Marta López** | Consultar estado del crédito | Mi crédito | Resume el estado del crédito mostrando saldo pendiente, plan de amortización, próximas cuotas, mora y estado general del crédito. |
| **Marta López** | Realizar pago | Pago en línea | Permite registrar y confirmar el pago de una cuota del crédito. |
| **Marta López** | Solicitar reestructuración | Solicitud de reestructuración | Permite iniciar formalmente el proceso de reestructuración desde la aplicación. |
| **Byron Pérez** | Realizar pago | Detalle del crédito (Asesor) | Permite localizar rápidamente el crédito del cliente y explicar su estado antes de registrar un pago presencial. |
| **Byron Pérez** | Realizar pago | Registro de pago presencial | Facilita registrar pagos efectuados durante una visita domiciliaria utilizando el mismo caso de uso definido para el cliente. |
| **Byron Pérez** | Realizar pago | Comprobante de pago | Resume la aplicación del pago y genera evidencia para el cliente y el asesor. |
| **Lorena Aguilar** | Consultar cartera en riesgo | Tablero gerencial | Presenta indicadores estratégicos sobre la cartera de créditos, mora y riesgo para apoyar la toma de decisiones. |
| **Lorena Aguilar** | Consultar reportes | Reportes | Permite consultar y exportar información operativa y financiera requerida por la gerencia. |
| **Lorena Aguilar** | Generar cierre mensual | Cierre mensual | Consolida la información financiera correspondiente al período para el cierre operativo. |
| **Administrador** | Administrar usuarios | Administración de usuarios | Gestiona usuarios, roles y permisos del sistema. |
| **Administrador** | Administrar catálogos | Administración de catálogos | Permite mantener la información utilizada por los distintos módulos del sistema. |
| **Administrador** | Consultar reportes | Reportes | El administrador también puede acceder a los reportes generales del sistema según sus permisos. |

---

## Decisiones de diseño

Durante la elaboración de esta arquitectura de información se adoptaron las siguientes decisiones:

- Se conservaron exactamente los nombres de los casos de uso definidos durante el Proyecto 1 para mantener la trazabilidad entre ambos proyectos.
- Los nombres de las pantallas fueron definidos desde la perspectiva del usuario final, buscando que sean intuitivos y consistentes con las tareas que cada persona realiza.
- El caso de uso **Realizar pago** se implementa mediante diferentes pantallas dependiendo del contexto de uso. Mientras Marta realiza pagos desde la aplicación, Byron registra pagos presenciales durante visitas de cobranza. Ambos escenarios corresponden al mismo proceso de negocio, pero requieren interfaces diferentes debido a las condiciones particulares de cada usuario.
- No se asignaron responsabilidades relacionadas con la evaluación y aprobación de solicitudes de crédito a ninguna persona específica, ya que el mecanismo de aprobación aún no ha sido definido dentro del contexto del proyecto.
- Las pantallas propuestas servirán como base para la construcción del mapa de navegación y de los wireframes de baja fidelidad desarrollados en las siguientes etapas del Proyecto 2.