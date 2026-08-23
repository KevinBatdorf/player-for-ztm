import { Fragment, type ReactNode } from 'react';

/** Only what `lib/lecture.ts` emits, which is why there is no parser dependency. */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks(text).map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

type Item = { text: string; depth: number };

type BlockNode =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'list'; ordered: boolean; items: Item[] }
  | { kind: 'rule' };

const HEADING = /^(#{1,6}) +(.*)$/;
const IMAGE = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const BULLET = /^( *)([-*]|\d+\.) +(.*)$/;

function blocks(text: string): BlockNode[] {
  const lines = text.split('\n');
  const out: BlockNode[] = [];
  let at = 0;

  while (at < lines.length) {
    const line = lines[at] ?? '';

    if (!line.trim()) {
      at += 1;
      continue;
    }

    // A fence swallows blank lines, so it has to be read before they are skipped.
    if (line.startsWith('```')) {
      const body: string[] = [];
      at += 1;
      while (at < lines.length && !(lines[at] ?? '').startsWith('```')) {
        body.push(lines[at] ?? '');
        at += 1;
      }
      at += 1;
      out.push({ kind: 'code', text: body.join('\n') });
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      out.push({ kind: 'rule' });
      at += 1;
      continue;
    }

    const image = IMAGE.exec(line.trim());
    if (image) {
      out.push({ kind: 'image', alt: image[1] ?? '', src: image[2] ?? '' });
      at += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      out.push({ kind: 'heading', level: (heading[1] ?? '#').length, text: heading[2] ?? '' });
      at += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      const body: string[] = [];
      while (at < lines.length && (lines[at] ?? '').startsWith('> ')) {
        body.push((lines[at] ?? '').slice(2));
        at += 1;
      }
      out.push({ kind: 'quote', text: body.join(' ') });
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      const ordered = /\d/.test(bullet[2] ?? '');
      const items: Item[] = [];
      while (at < lines.length) {
        const row = BULLET.exec(lines[at] ?? '');
        if (!row) break;
        items.push({ text: row[3] ?? '', depth: Math.floor((row[1] ?? '').length / 2) });
        at += 1;
      }
      out.push({ kind: 'list', ordered, items });
      continue;
    }

    // Their paragraphs arrive on one line each, so a run of them is a run of paragraphs.
    out.push({ kind: 'para', text: line });
    at += 1;
  }

  return out;
}

function Block({ block }: { block: BlockNode }) {
  switch (block.kind) {
    case 'heading': {
      const Tag = (block.level <= 2 ? 'h2' : 'h3') as 'h2' | 'h3';
      return (
        <Tag className="mt-1 text-heading leading-snug font-medium text-ink">
          <Inline text={block.text} />
        </Tag>
      );
    }

    case 'para':
      return (
        <p className="text-body leading-relaxed text-ink">
          <Inline text={block.text} />
        </p>
      );

    case 'code':
      return (
        <pre className="rule overflow-x-auto rounded-panel bg-raised p-2.5 font-mono text-caption text-ink">
          <code>{block.text}</code>
        </pre>
      );

    case 'quote':
      return (
        <blockquote className="border-l-2 border-accent pl-3 text-body leading-relaxed text-ink-soft">
          <Inline text={block.text} />
        </blockquote>
      );

    case 'image':
      return (
        <img src={block.src} alt={block.alt} loading="lazy" className="rounded-panel w-full" />
      );

    case 'rule':
      return <hr className="border-line" />;

    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className="flex flex-col gap-1.5 text-body leading-relaxed text-ink">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2" style={{ paddingLeft: item.depth * 14 }}>
              <span className="shrink-0 font-mono text-caption text-ink-faint">
                {block.ordered ? `${i + 1}.` : '·'}
              </span>
              <span className="min-w-0">
                <Inline text={item.text} />
              </span>
            </li>
          ))}
        </Tag>
      );
    }
  }
}

/** One pass over four markers; nesting inside them is not something the writer emits. */
const INLINE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;

function Inline({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;

  for (const hit of text.matchAll(INLINE)) {
    const at = hit.index;
    if (at > last) out.push(text.slice(last, at));
    last = at + hit[0].length;

    if (hit[1] && hit[2]) {
      out.push(
        <a
          key={at}
          href={hit[2]}
          target="_blank"
          rel="noreferrer"
          className="text-accent-text underline decoration-1 underline-offset-2 hover:decoration-2"
        >
          {hit[1]}
        </a>,
      );
    } else if (hit[3]) {
      out.push(
        <strong key={at} className="font-medium text-ink">
          {hit[3]}
        </strong>,
      );
    } else if (hit[4]) {
      out.push(<em key={at}>{hit[4]}</em>);
    } else if (hit[5]) {
      out.push(
        <code key={at} className="rounded bg-raised px-1 py-0.5 font-mono text-caption">
          {hit[5]}
        </code>,
      );
    }
  }

  if (last < text.length) out.push(text.slice(last));

  return <Fragment>{out}</Fragment>;
}
