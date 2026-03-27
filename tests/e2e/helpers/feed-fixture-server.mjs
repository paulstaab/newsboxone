import http from 'node:http';

const port = Number.parseInt(process.env.PORT ?? '4100', 10);
const baseUrl = `http://127.0.0.1:${port}`;

function atomFeed(feedId, title, entries) {
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${feedId}</id>
  <title>${title}</title>
  <updated>2026-03-27T00:00:00Z</updated>
  ${entries
    .map(
      (entry) => `<entry>
    <id>${entry.id}</id>
    <title>${entry.title}</title>
    <updated>${entry.updated}</updated>
    <published>${entry.updated}</published>
    <link href="${entry.url}" />
    <summary>${entry.summary}</summary>
    <content type="html"><![CDATA[${entry.content}]]></content>
  </entry>`,
    )
    .join('\n')}
</feed>`;
}

const feeds = {
  '/feeds/engineering.xml': atomFeed('engineering', 'Engineering Daily', [
    {
      id: `${baseUrl}/articles/engineering-1`,
      title: 'Engineering Launch Brief',
      updated: '2026-03-26T10:00:00Z',
      url: `${baseUrl}/articles/engineering-1`,
      summary: 'Engineering launch brief summary.',
      content:
        '<p>Engineering launch brief summary.</p><p><img src="https://cdn.example.com/eng.jpg" alt="Engineering" /></p>',
    },
    {
      id: `${baseUrl}/articles/engineering-2`,
      title: 'Observability Digest',
      updated: '2026-03-26T09:00:00Z',
      url: `${baseUrl}/articles/engineering-2`,
      summary: 'Observability digest summary.',
      content: '<p>Observability digest summary.</p>',
    },
  ]),
  '/feeds/design.xml': atomFeed('design', 'Design Weekly', [
    {
      id: `${baseUrl}/articles/design-1`,
      title: 'Design Systems Review',
      updated: '2026-03-26T08:00:00Z',
      url: `${baseUrl}/articles/design-1`,
      summary: 'Design systems review summary.',
      content: '<p>Design systems review summary.</p>',
    },
  ]),
};

const articlePages = {
  '/articles/engineering-1':
    '<html><body><article><h1>Engineering Launch Brief</h1><p>Engineering launch brief body.</p></article></body></html>',
  '/articles/engineering-2':
    '<html><body><article><h1>Observability Digest</h1><p>Observability digest body.</p></article></body></html>',
  '/articles/design-1':
    '<html><body><article><h1>Design Systems Review</h1><p>Design systems review body.</p></article></body></html>',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', baseUrl);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (feeds[url.pathname]) {
    res.writeHead(200, { 'content-type': 'application/atom+xml; charset=utf-8' });
    res.end(feeds[url.pathname]);
    return;
  }

  if (articlePages[url.pathname]) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(articlePages[url.pathname]);
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Feed fixture server listening on ${baseUrl}\n`);
});
