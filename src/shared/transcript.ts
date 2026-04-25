export function joinTranscriptParts(parts: string[]): string {
  const raw = parts.filter((part) => part && part.trim()).join(' ');
  return raw.replace(/\s+/g, ' ').trim();
}

export function buildPreview(text: string, maxLength = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxLength - 3))}...`;
}
