# Skyrim Interactive Map · Mapa Interativo de Skyrim

Static, no-backend interactive map of Skyrim: holds (territories), cities, dungeons, landmarks and resources (ore veins, alchemy ingredients, lumber, etc.) with filters, search, PT-BR / EN interface and an in-browser edit mode.

Mapa interativo estático de Skyrim, sem backend: holds (territórios), cidades, masmorras, pontos de referência e recursos (minérios, ingredientes de alquimia, madeira, etc.) com filtros, busca, interface PT-BR / EN e modo de edição no navegador.

## Run locally · Rodar local

Any static server works. For example:

```
py -3 -m http.server 8080
```

then open http://localhost:8080. Opening `index.html` directly from disk does **not** work, because the browser blocks `fetch` of the JSON files.

## Data · Dados

Everything lives in `data/`:

| File | Content |
|---|---|
| `categories.json` | categories, subtypes, icons, colors, labels (en/pt) |
| `holds.json` | the 9 holds as polygons (pixel coordinates on the map image) |
| `locations.json` | settlements, dungeons, landmarks |
| `ores.json` | mines and ore veins |
| `ingredients.json` | alchemy ingredient areas |
| `other.json` | lumber mills, hot springs, fishing, hunting, smelters |
| `index.json` | list of data files to load + repo link |

A point looks like this:

```json
{ "id": "whiterun", "cat": "settlement", "sub": "city", "x": 712, "y": 428, "hold": "whiterun",
  "name": { "en": "Whiterun", "pt": "Whiterun" },
  "desc": { "en": "...", "pt": "..." },
  "tags": ["trade"], "approx": true }
```

`x`/`y` are pixels on `assets/skyrim_map.jpg` (1300×867, origin top-left). The bottom-right corner of the site shows the cursor coordinates. `approx: true` marks seed positions that were estimated and may need a nudge.

A new subtype can be used freely: anything typed in the *Subtype* field of the edit form becomes a new filter entry. Adding it to `categories.json` gives it a proper label, icon and color.

## Contributing · Como contribuir

1. Turn on **Edit mode** in the sidebar.
2. Click the map to add a point, drag markers to move them, use the polygon tools (top-right) to draw or edit areas. Click *Edit* inside a popup to change or delete an item.
3. Changes are saved in your browser only. Click **Export all (JSON)** and send the file, or open a pull request:
   ```
   py -3 tools/split_export.py ~/Downloads/skyrim-map-data.json
   ```
   writes the per-file layout back into `data/`.
4. **Only my changes** exports just your edits; the maintainer can import that file on top of the current data.

---

1. Ligue o **Modo de edição** na barra lateral.
2. Clique no mapa pra adicionar um ponto, arraste marcadores pra mover, use as ferramentas de polígono (canto superior direito) pra desenhar ou editar áreas. Clique em *Editar* dentro de um popup pra alterar ou apagar.
3. As mudanças ficam só no seu navegador. Clique em **Exportar tudo (JSON)** e mande o arquivo, ou abra um pull request usando o script acima pra gravar em `data/`.
4. **Só minhas mudanças** exporta só o que você editou; quem mantém o repo importa esse arquivo por cima dos dados atuais.

## Stack

Leaflet 1.9 (`CRS.Simple` over the map image), Leaflet-Geoman for polygon drawing, vanilla JS, no build step. Hosted on GitHub Pages.

Map image © Bethesda Softworks. Fan project, non-commercial.
