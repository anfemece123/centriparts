# Herramienta de evaluación con fotografías reales

Construye un conjunto de evaluación con fotos reales del catálogo y mide qué
tan bien funciona la búsqueda visual, según lo pedido en las secciones 7 y 29
del ticket. **No se ejecutó con fotos reales en este repositorio** — el
equipo debe correrlo contra su propio catálogo desplegado.

## 1. Crear el manifiesto de casos

```bash
npm run visual-eval:init -- scripts/visual-eval/manifest.json
```

Esto crea `scripts/visual-eval/manifest.json` con la forma:

```ts
type VisualSearchEvaluationCase = {
  queryImagePath: string      // ruta local a la foto de consulta
  expectedProductId: string   // product_id real del catálogo que debería aparecer
  categoryId: string | null   // null = búsqueda global
  notes?: string               // p.ej. "foto sucia", "otro ángulo", "sin referencia visible"
}
```

Agrega tantos casos como fotos tengas. Para una evaluación seria, incluye
variaciones reales: foto limpia vs. usada, otro ángulo, otro fondo, rotación,
suciedad/manchas/desgaste, imagen recortada, con y sin referencia visible, y
piezas visualmente casi idénticas — exactamente los escenarios que pide la
sección 7 del ticket.

## 2. Ejecutar la evaluación

```bash
export SUPABASE_FUNCTIONS_URL="https://<project-ref>.supabase.co/functions/v1"
export SUPABASE_ANON_KEY="<anon-o-publishable-key>"
export VISUAL_SEARCH_FUNCTION_SECRET="<opcional, igual a FUNCTION_SECRET>"

npm run visual-eval:run -- scripts/visual-eval/manifest.json scripts/visual-eval/reports/dinov2-small-v1.json
```

Esto llama a `visual-product-search` una vez por caso (secuencialmente, para
no distorsionar la medición de latencia ni disparar el rate limit del
endpoint), y calcula Recall@1/3/5/10, MRR y percentiles de latencia sobre las
respuestas reales.

Para comparar proveedores/modelos: cambia `VISUAL_EMBEDDING_PROVIDER` /
`VISUAL_EMBEDDING_MODEL` en el servicio de inferencia, corre el backfill para
reprocesar el catálogo con el nuevo modelo, y vuelve a correr este comando
con una etiqueta distinta en el manifiesto (`label`) y un archivo de salida
distinto.

## 3. Comparar reportes

```bash
npm run visual-eval:compare -- scripts/visual-eval/reports/dinov2-small-v1.json scripts/visual-eval/reports/siglip-base-v1.json
```

Imprime una tabla Markdown lista para pegar en el reporte final.

## Qué mide

- **Recall@K**: en qué fracción de casos el producto correcto aparece entre
  los primeros K resultados.
- **MRR** (Mean Reciprocal Rank): promedio de 1/posición del producto
  correcto (0 si nunca aparece).
- **Latencia** media/mediana/p95 de la llamada completa al endpoint.
- **% de búsquedas sin OpenAI**: toma `meta.usedOpenAi` de cada respuesta.

## Qué NO hace

- No mide uso de memoria del servicio de inferencia (requeriría instrumentar
  el proceso Python directamente — no incluido aquí para no sobre-construir
  antes de tener datos reales).
- No decide el modelo activo por ti: lee el reporte, compara, y decide con
  base en las métricas reales — no en esta guía.
