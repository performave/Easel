import { HTMLAttributes, ReactNode } from 'react'
import { Controller } from 'react-hook-form'

import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from '@/components/ui/field'
import { RichTextEditor } from '@/components/ui/rich-text-editor'

interface RichTextFieldProps {
    name: string
    label?: string
    description?: ReactNode
    placeholder?: string
    fieldProps?: HTMLAttributes<HTMLDivElement>
}

export function RichTextField({
    name,
    label,
    description,
    placeholder,
    fieldProps,
}: RichTextFieldProps) {
    return (
        <Controller
            name={name}
            render={({ field, fieldState, formState }) => (
                <Field data-invalid={!!fieldState.error} {...fieldProps}>
                    {label && <FieldLabel>{label}</FieldLabel>}
                    <RichTextEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={placeholder}
                        disabled={formState.isSubmitting}
                    />
                    {description && (
                        <FieldDescription>{description}</FieldDescription>
                    )}
                    {fieldState.error && (
                        <FieldError>{fieldState.error.message}</FieldError>
                    )}
                </Field>
            )}
        />
    )
}
