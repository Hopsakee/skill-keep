import { toast } from 'sonner';

/**
 * Copy text to clipboard with toast feedback
 */
export async function copyToClipboard(
  text: string,
  successMessage: string = 'Gekopieerd naar clipboard',
  errorMessage: string = 'Kopiëren mislukt'
): Promise<boolean> {
  if (!text) {
    toast.error('Geen content om te kopiëren');
    return false;
  }
  
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
    return true;
  } catch {
    toast.error(errorMessage);
    return false;
  }
}
