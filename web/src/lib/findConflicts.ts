export type ScheduledItem = {
  id: string;
  startAt: Date;
  endAt: Date;
};

export function findConflicts(items: ScheduledItem[]): Set<string> {
  const conflicts = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.startAt < b.endAt && b.startAt < a.endAt) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }
  return conflicts;
}
