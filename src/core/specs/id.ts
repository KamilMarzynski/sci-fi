export function formatFeatureId(sequenceNumber: number): string {
  return `FEAT-${sequenceNumber.toString().padStart(4, "0")}`;
}
