/**
 * Author's verbatim NOTAS per D32 + `feedback_intent_vs_implementation`.
 *
 * The 5 NOTAS from the workbook are authoritative model documentation; they
 * are preserved in `Project.modelNotes` and displayed VERBATIM. The L0
 * dashboard tucks them at the bottom as collapsed details so the CEO has
 * one-click access to the original author's caveats without cluttering
 * the headline numbers.
 *
 * Implementation note: rendered as a native <details> so this remains a
 * server component (no React state, no client JS).
 */

interface ModelNotesProps {
  notes: string[];
}

export function ModelNotes({ notes }: ModelNotesProps) {
  if (notes.length === 0) return null;
  return (
    <details className="border-foreground/10 bg-card text-card-foreground group rounded-2xl border p-5 shadow-sm">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3">
        <span className="text-foreground/70 text-sm font-medium">
          NOTAS del autor ({notes.length})
        </span>
        <span className="text-foreground/40 text-xs group-open:hidden">Mostrar</span>
        <span className="text-foreground/40 text-xs hidden group-open:inline">Ocultar</span>
      </summary>
      <ol className="text-foreground/80 mt-4 list-decimal space-y-2 pl-5 text-xs">
        {notes.map((n, i) => (
          <li key={i} className="whitespace-pre-line">{n}</li>
        ))}
      </ol>
      <p className="text-foreground/40 mt-3 text-[10px]">
        Conservadas verbatim desde FCFCasas2!A105:I110 por D32.
      </p>
    </details>
  );
}
