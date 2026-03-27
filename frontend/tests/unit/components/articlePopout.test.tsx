import { describe, it, expect, vi } from 'vitest';
import React, { useEffect, useRef } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ArticlePopout } from '@/components/timeline/ArticlePopout';
import { useArticlePopout } from '@/hooks/useArticlePopout';
import type { ArticlePreview, Article } from '@/types';

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

const { mockArticleResponse, mockContentResponse } = vi.hoisted(() => ({
  mockArticleResponse: {
    data: undefined as Article | null | undefined,
    error: null as Error | null,
    isLoading: false,
  },
  mockContentResponse: {
    data: undefined as string | null | undefined,
    error: null as Error | null,
    isLoading: false,
  },
}));

vi.mock('swr', () => ({
  default: (key: unknown) => {
    if (Array.isArray(key) && key[0] === 'article-content') {
      return mockContentResponse;
    }
    if (Array.isArray(key) && key[0] === 'article') {
      return mockArticleResponse;
    }
    return { data: undefined, error: null, isLoading: false };
  },
}));

const mockArticle: ArticlePreview = {
  id: 12,
  feedId: 2,
  folderId: 100,
  title: 'Popout Article Title',
  feedName: 'Example Feed',
  author: 'Pop Author',
  summary: 'This is a summary of the article.',
  body: '',
  url: 'https://example.com/article',
  thumbnailUrl: 'https://example.com/image.jpg',
  pubDate: 1700000000,
  unread: true,
  starred: false,
  hasFullText: true,
  storedAt: 1700000000,
};

const mockFullArticle: Article = {
  id: mockArticle.id,
  guid: 'guid-1',
  guidHash: 'hash-1',
  title: mockArticle.title,
  author: mockArticle.author,
  url: mockArticle.url,
  body: '<p>This is the full body content.</p>',
  feedId: mockArticle.feedId,
  folderId: 100,
  unread: mockArticle.unread,
  starred: mockArticle.starred,
  pubDate: mockArticle.pubDate,
  lastModified: 1700000000,
  enclosureLink: null,
  enclosureMime: null,
  fingerprint: 'fp',
  contentHash: 'ch',
  mediaThumbnail: null,
  mediaDescription: null,
  rtl: false,
};

describe('ArticlePopout', () => {
  it('renders heading, subheading, and body content', () => {
    mockArticleResponse.data = mockFullArticle;
    mockArticleResponse.error = null;
    mockArticleResponse.isLoading = false;
    mockContentResponse.data = '<p>This is the full body content.</p>';
    mockContentResponse.error = null;
    mockContentResponse.isLoading = false;

    render(
      <ArticlePopout
        isOpen
        article={mockArticle}
        onClose={vi.fn()}
        dialogRef={React.createRef()}
        closeButtonRef={React.createRef()}
      />,
    );

    expect(screen.getByText('Popout Article Title')).toBeDefined();
    expect(screen.getByText(/Example Feed/i)).toBeDefined();
    expect(screen.getByText('This is the full body content.')).toBeDefined();
  });

  it('calls onClose only when close button is clicked', () => {
    const onClose = vi.fn();

    render(
      <ArticlePopout
        isOpen
        article={mockArticle}
        onClose={onClose}
        dialogRef={React.createRef()}
        closeButtonRef={React.createRef()}
      />,
    );

    fireEvent.click(screen.getByTestId('article-popout-overlay'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when Space is pressed', async () => {
    mockArticleResponse.data = mockFullArticle;
    mockArticleResponse.error = null;
    mockArticleResponse.isLoading = false;
    mockContentResponse.data = '<p>This is the full body content.</p>';
    mockContentResponse.error = null;
    mockContentResponse.isLoading = false;

    function Harness() {
      const openerRef = useRef<HTMLButtonElement>(null);
      const { isOpen, openPopout, closePopout, dialogRef, closeButtonRef } = useArticlePopout();

      useEffect(() => {
        openPopout({ id: mockArticle.id, feedId: mockArticle.feedId }, openerRef.current);
      }, [openPopout]);

      return (
        <div>
          <button type="button" ref={openerRef}>
            Open
          </button>
          <ArticlePopout
            isOpen={isOpen}
            article={mockArticle}
            onClose={closePopout}
            dialogRef={dialogRef}
            closeButtonRef={closeButtonRef}
          />
        </div>
      );
    }

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByText('Popout Article Title')).toBeDefined();
    });

    fireEvent.keyDown(document, { key: ' ' });

    await waitFor(() => {
      expect(screen.queryByText('Popout Article Title')).toBeNull();
    });
  });
});
