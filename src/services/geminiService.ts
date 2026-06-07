/**
 * Client-side integration interface for Gemini Copywriter Assistant.
 * Routes requests securely through the Node.js Express server to shield Gemini API keys.
 */

export interface RefineCopyResponse {
  success: boolean;
  text: string;
  isSimulated: boolean;
  error?: string;
}

/**
 * Sends a draft text and a context block to the server-side Gemini endpoint.
 * Returns refined, premium minimalist lookbook style copy.
 */
export async function refineDraftCopy(
  text: string,
  context?: string
): Promise<RefineCopyResponse> {
  if (!text || !text.trim()) {
    return { success: false, text: '', isSimulated: false, error: 'Text content cannot be blank' };
  }

  try {
    const response = await fetch('/api/refine-copy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        context,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      success: !!data.success,
      text: data.text || '',
      isSimulated: !!data.isSimulated,
    };
  } catch (error: any) {
    console.error("Failed to query Gemini backend proxy:", error);
    return {
      success: false,
      text: '',
      isSimulated: false,
      error: error.message || 'Copywriting refinement request timed out or was blocked.',
    };
  }
}
