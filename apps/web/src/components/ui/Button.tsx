import { cx } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ 
  children, 
  className = '', 
  variant = 'primary', 
  size = 'md',
  ...props 
}: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-[0_0_15px_rgba(139,92,246,0.4)] border border-transparent",
    secondary: "bg-white/5 text-white hover:bg-white/10 border border-white/10",
    ghost: "bg-transparent text-gray-300 hover:text-white hover:bg-white/5",
    danger: "bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30"
  };
  
  const sizes = { 
    sm: "px-3 py-1.5 text-sm", 
    md: "px-4 py-2 text-sm", 
    lg: "px-6 py-3 text-base" 
  };
  
  return (
    <button className={cx(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}
