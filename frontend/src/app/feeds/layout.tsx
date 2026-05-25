import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Feed Management',
};

export default function FeedsLayout({ children }: { children: ReactNode }) {
  return children;
}
