'use client'

import type { ReactNode } from 'react'
import { Building2, CheckCircle2, LoaderCircle, Mail, MessageSquareText, Send, UserRound } from 'lucide-react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import ErrorNotice from '@/components/error/errorNotice'
import { useState } from 'react'
import { submitContactRequest } from '@/utils/contact/submitContactRequest'

const fieldClassName = 'w-full rounded-lg border border-ui-border bg-ui-panel px-3 py-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/15'

type ContactResult = {
    ticketId: string
    nextStep: string
}

export default function Contact() {
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [result, setResult] = useState<ContactResult | null>(null)
    const validationSchema = Yup.object().shape({
        name: Yup.string().required('Name is required'),
        email: Yup.string().email('Invalid email').required('Email is required'),
        company: Yup.string(),
        type: Yup.string().min(5, 'Subject must be at least 5 characters').required('Subject is required'),
        message: Yup.string().min(20, 'Message must be at least 20 characters').required('Message is required'),
    })

    const formik = useFormik({
        initialValues: {
            name: '',
            email: '',
            company: '',
            type: '',
            message: '',
        },
        validationSchema,
        onSubmit: async (values) => {
            setSubmitting(true)
            setSubmitError('')
            setResult(null)
            try {
                const payload = await submitContactRequest({
                    name: values.name,
                    email: values.email,
                    company: values.company,
                    subject: values.type,
                    message: values.message,
                    source: window.location.pathname,
                })
                setResult({
                    ticketId: payload.ticketId || 'received',
                    nextStep: payload.nextStep || 'We received your request and will reply by email.',
                })
                formik.resetForm({ values })
            } catch (error) {
                setSubmitError(error instanceof Error ? error.message : 'Unable to send the request right now.')
            } finally {
                setSubmitting(false)
            }
        }
    })

    const canSubmit = formik.isValid && formik.dirty && !submitting

    return (
        <section className='min-h-app-viewport bg-ui-canvas px-4 py-12 text-ui-text md:px-8 md:py-18'>
            <div className='mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.65fr_1.35fr] lg:items-start'>
                <div className='grid gap-3'>
                    <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>Contact us</h1>
                    <a href='mailto:contact@hanasand.com' className='inline-flex w-fit items-center gap-2 text-sm font-semibold text-ui-primary hover:text-ui-primary/80'>
                        <Mail className='h-4 w-4' /> contact@hanasand.com
                    </a>
                </div>

                <form className='grid gap-5 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-lg md:p-7' onSubmit={formik.handleSubmit}>
                    {result ? (
                        <div className='rounded-lg border border-ui-success/35 bg-ui-success/10 p-4 text-sm leading-6 text-ui-success'>
                            <div className='flex items-center gap-2 font-semibold'>
                                <CheckCircle2 className='h-4 w-4' />
                                Request received
                            </div>
                            <p className='mt-2'>Ticket <span className='font-mono font-semibold'>{result.ticketId}</span>. {result.nextStep}</p>
                        </div>
                    ) : null}

                    <ErrorNotice compact message={submitError} />

                    <Field icon={<UserRound className='h-4 w-4 text-ui-muted' />} label='Name' error={formik.touched.name ? formik.errors.name : undefined}>
                        <input type='text' className={fieldClassName} {...formik.getFieldProps('name')} placeholder='Name' autoComplete='name' />
                    </Field>

                    <Field icon={<Mail className='h-4 w-4 text-ui-muted' />} label='Email' error={formik.touched.email ? formik.errors.email : undefined}>
                        <input type='email' className={fieldClassName} {...formik.getFieldProps('email')} placeholder='name@company.com' autoComplete='email' />
                    </Field>

                    <Field icon={<Building2 className='h-4 w-4 text-ui-muted' />} label='Company or team' error={formik.touched.company ? formik.errors.company : undefined}>
                        <input type='text' className={fieldClassName} {...formik.getFieldProps('company')} placeholder='Optional' autoComplete='organization' />
                    </Field>

                    <Field icon={<MessageSquareText className='h-4 w-4 text-ui-muted' />} label='Subject' error={formik.touched.type ? formik.errors.type : undefined}>
                        <input type='text' className={fieldClassName} {...formik.getFieldProps('type')} placeholder='What is this about?' />
                    </Field>

                    <Field icon={<MessageSquareText className='h-4 w-4 text-ui-muted' />} label='Message' error={formik.touched.message ? formik.errors.message : undefined}>
                        <textarea {...formik.getFieldProps('message')} placeholder='How can we help?' className={`${fieldClassName} min-h-44 resize-y`} />
                    </Field>

                    <button
                        type='submit'
                        className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${canSubmit ? 'bg-ui-primary text-ui-on-primary hover:bg-ui-primary/90' : 'cursor-not-allowed border border-ui-border bg-ui-raised text-ui-muted'}`}
                        disabled={!canSubmit}
                    >
                        {submitting ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
                        {submitting ? 'Sending' : 'Send request'}
                    </button>
                </form>
            </div>
        </section>
    )
}

function Field({ label, icon, error, children }: { label: string, icon: ReactNode, error?: string, children: ReactNode }) {
    return (
        <label className='grid gap-2'>
            <span className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                {icon}
                {label}
            </span>
            {children}
            {error && <ErrorNotice compact message={error} />}
        </label>
    )
}
