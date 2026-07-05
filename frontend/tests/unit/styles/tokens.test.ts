import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENT_SCOPED_VARIABLES = new Set(['--timeline-offset']);

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? collectFiles(path) : [path];
  });
}

describe('design tokens', () => {
  it('defines every design-token CSS variable referenced by source files', () => {
    const tokenSource = readFileSync('src/styles/tokens.css', 'utf8');
    const definedTokens = new Set(
      Array.from(tokenSource.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)).map((match) => match[1]),
    );

    const referencedTokens = new Set<string>();
    for (const file of collectFiles('src').filter((path) => /\.(css|ts|tsx)$/.test(path))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) {
        referencedTokens.add(match[1]);
      }
    }

    const missing = Array.from(referencedTokens)
      .filter((token) => !definedTokens.has(token) && !COMPONENT_SCOPED_VARIABLES.has(token))
      .sort();

    expect(missing).toEqual([]);
  });
});
