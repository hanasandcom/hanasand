'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { VmWebsitePlan } from '@/utils/vms/fetch/suggestVmSetup'

const inputClass = 'h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-normal text-ui-text outline-none focus-visible:ring-2 focus-visible:ring-ui-primary/20'
const labelClass = 'grid gap-1 text-xs font-medium text-ui-muted'

export default function VmWebsiteEditor({ plan, onChange, disabled }: {
    plan: VmWebsitePlan
    onChange: Dispatch<SetStateAction<VmWebsitePlan>>
    disabled: boolean
}) {
    const gallery = plan.gallery || []

    function updateSection(index: number, field: 'heading' | 'body', value: string) {
        onChange(current => ({
            ...current,
            sections: current.sections.map((section, itemIndex) => itemIndex === index
                ? { ...section, [field]: value }
                : section),
        }))
    }

    function updateImage(index: number, field: 'url' | 'alt' | 'caption', value: string) {
        onChange(current => ({
            ...current,
            gallery: (current.gallery || []).map((image, itemIndex) => itemIndex === index
                ? { ...image, [field]: value }
                : image),
        }))
    }

    return <fieldset disabled={disabled} className='grid min-w-0 gap-3 rounded-xl border border-ui-border bg-ui-panel p-3 sm:p-4'>
        <legend className='px-1 text-sm font-semibold text-ui-text'>Website draft</legend>
        <div className='grid min-w-0 gap-4 xl:grid-cols-2'>
            <div className='grid min-w-0 content-start gap-3'>
                <label className={labelClass}>Page title
                    <input required maxLength={120} value={plan.title}
                        onChange={event => onChange(current => ({ ...current, title: event.target.value }))}
                        className={inputClass} />
                </label>
                <label className={labelClass}>Short introduction
                    <textarea maxLength={120} rows={2} value={plan.tagline}
                        onChange={event => onChange(current => ({ ...current, tagline: event.target.value }))}
                        className={`${inputClass} h-auto resize-y py-2`} />
                </label>

                {plan.sections.map((section, index) => <fieldset key={index} className='grid min-w-0 gap-2 rounded-lg border border-ui-border p-3'>
                    <legend className='px-1 text-xs font-medium text-ui-muted'>Section {index + 1}</legend>
                    <label className={labelClass}>Heading
                        <input maxLength={100} value={section.heading}
                            onChange={event => updateSection(index, 'heading', event.target.value)}
                            className={inputClass} />
                    </label>
                    <label className={labelClass}>Text
                        <textarea maxLength={500} rows={3} value={section.body}
                            onChange={event => updateSection(index, 'body', event.target.value)}
                            className={`${inputClass} h-auto resize-y py-2`} />
                    </label>
                    <button type='button' onClick={() => onChange(current => ({
                        ...current,
                        sections: current.sections.filter((_, itemIndex) => itemIndex !== index),
                    }))} className='justify-self-start rounded-md px-2 py-1 text-xs font-medium text-ui-muted hover:bg-ui-raised hover:text-ui-text'>
                        Remove section
                    </button>
                </fieldset>)}
                <button type='button' disabled={plan.sections.length >= 5} onClick={() => onChange(current => ({
                    ...current,
                    sections: [...current.sections, { heading: '', body: '' }],
                }))} className='h-9 justify-self-start rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-medium text-ui-text hover:bg-ui-panel disabled:opacity-50'>
                    Add section
                </button>

                <label className={labelClass}>Contact email
                    <span className='font-normal'>Optional. Visitors can use it to email you.</span>
                    <input type='email' maxLength={254} value={plan.contactEmail || ''}
                        onChange={event => onChange(current => ({ ...current, contactEmail: event.target.value }))}
                        className={inputClass} />
                </label>

                <fieldset className='grid gap-2'>
                    <legend className='text-xs font-medium text-ui-muted'>Gallery images
                        <span className='font-normal'> Paste HTTPS image links and describe each image.</span>
                    </legend>
                    {gallery.map((image, index) => <div key={index} className='grid gap-2 rounded-lg border border-ui-border p-3'>
                        <label className={labelClass}>Image URL
                            <input type='url' pattern='https://.*' required value={image.url}
                                onChange={event => updateImage(index, 'url', event.target.value)} className={inputClass} />
                        </label>
                        <label className={labelClass}>Image description
                            <input required maxLength={240} value={image.alt}
                                onChange={event => updateImage(index, 'alt', event.target.value)} className={inputClass} />
                        </label>
                        <label className={labelClass}>Caption <span className='font-normal'>Optional</span>
                            <input maxLength={240} value={image.caption}
                                onChange={event => updateImage(index, 'caption', event.target.value)} className={inputClass} />
                        </label>
                        <button type='button' onClick={() => onChange(current => ({
                            ...current,
                            gallery: (current.gallery || []).filter((_, itemIndex) => itemIndex !== index),
                        }))} className='justify-self-start rounded-md px-2 py-1 text-xs font-medium text-ui-muted hover:bg-ui-raised hover:text-ui-text'>
                            Remove image
                        </button>
                    </div>)}
                    <button type='button' disabled={gallery.length >= 8} onClick={() => onChange(current => ({
                        ...current,
                        gallery: [...(current.gallery || []), { url: '', alt: '', caption: '' }],
                    }))} className='h-9 justify-self-start rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-medium text-ui-text hover:bg-ui-panel disabled:opacity-50'>
                        Add image
                    </button>
                </fieldset>
                <p className='text-xs text-ui-muted'>This publishes a responsive static page. A contact email opens the visitor’s email app; uploaded files and contact forms are not included.</p>
            </div>

            <section aria-label='Website preview' className='min-w-0 overflow-hidden rounded-xl border border-ui-border bg-[#f7f5f0] p-3 text-[#20241f] sm:p-5'>
                <div className='mx-auto grid min-h-48 max-w-xl content-start gap-3 rounded-xl bg-[#e9e6dc] p-5 sm:p-7'>
                    <p className='text-[10px] font-semibold uppercase tracking-[0.16em] text-[#62685f]'>Preview</p>
                    <h2 className='wrap-break-word text-3xl font-semibold leading-tight tracking-tight sm:text-4xl'>
                        {plan.title || 'Your page title'}
                    </h2>
                    {plan.tagline && <p className='whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-[#555c56]'>
                        {plan.tagline}
                    </p>}
                </div>
                <div className='mx-auto grid max-w-xl'>
                    {plan.sections.length ? plan.sections.map((section, index) => <article key={index}
                        className='grid gap-1 border-b border-[#d8d7cf] px-1 py-4'>
                        <h3 className='wrap-break-word text-base font-semibold'>{section.heading || 'Section heading'}</h3>
                        {section.body && <p className='whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-[#555c56]'>
                            {section.body}
                        </p>}
                    </article>) : <p className='px-1 py-4 text-sm text-[#62685f]'>Add a section to build out your page.</p>}
                </div>
                {gallery.length > 0 && <div aria-label='Gallery preview' className='mx-auto grid max-w-xl grid-cols-2 gap-2 py-3'>
                    {gallery.map((image, index) => image.url ? <figure key={index}
                        className='overflow-hidden rounded-lg bg-[#e9e6dc]'>
                        <img src={image.url} alt={image.alt} className='aspect-[4/3] w-full object-cover' />
                        {image.caption && <figcaption className='p-2 text-xs text-[#555c56]'>
                            {image.caption}
                        </figcaption>}
                    </figure> : <div key={index}
                        className='grid aspect-[4/3] place-items-center rounded-lg bg-[#e9e6dc] text-xs text-[#62685f]'>
                        Add an HTTPS image link
                    </div>)}
                </div>}
                {plan.contactEmail && <p className='mx-auto grid max-w-xl gap-1 border-t border-[#d8d7cf] px-1 py-4 text-sm'>
                    Contact <span className='font-medium text-[#485b4a]'>{plan.contactEmail}</span>
                </p>}
            </section>
        </div>
    </fieldset>
}
