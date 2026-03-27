export interface ReconciliationSweep {
  serverUnreadIds: Set<number>;
  removedIds: number[];
  checkedAt: number;
}
