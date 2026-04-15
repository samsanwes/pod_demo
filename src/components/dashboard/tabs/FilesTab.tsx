import { useEffect, useState } from 'react';
import { Download, File as FileIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { OrderFileRow } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
import { titleCase, formatDateTime } from '@/lib/utils';

export function FilesTab({ orderId }: { orderId: string }) {
  const [files, setFiles] = useState<OrderFileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('order_files')
        .select('*')
        .eq('order_id', orderId)
        .order('uploaded_at', { ascending: true });
      if (cancelled) return;
      if (error) console.error(error);
      setFiles((data ?? []) as OrderFileRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  async function download(f: OrderFileRow) {
    const { data, error } = await supabase.storage.from('order-files').createSignedUrl(f.storage_path, 60);
    if (error || !data) return;
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = f.file_name;
    a.click();
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading files…</div>;
  if (files.length === 0) return <div className="text-sm text-muted-foreground">No files uploaded.</div>;

  return (
    <ul className="space-y-2">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 rounded-md border bg-white p-3">
          <FileIcon className="h-5 w-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{f.file_name}</div>
            <div className="text-xs text-muted-foreground">
              {titleCase(f.file_type)} · {f.file_size_bytes ? `${(f.file_size_bytes / 1024 / 1024).toFixed(1)} MB · ` : ''}
              uploaded {formatDateTime(f.uploaded_at)}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => download(f)}>
            <Download className="mr-1 h-4 w-4" /> Download
          </Button>
        </li>
      ))}
    </ul>
  );
}
