export type RollDiceArgs = {
  count: number;
  sides: number;
};

export const rollDiceDefinition = {
  type: "function" as const,
  name: "roll_dice",
  description: "Roll one or more dice with the requested number of sides.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      count: {
        type: "number",
        description: "How many dice to roll. Must be between 1 and 20.",
      },
      sides: {
        type: "number",
        description: "How many sides each die has. Must be between 2 and 100.",
      },
    },
    required: ["count", "sides"],
  },
  strict: true,
};

export function rollDice(args: RollDiceArgs) {
  const count = Math.floor(args.count);
  const sides = Math.floor(args.sides);

  if (count < 1 || count > 20) {
    return { error: "Dice count must be between 1 and 20." };
  }

  if (sides < 2 || sides > 100) {
    return { error: "Dice sides must be between 2 and 100." };
  }

  const rolls = Array.from(
    { length: count },
    () => Math.floor(Math.random() * sides) + 1,
  );
  const total = rolls.reduce((sum, value) => sum + value, 0);

  return {
    rolls,
    total,
    description: `Rolled ${count}d${sides}: ${rolls.join(", ")}. Total: ${total}.`,
  };
}
