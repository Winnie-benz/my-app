export function calcAvgCost(
  oldStock: number,
  oldAvg: number,
  newQty: number,
  newCost: number,
): number {
  const total = oldStock + newQty
  if (total === 0) return 0
  return (oldStock * oldAvg + newQty * newCost) / total
}

export function generateBarcode(): string {
  return String(Math.floor(1000000 + Math.random() * 9000000))
}
