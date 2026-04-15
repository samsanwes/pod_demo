import { useMemo, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Step1Contact } from './steps/Step1Contact';
import { Step2BookSpec } from './steps/Step2BookSpec';
import { Step2PrintSpec } from './steps/Step2PrintSpec';
import { Step3Review } from './steps/Step3Review';
import {
  step1Schema, bookSpecSchema, printSpecSchema,
  type Step1Values, type BookSpecValues, type PrintSpecValues, type UploadedFileMeta,
} from './schemas';

type StepId = 1 | 2 | 3;

export function OrderForm() {
  const [step, setStep] = useState<StepId>(1);
  const [contact, setContact] = useState<Step1Values | null>(null);
  const [bookSpec, setBookSpec] = useState<BookSpecValues | null>(null);
  const [printSpec, setPrintSpec] = useState<PrintSpecValues | null>(null);
  const [files, setFiles] = useState<UploadedFileMeta[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Stable anon folder for Storage uploads from this form submission
  const anonFolder = useMemo(
    () => `anon/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}`,
    []
  );

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: contact ?? {
      client_name: '', client_email: '', client_phone: '', client_organization: '',
      binding_type: 'perfect', quantity: 50, delivery_date: '',
      delivery_method: 'pickup', delivery_address: '', special_instructions: '',
      binding_type_other: '',
    },
    mode: 'onBlur',
  });

  const bookForm = useForm<BookSpecValues>({
    resolver: zodResolver(bookSpecSchema),
    defaultValues: bookSpec ?? {
      trim_size: 'A5', trim_size_other: '', num_pages: 100, paper_type: 'Maplitho 80gsm',
      cover_printing: 'colour', inner_printing: 'bw', cover_lamination: 'matte',
    },
    mode: 'onBlur',
  });

  const printForm = useForm<PrintSpecValues>({
    resolver: zodResolver(printSpecSchema),
    defaultValues: printSpec ?? {
      printing_type: ['bw'], printing_sides: 'double', paper_size: 'A4', paper_size_other: '',
    },
    mode: 'onBlur',
  });

  const isPerfect = contact?.binding_type === 'perfect';

  async function nextFrom1() {
    const ok = await step1Form.trigger();
    if (!ok) return;
    setContact(step1Form.getValues());
    setStep(2);
  }

  async function nextFrom2() {
    if (!contact) return;
    if (contact.binding_type === 'perfect') {
      const ok = await bookForm.trigger();
      if (!ok) return;
      setBookSpec(bookForm.getValues());
    } else {
      const ok = await printForm.trigger();
      if (!ok) return;
      setPrintSpec(printForm.getValues());
    }
    setStep(3);
  }

  async function submit() {
    if (!contact) return;
    setSubmitting(true);
    try {
      // Generate UUID client-side — anon has INSERT but no SELECT policy, so we
      // can't round-trip via RETURNING. Using a known id lets us link files and
      // call the edge function without reading the row back.
      const orderId = crypto.randomUUID();
      const orderPayload: Record<string, unknown> = {
        id: orderId,
        status: 'new',
        ...contact,
      };

      if (contact.binding_type === 'perfect' && bookSpec) {
        Object.assign(orderPayload, {
          trim_size: bookSpec.trim_size,
          trim_size_other: bookSpec.trim_size_other || null,
          num_pages: bookSpec.num_pages,
          paper_type: bookSpec.paper_type,
          cover_printing: bookSpec.cover_printing,
          inner_printing: bookSpec.inner_printing,
          cover_lamination: bookSpec.cover_lamination,
        });
      } else if (printSpec) {
        Object.assign(orderPayload, {
          printing_type: printSpec.printing_type,
          printing_sides: printSpec.printing_sides,
          paper_size: printSpec.paper_size,
          paper_size_other: printSpec.paper_size_other || null,
        });
      }

      // Empty-string normalizations (DB prefers NULL)
      ['binding_type_other', 'delivery_address', 'special_instructions'].forEach((k) => {
        if (orderPayload[k] === '') orderPayload[k] = null;
      });

      const { error: insertErr } = await supabase.from('orders').insert(orderPayload);
      if (insertErr) throw insertErr;

      // Insert file rows
      if (files.length > 0) {
        const { error: filesErr } = await supabase.from('order_files').insert(
          files.map((f) => ({
            order_id: orderId,
            file_type: f.file_type,
            file_name: f.file_name,
            storage_path: f.storage_path,
            file_size_bytes: f.file_size_bytes,
            mime_type: f.mime_type,
          }))
        );
        if (filesErr) throw filesErr;
      }

      // Ask the edge function to assign POD-YYYY-NNNN.
      // Time-box this so a slow edge-function cold start doesn't hang submission.
      // If we time out, the order is already saved with status=new and the manager
      // can still run the function later via the dashboard.
      let orderNumber = orderId.slice(0, 8);
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 8000)
        );
        const call = supabase.functions
          .invoke('generate-order-number', { body: { order_id: orderId } })
          .then((r) => r as { data: unknown; error: unknown });
        const { data: fnData } = (await Promise.race([call, timeout])) as { data: unknown };
        if (fnData && typeof fnData === 'object' && 'order_number' in fnData) {
          orderNumber = String((fnData as { order_number: string }).order_number);
        }
      } catch (err) {
        // Non-fatal — order_number can be assigned later by manager
        console.warn('[order] generate-order-number fn failed', err);
      }

      navigate(`/order-submitted/${encodeURIComponent(orderNumber)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Submission failed', description: msg });
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Place a print order</CardTitle>
          <div className="text-sm text-muted-foreground">Step {step} of 3</div>
        </div>
        <CardDescription>
          Tell us about your project. We'll review it and send you a quote.
        </CardDescription>
        <ProgressBar step={step} />
      </CardHeader>
      <CardContent>
        {step === 1 && (
          <FormProvider {...step1Form}>
            <Step1Contact />
          </FormProvider>
        )}
        {step === 2 && contact && (
          isPerfect ? (
            <FormProvider {...bookForm}>
              <Step2BookSpec files={files} setFiles={setFiles} anonFolder={anonFolder} />
            </FormProvider>
          ) : (
            <FormProvider {...printForm}>
              <Step2PrintSpec files={files} setFiles={setFiles} anonFolder={anonFolder} />
            </FormProvider>
          )
        )}
        {step === 3 && contact && (
          <Step3Review contact={contact} bookSpec={bookSpec} printSpec={printSpec} files={files} />
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button type="button" variant="ghost" disabled={step === 1} onClick={() => setStep((s) => (s - 1) as StepId)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>

          {step < 3 && (
            <Button type="button" onClick={step === 1 ? nextFrom1 : nextFrom2}>
              Continue <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 3 && (
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitting ? 'Submitting…' : 'Submit order'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressBar({ step }: { step: StepId }) {
  return (
    <div className="mt-3 flex gap-2">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            n <= step ? 'bg-primary' : 'bg-muted'
          }`}
        />
      ))}
    </div>
  );
}
