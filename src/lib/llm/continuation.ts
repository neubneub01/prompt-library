/**
 * Continuation parsing utilities for packetized prompt outputs
 * 
 * Detects "NEXT PROMPT TO CONTINUE:" patterns in LLM responses
 * to enable the Continue button UX for multi-packet workflows
 */

// Various patterns the LLM might use to indicate continuation
const CONTINUATION_PATTERNS = [
  // Standard format
  /NEXT PROMPT TO CONTINUE:\s*(.+?)(?:\n|$)/im,
  // XML-style (more structured)
  /<!--\s*CONTINUATION_PROMPT:\s*(.+?)\s*-->/i,
  // Markdown code block style (without 's' flag, use [\s\S] instead)
  /```continuation\n([\s\S]+?)\n```/i,
  // JSON-style
  /"continuation_prompt":\s*"(.+?)"/i,
  // Simple arrow format
  /→\s*CONTINUE:\s*(.+?)(?:\n|$)/im,
  // Packet indicator
  /PACKET \d+ COMPLETE[.\s]*(?:Continue with|Next):\s*(.+?)(?:\n|$)/im,
];

export interface ContinuationResult {
  found: boolean;
  prompt: string | null;
  // The position where the continuation marker was found (for potential removal from display)
  startIndex: number | null;
  endIndex: number | null;
}

/**
 * Parse a response to find a continuation prompt
 */
export function parseContinuation(response: string): ContinuationResult {
  for (const pattern of CONTINUATION_PATTERNS) {
    const match = response.match(pattern);
    if (match && match[1]) {
      return {
        found: true,
        prompt: match[1].trim(),
        startIndex: match.index ?? null,
        endIndex: match.index !== undefined ? match.index + match[0].length : null,
      };
    }
  }
  
  return {
    found: false,
    prompt: null,
    startIndex: null,
    endIndex: null,
  };
}

/**
 * Remove the continuation marker from a response for cleaner display
 */
export function stripContinuationMarker(response: string): string {
  let cleaned = response;
  
  for (const pattern of CONTINUATION_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Clean up any trailing whitespace/newlines
  return cleaned.trimEnd();
}

/**
 * Check if a response likely has more packets coming
 * based on the presence of continuation markers or packet indicators
 */
export function hasMorePackets(response: string): boolean {
  const continuation = parseContinuation(response);
  if (continuation.found) return true;
  
  // Also check for packet numbering without explicit continuation
  const packetMatch = response.match(/PACKET (\d+) OF (\d+)/i);
  if (packetMatch) {
    const current = parseInt(packetMatch[1], 10);
    const total = parseInt(packetMatch[2], 10);
    return current < total;
  }
  
  return false;
}

/**
 * Build a continuation message that includes context from the previous response
 */
export function buildContinuationMessage(
  continuationPrompt: string,
  previousResponse?: string
): string {
  // If there's a previous response, we might want to reference it
  if (previousResponse) {
    // Just use the continuation prompt - the LLM should have context from the system prompt
    return continuationPrompt;
  }
  
  return continuationPrompt;
}
