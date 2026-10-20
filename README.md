# Crédito Vecino

### Sistema de Gestión de Microcréditos

> **Proyecto Integrador**  
> **Análisis de Sistemas II (037)**  
> Universidad Mariano Gálvez de Guatemala – 2026

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-Tested-6E9F18)
![Figma](https://img.shields.io/badge/Figma-Prototipo-F24E1E?logo=figma&logoColor=white)
![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-6BA539)
![Arquitectura](https://img.shields.io/badge/Arquitectura-Hexagonal-blue)

---

# Descripción

**Crédito Vecino** es un sistema de gestión de microcréditos desarrollado como proyecto integrador del curso **Análisis de Sistemas II**.

El proyecto fue desarrollado en dos etapas:

- **Proyecto 1:** Diseño de la arquitectura del sistema e implementación del núcleo de negocio.
- **Proyecto 2:** Investigación de usuarios, experiencia de usuario (UX), arquitectura de información, prototipo navegable de alta fidelidad, movilidad, accesibilidad y evolución del núcleo.

Este repositorio reúne tanto el código fuente del dominio como toda la documentación generada durante ambas entregas.

---

# Objetivos del Proyecto 2

- Comprender las necesidades de los usuarios mediante investigación UX.
- Diseñar la arquitectura de información del sistema.
- Elaborar wireframes de baja fidelidad.
- Construir un prototipo navegable de alta fidelidad en Figma.
- Definir la estrategia de movilidad y experiencia de usuario.
- Evaluar el diseño mediante heurísticas de Nielsen y criterios WCAG 2.2.
- Evolucionar el núcleo de negocio implementado durante el Proyecto 1.

---

# Estado de los entregables

| Entregable | Descripción | Estado |
|------------|-------------|:------:|
| **E1** | Investigación de usuarios | Terminado |
| **E2** | Arquitectura de información y wireframes | Terminado |
| **E3** | Prototipo navegable de alta fidelidad | Terminado |
| **E4** | Movilidad y experiencia de usuario | Terminado |
| **E5** | Evaluación heurística y accesibilidad | Terminado |
| **E6** | Evolución del núcleo e impacto SOLID | Terminado |
| **E7** | Documento consolidado | Terminado |

---

# Prototipo interactivo

El prototipo de alta fidelidad fue desarrollado utilizando **Figma** y representa los tres flujos principales del sistema.

**Enlace al prototipo**

https://www.figma.com/design/oZNRdndoK2Nm2GskdeOjlD/Cr%C3%A9dito-vecino

---

# Flujos implementados

## Originación del crédito

```text
Solicitud
      ↓
Revisión
      ↓
Crédito aprobado
```

## Cobro en campo

```text
Detalle del crédito
        ↓
Detalle de la mora
        ↓
Registro del pago
        ↓
Comprobante
```

## Consulta gerencial

```text
Dashboard
      ↓
Créditos del tramo
      ↓
Reportes
      ↓
Cierre mensual
```

---

# Tecnologías utilizadas

## Backend

- Node.js 20
- TypeScript
- Vitest
- Zod
- OpenAPI 3.1
- date-fns

## UX / UI

- Figma
- Figma AI

## Documentación

- Markdown
- Mermaid
- PlantUML

---


# RAG — Generación aumentada por recuperación (E4)

El sistema Crédito Vecino incorpora un módulo RAG que permite
responder preguntas sobre las políticas institucionales
utilizando documentos del corpus canónico y citando las
fuentes consultadas.

### Arquitectura

El flujo de una consulta es:

1. El usuario formula una pregunta.
2. Gemini genera un embedding de la pregunta.
3. PostgreSQL con pgvector recupera los fragmentos
   documentalmente más similares.
4. Gemini Flash genera una respuesta utilizando
   los fragmentos recuperados como contexto.
5. El sistema valida que los identificadores citados
   pertenezcan a los fragmentos recuperados.
6. Se entrega la respuesta o un mensaje indicando
   que no fue posible validar las referencias.

### Corpus documental

El corpus está compuesto por siete documentos Markdown
del paquete canónico:

- FAQ-CLIENTES-01.md
- MAN-PRODUCTO-01.md
- NOTA-CAMPO-07.md
- POL-2024-01.md
- POL-2026-10.md
- POL-CARTERA-01.md
- POL-COBRO-01.md

Los documentos se leen desde la ruta configurada en
CV_DATA_DIR. El paquete canónico no se modifica.

### Estrategia de fragmentación

Se utiliza una fragmentación propia implementada en
src/rag/fragmentador.ts.

Configuración predeterminada:

- Tamaño máximo: 1000 caracteres.
- Solapamiento configurado: 150 caracteres.
- Separación prioritaria por párrafos Markdown.
- División adicional para bloques que superan el tamaño.
- Identificadores estables por documento y posición.
- Conservación del identificador y la ruta de origen.

El solapamiento se aplica al dividir bloques largos;
no se garantiza entre todos los fragmentos separados
por párrafos.

Esta estrategia permite recuperar secciones relevantes
sin enviar documentos completos al modelo generativo.

### Modelo de embeddings

Proveedor: Google Gemini.

Modelo: gemini-embedding-001.

Dimensiones: 768.

Tipos de tarea utilizados:

- RETRIEVAL_DOCUMENT para indexar documentos.
- RETRIEVAL_QUERY para buscar mediante preguntas.

Se eligió este servicio para generar representaciones
semánticas sin ejecutar un modelo local pesado.

### Almacenamiento vectorial

Se utiliza PostgreSQL en Supabase con la extensión
pgvector.

Tabla: public.rag_fragmentos.

Los registros almacenan:

- Identificador del fragmento.
- Identificador del documento.
- Ruta de la fuente.
- Contenido textual.
- Posición del fragmento.
- Vector de 768 dimensiones.

La búsqueda utiliza distancia coseno mediante pgvector.

### Generación de respuestas

Modelo generativo utilizado: gemini-3.8-flash.

El módulo src/rag/responderPregunta.ts recupera hasta
cinco fragmentos y los proporciona al modelo como
contexto documental.

Las instrucciones del asistente se mantienen separadas
en src/rag/instruccionesRAG.ts.

### Citas y validación

El asistente debe citar identificadores de fragmentos
recuperados, por ejemplo:

POL-2024-01-chunk-1

El sistema utiliza:

- src/rag/validarCitas.ts
- src/rag/evaluarRespuesta.ts

La validación comprueba que los identificadores citados
pertenezcan a los fragmentos recuperados.

Esta comprobación no demuestra automáticamente que
cada afirmación esté respaldada por el contenido citado.

### Seguridad

Los documentos recuperados se tratan como datos no
confiables y nunca como instrucciones del sistema.

Se realizaron pruebas de inyección de instrucciones
con documentos simulados y consultas al corpus.

La resistencia frente al caso canónico OP-7 requiere
su comprobación específica antes de cerrar E4.

Las credenciales se configuran mediante variables de
entorno y no deben incluirse en el repositorio.

### Pruebas y evidencia

Se utilizan Vitest y TypeScript.

La suite completa registró:

- 22 archivos de pruebas aprobados.
- 284 pruebas aprobadas.

Además, se verificó la consulta G-8:

"Según las políticas vigentes, ¿cómo se calcula el
interés moratorio de un crédito otorgado en agosto
de 2026? Cita la fuente."

El asistente identificó POL-2024-01 como política
aplicable y explicó la tasa nominal anual del 24 %,
la base Actual/360 y el cálculo sobre capital en mora,
con referencias a los fragmentos recuperados.

### Ejecución de pruebas manuales

Desde la raíz del proyecto:

```powershell
node --env-file=.env --import tsx src/rag/probarBusqueda.ts
```

```powershell
node --env-file=.env --import tsx src/rag/probarRespuesta.ts
```

```powershell
node --env-file=.env --import tsx src/rag/probarInyeccion.ts
```

Para ejecutar la suite automatizada:

```powershell
node --env-file=.env --import tsx node_modules/vitest/vitest.mjs run
```

# Estructura del repositorio

```text
.
├── src/
│   ├── dominio/
│   ├── servicios/
│   ├── estrategias/
│   ├── contratos/
│   └── demo.ts
│
├── tests/
│
└── docs/
    ├── proyecto1/
    │   ├── adr/
    │   ├── api/
    │   ├── diagramas/
    │   └── entregables/
    │
    └── proyecto2/
        ├── E1/
        ├── E2/
        ├── E3/
        ├── E4/
        ├── E5/
        ├── E6/
        └── adr/
```

---

# Instalación

```bash
git clone https://github.com/acifuinaMar/analisis2

cd analisis2

git checkout proyecto2

npm install
```

---

# Ejecución

## Ejecutar pruebas

```bash
npm test
```

## Ejecutar demostración

```bash
npm run demo
```

## Regenerar OpenAPI

```bash
npm run contratos:openapi
```

---

# Documentación

## Proyecto 1

- Arquitectura Hexagonal
- Modelo de Dominio
- OpenAPI
- ADR
- Diagramas UML
- Matriz de trazabilidad

## Proyecto 2

- Investigación de usuarios
- Journey Map
- Arquitectura de información
- Wireframes
- Prototipo navegable
- Estrategia de movilidad
- Evaluación heurística
- Evolución del núcleo

---

# Distribución del trabajo

| Integrante | Responsabilidades principales |
|------------|-------------------------------|
| **Maryori Elizabeth Acifuina Juárez** | Investigación de usuarios (E1), arquitectura de información (E2), wireframes, diseño del prototipo de alta fidelidad (E3), documentación UX/UI y reorganización del repositorio. |
| **Dalila Nineth Zacarías de León** | Evolución del núcleo del dominio (E6), implementación de la política de mora escalonada, actualización del motor de negocio, integración con el Proyecto 1 y validación técnica. |
| **Eric Alexander Barillas Orozco** | Documentación de movilidad y experiencia de usuario (E4), actualización del ADR del Proyecto 2 y apoyo en documentación técnica. |
| **Hilton Alexander López Ic** |  |

---

# Uso de Inteligencia Artificial

En cumplimiento del apartado de integridad académica establecido en el curso, se declara el uso de herramientas de Inteligencia Artificial como apoyo durante el desarrollo del proyecto.

| Herramienta | Uso principal |
|-------------|---------------|
| **ChatGPT (OpenAI)** | Documentación técnica, revisión de consistencia y acompañamiento durante el desarrollo. |
| **Claude (Anthropic)** | Apoyo para documentación técnica y revisión de consistencia entre entregables. |
| **Figma AI** | Generación inicial de propuestas de interfaz y asistencia durante la construcción del prototipo de alta fidelidad. |

Las herramientas anteriores fueron utilizadas únicamente como apoyo. Todas las decisiones de diseño, implementación y documentación fueron revisadas, comprendidas y validadas por los integrantes del equipo antes de su entrega.

---

# Autores

- **Maryori Elizabeth Acifuina Juárez**
- **Dalila Nineth Zacarías de León**
- **Eric Alexander Barillas Orozco**
- **Hilton Alexander López Ic**

---

**Universidad Mariano Gálvez de Guatemala**

**2026**