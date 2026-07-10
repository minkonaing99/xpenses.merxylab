import { useState, type FormEvent } from 'react'
import { Trash } from '@phosphor-icons/react'
import { Panel } from '../../ui/Panel'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Banner } from '../../ui/Banner'
import { useCategories } from '../../offline/hooks'
import { createCategory, updateCategory, deleteCategory } from '../../offline/mutations'
import { countTransactionsUsingCategory } from '../../offline/references'
import type { XpensesDb } from '../../offline/db'
import './CategoriesScreen.css'

interface CategoriesScreenProps {
  db: XpensesDb
}

export function CategoriesScreen({ db }: CategoriesScreenProps) {
  const categories = useCategories(db)
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [blockedDelete, setBlockedDelete] = useState<{ name: string; count: number } | null>(null)

  function startEdit(id: string, currentName: string) {
    setEditingId(id)
    setName(currentName)
  }

  async function handleDelete(id: string, categoryName: string) {
    const referenced = await countTransactionsUsingCategory(db, id)
    if (referenced > 0) {
      setBlockedDelete({ name: categoryName, count: referenced })
      return
    }
    setBlockedDelete(null)
    await deleteCategory(db, id)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (editingId) {
      await updateCategory(db, editingId, { name: trimmed })
      setEditingId(null)
    } else {
      await createCategory(db, { name: trimmed })
    }
    setName('')
  }

  return (
    <div className="screen">
      <div className="screen__header">
        <div className="text-screen-title">Categories</div>
      </div>
      <div className="screen__body">
        <Panel>
          <form className="categories__form" onSubmit={handleSubmit}>
            <label className="categories__field" htmlFor="category-name">
              <span className="text-caption-strong">Category name</span>
              <input
                id="category-name"
                className="categories__input text-body"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <Button type="submit" disabled={name.trim().length === 0}>
              {editingId ? 'Save' : 'Add'}
            </Button>
          </form>
        </Panel>

        {blockedDelete && (
          <div className="screen__banner">
            <Banner
              tone="warning"
              message={`Can't delete ${blockedDelete.name} — used by ${blockedDelete.count} transaction${blockedDelete.count === 1 ? '' : 's'}.`}
              onDismiss={() => setBlockedDelete(null)}
            />
          </div>
        )}

        {categories !== undefined && categories.length === 0 ? (
          <EmptyState title="No categories yet" description="Add your first category above." />
        ) : (
          <Panel>
            {categories?.map((category) => (
              <div key={category.id} className="categories__row">
                <button
                  type="button"
                  className="categories__row-label text-body"
                  onClick={() => startEdit(category.id, category.name)}
                >
                  {category.name}
                </button>
                <button
                  type="button"
                  className="categories__delete"
                  aria-label={`Delete ${category.name}`}
                  onClick={() => handleDelete(category.id, category.name)}
                >
                  <Trash size={18} aria-hidden="true" />
                </button>
              </div>
            ))}
          </Panel>
        )}
      </div>
    </div>
  )
}
