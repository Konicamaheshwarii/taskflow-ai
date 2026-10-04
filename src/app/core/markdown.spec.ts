import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('escapes raw HTML so scripts and handlers never render', () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('only links http(s) and mailto URLs', () => {
    expect(renderMarkdown('[ok](https://a.dev/?a=1&b=2)')).toContain('<a href="https://a.dev/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">ok</a>');
    expect(renderMarkdown('[bad](javascript:alert(1))')).not.toContain('<a');
  });

  it('renders headings, emphasis, code, lists and code blocks', () => {
    const html = renderMarkdown('# Title\n**bold** and *it* `x<y`\n\n- one\n- two\n\n1. first\n\n```\na < b\n```');
    expect(html).toBe(
      '<h3>Title</h3><p><strong>bold</strong> and <em>it</em> <code>x&lt;y</code></p>' +
      '<ul><li>one</li><li>two</li></ul><ol><li>first</li></ol><pre><code>a &lt; b</code></pre>');
  });
});
