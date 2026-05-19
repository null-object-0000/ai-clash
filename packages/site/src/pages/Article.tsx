export function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="doc-shell">
      <article className="doc">
        {title && <h1>{title}</h1>}
        {children}
      </article>
    </main>
  )
}
