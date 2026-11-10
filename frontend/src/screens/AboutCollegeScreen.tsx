import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScreenShell } from '../components/Layout/ScreenShell';
import { withApiBase } from '../config/runtime';
import { useStore } from '../store/assistantStore';

type TreeNode = {
  id: string;
  type: 'folder' | 'article';
  title: string;
  slug?: string;
  children?: TreeNode[];
};

type ArticlePayload = {
  slug: string;
  title: string;
  markdown: string;
};

function firstArticle(node: TreeNode | null): string | null {
  if (!node) return null;
  if (node.type === 'article' && node.slug) return node.slug;
  for (const child of node.children || []) {
    const slug = firstArticle(child);
    if (slug) return slug;
  }
  return null;
}

function MarkdownView({ markdown }: { markdown: string }) {
  return (
    <div className="article-markdown text-slate-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}

function TreeItem({
  node,
  activeSlug,
  onSelect,
  level = 0,
}: {
  node: TreeNode;
  activeSlug: string;
  onSelect: (slug: string) => void;
  level?: number;
}) {
  const [open, setOpen] = useState(true);

  if (node.type === 'article' && node.slug) {
    const active = node.slug === activeSlug;
    return (
      <button
        type="button"
        onClick={() => onSelect(node.slug!)}
        className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
          active ? 'bg-brand-100 text-brand-800 font-medium' : 'text-slate-600 hover:bg-slate-100'
        }`}
        style={{ marginLeft: level * 10 }}
      >
        {node.title}
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full text-left px-2 py-2 rounded-lg text-slate-700 font-medium hover:bg-slate-100"
        style={{ marginLeft: level * 10 }}
      >
        {open ? '▾' : '▸'} {node.title}
      </button>
      {open && (
        <div className="space-y-1">
          {(node.children || []).map(child => (
            <TreeItem
              key={child.id}
              node={child}
              activeSlug={activeSlug}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const AboutCollegeScreen: React.FC = () => {
  const debugStubMode = useStore(s => s.debugStubMode);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [activeSlug, setActiveSlug] = useState('');
  const [article, setArticle] = useState<ArticlePayload | null>(null);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [ttsBusy, setTtsBusy] = useState(false);

  useEffect(() => {
    fetch(withApiBase('/api/articles/tree'))
      .then(r => r.json())
      .then((data: TreeNode) => {
        setTree(data);
        const first = firstArticle(data);
        if (first) setActiveSlug(first);
      })
      .finally(() => setLoadingTree(false));
  }, []);

  useEffect(() => {
    if (!activeSlug) return;
    setLoadingArticle(true);
    fetch(withApiBase(`/api/articles/article?slug=${encodeURIComponent(activeSlug)}`))
      .then(r => r.json())
      .then((data: ArticlePayload) => {
        setArticle(data);
      })
      .finally(() => setLoadingArticle(false));
  }, [activeSlug]);

  const canSpeak = Boolean(article?.markdown?.trim());

  return (
    <ScreenShell
      title="О колледже"
      subtitle="Материалы для студентов, абитуриентов и гостей"
    >
      <div className="h-full grid grid-cols-[320px_1fr_320px] gap-4">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Разделы</h3>
          {loadingTree && <p className="text-slate-400 text-sm">Загрузка структуры...</p>}
          {!loadingTree && tree && (
            <TreeItem node={tree} activeSlug={activeSlug} onSelect={setActiveSlug} />
          )}
        </aside>

        <main className="rounded-2xl border border-slate-200 bg-white p-6 overflow-y-auto">
          {loadingArticle && <p className="text-slate-400">Загрузка статьи...</p>}
          {!loadingArticle && article && <MarkdownView markdown={article.markdown} />}
          {!loadingArticle && !article && <p className="text-slate-400">Выберите статью слева.</p>}
        </main>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Озвучивание</h3>
          <div className="text-sm text-slate-600 leading-relaxed">
            Функция озвучивания временно отключена на этой странице.
          </div>
        </aside>
      </div>
    </ScreenShell>
  );
};
