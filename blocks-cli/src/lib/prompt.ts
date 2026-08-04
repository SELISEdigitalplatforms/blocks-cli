import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export async function promptText(message: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(message)).trim();
  } finally {
    rl.close();
  }
}

export async function selectFromList(message: string, options: string[]): Promise<number> {
  const rl = createInterface({ input, output });
  try {
    console.log(message);
    options.forEach((option, index) => console.log(`  ${index + 1}) ${option}`));

    while (true) {
      const answer = (await rl.question(`Choose 1-${options.length}: `)).trim();
      const choice = Number(answer);
      if (Number.isInteger(choice) && choice >= 1 && choice <= options.length) return choice - 1;
      console.log(`Enter a number between 1 and ${options.length}.`);
    }
  } finally {
    rl.close();
  }
}
