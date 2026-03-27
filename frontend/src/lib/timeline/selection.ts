export function getNextSelectionId(currentId: number | null, orderedIds: number[]): number | null {
  if (orderedIds.length === 0) return null;
  if (currentId === null) return orderedIds[0] ?? null;
  const currentIndex = orderedIds.indexOf(currentId);
  if (currentIndex === -1) return orderedIds[0] ?? null;
  const nextIndex = Math.min(currentIndex + 1, orderedIds.length - 1);
  return orderedIds[nextIndex] ?? null;
}

export function getPreviousSelectionId(
  currentId: number | null,
  orderedIds: number[],
): number | null {
  if (orderedIds.length === 0) return null;
  if (currentId === null) return orderedIds[0] ?? null;
  const currentIndex = orderedIds.indexOf(currentId);
  if (currentIndex === -1) return orderedIds[0] ?? null;
  const prevIndex = Math.max(currentIndex - 1, 0);
  return orderedIds[prevIndex] ?? null;
}

export function getTopmostVisibleId(visibleIds: number[]): number | null {
  return visibleIds[0] ?? null;
}
