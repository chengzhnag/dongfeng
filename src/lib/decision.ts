export type DecisionOption = {
  id: string;
  text: string;
  weight: number;
};

export function weightedRandomPick(options: DecisionOption[]): DecisionOption {
  const totalWeight = options.reduce((sum, option) => sum + (option.weight || 1), 0);
  const randomBuffer = crypto.getRandomValues(new Uint32Array(2));
  const randomValue = ((randomBuffer[0] >>> 5) * 67108864 + (randomBuffer[1] >>> 6)) / 9007199254740992;

  let target = randomValue * totalWeight;
  for (const option of options) {
    target -= option.weight || 1;
    if (target <= 0) return option;
  }
  return options[options.length - 1];
}
