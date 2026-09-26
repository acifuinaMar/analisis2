# Hallazgos realizados por Maryori Elizabeth Acifuina Juárez

Durante la evaluación heurística del prototipo me enfoqué principalmente en la claridad de la información presentada al usuario, la comprensión de los procesos financieros y el cumplimiento de criterios de accesibilidad aplicables a la interfaz. A continuación se describen los hallazgos identificados y las correcciones propuestas.

---

## H-01 · El estado del crédito no comunica suficiente información

**Heurística:** H1 - Visibilidad del estado del sistema  
**Severidad:** 3 - Problema importante

### Problema identificado

Durante la revisión del flujo del cliente observé que el estado del crédito únicamente mostraba el texto **"En mora"**, sin explicar qué significaba esa condición ni cuál era su impacto sobre el crédito.

Consideré que esto podía generar incertidumbre, ya que un cliente que desconoce el funcionamiento de las políticas de mora no tiene forma de comprender cuánto ha incrementado su deuda ni por qué ocurrió dicho incremento.

### Corrección aplicada

Se incorporó un botón **"Ver más"** que dirige a la pantalla **Detalle de la mora**, donde el usuario puede consultar:

- Tramo actual de mora.
- Días de atraso.
- Monto generado por mora.
- Desglose del cálculo por tramos.
- Explicación sencilla del funcionamiento de la mora escalonada.

Con esta modificación el sistema mantiene informado al usuario y mejora la comprensión del estado actual de su crédito.

---

## H-03 · El cálculo de la mora no era comprensible para usuarios no financieros

**Heurística:** H2 - Correspondencia entre el sistema y el mundo real  
**Severidad:** 3 - Problema importante

### Problema identificado

Uno de los objetivos principales del sistema es que el cliente comprenda el origen de los montos que debe pagar. Sin embargo, mostrar únicamente el monto total de mora obliga al usuario a confiar en el sistema sin entender cómo fue calculado.

Al tratarse de una aplicación financiera, consideré importante que la información pudiera entenderse sin necesidad de conocer fórmulas o conceptos técnicos.

### Corrección aplicada

Se diseñó una pantalla denominada **Detalle de la mora**, donde el cálculo se presenta mediante una tabla con:

- Tramo recorrido.
- Días cobrados.
- Tasa aplicada.
- Monto generado por cada tramo.

Además, se agregó una explicación en lenguaje sencillo indicando que la mora se calcula por etapas y que el monto final corresponde a la suma de cada tramo recorrido.

Con ello el usuario puede relacionar el resultado mostrado por el sistema con información comprensible y transparente.

---

## H-05 · El sistema no ofrecía una confirmación suficientemente clara en operaciones financieras

**Heurística:** H5 - Prevención de errores  
**Severidad:** 2 - Problema moderado

### Problema identificado

Durante la revisión del flujo de solicitud de crédito y del registro de pagos identifiqué que el usuario realizaba operaciones financieras importantes sin recibir una confirmación suficientemente detallada del resultado obtenido.

En este tipo de sistemas es importante que el usuario tenga certeza de que la operación fue ejecutada correctamente antes de abandonar el proceso.

### Corrección aplicada

Se incorporaron pantallas de confirmación que muestran claramente:

- Confirmación de la operación realizada.
- Monto registrado.
- Información del cliente.
- Fecha y hora.
- Número de comprobante.

Asimismo, se añadieron acciones para descargar, imprimir o compartir el comprobante generado, facilitando la verificación posterior de la operación.

---

# Auditoría de Accesibilidad (WCAG 2.2)

Durante la auditoría de accesibilidad revisé el cumplimiento de los criterios WCAG 2.2 de nivel A y AA aplicables al prototipo, así como los principios POUR.

La revisión se enfocó principalmente en los siguientes aspectos:

- Contraste suficiente entre texto y fondo.
- Tamaño adecuado de los objetivos táctiles para dispositivos móviles.
- Etiquetas claras en formularios.
- Consistencia de la navegación.
- Prevención de errores en operaciones financieras.
- Claridad en la presentación del estado del sistema.
- Organización visual de la información tanto en dispositivos móviles como en escritorio.

Como resultado de la auditoría se realizaron ajustes orientados principalmente a mejorar la comprensión de la información financiera presentada al usuario y reforzar la retroalimentación durante las operaciones críticas del sistema.

---

## Conclusión

Los hallazgos encontrados durante esta evaluación permitieron identificar oportunidades de mejora relacionadas con la comunicación de información financiera, la comprensión de la política de mora y la retroalimentación ofrecida durante las operaciones críticas del sistema.

Las correcciones implementadas contribuyen a que el prototipo sea más comprensible, transparente y fácil de utilizar tanto para clientes como para asesores, manteniendo la consistencia con las heurísticas de Nielsen y los criterios de accesibilidad establecidos por WCAG 2.2.