import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useSubmitCheckin } from '@/hooks/useTasksWithCheckins';
import type { TaskWithTemplate } from '@/types/checkin';

export function ReadingSharePrompt({ task, date }: { task: TaskWithTemplate; date?: Date }) {
  const submit = useSubmitCheckin();
  const checkin = task.todayCheckin;
  const metadata = useMemo(() => (checkin?.metadata || {}) as Record<string, unknown>, [checkin?.metadata]);
  const isReading = /reading/i.test(task.task_name) || /reading/i.test(task.template?.name || '');
  const shouldPrompt = !!checkin && isReading && !metadata.reading_note && metadata.reading_prompt_skipped !== true;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (shouldPrompt) setOpen(true);
  }, [shouldPrompt, checkin?.id]);

  if (!checkin || !isReading) return null;

  const saveMetadata = async (patch: Record<string, unknown>) => {
    await submit.mutateAsync({
      taskInstanceId: task.id,
      date,
      value: {
        boolean_value: checkin.boolean_value ?? undefined,
        numeric_value: checkin.numeric_value ?? undefined,
        time_value: checkin.time_value ?? undefined,
        duration_minutes: checkin.duration_minutes ?? undefined,
        metadata: { ...metadata, ...patch },
      },
    });
  };

  const skip = async () => {
    await saveMetadata({ reading_prompt_skipped: true });
    setOpen(false);
  };

  const share = async () => {
    const clean = note.trim();
    if (!clean) return;
    await saveMetadata({ reading_note: clean, reading_shared_at: new Date().toISOString(), reading_prompt_skipped: false });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-2"><BookOpen className="w-5 h-5" /></div>
          <DialogTitle>What did you read?</DialogTitle>
          <p className="text-sm text-muted-foreground">Optional. Share a little context with the league so Reading feels like a real activity, not just +3.</p>
        </DialogHeader>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={180} rows={3} placeholder="20 pages of To Kill a Mockingbird" autoFocus />
        <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={() => void skip()} disabled={submit.isPending}>Skip</Button>
          <Button type="button" onClick={() => void share()} disabled={submit.isPending || !note.trim()} className="gap-2"><Send className="w-4 h-4" />Share</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
