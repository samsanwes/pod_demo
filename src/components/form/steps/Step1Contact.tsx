import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Step1Values } from '../schemas';
import { BINDING_OPTIONS_PUBLIC, BINDING_LABELS, DELIVERY_METHODS } from '../schemas';
import { titleCase } from '@/lib/utils';

export function Step1Contact() {
  const form = useFormContext<Step1Values>();
  const { register, watch, setValue, formState: { errors } } = form;
  const binding = watch('binding_type');
  const delivery = watch('delivery_method');

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Your name" error={errors.client_name?.message}>
          <Input {...register('client_name')} placeholder="Jane Doe" />
        </Field>
        <Field label="Organisation" error={errors.client_organization?.message}>
          <Input {...register('client_organization')} placeholder="Church / Seminary / Publisher" />
        </Field>
        <Field label="Email" error={errors.client_email?.message}>
          <Input type="email" {...register('client_email')} placeholder="you@example.com" />
        </Field>
        <Field label="Phone" error={errors.client_phone?.message}>
          <Input type="tel" {...register('client_phone')} placeholder="+91 ..." />
        </Field>
      </div>

      <hr />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Print Type / Binding Option" error={errors.binding_type?.message}>
          <Select value={binding} onValueChange={(v) => setValue('binding_type', v as Step1Values['binding_type'], { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="Choose print type…" /></SelectTrigger>
            <SelectContent>
              {BINDING_OPTIONS_PUBLIC.map((b) => (
                <SelectItem key={b} value={b}>{BINDING_LABELS[b]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {binding === 'other' && (
          <Field label="Describe print type" error={errors.binding_type_other?.message}>
            <Input {...register('binding_type_other')} placeholder="e.g. spiral with tabs" />
          </Field>
        )}
        <Field label="Quantity" error={errors.quantity?.message}>
          <Input type="number" min={1} {...register('quantity', { valueAsNumber: true })} />
        </Field>
        <Field label="Required by" error={errors.delivery_date?.message}>
          <Input type="date" {...register('delivery_date')} />
        </Field>
        <Field label="Delivery method" error={errors.delivery_method?.message}>
          <Select value={delivery} onValueChange={(v) => setValue('delivery_method', v as Step1Values['delivery_method'], { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="Choose method…" /></SelectTrigger>
            <SelectContent>
              {DELIVERY_METHODS.map((m) => (
                <SelectItem key={m} value={m}>{titleCase(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {delivery === 'courier' && (
        <Field label="Delivery address" error={errors.delivery_address?.message}>
          <Textarea {...register('delivery_address')} rows={3} placeholder="Full address including pincode" />
        </Field>
      )}

      <Field label="Special instructions" optional>
        <Textarea {...register('special_instructions')} rows={3} placeholder="Anything we should know?" />
      </Field>
    </div>
  );
}

function Field({
  label, error, optional, children,
}: { label: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-2">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
