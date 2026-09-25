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