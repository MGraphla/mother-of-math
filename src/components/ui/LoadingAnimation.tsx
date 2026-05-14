import React from 'react';
import { Pi } from 'lucide-react';
import { cn } from '@/lib/utils'; // if cn is available, wait I check using grep later.

export const LoadingAnimation = ({ message = "Loading...", fullScreen = false }: { message?: string, fullScreen?: boolean }) => {
  return (
    <div className={`flex flex-col items-center justify-center ${fullScreen ? 'min-h-screen w-full bg-background/80 backdrop-blur-sm z-50' : 'p-8'}`}>
      <div className="relative flex items-center justify-center w-24 h-24">
        {/* Outer glowing ring */}
        <div className="absolute w-full h-full rounded-full border border-primary/20 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
        
        {/* Intermediate spinning dashed ring */}
        <div className="absolute w-[80%] h-[80%] rounded-full border-[3px] border-dashed border-primary/40 animate-[spin_3s_linear_infinite]" />
        
        {/* Inner solid spinning ring */}
        <div className="absolute w-[60%] h-[60%] rounded-full border-[3px] border-transparent border-t-primary border-l-primary animate-spin" />
        
        <div className="absolute flex text-primary">
          <Pi className="w-6 h-6 animate-pulse" />
        </div>
      </div>
      
      {message && (
        <div className="mt-6 text-primary/80 font-medium tracking-wide animate-pulse text-sm">
          {message}
        </div>
      )}
    </div>
  );
};
