import { useState } from 'react';
import {
  Rocket,
  Terminal,
  Info,
  Send,
  Receipt,
  AtSign,
  DollarSign,
  Code,
  Copy,
  Check,
  Play,
  Link,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeHighlight } from '@/components/ui/code-highlight';
import {
  CODE_SNIPPETS,
  SNIPPET_CATEGORIES,
  getSnippetsById,
  type SnippetCategory,
  type CodeSnippet,
} from '@/data/code-snippets';
import { useUIStore, useScenarioStore } from '@/stores';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<SnippetCategory, React.ReactNode> = {
  'this-scenario': <Play className="h-4 w-4" />,
  'getting-started': <Rocket className="h-4 w-4" />,
  repl: <Terminal className="h-4 w-4" />,
  basics: <Info className="h-4 w-4" />,
  payments: <Send className="h-4 w-4" />,
  invoices: <Receipt className="h-4 w-4" />,
  'lightning-address': <AtSign className="h-4 w-4" />,
  fiat: <DollarSign className="h-4 w-4" />,
  advanced: <Code className="h-4 w-4" />,
  'bitcoin-connect': <Link className="h-4 w-4" />,
  '402': <ShieldCheck className="h-4 w-4" />,
};

export function CodeSnippets() {
  const { snippetCategory, setSnippetCategory } = useUIStore();
  const { currentScenario } = useScenarioStore();

  const filteredSnippets =
    snippetCategory === 'this-scenario'
      ? currentScenario.snippetIds
        ? getSnippetsById(currentScenario.snippetIds)
        : []
      : CODE_SNIPPETS.filter(
          (snippet) => snippet.category === snippetCategory
        );

  return (
    <div className="flex h-full flex-col sm:flex-row">
      {/* Category Sidebar - horizontal scroll on mobile, vertical sidebar on desktop */}
      <div className="border-b sm:border-b-0 sm:border-r flex-shrink-0 sm:w-48 overflow-x-auto sm:overflow-x-hidden sm:overflow-y-auto">
        <div className="flex sm:flex-col p-2 gap-1 sm:space-y-1 sm:gap-0">
          {SNIPPET_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSnippetCategory(category.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left whitespace-nowrap flex-shrink-0',
                snippetCategory === category.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              {CATEGORY_ICONS[category.id]}
              <span>{category.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Snippets Content */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <div className="space-y-4">
          {filteredSnippets.map((snippet) => (
            <SnippetCard key={snippet.id} snippet={snippet} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SnippetCard({ snippet }: { snippet: CodeSnippet }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-2 p-3 bg-muted/30">
        <div className="min-w-0">
          <h3 className="font-medium text-sm">{snippet.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {snippet.description}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 flex-shrink-0"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-xs">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              <span className="text-xs">Copy</span>
            </>
          )}
        </Button>
      </div>

      {/* Code Block */}
      <div className="p-3 bg-muted/10">
        <CodeHighlight code={snippet.code} language={snippet.language} />
      </div>
    </div>
  );
}
