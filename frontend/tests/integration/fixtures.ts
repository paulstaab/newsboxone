import AxeBuilder from '@axe-core/playwright';
import { expect, test as base } from '@playwright/test';

interface Fixtures {
  makeAxeBuilder: () => AxeBuilder;
}

export const test = base.extend<Fixtures>({
  makeAxeBuilder: async ({ page }, fixtureUse) => {
    await fixtureUse(() => new AxeBuilder({ page }));
  },
});

export { expect };
