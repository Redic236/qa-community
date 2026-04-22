import { useMemo } from 'react';
import { theme } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { useThemeMode } from '@/hooks/useThemeMode';
import oneLight from 'react-syntax-highlighter/dist/esm/styles/prism/one-light';
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import graphql from 'react-syntax-highlighter/dist/esm/languages/prism/graphql';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import type { Components } from 'react-markdown';

// Register only the langs we expect to see so the bundle doesn't balloon to
// 500KB+. New langs can be added here cheap (~1-3KB each).
const LANGS: Record<string, unknown> = {
  bash, sh: bash, shell: bash,
  c, cpp, 'c++': cpp,
  cs: csharp, csharp,
  css,
  diff,
  go, golang: go,
  graphql, gql: graphql,
  javascript, js: javascript,
  json,
  jsx,
  markdown, md: markdown,
  python, py: python,
  rust, rs: rust,
  sql,
  tsx,
  typescript, ts: typescript,
  yaml, yml: yaml,
};
for (const [name, lang] of Object.entries(LANGS)) {
  SyntaxHighlighter.registerLanguage(name, lang);
}

interface Props {
  content: string;
}

/**
 * Renders trusted-by-default user markdown. `react-markdown` escapes raw HTML
 * by default (rehypeRaw is NOT added), so <script> / on* handlers / javascript:
 * URLs are all neutralized. Safe to pass any user string.
 *
 * Pre-existing plain-text content renders identically — plaintext paragraphs
 * are valid markdown, so backfilling old questions isn't needed.
 */
export default function MarkdownRenderer({ content }: Props) {
  const { token: tk } = theme.useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const components = useMemo<Components>(() => ({
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const text = String(children).replace(/\n$/, '');
      // Inline code (no language hint and short) → chip-style
      if (!match) {
        return (
          <code
            style={{
              background: tk.colorFillTertiary,
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: '0.9em',
              fontFamily: 'var(--ant-font-family-code, monospace)',
            }}
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <SyntaxHighlighter
          PreTag="div"
          language={match[1]}
          style={isDark ? oneDark : oneLight}
          customStyle={{
            margin: '8px 0',
            borderRadius: tk.borderRadius,
            fontSize: 13,
          }}
        >
          {text}
        </SyntaxHighlighter>
      );
    },
    a({ href, children, ...props }) {
      // All links open in new tab with rel=noopener — user markdown shouldn't
      // be able to redirect the whole app or snoop referrer.
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    },
    img({ src, alt, ...props }) {
      // Constrain inline images so a giant upload doesn't blow up the layout.
      return (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={{ maxWidth: '100%', height: 'auto', borderRadius: tk.borderRadius }}
          {...props}
        />
      );
    },
    table({ children }) {
      return (
        <div style={{ overflowX: 'auto', margin: '8px 0' }}>
          <table
            style={{
              borderCollapse: 'collapse',
              width: '100%',
              fontSize: 13,
            }}
          >
            {children}
          </table>
        </div>
      );
    },
    th({ children, style, ...props }) {
      return (
        <th
          style={{
            border: `1px solid ${tk.colorBorderSecondary}`,
            padding: '6px 10px',
            background: tk.colorFillQuaternary,
            textAlign: 'left',
            ...style,
          }}
          {...props}
        >
          {children}
        </th>
      );
    },
    td({ children, style, ...props }) {
      return (
        <td
          style={{
            border: `1px solid ${tk.colorBorderSecondary}`,
            padding: '6px 10px',
            ...style,
          }}
          {...props}
        >
          {children}
        </td>
      );
    },
    blockquote({ children }) {
      return (
        <blockquote
          style={{
            margin: '8px 0',
            padding: '4px 12px',
            borderLeft: `4px solid ${tk.colorBorderSecondary}`,
            color: tk.colorTextSecondary,
          }}
        >
          {children}
        </blockquote>
      );
    },
  }), [isDark, tk]);

  return (
    <div
      className="markdown-body"
      style={{
        color: tk.colorText,
        lineHeight: 1.65,
        wordBreak: 'break-word',
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
