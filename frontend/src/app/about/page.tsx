import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About',
};

const productHighlights = [
  'Read authenticated feeds through a focused timeline workflow.',
  'Organize subscriptions into folders and tune extraction behavior per feed.',
  'Install the app, keep reading offline, and sync updates when connectivity returns.',
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--color-surface))] text-[hsl(var(--color-text))]">
      <section className="timeline-header">
        <div className="timeline-shell timeline-header__inner">
          <div className="timeline-header__copy">
            <p className="timeline-header__eyebrow">About</p>
            <h1 className="timeline-header__title">NewsBoxOne</h1>
            <p className="timeline-header__subtitle">
              A focused reader for authenticated feeds, folders, and offline-friendly updates.
            </p>
          </div>
        </div>
      </section>

      <div className="timeline-shell pb-24 pt-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <section className="rounded-[var(--radius-xl)] border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface-muted))] p-8 shadow-[var(--shadow-soft)]">
            <h2 className="text-2xl font-semibold">What this app is for</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[hsl(var(--color-text-muted))]">
              NewsBoxOne combines a static-export Next.js frontend with an authenticated feed
              backend so you can keep a curated reading queue without exposing your feed service
              directly in the browser.
            </p>
            <ul className="mt-6 space-y-3 text-sm leading-6 text-[hsl(var(--color-text-muted))]">
              {productHighlights.map((highlight) => (
                <li
                  key={highlight}
                  className="rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-4 py-3"
                >
                  {highlight}
                </li>
              ))}
            </ul>
          </section>

          <aside className="rounded-[var(--radius-xl)] border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface-muted))] p-8 shadow-[var(--shadow-soft)]">
            <h2 className="text-xl font-semibold">Quick navigation</h2>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/timeline"
                className="rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-4 py-3 transition hover:border-[hsl(var(--color-accent))] hover:text-[hsl(var(--color-text))]"
              >
                Open timeline
              </Link>
              <Link
                href="/feeds"
                className="rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-4 py-3 transition hover:border-[hsl(var(--color-accent))] hover:text-[hsl(var(--color-text))]"
              >
                Manage feeds
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-[hsl(var(--color-border))] bg-[hsl(var(--color-surface))] px-4 py-3 transition hover:border-[hsl(var(--color-accent))] hover:text-[hsl(var(--color-text))]"
              >
                Sign in
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
