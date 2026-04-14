const parseHiddenReviewUserIds = (value: string | undefined) => {
  const raw = (value || '').trim();
  if (!raw) {
    return [];
  }

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((id) => String(id || '').trim()).filter(Boolean);
      }
    } catch (error) {
      console.error('Error parsing hidden review user ids', error);
    }
  }

  return raw
    .split(',')
    .map((id) => id.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
};

const hiddenReviewUserIds = new Set(
  parseHiddenReviewUserIds(process.env.NEXT_PUBLIC_HIDDEN_REVIEWS_USER_IDS),
);

export const isHiddenReviewUser = (reviewerId: string | number | undefined) => {
  return hiddenReviewUserIds.has(String(reviewerId || '').trim());
};
