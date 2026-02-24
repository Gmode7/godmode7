interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  
  return (
    <div className="text-gray-300 space-y-4 text-sm leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith('```')) {
          const code = part.replace(/```\w*\n?/, '').replace(/```$/, '');
          return (
            <div key={index} className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500/20 to-indigo-500/20 rounded-lg blur opacity-50 group-hover:opacity-100 transition duration-500"></div>
              <pre className="relative bg-[#0a0a0f] border border-white/10 p-4 rounded-lg overflow-x-auto text-blue-300 font-mono text-xs">
                <code>{code}</code>
              </pre>
            </div>
          );
        }
        
        // Basic markdown rendering
        let formattedPart = part
          .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
          .replace(/## (.*?)\n/g, '<h2 class="text-xl font-bold text-white mt-6 mb-3">$1</h2>')
          .replace(/# (.*?)\n/g, '<h1 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400 mt-4 mb-4">$1</h1>')
          .replace(/- (.*?)\n/g, '<li class="ml-4 list-disc marker:text-violet-500">$1</li>');

        return <div key={index} dangerouslySetInnerHTML={{ __html: formattedPart }} />;
      })}
    </div>
  );
}
