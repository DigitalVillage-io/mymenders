import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Select, { type GroupBase, type MultiValue } from 'react-select';
import type { Vendor } from '../types';
import { getGroupedTaxonomyOptions, getTaxonomyOptions } from '../../shared/vendorTaxonomy.js';

type Props = {
  value: Vendor;
  saving?: boolean;
  onSave: (value: Vendor) => void;
  onVisibilityChange?: (visibility: 'exact' | 'approx') => void;
  onCancel?: () => void;
};
type Option = { value: string; label: string };
type CategoryGroup = GroupBase<Option>;
const inputClass = 'mymenders-field mymenders-field--mono w-full border px-3 py-2 text-sm outline-none';
const taxonomy = (group: string) => getTaxonomyOptions(group).map((item) => ({ value: item.id, label: item.label }));
const categoryOptions: CategoryGroup[] = getGroupedTaxonomyOptions('categories').map((group) => ({ label: group.label, options: group.options.map((item) => ({ value: item.id, label: item.label })) }));
const selectStyles = {
  control: (base: any) => ({ ...base, backgroundColor: '#ffffff', borderColor: '#d5d5d5', borderRadius: '0.625rem', minHeight: '2.5rem', fontSize: '0.8125rem', boxShadow: 'none', '&:hover': { borderColor: '#aaa' } }),
  menu: (base: any) => ({ ...base, backgroundColor: '#ffffff', borderRadius: '0.75rem', boxShadow: '0 12px 28px rgba(15, 23, 42, 0.12)', fontSize: '0.875rem', overflow: 'hidden', zIndex: 50 }),
  menuPortal: (base: any) => ({ ...base, zIndex: 3300 }),
  multiValue: (base: any) => ({ ...base, backgroundColor: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: '999px' }),
  multiValueLabel: (base: any) => ({ ...base, color: '#555', fontSize: '0.75rem', padding: '0.125rem 0.5rem' }),
  multiValueRemove: (base: any) => ({ ...base, '&:hover': { backgroundColor: '#0a0a0a', color: '#ffffff' } }),
  placeholder: (base: any) => ({ ...base, color: '#999' }),
  option: (base: any, state: any) => ({ ...base, backgroundColor: state.isFocused || state.isSelected ? '#f5f5f5' : '#ffffff', color: '#111', '&:active': { backgroundColor: '#e0e0e0' } }),
};

export function MenderEditor({ value, saving, onSave, onVisibilityChange, onCancel }: Props) {
  const [form, setForm] = useState<Vendor>(value);
  useEffect(() => setForm(value), [value]);
  const set = (key: keyof Vendor, next: unknown) => setForm((current) => ({ ...current, [key]: next }));
  const selected = (key: 'types' | 'categories' | 'regional_techniques') => form[key] || [];
  const submit = (event: FormEvent) => { event.preventDefault(); onSave(form); };
  return <form onSubmit={submit} className="space-y-6">
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-4">
        <Field label="Mender / studio name"><input className={inputClass} value={form.name || ''} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Entry level"><select className={inputClass} value={form.entry_level || form.category || 'Menders'} onChange={(e) => { set('entry_level', e.target.value); set('category', e.target.value); }}><option>Menders</option><option>Member of the public</option></select></Field>
        <Field label="Studio type"><TaxonomyMultiSelect options={taxonomy('types')} value={selected('types')} onChange={(values) => set('types', values)} /></Field>
        <Field label="Categories"><TaxonomyMultiSelect options={categoryOptions} value={selected('categories')} onChange={(values) => set('categories', values)} /></Field>
        <Field label="Regional techniques"><TaxonomyMultiSelect options={taxonomy('regional_techniques')} value={selected('regional_techniques')} onChange={(values) => set('regional_techniques', values)} /></Field>
        <Field label="Rating"><input type="number" min="0" max="5" step="0.1" className={inputClass} value={form.rating || 0} onChange={(e) => set('rating', Number(e.target.value))} /></Field>
      </div>
      <div className="space-y-4">
        <Field label="Status"><select className={inputClass} value={form.status || 'active'} onChange={(e) => set('status', e.target.value as Vendor['status'])}><option value="draft">Draft</option><option value="active">Active</option></select></Field>
        <Field label="Location visibility"><select className={inputClass} disabled={saving} value={form.location_visibility || 'exact'} onChange={(e) => { const visibility = e.target.value as 'exact' | 'approx'; set('location_visibility', visibility); onVisibilityChange?.(visibility); }}><option value="exact">Exact address/pin</option><option value="approx">Approximate zone (200 m)</option></select><span className="mt-1.5 block text-[11px] leading-[1.35] text-[#777]">Visibility changes publish immediately. Approximate locations never expose the canonical address or coordinates.</span></Field>
        <Field label="Address"><input className={inputClass} value={form.address || ''} onChange={(e) => set('address', e.target.value)} /></Field>
        <div className="grid gap-4 grid-cols-2"><Field label="Latitude"><input type="number" step="any" className={inputClass} value={form.latitude} onChange={(e) => set('latitude', Number(e.target.value))} /></Field><Field label="Longitude"><input type="number" step="any" className={inputClass} value={form.longitude} onChange={(e) => set('longitude', Number(e.target.value))} /></Field></div>
        <Field label="Telephone"><input className={inputClass} value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Website"><input type="text" className={inputClass} value={form.website || ''} onChange={(e) => set('website', e.target.value)} /></Field>
        <Field label="Social"><input type="text" className={inputClass} value={form.social || ''} onChange={(e) => set('social', e.target.value)} /></Field>
        <Field label="Email address"><input type="email" className={inputClass} value={form.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Photo URL"><input className={inputClass} value={form.photo_url || ''} onChange={(e) => set('photo_url', e.target.value)} /></Field>
      </div>
    </div>
    <Field label="Review / notes"><textarea rows={4} className={inputClass} value={form.review_text || ''} onChange={(e) => set('review_text', e.target.value)} /></Field>
    <div className="flex gap-3 border-t border-[#e5e5e5] pt-5"><button type="submit" disabled={saving} className="admin-action rounded-full bg-[#0a0a0a] px-5 py-2.5 text-sm text-white hover:bg-black disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button>{onCancel && <button type="button" onClick={onCancel} className="admin-action rounded-full border border-[#d5d5d5] bg-white px-5 py-2.5 text-sm">Cancel</button>}</div>
  </form>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="add-mender-modal-label mb-1.5 block text-[11px] uppercase">{label}</span>{children}</label>; }
function TaxonomyMultiSelect({ options, value, onChange }: { options: Option[] | CategoryGroup[]; value: string[]; onChange: (values: string[]) => void }) {
  const flatOptions = options.flatMap((option) => 'options' in option ? option.options : option);
  return <Select<Option, true>
    isMulti
    closeMenuOnSelect={false}
    options={options}
    value={flatOptions.filter((option) => value.includes(option.value))}
    onChange={(selected: MultiValue<Option>) => onChange(selected.map((option) => option.value))}
    placeholder="Select..."
    menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
    menuPosition="fixed"
    styles={selectStyles}
  />;
}
