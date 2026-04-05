import { t } from '@/shared/translations'

export default function HomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">{t.home.welcome}</h1>
    </div>
  )
}
