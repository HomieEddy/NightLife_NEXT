export function orderLineSubtotal(
  baseUnitPrice: number,
  lineQuantity: number,
  addOns: { priceDelta: number; quantity: number }[],
): number {
  const addOnTotal = addOns.reduce(
    (sum, addOn) => sum + addOn.priceDelta * addOn.quantity,
    0,
  );
  return baseUnitPrice * lineQuantity + addOnTotal;
}
