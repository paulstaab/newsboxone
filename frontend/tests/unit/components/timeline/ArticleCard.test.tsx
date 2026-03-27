import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArticleCard } from '@/components/timeline/ArticleCard';
import type { ArticlePreview } from '@/types';

// Mock next/image
/* eslint-disable @next/next/no-img-element */
type MockImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  unoptimized?: boolean;
  fill?: boolean;
};

vi.mock('next/image', () => ({
  default: (props: MockImageProps) => {
    const { unoptimized, fill, ...rest } = props;
    void unoptimized;
    void fill;
    return <img alt="" {...rest} />;
  },
}));
/* eslint-enable @next/next/no-img-element */

const mockArticle: ArticlePreview = {
  id: 1,
  feedId: 10,
  folderId: 100,
  title: 'Test Article Title',
  feedName: 'Example Feed',
  author: 'Test Author',
  summary: 'This is a summary of the article.',
  body: '<p>This is the full body content.</p>',
  url: 'https://example.com/article',
  thumbnailUrl: 'https://example.com/image.jpg',
  pubDate: 1700000000,
  unread: true,
  starred: false,
  hasFullText: true,
  storedAt: 1700000000,
};

describe('ArticleCard', () => {
  it('renders article summary information correctly', () => {
    render(<ArticleCard article={mockArticle} onOpen={vi.fn()} />);

    expect(screen.getByText('Test Article Title')).toBeDefined();
    expect(screen.getByText('This is a summary of the article.')).toBeDefined();
    expect(screen.getByAltText('')).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('renders fallback title when title is missing', () => {
    const article = { ...mockArticle, title: '' };
    render(<ArticleCard article={article} onOpen={vi.fn()} />);

    expect(screen.getByText('Untitled article')).toBeDefined();
  });

  it('does not render thumbnail if url is missing', () => {
    const article = { ...mockArticle, thumbnailUrl: null };
    render(<ArticleCard article={article} onOpen={vi.fn()} />);

    expect(screen.queryByRole('img')).toBeNull();
  });

  it('calls onOpen when the card is clicked', () => {
    const onOpen = vi.fn();
    render(<ArticleCard article={mockArticle} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('option'));

    expect(onOpen).toHaveBeenCalledWith(mockArticle, expect.any(HTMLElement));
  });

  it('does not call onOpen when the title link is clicked', () => {
    const onOpen = vi.fn();
    render(<ArticleCard article={mockArticle} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('link'));

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('opens on Enter key press', () => {
    const onOpen = vi.fn();
    render(<ArticleCard article={mockArticle} onOpen={onOpen} />);

    fireEvent.keyDown(screen.getByRole('option'), { key: 'Enter' });

    expect(onOpen).toHaveBeenCalledWith(mockArticle, expect.any(HTMLElement));
  });
});
