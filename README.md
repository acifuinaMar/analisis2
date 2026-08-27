# Sistema de Gestión de Microcrédito — Crédito Vecino, S. A.

**Análisis de Sistemas II (037) · Proyecto 1 — Arquitectura y diseño de componentes**
Universidad Mariano Gálvez de Guatemala · Segundo semestre 2026

Repositorio del Proyecto 1 del proyecto integrador: el diseño y el núcleo de
cálculo ejecutable del Sistema de Gestión de Microcrédito de Crédito Vecino,
S. A., una fintech de microfinanzas guatemalteca. Este proyecto cubre los
entregables **E1 a E6** definidos en el enunciado del curso; no incluye
servidor HTTP, base de datos, interfaz gráfica, autenticación, RAG ni
servidor MCP — esos componentes están fuera del alcance de esta fase y se
abordarán en el Proyecto 2 y el Proyecto Final.

## Alcance de esta entrega

| Entregable | Contenido | Dónde está |
|---|---|---|
| E1 | Modelo de dominio en UML (casos de uso, clases, secuencia, estados, actividades) y matriz de trazabilidad | `docs/diagramas/`, `docs/trazabilidad/` |
| E2 | Justificación de la arquitectura (ISO/IEC 25010, 4+1, C4) | `docs/entregables/E2.md` |
| E3 | Diseño de componentes, SOLID/GRASP y patrones de diseño | `docs/entregables/E3.md` |
| E4 | Núcleo de cálculo ejecutable (walking skeleton) y pruebas | `src/`, `tests/` |
| E5 | Contratos de la API (OpenAPI) y ADR | `docs/entregables/E5.md`, `docs/api/`, `docs/adr/` |
| E6 | Documento de arquitectura consolidado (E1–E5) | `docs/arquitectura.pdf` |

## Stack tecnológico

- **Runtime:** Node.js 20 LTS o superior
- **Lenguaje:** TypeScript en modo `strict` (obligatorio, ver `tsconfig.json`)
- **Pruebas:** Vitest
- **Dinero:** Objeto de Valor `Dinero` en enteros de centavos (nunca `Number` en punto flotante, sección 6.2 del enunciado)
- **Fechas:** date-fns
- **Validación / contratos:** Zod + `@asteasolutions/zod-to-openapi`
- **Diagramas:** Mermaid / PlantUML (editable, en `docs/diagramas/`)

## Estructura del repositorio

```
analisis2-Proyecto1/
├── README.md                      este archivo
├── package.json / tsconfig.json   configuración del proyecto (strict: true)
├── src/
│   ├── dominio/                   núcleo puro (E4) — sin infraestructura
│   │   ├── dinero.ts              Objeto de Valor Dinero
│   │   ├── credito.ts, cuota.ts, pago.ts, ...
│   │   ├── plan-amortizacion.ts   plan de amortización (sistema francés)
│   │   └── estados/               máquina de estados del crédito (patrón State)
│   ├── estrategias/                Strategy: métodos de interés y política de adelanto
│   ├── servicios/                  CalculadoraMora, Cartera, PrelacionPago (Chain of Responsibility)
│   ├── contratos/                  esquemas Zod + generador de OpenAPI (E5)
│   ├── adaptadores/                Reloj (puerto secundario): RelojSistema y RelojFijo
│   └── demo.ts                     script de demostración end-to-end del núcleo
├── tests/                          pruebas unitarias (incluye los casos de referencia del enunciado)
└── docs/
    ├── arquitectura.pdf            documento consolidado E1–E5 (E6)
    ├── diagramas/                  UML y C4 en forma editable (Mermaid/PlantUML)
    ├── entregables/                E2.md, E3.md, E5.md — documentación detallada
    ├── trazabilidad/               matriz requisito → caso de uso → clase
    ├── adr/                        ADR-001, ADR-002
    └── api/                        contrato openapi.yaml generado desde Zod
```

## Instalación y ejecución

Requisitos previos: **Node.js 20 LTS o superior** y `npm`.

```bash
# 1. Clonar el repositorio
git clone https://github.com/acifuinaMar/analisis2/tree/Proyecto1
cd analisis2
git checkout Proyecto1

# 2. Instalar dependencias
npm install
```

### Ejecutar las pruebas del núcleo de cálculo

```bash
npm test
```

Esto corre `vitest run` sobre toda la carpeta `tests/`. No requiere base de
datos ni servidor. Al día de esta entrega, la suite completa pasa:
**10 archivos de prueba, 151 pruebas, todas exitosas**, incluyendo:

- La tabla de amortización de 12 cuotas del caso de referencia (sección 6.4.1 del enunciado), celda por celda.
- Los invariantes del dominio (sección 6.10): Σ amortizaciones = capital, saldo final = 0.00, cartera en riesgo entre 0 y 1, idempotencia de pagos, prohibición de anatocismo, etc.
- La cartera en riesgo del caso de referencia (sección 6.8.1): 7.00 % y 6.06 % tras dar de baja el crédito C-005.
- El interés moratorio de Q7.26 del ejemplo de la sección 6.5.
- La reversibilidad del ciclo de vida del crédito (sección 6.7): un crédito en Mora 2 que abona y baja a 10 días de atraso reclasifica en Mora 1; transiciones inválidas (p. ej. pagar un crédito `solicitado`) son rechazadas por diseño.

### Ejecutar la demostración end-to-end

```bash
npm run demo
```

Corre `src/demo.ts`, que construye un crédito con la política vigente,
genera su plan de amortización, aplica pagos en distintos escenarios
(exacto, parcial, con excedente) y calcula la cartera en riesgo — usando
únicamente el núcleo de dominio, sin infraestructura.

### Regenerar el contrato OpenAPI

```bash
npm run contratos:openapi
```

Regenera `docs/api/openapi.yaml` a partir de los esquemas Zod definidos en
`src/contratos/`, siguiendo el principio de "contrato único" de la nota 8.2
del enunciado: el mismo esquema valida la API, documenta OpenAPI y (en el
Proyecto Final) define las herramientas del servidor MCP.

## Documentación

- **Documento de arquitectura consolidado (E6):** [`docs/arquitectura.pdf`](docs/arquitectura.pdf)
- **Diagramas UML y C4 (editables):** [`docs/diagramas/`](docs/diagramas/)
- **ADR:** [`docs/adr/ADR-001-arquitectura-hexagonal.md`](docs/adr/ADR-001-arquitectura-hexagonal.md), [`docs/adr/ADR-002-representacion-dinero.md`](docs/adr/ADR-002-representacion-dinero.md)
- **Contrato de la API:** [`docs/api/openapi.yaml`](docs/api/openapi.yaml)
- **Matriz de trazabilidad:** [`docs/trazabilidad/matriz-de-trazabilidad.md`](docs/trazabilidad/matriz-de-trazabilidad.md)

## Herramientas de IA utilizadas

En cumplimiento de la sección 13 del enunciado (integridad académica), se
declara el uso de las siguientes herramientas de IA como apoyo durante el
desarrollo del proyecto:

- **Claude** (Anthropic)
- **ChatGPT** (OpenAI)

Ambas se usaron como apoyo para el diseño, la redacción de documentación y
la revisión de código. Todo el contenido entregado fue comprendido,
validado y puede ser explicado y defendido por el autor.

## Autores

- **MARYORI ELIZABETH ACIFUINA JUAREZ**
- **DALILA NINETH ZACARIAS DE LEON**
- **HILTON ALEXANDER LÓPEZ IC**
- **ERIC ALEXANDER BARILLAS OROZCO**

Universidad Mariano Gálvez de Guatemala, 2026.
