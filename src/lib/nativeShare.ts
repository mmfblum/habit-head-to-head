import { Share } from '@capacitor/share';

interface ShareLinkInput {
  title: string;
  text: string;
  url: string;
}

export async function shareZrizinLink({ title, text, url }: ShareLinkInput): Promise<'shared' | 'copied'> {
  try {
    const capability = await Share.canShare();
    if (capability.value) {
      await Share.share({ title, text, url, dialogTitle: title });
      return 'shared';
    }
  } catch {
    // Fall through to browser APIs so the web app remains shareable.
  }

  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return 'shared';
    }
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
  }

  await navigator.clipboard.writeText(url);
  return 'copied';
}
