import { useMemo, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

export function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const html = useMemo(() => {
    return parseMarkdownToHtml(content);
  }, [content]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });
    }
  }, [html]);

  return (
    <ScrollArea className={`h-full ${className}`}>
      <div 
        ref={containerRef}
        className="prose prose-sm dark:prose-invert max-w-none p-4 
          prose-headings:text-foreground prose-headings:font-semibold
          prose-h1:text-2xl prose-h1:border-b prose-h1:border-border prose-h1:pb-2 prose-h1:mt-6 prose-h1:mb-3 first:prose-h1:mt-0
          prose-h2:text-xl prose-h2:mt-5 prose-h2:mb-2
          prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-1
          prose-p:text-foreground prose-p:leading-relaxed prose-p:my-0
          prose-a:text-info prose-a:no-underline hover:prose-a:underline
          prose-strong:text-foreground prose-strong:font-semibold
          prose-code:text-info prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:my-2
          prose-ul:my-2 prose-ul:list-disc prose-ul:pl-5 prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-5
          prose-li:text-foreground prose-li:my-0 prose-li:leading-relaxed
          prose-blockquote:border-l-info prose-blockquote:text-muted-foreground prose-blockquote:italic
          prose-hr:border-border
          prose-table:border-collapse prose-table:w-full prose-table:my-3
          prose-thead:bg-muted/50
          prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-sm prose-th:font-semibold prose-th:text-foreground
          prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 prose-td:text-sm prose-td:text-foreground
          [&>*:first-child]:mt-0
          [&_pre]:!bg-[#0d1117] [&_pre_code]:!bg-transparent [&_.hljs]:!bg-transparent"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </ScrollArea>
  );
}

function parseMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  // Normalize line endings and collapse multiple blank lines
  let text = markdown.replace(/\r\n/g, '\n');
  
  // Split into lines for processing
  const lines = text.split('\n');
  const blocks: string[] = [];
  let currentBlock: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockContent: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Handle code blocks
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        // Flush current block
        if (currentBlock.length > 0) {
          blocks.push(processInlineBlock(currentBlock.join('\n')));
          currentBlock = [];
        }
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        codeBlockContent = [];
      } else {
        // End code block
        const escaped = codeBlockContent.join('\n')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        blocks.push(`<pre><code class="language-${codeBlockLang || 'text'}">${escaped}</code></pre>`);
        inCodeBlock = false;
        codeBlockLang = '';
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }
    
    // Check for block-level elements
    const trimmed = line.trim();
    
    // Empty line - flush current block
    if (trimmed === '') {
      if (currentBlock.length > 0) {
        blocks.push(processInlineBlock(currentBlock.join('\n')));
        currentBlock = [];
      }
      continue;
    }
    
    // Headers
    if (trimmed.startsWith('### ')) {
      if (currentBlock.length > 0) {
        blocks.push(processInlineBlock(currentBlock.join('\n')));
        currentBlock = [];
      }
      blocks.push(`<h3>${processInline(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      if (currentBlock.length > 0) {
        blocks.push(processInlineBlock(currentBlock.join('\n')));
        currentBlock = [];
      }
      blocks.push(`<h2>${processInline(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      if (currentBlock.length > 0) {
        blocks.push(processInlineBlock(currentBlock.join('\n')));
        currentBlock = [];
      }
      blocks.push(`<h1>${processInline(trimmed.slice(2))}</h1>`);
      continue;
    }
    
    // Horizontal rules
    if (/^(---|\*\*\*|___)$/.test(trimmed)) {
      if (currentBlock.length > 0) {
        blocks.push(processInlineBlock(currentBlock.join('\n')));
        currentBlock = [];
      }
      blocks.push('<hr>');
      continue;
    }
    
    // Blockquotes
    if (trimmed.startsWith('> ')) {
      if (currentBlock.length > 0) {
        blocks.push(processInlineBlock(currentBlock.join('\n')));
        currentBlock = [];
      }
      blocks.push(`<blockquote>${processInline(trimmed.slice(2))}</blockquote>`);
      continue;
    }
    
    // Table rows — collect consecutive pipe-starting lines
    if (trimmed.startsWith('|')) {
      if (currentBlock.length > 0 && !currentBlock[0].trim().startsWith('|')) {
        blocks.push(processInlineBlock(currentBlock.join('\n')));
        currentBlock = [];
      }
      currentBlock.push(line);
      continue;
    }

    // List items - collect consecutive list items
    if (/^[-*] /.test(trimmed)) {
      if (currentBlock.length > 0 && !/^[-*] /.test(currentBlock[0].trim())) {
        blocks.push(processInlineBlock(currentBlock.join('\n')));
        currentBlock = [];
      }
      currentBlock.push(line);
      continue;
    }
    
    if (/^\d+\. /.test(trimmed)) {
      if (currentBlock.length > 0 && !/^\d+\. /.test(currentBlock[0].trim())) {
        blocks.push(processInlineBlock(currentBlock.join('\n')));
        currentBlock = [];
      }
      currentBlock.push(line);
      continue;
    }
    
    // Regular text - add to current block
    // If previous block was a list or table, flush it first
    if (currentBlock.length > 0 && (
      /^[-*] /.test(currentBlock[0].trim()) ||
      /^\d+\. /.test(currentBlock[0].trim()) ||
      currentBlock[0].trim().startsWith('|')
    )) {
      blocks.push(processInlineBlock(currentBlock.join('\n')));
      currentBlock = [];
    }
    currentBlock.push(line);
  }
  
  // Flush remaining block
  if (currentBlock.length > 0) {
    blocks.push(processInlineBlock(currentBlock.join('\n')));
  }
  
  return blocks.join('\n');
}

function processInlineBlock(text: string): string {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  
  // Check if this is a table (first line starts with |)
  if (lines[0]?.trim().startsWith('|')) {
    return parseTable(lines);
  }

  // Check if this is a list
  const firstTrimmed = lines[0]?.trim() || '';
  if (/^[-*] /.test(firstTrimmed)) {
    const items = lines.map(l => `<li>${processInline(l.trim().replace(/^[-*] /, ''))}</li>`);
    return `<ul>${items.join('')}</ul>`;
  }
  if (/^\d+\. /.test(firstTrimmed)) {
    const items = lines.map(l => `<li>${processInline(l.trim().replace(/^\d+\. /, ''))}</li>`);
    return `<ol>${items.join('')}</ol>`;
  }
  
  // Regular paragraph - join lines with <br> for single line breaks
  const processed = lines.map(l => processInline(l)).join('<br>');
  return `<p>${processed}</p>`;
}

/** Parse a GFM-style markdown table into an HTML table */
function parseTable(lines: string[]): string {
  // Split a row into cells, stripping leading/trailing pipes and whitespace
  const splitRow = (line: string) =>
    line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

  const isSeparator = (line: string) => /^[\|\s\-:]+$/.test(line);

  // Find separator row index
  const sepIdx = lines.findIndex(isSeparator);
  if (sepIdx === -1) {
    // No separator — fall back to paragraph
    return `<p>${lines.map(processInline).join('<br>')}</p>`;
  }

  const headerRows = lines.slice(0, sepIdx);
  const bodyRows = lines.slice(sepIdx + 1);

  const thead = headerRows.map(row => {
    const cells = splitRow(row).map(c => `<th>${processInline(c)}</th>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const tbody = bodyRows.map(row => {
    const cells = splitRow(row).map(c => `<td>${processInline(c)}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function processInline(text: string): string {
  let html = text;
  
  // Escape HTML entities
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/(?<![_\w])_([^_]+)_(?![_\w])/g, '<em>$1</em>');
  
  // Strikethrough
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  
  return html;
}
