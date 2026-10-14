import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  getNativePushPermission,
  isNativePushAvailable,
  registerNativePush,
  requestNativePushPermission,
  startNativePushListeners,
} from '@/lib/nativePush';

type PromptState = 'hidden' | 'prompt' | 'working';

export function NativePushPrompt() {
  const { user } = useAuth();
  const [state, setState] = useState<PromptState>('hidden');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || !isNativePushAvailable()) return;

    let active = true;
    let cleanup = async () => undefined;

    const initialize = async () => {
      cleanup = await startNativePushListeners((message) => {
        if (active) toast.error(message);
      });

      const permission = await getNativePushPermission();
      if (!active) return;

      if (permission === 'granted') {
        await registerNativePush();
        setState('hidden');
      } else if (permission === 'prompt' || permission === 'prompt-with-rationale') {
        setState('prompt');
      } else {
        setState('hidden');
      }
    };

    initialize().catch((error) => {
      console.error('Failed to initialize native push', error);
    });

    return () => {
      active = false;
      cleanup().catch(() => undefined);
    };
  }, [user?.id]);

  const handleEnable = async () => {
    setState('working');
    try {
      const permission = await requestNativePushPermission();
      if (permission === 'granted') {
        toast.success('Game alerts enabled');
        setState('hidden');
      } else {
        toast.info('Notifications are off. You can enable them later in device settings.');
        setState('hidden');
      }
    } catch (error) {
      console.error('Failed to enable push notifications', error);
      toast.error('Could not enable notifications yet');
      setState('prompt');
    }
  };

  if (!user || state === 'hidden' || dismissed || !isNativePushAvailable()) return null;

  return (
    <div className="fixed left-4 right-4 bottom-20 z-50 mx-auto max-w-md rounded-2xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur-lg">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
        aria-label="Dismiss notification prompt"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-3 pr-7">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold">Stay in the game</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Get matchup, lead-change, score and weekly-result alerts on this device.
          </p>
          <Button
            size="sm"
            className="mt-3"
            disabled={state === 'working'}
            onClick={handleEnable}
          >
            {state === 'working' ? 'Enabling…' : 'Enable game alerts'}
          </Button>
        </div>
      </div>
    </div>
  );
}
