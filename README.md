# Dashboard Venado Tuerto

Dashboard interactivo de datos abiertos de la **Municipalidad de Venado Tuerto** (Santa Fe, Argentina). Sintetiza los 27 datasets del portal CKAN oficial en **8 análisis ejecutivos** por categoría temática, con KPIs, visualizaciones y narrativa.

🌐 Fuente: [datos-abiertos.venadotuerto.gob.ar](https://datos-abiertos.venadotuerto.gob.ar/) (CKAN v2.10) · Licencias **CC-BY** y **ODC-BY**

## Análisis ejecutivos disponibles

| Categoría | Datasets | KPIs ejemplo |
|-----------|---------:|--------------|
| **Gobierno** | 6 | 1.345 agentes municipales · 6.568 documentos CDR 2025 (+27,2% vs 2024) |
| **Hacienda y Economía** | 5 | 2.365 comercios habilitados · 5.755 habilitaciones acumuladas |
| **Educación** | 3 | 97 instituciones · 678 becados (62,7% mujeres) |
| **Salud y Desarrollo Humano** | 2 | 12 centros de salud · 2.129 carnets manipulación 2025 |
| **Seguridad y Convivencia** | 3 | 1.380 vehículos abandonados · 12.825 licencias 2025 |
| **Obras y Servicios Públicos** | 5 | 509 obras · 102.431 unidades de producción municipal |
| **Ambiente** | 2 | 158 actividades educativas · 6.426 asistentes |
| **Vivienda y Territorio** | 1 | 1.175 beneficiarios Nuestro Terreno (47,1% mujeres) |

## Stack

- **React 19** + **TypeScript 5** (strict) + **Vite 6**
- **react-router-dom v7** · **Zustand** (theme)
- **@nivo** (bar, line, pie) + **Recharts** para visualización
- **react-markdown** + **remark-gfm** para narrativa
- **framer-motion** · **lucide-react**
- **papaparse** para procesamiento CSV en build-time
- CSS puro con variables (sin Tailwind) — dark/light theme

## Estructura

```
.
├── data/
│   ├── raw/                       CSVs originales del portal CKAN, por categoría
│   └── manifest.json              Índice con metadatos (id, fuente, hash, fechas)
├── public/
│   ├── data/<categoria>/          JSONs procesados (KPIs + charts) por informe
│   └── reports/<categoria>/       Narrativas markdown por informe
├── scripts/
│   ├── download-ckan.cjs          Descarga masiva desde la API CKAN
│   ├── build-data.cjs             Orquestador del pipeline
│   ├── lib/csv-utils.cjs          Helpers compartidos
│   ├── process-cat-*.cjs          8 processors de análisis ejecutivo
│   └── process-personal-municipal.cjs  Informe individual de muestra
├── src/
│   ├── components/                UI: Layout, Sidebar, ChartRenderer, KPICounter, etc.
│   ├── pages/                     Landing + ReportView
│   ├── data/reportRegistry.ts     Registro de los 8 resúmenes + 27 informes
│   ├── lib/categories.ts          Definición de las 8 categorías temáticas
│   ├── store/useStore.ts          Zustand (theme)
│   ├── hooks/useReportData.ts     Carga paralela de md + json
│   └── types/report.ts            Tipos TS del schema unificado
└── package.json
```

## Desarrollo

Requiere **Node.js ≥ 18**.

```bash
npm install                # primera vez
npm run download           # descarga CSVs desde CKAN (idempotente)
npm run build-data         # procesa CSVs → JSON + markdown
npm run dev                # dev server en http://localhost:5173/
npm run build              # build production en dist/
npm run preview            # sirve la build
```

### Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run download` | Descarga los 88 CSVs del portal CKAN a `data/raw/` y genera `manifest.json` |
| `npm run download:dry` | Lista lo que se descargaría sin escribir archivos |
| `npm run build-data` | Procesa los CSVs y emite los JSONs + markdown en `public/data` y `public/reports` |
| `npm run dev` | Vite dev server con HMR |
| `npm run build` | Build production (incluye `prebuild` que regenera los datos) |
| `npm run preview` | Sirve la build |

## Schema unificado

Cada informe se serializa al tipo `ReportData` (ver `src/types/report.ts`):

```ts
interface ReportData {
  meta: { id, title, category, description, source, license, last_updated, organization };
  kpis: KPI[];                    // 3-5 indicadores clave por informe
  charts: ChartConfig[];          // bar, horizontalBar, stackedBar, line, area, pie
  tables?: ReportTable[];         // tablas opcionales (centros, vecinales, etc.)
}
```

## Cómo agregar un nuevo informe

1. Identificar el dataset en `data/manifest.json` (campo `id`).
2. Crear `scripts/process-<id>.cjs` siguiendo el patrón de `process-personal-municipal.cjs`.
3. Sumarlo a la lista en `scripts/build-data.cjs`.
4. Agregar la entrada al array `REPORTS` en `src/data/reportRegistry.ts`.
5. Correr `npm run build-data` y verificar en `npm run dev`.

## Atribución

Datos publicados por la **Municipalidad de Venado Tuerto** bajo licencias abiertas (CC-BY / ODC-BY). Cualquier publicación derivada debe citar la fuente: <https://datos-abiertos.venadotuerto.gob.ar/>.

Dashboard construido por **Laboratorio Colossus · OpenArg**.

## Licencia

MIT (código del dashboard). Los datos crudos mantienen sus licencias originales.
