import { useState, type ChangeEvent } from 'react';
import { Upload, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import type { UploadedFileMeta } from './schemas';

const BUCKET = 'order-files';
const MAX_MB = 50;

interface Props {
  label: string;
  fileType: UploadedFileMeta['file_type'];
  accept?: string;
  required?: boolean;
  value: UploadedFileMeta | null;
  onChange: (meta: UploadedFileMeta | null) => void;
  anonFolder: string; // stable folder for this form submission
}

export function FileUpload({ label, fileType, accept = '.pdf,.zip,.ai,.indd,.psd', required, value, onChange, anonFolder }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: `Max ${MAX_MB} MB.` });
      return;
    }
    setBusy(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${anonFolder}/${Date.now()}-${fileType}-${safe}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (error) throw error;
      onChange({
        file_type: fileType,
        file_name: file.name,
        storage_path: path,
        file_size_bytes: file.size,
        mime_type: file.type || 'application/octet-stream',
      });
      toast({ title: 'Uploaded', description: file.name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ variant: 'destructive', title: 'Upload failed', description: msg });
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function clear() {
    if (!value) return;
    await supabase.storage.from(BUCKET).remove([value.storage_path]).catch(() => {});
    onChange(null);
  }

  const inputId = `upload-${fileType}`;

  return (
    <div className="rounded-md border border-dashed p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">
            {label} {required && <span className="text-destructive">*</span>}
          </div>
          <div className="text-xs text-muted-foreground">PDF, AI, INDD, PSD, ZIP — up to {MAX_MB} MB</div>
        </div>
        {value && (
          <Button size="icon" variant="ghost" onClick={clear} type="button" aria-label="Remove file">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {value ? (
        <div className="mt-3 flex items-center gap-2 rounded bg-brand-snow px-3 py-2 text-sm">
          <Check className="h-4 w-4 text-emerald-600" />
          <span className="truncate">{value.file_name}</span>
          <span className="ml-auto text-xs text-muted-foreground">{(value.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
        </div>
      ) : (
        <div className="mt-3">
          <input id={inputId} type="file" accept={accept} className="hidden" onChange={handleFile} disabled={busy} />
          <Button asChild variant="outline" size="sm" type="button" disabled={busy}>
            <label htmlFor={inputId} className="cursor-pointer">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {busy ? 'Uploading…' : 'Choose file'}
            </label>
          </Button>
        </div>
      )}
    </div>
  );
}
