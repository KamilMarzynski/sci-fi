export function formatBugId(sequenceNumber: number): string {
  return `BUG-${sequenceNumber.toString().padStart(4, '0')}`;
}
