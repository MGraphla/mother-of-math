import React, { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  children: React.ReactNode;
  className?: string;
}

const Sidebar = ({ children, className }: SidebarProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen transition-all duration-300 ease-in-out',
          isExpanded ? 'w-72' : 'w-20',
          className
        )}
      >
        <div className="flex items-center justify-between p-4">
          <span className={cn('font-extrabold text-3xl tracking-wider', !isExpanded && 'hidden')}>MAMA</span>
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>

      {/* Mobile Sidebar */}
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            {children}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};

export default Sidebar;
