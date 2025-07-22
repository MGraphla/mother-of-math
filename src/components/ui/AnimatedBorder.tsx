import React from 'react';
import { cn } from '@/lib/utils';

interface AnimatedBorderProps {
  children: React.ReactNode;
  className?: string;
  slow?: boolean;
  variant?: 'default' | 'brown';
}

const AnimatedBorder: React.FC<AnimatedBorderProps> = ({ children, className, slow, variant = 'default' }) => {
  return (
    <div className={cn('relative p-1 overflow-hidden rounded-lg animated-border-gradient', { 'slow': slow, 'brown': variant === 'brown' }, className)}>
      <div className="relative z-10 bg-background p-6 rounded-md">
        {children}
      </div>
    </div>
  );
};

export default AnimatedBorder;
