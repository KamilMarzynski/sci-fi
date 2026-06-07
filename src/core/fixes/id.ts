export function formatFixId(sequenceNumber: number): string {
  return `FIX-${sequenceNumber.toString().padStart(4, '0')}`;
}
