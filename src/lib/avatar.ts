/**
 * Safe avatar URL extractor & sanitizer
 */
export function getSafeAvatarUrl(metadata?: Record<string, any> | null): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const candidates = [
    metadata.picture,
    metadata.avatar_url,
    metadata.avatarUrl,
    metadata.imageUrl,
    metadata.avatar,
    metadata.image,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (!trimmed) continue;
      if (trimmed.toLowerCase().startsWith('data:') || trimmed.toLowerCase().startsWith('blob:') || trimmed.toLowerCase().startsWith('javascript:')) {
        continue;
      }
      if (/^(https?:\/\/|\/)/i.test(trimmed) && trimmed.length <= 2048) {
        return trimmed;
      }
    }
  }

  return null;
}
