import pc from "picocolors";
import ora from "ora";

/**
 * UI Helper Functions — uses `picocolors` (~16KB, no deps) for ANSI styling.
 * Drop-in replacement for the previous `chalk` import (chalk was ~200KB + deps).
 */

export function success(message) {
  console.log(pc.green(`\n✓ ${message}\n`));
}

export function error(message) {
  console.log(pc.red(`\n✗ ${message}\n`));
}

export function info(message) {
  console.log(pc.blue(`\n${message}\n`));
}

export function warn(message) {
  console.log(pc.yellow(`\n⚠ ${message}\n`));
}

export function gray(message) {
  console.log(pc.gray(message));
}

export function spinner(text) {
  return ora(text);
}

export function printSection(title) {
  console.log(pc.blue(`\n${title}\n`));
}

export function printKeyValue(key, value, isSuccess = false) {
  const color = isSuccess ? pc.green : pc.gray;
  console.log(color(`  ${key}: ${value}`));
}

export function printList(items, isSuccess = false) {
  const symbol = isSuccess ? "✓" : "✗";
  const color = isSuccess ? pc.green : pc.gray;
  items.forEach((item) => {
    console.log(color(`  ${symbol} ${item}`));
  });
}
