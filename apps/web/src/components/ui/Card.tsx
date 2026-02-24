import { cx } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div 
      onClick={onClick}
      className={cx(
        "rounded-xl border border-white/10 bg-[#1a1a24]/80 backdrop-blur-xl shadow-lg transition-all duration-300",
        onClick && "cursor-pointer hover:border-violet-500/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] hover:-translate-y-1",
        className
      )}
    >
      {children}
    </div>
  );
}
