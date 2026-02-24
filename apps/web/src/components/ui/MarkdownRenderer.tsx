interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // Split by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);
  
  const formatText = (text: string): string => {
    return text
      // Headers
      .replace(/^#### (.*$)/gim, '<h4 class="text-lg font-bold text-white mt-4 mb-2">$1</h4>')
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold text-white mt-5 mb-3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400 mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400 mt-4 mb-4">$1</h1>')
      // Bold and italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="text-white font-bold"><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-gray-300">$1</em>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-violet-400 hover:text-violet-300 underline" target="_blank" rel="noopener">$1</a>')
      // Emoji support - keep as is
      // Line breaks
      .replace(/\n/g, '<br />');
  };
  
  const formatLists = (text: string): string => {
    // Handle bullet lists
    const lines = text.split('<br />');
    let inList = false;
    let result: string[] = [];
    
    for (const line of lines) {
      const bulletMatch = line.match(/^\s*[•\-\*]\s*(.+)$/);
      if (bulletMatch) {
        if (!inList) {
          result.push('<ul class="space-y-1 my-2 ml-2">');
          inList = true;
        }
        result.push(`<li class="flex items-start gap-2"><span class="text-violet-500 mt-1.5">•</span><span>${bulletMatch[1]}</span></li>`);
      } else {
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
        result.push(line);
      }
    }
    
    if (inList) {
      result.push('</ul>');
    }
    
    return result.join('<br />');
  };
  
  return (
    <div className="text-gray-300 text-sm leading-relaxed space-y-2">
      {parts.map((part, index) => {
        if (part.startsWith('```')) {
          // Extract language and code
          const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
          const lang = match?.[1] || '';
          const code = match?.[2] || part.replace(/```\w*\n?/, '').replace(/```$/, '');
          
          return (
            <div key={index} className="relative group my-4">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500/20 to-indigo-500/20 rounded-lg blur opacity-50 group-hover:opacity-100 transition duration-500"></div>
              <div className="relative bg-[#0a0a0f] border border-white/10 rounded-lg overflow-hidden">
                {lang && (
                  <div className="px-4 py-2 bg-white/5 border-b border-white/10 text-xs text-gray-500 font-mono">
                    {lang}
                  </div>
                )}
                <pre className="p-4 overflow-x-auto text-blue-300 font-mono text-xs">
                  <code>{code}</code>
                </pre>
              </div>
            </div>
          );
        }
        
        // Format the text part
        const formatted = formatLists(formatText(part));
        
        return (
          <div 
            key={index} 
            className="[&_h1]:mb-4 [&_h2]:mb-3 [&_h3]:mb-2 [&_ul]:my-3 [&_p]:my-2"
            dangerouslySetInnerHTML={{ __html: formatted }} 
          />
        );
      })}
    </div>
  );
}
