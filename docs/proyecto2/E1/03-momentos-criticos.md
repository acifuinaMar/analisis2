# E1 · Investigación de Usuario
# Momentos Críticos

## Introducción

Durante el análisis del recorrido del usuario se identificaron cuatro momentos donde un error de interfaz podría traducirse directamente en pérdidas económicas, cobros incorrectos o pérdida de confianza entre el cliente y la institución.

Los siguientes escenarios representan situaciones donde el diseño de la interfaz tiene un impacto directo sobre el negocio y, por lo tanto, requieren especial atención durante las etapas de diseño e implementación del sistema.

---

## Momento crítico 1 · Pago con mora no visible

### ¿Qué sucede?

Marta realiza un pago tres días después del vencimiento creyendo que únicamente debe cancelar el valor habitual de su cuota.

### Riesgo

La interfaz no informa claramente que ya existe una mora ni actualiza el monto antes de confirmar el pago.

### Consecuencia

El cliente cree haber regularizado su crédito cuando todavía mantiene un saldo pendiente que continuará generando mora.

### Oportunidad de diseño

Mostrar el monto actualizado antes de confirmar el pago y explicar claramente cómo se distribuye entre capital, intereses y mora.

---

## Momento crítico 2 · Desglose del pago poco claro

### ¿Qué sucede?

Durante la visita, Byron intenta explicar el monto adeudado, pero tanto él como Marta presentan dudas sobre el cálculo de la mora y la prelación de pagos.

### Riesgo

El sistema no presenta un desglose suficientemente claro para respaldar la explicación del asesor.

### Consecuencia

El asesor puede comunicar información incorrecta al cliente, generando desconfianza y aumentando la probabilidad de una segunda visita.

### Oportunidad de diseño

Presentar un desglose claro y transparente del cálculo de la deuda y del orden de aplicación de los pagos.

---

## Momento crítico 3 · Validación insuficiente del pago

### ¿Qué sucede?

Después de finalizar la visita, Byron descubre que el monto registrado no fue suficiente para dejar el crédito completamente al día.

### Riesgo

El sistema permite finalizar el proceso sin advertir que todavía existe un saldo pendiente.

### Consecuencia

El asesor debe regresar con el cliente para solicitar un pago adicional, incrementando los costos operativos y deteriorando la confianza del cliente en la institución.

### Oportunidad de diseño

Validar automáticamente si el pago realmente regulariza el crédito antes de confirmar la transacción y advertir al asesor cuando aún exista un saldo pendiente.

---

## Momento crítico 4 · Cambio de tramo de mora (Obligatorio)

### ¿Qué sucede?

Mientras Marta continúa realizando los pagos que considera correctos, la mora continúa acumulándose hasta cambiar de tramo.

La clienta descubre esta situación únicamente cuando Byron la visita para explicarle el estado real de su crédito.

### ¿Cuándo se entera?

Después de que el cambio de tramo ya ocurrió.

### ¿Por qué canal?

Mediante una visita presencial realizada por el asesor de crédito.

### Consecuencia

La clienta siente que fue informada demasiado tarde y pierde confianza tanto en el sistema como en la institución.

### Oportunidad de diseño

Enviar notificaciones antes de que ocurra el cambio de tramo de mora, indicando claramente la fecha límite para evitarlo y el monto actualizado que debe cancelarse.

---

## Conclusión

Los cuatro momentos críticos evidencian que la mayoría de los errores económicos no se originan por cálculos incorrectos, sino por una comunicación insuficiente entre el sistema y sus usuarios.

Un diseño que informe oportunamente el estado del crédito, el cálculo de la mora y las consecuencias de cada pago puede reducir significativamente los errores operativos, fortalecer la confianza de los clientes y facilitar el trabajo de los asesores.

Las oportunidades de diseño identificadas en este Journey Map serán utilizadas como insumo para la elaboración de los wireframes y del prototipo de alta fidelidad desarrollados en el Entregable 2.