import { CATEGORIES, CATEGORY_SINGULAR, COLOR_FAMILIES, OCCASION_LABELS, OCCASIONS, PATTERNS, SEASONS, STYLES } from '../../../shared/taxonomy'
import type { ItemUpdate } from '../../../shared/schemas'
import { useState } from 'react'
import type { Item } from '../../lib/types'
import { ColorChips, Field, Input, MultiChips, Scale, Select, Textarea, cap } from '../ui'

export type ItemDraft = Required<Pick<ItemUpdate, 'name' | 'category' | 'subcategory' | 'colors' | 'pattern' | 'materialEstimate' | 'styles' | 'occasions' | 'seasons' | 'formality' | 'warmth'>> & { brand: string | null; notes: string | null; tags: string[] }

export function draftFrom(i: Item): ItemDraft {
  return {
    name: i.name,
    category: (i.category ?? '') as ItemDraft['category'],
    subcategory: i.subcategory,
    colors: i.colors as ItemDraft['colors'],
    pattern: i.pattern as ItemDraft['pattern'],
    materialEstimate: i.materialEstimate,
    styles: i.styles as ItemDraft['styles'],
    occasions: i.occasions as ItemDraft['occasions'],
    seasons: i.seasons as ItemDraft['seasons'],
    formality: i.formality,
    warmth: i.warmth,
    brand: i.brand,
    notes: i.notes,
    tags: i.tags,
  }
}

/** Only the fields that differ from the stored item. */
export function changedFields(i: Item, d: ItemDraft): ItemUpdate {
  const base = draftFrom(i)
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(d) as (keyof ItemDraft)[]) {
    if (JSON.stringify(base[k]) !== JSON.stringify(d[k])) out[k] = d[k] === '' ? null : d[k]
  }
  return out as ItemUpdate
}

function Estimated({ item, field }: { item: Item; field: string }) {
  if (!item.aiTagged || item.userEditedFields.includes(field)) return null
  return <span className="ml-2 rounded-full bg-[#e4ebee] px-2 py-0.5 text-[10px] normal-case text-ink-soft">Estimated from photo</span>
}

/** Garment attribute form. AI-suggested values are labelled until confirmed or edited. */
export function ItemEditor({ item, draft, onChange, compact }: { item: Item; draft: ItemDraft; onChange: (d: Partial<ItemDraft>) => void; compact?: boolean }) {
  const label = (text: string, field: string) => (
    <>
      {text}
      <Estimated item={item} field={field} />
    </>
  )
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`name-${item.id}`}>
          <Input id={`name-${item.id}`} value={draft.name} maxLength={80} placeholder="e.g. Navy wool overcoat" onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <Field label="Category" htmlFor={`cat-${item.id}`} error={!draft.category ? 'Required' : null}>
          <Select id={`cat-${item.id}`} value={draft.category ?? ''} onChange={(e) => onChange({ category: e.target.value as ItemDraft['category'] })}>
            <option value="" disabled>
              Choose…
            </option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_SINGULAR[c]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div>
        <p className="mb-2 text-[12px] uppercase text-ink-soft">{label('Colours', 'colors')}</p>
        <ColorChips label="Colours" options={COLOR_FAMILIES} value={draft.colors} onChange={(v) => onChange({ colors: v.slice(0, 3) as ItemDraft['colors'] })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor={`sub-${item.id}`}>
          <Input id={`sub-${item.id}`} value={draft.subcategory ?? ''} maxLength={60} placeholder="e.g. trench coat" onChange={(e) => onChange({ subcategory: e.target.value || null })} />
        </Field>
        <Field label="Pattern" htmlFor={`pat-${item.id}`}>
          <Select id={`pat-${item.id}`} value={draft.pattern} onChange={(e) => onChange({ pattern: e.target.value as ItemDraft['pattern'] })}>
            {PATTERNS.map((p) => (
              <option key={p} value={p}>
                {cap(p)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {!compact && (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[12px] uppercase text-ink-soft">{label('Formality', 'formality')}</p>
              <Scale label="Formality" value={draft.formality} onChange={(n) => onChange({ formality: n })} low="Very casual" high="Black tie" />
            </div>
            <div>
              <p className="mb-2 text-[12px] uppercase text-ink-soft">{label('Warmth', 'warmth')}</p>
              <Scale label="Warmth" value={draft.warmth} onChange={(n) => onChange({ warmth: n })} low="Light" high="Heavy" />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[12px] uppercase text-ink-soft">{label('Occasions', 'occasions')}</p>
            <MultiChips label="Occasions" options={OCCASIONS} labels={OCCASION_LABELS} value={draft.occasions} onChange={(v) => onChange({ occasions: v })} />
          </div>
          <div>
            <p className="mb-2 text-[12px] uppercase text-ink-soft">{label('Seasons', 'seasons')}</p>
            <MultiChips label="Seasons" options={SEASONS} value={draft.seasons} onChange={(v) => onChange({ seasons: v })} />
          </div>
          <div>
            <p className="mb-2 text-[12px] uppercase text-ink-soft">{label('Style', 'styles')}</p>
            <MultiChips label="Style" options={STYLES} value={draft.styles} onChange={(v) => onChange({ styles: v })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={'Material (appearance)'} htmlFor={`mat-${item.id}`} hint="What it looks like it’s made of. Edit it if you know.">
              <Input id={`mat-${item.id}`} value={draft.materialEstimate ?? ''} maxLength={80} onChange={(e) => onChange({ materialEstimate: e.target.value || null })} />
            </Field>
            <Field label="Brand" htmlFor={`brand-${item.id}`}>
              <Input id={`brand-${item.id}`} value={draft.brand ?? ''} maxLength={60} onChange={(e) => onChange({ brand: e.target.value || null })} />
            </Field>
          </div>
          <Field label="Tags" htmlFor={`tags-${item.id}`} hint="Comma-separated, e.g. vintage, gift, needs tailoring">
            <TagsInput id={`tags-${item.id}`} value={draft.tags} onChange={(tags) => onChange({ tags })} />
          </Field>
          <Field label="Notes" htmlFor={`notes-${item.id}`}>
            <Textarea id={`notes-${item.id}`} rows={3} maxLength={1000} value={draft.notes ?? ''} onChange={(e) => onChange({ notes: e.target.value || null })} />
          </Field>
        </>
      )}
    </div>
  )
}

function TagsInput({ id, value, onChange }: { id: string; value: string[]; onChange: (t: string[]) => void }) {
  const [text, setText] = useState(value.join(', '))
  return (
    <Input
      id={id}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onChange([...new Set(e.target.value.split(',').map((t) => t.trim().slice(0, 30)).filter(Boolean))].slice(0, 20))
      }}
    />
  )
}
