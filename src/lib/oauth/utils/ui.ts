import pc from "picocolors";
import ora from "ora";

/**
 * UI Helper Functions
 */

export function success(message: string) {
  console.log(pc.green(`\n✓ ${message}\n`));
}

export function error(message: string) {
  console.log(pc.red(`\n✗ ${message}\n`));
}

export function info(message: string) {
  console.log(pc.blue(`\n${message}\n`));
}

export function warn(message: string) {
  console.log(pc.yellow(`\n⚠ ${message}\n`));
}

export function gray(message: string) {
  console.log(pc.gray(message));
}

export function spinner(text: string) {
  return ora(text);
}

export function printSection(title: string) {
  console.log(pc.blue(`\n${title}\n`));
}

export function printKeyValue(key: string, value: string, isSuccess = false) {
  const color = isSuccess ? pc.green : pc.gray;
  console.log(color(`  ${key}: ${value}`));
}

export function printList(items: string[], isSuccess = false) {
  const symbol = isSuccess ? "✓" : "✗";
  const color = isSuccess ? pc.green : pc.gray;
  items.forEach((item) => {
    console.log(color(`  ${symbol} ${item}`));
  });
}
