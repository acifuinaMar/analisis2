## Levantar la API

```bash
npm run cargar   # una vez: deja la cartera en la base (ver .env.example)
npm run api      # http://127.0.0.1:3000  (PORT y HOST se pueden cambiar)
```

La API es un adaptador delgado sobre los mismos servicios que usa el
servidor MCP (`ConsultasCartera`, `OriginacionCredito`, `CobroCredito`) y
reutiliza sus esquemas Zod (`src/mcp/esquemas.ts`): el tablero y el chat
no pueden dar cifras distintas. **Ninguna cifra se calcula en la
interfaz.** Escucha solo en `127.0.0.1` por defecto.

Reglas que hace cumplir:

- **Fecha de corte obligatoria** en toda consulta (`fechaCorte=AAAA-MM-DD`):
  la API nunca lee el reloj del sistema.
- **Perfil en el servidor:** encabezado `X-Perfil: asesor | gerencia`.
  Es la separación de responsabilidades del alcance, no autenticación.
- **Aprobación humana:** un pago sin `"confirmado": true` solo devuelve la
  vista previa (200) y no mueve nada; con `true` se aplica (201). La misma
  `claveIdempotencia` repetida devuelve 200 sin volver a cobrar.
- **Errores uniformes:** `{ "error": true, "codigo", "mensaje", "detalle" }`.

| Método y ruta | Perfil | operación |
|---|---|---|
| `GET /api/creditos/:id?fechaCorte=` | ambos | Detalle del crédito (G-5) |
| `GET /api/creditos/:id/plan?fechaCorte=` | ambos | Plan de amortización |
| `GET /api/creditos/:id/deuda?fechaCorte=` | ambos | Monto exacto a cobrar (el sistema calcula el monto) |
| `GET /api/creditos/:id/cuotas/:n/deuda?fechaCorte=` | ambos | Desglose de una cuota (OP-1, OP-2) |
| `GET /api/creditos/:id/cuotas/:n/mora?fechaCorte=` | ambos | Detalle de la mora (G-5, G-7) |
| `POST /api/creditos/:id/pagos` | asesor | Registro de pago (OP-1 a OP-6) |
| `GET /api/asesores` | asesor | Catálogo para la solicitud |
| `POST /api/clientes` | asesor | Alta de cliente (OP-3) |
| `POST /api/creditos/simulacion` | asesor | Plan simulado antes de confirmar (OP-3) |
| `POST /api/creditos` | asesor | Desembolso (OP-3) |
| `GET /api/cartera/mora?fechaCorte=&tramo=` | ambos | Créditos en mora (G-4) |
| `GET /api/vencimientos?fechaCorte=&ventanaDias=` | ambos | Vencimientos próximos (G-6) |
| `GET /api/cartera?fechaCorte=` | gerencia | Tablero (G-1) |
| `GET /api/cierres/diario?fechaCorte=` | gerencia | Cierre diario (G-3) |
| `GET /api/cierres/mensual?periodo=AAAA-MM` | gerencia | Cierre mensual (G-2) |

Ejemplo (el cuerpo del pago usa los mismos campos que la herramienta MCP): Prueba en local.

```bash
curl -s -H "X-Perfil: gerencia" "localhost:3000/api/cartera?fechaCorte=2026-10-31"

curl -s -X POST localhost:3000/api/creditos/CV-2026-0043/pagos \
  -H "X-Perfil: asesor" -H "Content-Type: application/json" \
  -d '{"monto":1011.88,"claveIdempotencia":"IDEM-OP-1","fechaOperacion":"2026-10-31"}'
```