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

1. **Click** an empty spot on the map → *Add resource here*. Fill the form and save. (The menu also shows the hold you clicked, *Draw area* and *Copy coordinates*.)
2. Turn on **Edit mode** in the sidebar to drag markers and to edit area vertices with the polygon tools (top-right). Click *Edit* inside any popup to change or delete an item.
3. Changes are saved in your browser only. Click **Export all (JSON)** and send the file, or open a pull request:
   ```
   py -3 tools/split_export.py ~/Downloads/skyrim-map-data.json
   ```
   writes the per-file layout back into `data/`.
4. **Only my changes** exports just your edits; the maintainer can import that file on top of the current data.

---

1. **Clique** num espaço vazio do mapa → *Adicionar recurso aqui*. Preencha o formulário e salve. (O menu também mostra o hold clicado, *Desenhar área* e *Copiar coordenadas*.)
2. Ligue o **Modo de edição** na barra lateral pra arrastar marcadores e editar os vértices das áreas com as ferramentas de polígono (canto superior direito). Clique em *Editar* dentro de qualquer popup pra alterar ou apagar.
3. As mudanças ficam só no seu navegador. Clique em **Exportar tudo (JSON)** e mande o arquivo, ou abra um pull request usando o script acima pra gravar em `data/`.
4. **Só minhas mudanças** exporta só o que você editou; quem mantém o repo importa esse arquivo por cima dos dados atuais.

## Shared database · Banco compartilhado (Supabase)

Without a database the site is static: edits live only in the browser that made them. To make every visitor's edits visible to everyone on refresh, plug in a free [Supabase](https://supabase.com) project:

1. Create a project at supabase.com (free tier).
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, run it.
3. Open **Project Settings → API** and copy the *Project URL* and the *anon public* key.
4. Put both into `js/config.js` and publish. The anon key is designed to be public; what it can do is limited by the row policies in the SQL (read/write of the `map_overrides` table only).

With the database on, the repository's `data/*.json` is the base layer and the table holds every change on top of it. **Export all (JSON)** still works and gives you the merged result, which you can commit back into `data/` from time to time with `tools/split_export.py`.

---

Sem banco o site é estático: as edições ficam só no navegador de quem fez. Pra todo visitante ver as mudanças dos outros ao dar F5, conecte um projeto grátis do [Supabase](https://supabase.com):

1. Crie um projeto em supabase.com (plano grátis).
2. Abra o **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e rode.
3. Em **Project Settings → API** copie a *Project URL* e a chave *anon public*.
4. Coloque as duas em `js/config.js` e publique. A chave anon foi feita pra ser pública; o que ela pode fazer é limitado pelas políticas do SQL (ler e escrever só na tabela `map_overrides`).

Com o banco ligado, o `data/*.json` do repositório é a camada base e a tabela guarda cada mudança por cima. **Exportar tudo (JSON)** continua funcionando e dá o resultado combinado, que você pode gravar de volta em `data/` de vez em quando com `tools/split_export.py`.

### Reference images · Imagens de referência

Markers can carry a screenshot. The site downsizes it in the browser (1600 px full + 400 px thumbnail, JPEG) and uploads both to a public Supabase Storage bucket named `map-images`; the item stores `image: { url, thumb }`. Create the bucket in the dashboard (**Storage → New bucket**, public) and give the `anon` role SELECT/INSERT/UPDATE/DELETE on it (**Storage → Policies**). `supabase/storage.sql` does the same thing when the SQL editor is allowed to create policies on `storage.objects`.

Marcadores podem ter um print. O site reduz a imagem no navegador (1600 px + miniatura de 400 px, JPEG) e envia as duas pro bucket público `map-images` do Supabase Storage; o item guarda `image: { url, thumb }`. Crie o bucket pelo painel (**Storage → New bucket**, público) e dê ao papel `anon` SELECT/INSERT/UPDATE/DELETE nele (**Storage → Policies**). O `supabase/storage.sql` faz o mesmo quando o editor SQL deixa criar políticas em `storage.objects`.

## Stack

Leaflet 1.9 (`CRS.Simple` over the map image), Leaflet-Geoman for polygon drawing, vanilla JS, no build step. Hosted on GitHub Pages.

## Credits · Créditos

- Map image and in-game map marker icons © Bethesda Softworks (marker PNGs in `assets/icons/*.png` come from the [UESP](https://en.uesp.net/wiki/Skyrim:Maps) wiki). Fan project, non-commercial.
- Ingredient and resource icons (`assets/icons/*.svg`) are from [game-icons.net](https://game-icons.net) by Lorc, Delapouite and contributors, licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Built with [Leaflet](https://leafletjs.com) and [Leaflet-Geoman](https://geoman.io).
