import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUpload } from '../FileUpload';
import type { BookSpecValues, UploadedFileMeta } from '../schemas';
import {
  TRIM_SIZES,
  TEXT_PAPER_OPTIONS,
  COVER_PAPER_OPTIONS,
  COLOUR_MODES,
  LAMINATION_OPTIONS,
} from '../schemas';
import { titleCase } from '@/lib/utils';

interface Props {
  files: UploadedFileMeta[];
  setFiles: (next: UploadedFileMeta[]) => void;
  anonFolder: string;
}

export function Step2BookSpec({ files, setFiles, anonFolder }: Props) {
  const form = useFormContext<BookSpecValues>();
  const { register, watch, setValue, formState: { errors } } = form;
  const trim = watch('trim_size');

  const inner = files.find((f) => f.file_type === 'inner_pages') ?? null;
  const cover = files.find((f) => f.file_type === 'cover_page') ?? null;

  function setOne(next: UploadedFileMeta | null, type: UploadedFileMeta['file_type']) {
    const others = files.filter((f) => f.file_type !== type);
    setFiles(next ? [...others, next] : others);
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Trim size" error={errors.trim_size?.message}>
          <Select value={trim} onValueChange={(v) => setValue('trim_size', v as BookSpecValues['trim_size'], { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="Choose trim size…" /></SelectTrigger>
            <SelectContent>
              {TRIM_SIZES.map((t) => <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        {trim === 'other' && (
          <Field label="Custom trim size" error={errors.trim_size_other?.message}>
            <Input {...register('trim_size_other')} placeholder="e.g. 5x7 inches" />
          </Field>
        )}
        <Field label="Page count" error={errors.num_pages?.message}>
          <Input type="number" min={1} {...register('num_pages', { valueAsNumber: true })} />
        </Field>
        <Field label="Text paper" error={errors.paper_type?.message}>
          <Select value={watch('paper_type')} onValueChange={(v) => setValue('paper_type', v, { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="Choose text paper…" /></SelectTrigger>
            <SelectContent>
              {TEXT_PAPER_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Cover paper" error={errors.cover_paper_type?.message}>
          <Select value={watch('cover_paper_type')} onValueChange={(v) => setValue('cover_paper_type', v, { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="Choose cover paper…" /></SelectTrigger>
            <SelectContent>
              {COVER_PAPER_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Inner pages printing" error={errors.inner_printing?.message}>
          <Select value={watch('inner_printing')} onValueChange={(v) => setValue('inner_printing', v as BookSpecValues['inner_printing'], { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="B/W or colour…" /></SelectTrigger>
            <SelectContent>
              {COLOUR_MODES.map((c) => <SelectItem key={c} value={c}>{c === 'bw' ? 'Black & white' : 'Colour'}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Cover printing" error={errors.cover_printing?.message}>
          <Select value={watch('cover_printing')} onValueChange={(v) => setValue('cover_printing', v as BookSpecValues['cover_printing'], { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="B/W or colour…" /></SelectTrigger>
            <SelectContent>
              {COLOUR_MODES.map((c) => <SelectItem key={c} value={c}>{c === 'bw' ? 'Black & white' : 'Colour'}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Cover lamination" error={errors.cover_lamination?.message}>
          <Select value={watch('cover_lamination')} onValueChange={(v) => setValue('cover_lamination', v as BookSpecValues['cover_lamination'], { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="Choose finish…" /></SelectTrigger>
            <SelectContent>
              {LAMINATION_OPTIONS.map((l) => <SelectItem key={l} value={l}>{titleCase(l)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <hr />
      <div>
        <h3 className="font-display text-lg font-semibold">Upload print-ready files</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF preferred. Optional — you can also share files via email after submitting.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <FileUpload label="Inner pages" fileType="inner_pages" value={inner} onChange={(m) => setOne(m, 'inner_pages')} anonFolder={anonFolder} />
          <FileUpload label="Cover" fileType="cover_page" value={cover} onChange={(m) => setOne(m, 'cover_page')} anonFolder={anonFolder} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
