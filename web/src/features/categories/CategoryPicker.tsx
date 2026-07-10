import { Chip } from '../../ui/Chip'
import { useCategories } from '../../offline/hooks'
import type { XpensesDb } from '../../offline/db'

interface CategoryPickerProps {
  db: XpensesDb
  value: string | null
  onChange: (categoryId: string) => void
  excludeIds?: Set<string>
}

export function CategoryPicker({ db, value, onChange, excludeIds }: CategoryPickerProps) {
  const categories = useCategories(db)
  const visible = categories?.filter((category) => !excludeIds?.has(category.id))

  return (
    <div className="chip-row">
      {visible?.map((category) => (
        <Chip key={category.id} selected={value === category.id} onClick={() => onChange(category.id)}>
          {category.name}
        </Chip>
      ))}
    </div>
  )
}
