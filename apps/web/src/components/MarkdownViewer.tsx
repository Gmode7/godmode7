import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Download, X } from 'lucide-react';
import { Button } from './ui/Button';
import { toast } from './ui/Toast';

interface MarkdownViewerProps {
  content: string;
  filename?: string;
  onClose?: () => void;
}

export function MarkdownViewer({ content, filename, onClose }: MarkdownViewerProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast('Copied to clipboard', 'success');
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Downloaded', 'success');
  };

  return (
    <div className="flex flex-col h-full bg-gray-900/50 rounded-xl border border-white/10 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gray-900/80">
        <div className="flex items-center gap-3">
          {filename && (
            <span className="text-sm font-mono text-gray-400">{filename}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy} icon={<Copy className="w-4 h-4" />}>
            Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload} icon={<Download className="w-4 h-4" />}>
            Download
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} icon={<X className="w-4 h-4" />}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="prose prose-invert prose-lg max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline ? (
                  <div className="relative group">
                    <pre className="bg-black/30 rounded-lg p-4 overflow-x-auto">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  </div>
                ) : (
                  <code className="bg-black/30 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                    {children}
                  </code>
                );
              },
              table({ children }) {
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-white/10">
                      {children}
                    </table>
                  </div>
                );
              },
              th({ children }) {
                return (
                  <th className="border border-white/10 px-4 py-2 bg-white/5 text-left font-semibold">
                    {children}
                  </th>
                );
              },
              td({ children }) {
                return (
                  <td className="border border-white/10 px-4 py-2">
                    {children}
                  </td>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
