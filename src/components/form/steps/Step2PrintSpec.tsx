import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUpload } from '../FileUpload';
import type { PrintSpecValues, UploadedFileMeta } from '../schemas';
import { PAPER_SIZES, COLOUR_MODES } from '../schemas';
import { titleCase } from '@/lib/utils';

interface Props {
  files: UploadedFileMeta[];
  setFiles: (next: UploadedFileMeta[]) => void;
  anonFolder: string;
}

export function Step2PrintSpec({ files, setFiles, anonFolder }: Props) {
  const form = useFormContext<PrintSpecValues>();
  const { register, watch, setValue, formState: { errors } } = form;
  const size = watch('paper_size');
  const printing = (watch('printing_type') ?? []) as PrintSpecValues['printing_type'];
  const printFile = files.find((f) => f.file_type === 'print_file') ?? null;

  function toggle(mode: 'bw' | 'colour') {
    const next = printing.includes(mode) ? printing.filter((p) => p !== mode) : [...printing, mode];
    setValue('printing_type', next, { shouldValidate: true });
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Printing colour</Label>
          <div className="flex gap-2">
            {COLOUR_MODES.map((c) => {
              const on = printing.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggle(c)}
                  className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                    on ? 'bg-primary text-primary-foreground' : 'bg-white hover:bg-brand-snow'
                  }`}
                >
                  {c === 'bw' ? 'Black & white' : 'Colour'}
                </button>
              );
            })}
          </div>
          {errors.printing_type?.message && <p className="text-xs text-destructive">{errors.printing_type.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Printing sides</Label>
          <Select value={watch('printing_sides')} onValueChange={(v) => setValue('printing_sides', v as PrintSpecValues['printing_sides'], { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="Single or double…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single-sided</SelectItem>
              <SelectItem value="double">Double-sided</SelectItem>
            </SelectContent>
          </Select>
          {errors.printing_sides?.message && <p className="text-xs text-destructive">{errors.printing_sides.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Paper size</Label>
          <Select value={size} onValueChange={(v) => setValue('paper_size', v as PrintSpecValues['paper_size'], { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="Choose size…" /></SelectTrigger>
            <SelectContent>
              {PAPER_SIZES.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          {errors.paper_size?.message && <p className="text-xs text-destructive">{errors.paper_size.message}</p>}
        </div>

        {size === 'other' && (
          <div className="space-y-1.5">
            <Label>Custom paper size</Label>
            <Input {...register('paper_size_other')} placeholder="e.g. 9x12 inches" />
            {errors.paper_size_other?.message && <p className="text-xs text-destructive">{errors.paper_size_other.message}</p>}
          </div>
        )}
      </div>

      <hr />
      <div>
        <h3 className="font-display text-lg font-semibold">Upload print-ready file</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF preferred. Optional — you can also share files via email after submitting.
        </p>
        <div className="mt-4 max-w-md">
          <FileUpload
            label="Print file"
            fileType="print_file"
            value={printFile}
            onChange={(m) => {
              const others = files.filter((f) => f.file_type !== 'print_file');
              setFiles(m ? [...others, m] : others);
            }}
            anonFolder={anonFolder}
          />
        </div>
      </div>
    </div>
  );
}
