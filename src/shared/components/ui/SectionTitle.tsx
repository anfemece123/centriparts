interface SectionTitleProps {
  title: string
  description?: string
}

export default function SectionTitle({ title, description }: SectionTitleProps) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-zinc-400">{description}</p>}
    </div>
  )
}
