// UI strings. Data (names/descriptions) carry their own en/pt fields.
window.I18N = {
  pt: {
    title: "Mapa de Skyrim", search: "Buscar local, recurso, hold...", holds: "Territórios (Holds)", labels: "Rótulos",
    filterHold: "Filtrar por hold", layers: "Camadas", allOn: "todas", allOff: "nenhuma", edit: "Modo de edição",
    editHint: "Clique no mapa pra adicionar um ponto. Arraste marcadores pra mover. Use as ferramentas no canto do mapa pra desenhar ou editar áreas.",
    export: "Exportar tudo (JSON)", exportChanges: "Só minhas mudanças", import: "Importar JSON", reset: "Descartar mudanças locais",
    footer: "Mapa © Bethesda. Projeto de fãs, sem fins lucrativos.",
    formNew: "Novo ponto", formEdit: "Editar", category: "Categoria", subtype: "Subtipo", hold: "Hold", descEn: "Descrição (EN)", descPt: "Descrição (PT)",
    tags: "Tags (separadas por vírgula)", color: "Cor", delete: "Apagar", cancel: "Cancelar", save: "Salvar",
    capital: "Capital", approx: "posição aproximada, arraste no modo de edição pra corrigir", editBtn: "Editar",
    changes: (n) => n ? `${n} mudança(s) local(is) não publicada(s). Exporte e mande o JSON pro repositório.` : "Nenhuma mudança local.",
    confirmReset: "Descartar todas as mudanças locais? Isso não pode ser desfeito.",
    confirmDelete: "Apagar este item?", newArea: "Nova área", areaHint: "Área desenhada. Preencha os dados.",
    none: "—", resources: "Recursos", noResults: "Nada encontrado", imported: "Importado com sucesso.", importFail: "Arquivo inválido.",
  },
  en: {
    title: "Skyrim Map", search: "Search location, resource, hold...", holds: "Territories (Holds)", labels: "Labels",
    filterHold: "Filter by hold", layers: "Layers", allOn: "all", allOff: "none", edit: "Edit mode",
    editHint: "Click the map to add a point. Drag markers to move them. Use the tools on the map corner to draw or edit areas.",
    export: "Export all (JSON)", exportChanges: "Only my changes", import: "Import JSON", reset: "Discard local changes",
    footer: "Map © Bethesda. Fan project, non-commercial.",
    formNew: "New point", formEdit: "Edit", category: "Category", subtype: "Subtype", hold: "Hold", descEn: "Description (EN)", descPt: "Description (PT)",
    tags: "Tags (comma separated)", color: "Color", delete: "Delete", cancel: "Cancel", save: "Save",
    capital: "Capital", approx: "approximate position, drag in edit mode to fix", editBtn: "Edit",
    changes: (n) => n ? `${n} unpublished local change(s). Export and send the JSON to the repository.` : "No local changes.",
    confirmReset: "Discard all local changes? This cannot be undone.",
    confirmDelete: "Delete this item?", newArea: "New area", areaHint: "Area drawn. Fill in the details.",
    none: "—", resources: "Resources", noResults: "Nothing found", imported: "Imported successfully.", importFail: "Invalid file.",
  }
};
