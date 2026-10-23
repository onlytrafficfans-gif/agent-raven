type ProspectWithBigInt = { estimatedRevenue: bigint | null; [key: string]: unknown };

export function serializeProspect<T extends ProspectWithBigInt>(prospect: T) {
  return {
    ...prospect,
    estimatedRevenue: prospect.estimatedRevenue === null ? null : prospect.estimatedRevenue.toString(),
  };
}
