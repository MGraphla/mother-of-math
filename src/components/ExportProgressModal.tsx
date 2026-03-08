import React, { useState, useEffect, useMemo } from 'react';
import { FileText, FileType, CheckCircle2, Loader2, ImageIcon, Download, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ExportStep {
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface ExportProgressModalProps {
  isOpen: boolean;
  exportType: 'pdf' | 'pptx';
  progressMessage: string;
  isComplete: boolean;
  onClose: () => void;
}

// Fun math facts to rotate while waiting
const mathFacts = [
  "Did you know? The word 'Mathematics' comes from the Greek word 'mathema', meaning 'learning'.",
  "A 'googol' is the number 1 followed by 100 zeros — it inspired the name 'Google'!",
  "Zero is the only number that can't be represented in Roman numerals.",
  "Every odd number has the letter 'e' in it: one, three, five, seven, nine…",
  "The symbol for division (÷) is called an obelus.",
  "111,111,111 × 111,111,111 = 12,345,678,987,654,321 — a perfect palindrome!",
  "A pizza that has radius 'z' and height 'a' has volume Pi × z × z × a.",
  "In Cameroon, mathematics is taught in both English and French!",
  "The equals sign (=) was invented in 1557 by Robert Recorde.",
  "If you shuffle a deck of cards, that exact order has probably never existed before!",
  "The number 4 is the only number with the same number of letters as its value.",
  "A 'jiffy' is an actual unit of time: 1/100th of a second.",
];

// Floating math symbols for the background animation
const floatingSymbols = ['π', '∑', '∞', '÷', '×', '√', '∫', 'Δ', '±', '%', '=', '+'];

const ExportProgressModal: React.FC<ExportProgressModalProps> = ({
  isOpen,
  exportType,
  progressMessage,
  isComplete,
  onClose,
}) => {
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [factFade, setFactFade] = useState(true);

  // Export steps definition
  const steps: ExportStep[] = useMemo(() => {
    const type = exportType === 'pdf' ? 'PDF' : 'PowerPoint';
    return [
      {
        label: 'Preparing',
        description: `Setting up your ${type} export...`,
        icon: <Sparkles className="h-5 w-5" />,
      },
      {
        label: 'Generating Images',
        description: 'AI is creating custom illustrations...',
        icon: <ImageIcon className="h-5 w-5" />,
      },
      {
        label: `Building ${type}`,
        description: `Assembling your ${type.toLowerCase()} document...`,
        icon: exportType === 'pdf' ? <FileText className="h-5 w-5" /> : <FileType className="h-5 w-5" />,
      },
      {
        label: 'Downloading',
        description: 'Saving the file to your device...',
        icon: <Download className="h-5 w-5" />,
      },
    ];
  }, [exportType]);

  // Map progress messages to step index and percentage
  useEffect(() => {
    if (!progressMessage) return;
    const msg = progressMessage.toLowerCase();

    if (msg.includes('generating ai images') || msg.includes('generating 3 ai') || msg.includes('generating') && msg.includes('ai')) {
      setCurrentStep(1);
      setProgress(20);
    } else if (msg.includes('this may take a moment')) {
      setCurrentStep(1);
      setProgress(30);
    } else if (msg.includes('generated') && msg.includes('images')) {
      setCurrentStep(1);
      setProgress(55);
    } else if (msg.includes('image generation unavailable') || msg.includes('could not be generated')) {
      setCurrentStep(1);
      setProgress(50);
    } else if (msg.includes('building')) {
      setCurrentStep(2);
      setProgress(65);
    } else if (msg.includes('saving')) {
      setCurrentStep(3);
      setProgress(90);
    } else if (msg.includes('preparing')) {
      setCurrentStep(0);
      setProgress(5);
    }
  }, [progressMessage]);

  // Completion state
  useEffect(() => {
    if (isComplete) {
      setCurrentStep(4);
      setProgress(100);
    }
  }, [isComplete]);

  // Rotate fun facts every 6 seconds
  useEffect(() => {
    if (!isOpen || isComplete) return;
    const interval = setInterval(() => {
      setFactFade(false);
      setTimeout(() => {
        setCurrentFactIndex((prev) => (prev + 1) % mathFacts.length);
        setFactFade(true);
      }, 400);
    }, 6000);
    return () => clearInterval(interval);
  }, [isOpen, isComplete]);

  // Smooth progress bar animation - trickle effect
  useEffect(() => {
    if (!isOpen || isComplete) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        // Slowly trickle up, but don't exceed the next "real" milestone
        const maxTrickle = currentStep === 0 ? 18 : currentStep === 1 ? 52 : currentStep === 2 ? 85 : 95;
        if (prev < maxTrickle) {
          return prev + 0.3;
        }
        return prev;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [isOpen, isComplete, currentStep]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setProgress(2);
      setCurrentFactIndex(Math.floor(Math.random() * mathFacts.length));
      setFactFade(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Floating math symbols background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {floatingSymbols.map((symbol, i) => (
          <span
            key={i}
            className="absolute text-white/[0.07] font-bold select-none"
            style={{
              fontSize: `${24 + (i % 4) * 16}px`,
              left: `${(i * 8.3) % 100}%`,
              top: `${(i * 13.7 + 5) % 100}%`,
              animation: `float-symbol ${8 + (i % 5) * 2}s ease-in-out infinite`,
              animationDelay: `${i * 0.6}s`,
            }}
          >
            {symbol}
          </span>
        ))}
      </div>

      {/* Modal content */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-background rounded-2xl shadow-2xl border overflow-hidden">
        {/* Top accent bar - animated gradient */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-emerald-400 to-primary bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]" />

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              {isComplete ? (
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10">
                  <CheckCircle2 className="h-10 w-10 text-primary animate-[scale-in_0.3s_ease-out]" />
                </div>
              ) : (
                <div className="relative w-32 h-32">
                  {/* Interactive SVG Animation: Mama Math stirring a pot of knowledge */}
                  <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                    {/* Background Glow */}
                    <circle cx="50" cy="50" r="45" fill="currentColor" className="text-primary/5 animate-pulse" />
                    
                    {/* Mother Figure */}
                    <g className="mother">
                      {/* Body/Dress */}
                      <path d="M 20 90 C 20 50, 40 40, 50 40 C 60 40, 80 50, 80 90 Z" fill="#F4B400" />
                      {/* Dress Pattern (simple sash) */}
                      <path d="M 35 45 L 65 90 L 80 90 L 50 40 Z" fill="#e6a800" />
                      
                      {/* Neck */}
                      <rect x="46" y="25" width="8" height="20" fill="#4b2e1b" />
                      
                      {/* Face Profile */}
                      <path d="M 50 30 C 40 30, 38 20, 40 15 C 42 10, 50 8, 55 10 C 60 12, 62 20, 60 25 C 58 30, 55 30, 50 30 Z" fill="#4b2e1b" />
                      
                      {/* Headwrap (Gele) */}
                      <path d="M 35 15 C 30 0, 50 -10, 60 0 C 70 10, 65 20, 55 20 C 45 20, 35 20, 35 15 Z" fill="#009e60" />
                      <path d="M 45 -5 C 55 -15, 70 -5, 60 5 Z" fill="#007a4b" />
                      <path d="M 38 5 C 30 -5, 45 -15, 50 -5 Z" fill="#00c87a" />
                      
                      {/* Earring */}
                      <circle cx="56" cy="22" r="2" fill="#F4B400" />

                      {/* Arm (Left) */}
                      <path d="M 30 50 Q 15 65 35 75" fill="none" stroke="#4b2e1b" strokeWidth="6" strokeLinecap="round" />
                      
                      {/* Arm (Right) - Stirring */}
                      <g className="animate-[stir_2s_ease-in-out_infinite]" style={{ transformOrigin: '70px 50px' }}>
                        <path d="M 70 50 Q 85 65 55 70" fill="none" stroke="#4b2e1b" strokeWidth="6" strokeLinecap="round" />
                        {/* Wooden Spoon */}
                        <line x1="55" y1="70" x2="45" y2="85" stroke="#8b5a2b" strokeWidth="4" strokeLinecap="round" />
                      </g>
                    </g>

                    {/* The Pot */}
                    <path d="M 25 75 C 25 100, 75 100, 75 75 Z" fill="#2d3748" />
                    <ellipse cx="50" cy="75" rx="25" ry="6" fill="#1a202c" />
                    {/* Soup/Liquid */}
                    <ellipse cx="50" cy="75" rx="22" ry="4" fill="#009e60" className="animate-pulse" />

                    {/* Floating Math Symbols (Bubbles) */}
                    <g className="animate-[float-up_3s_linear_infinite] opacity-0" style={{ animationDelay: '0s' }}>
                      <text x="40" y="70" fontSize="10" fill="#F4B400" fontWeight="bold">+</text>
                    </g>
                    <g className="animate-[float-up_3.5s_linear_infinite] opacity-0" style={{ animationDelay: '0.7s' }}>
                      <text x="55" y="70" fontSize="12" fill="#fff" fontWeight="bold">π</text>
                    </g>
                    <g className="animate-[float-up_2.5s_linear_infinite] opacity-0" style={{ animationDelay: '1.4s' }}>
                      <text x="45" y="70" fontSize="14" fill="#009e60" fontWeight="bold">÷</text>
                    </g>
                    <g className="animate-[float-up_3.2s_linear_infinite] opacity-0" style={{ animationDelay: '2.1s' }}>
                      <text x="60" y="70" fontSize="11" fill="#F4B400" fontWeight="bold">×</text>
                    </g>
                    <g className="animate-[float-up_2.8s_linear_infinite] opacity-0" style={{ animationDelay: '1.1s' }}>
                      <text x="35" y="70" fontSize="13" fill="#fff" fontWeight="bold">∑</text>
                    </g>
                    <g className="animate-[float-up_3.6s_linear_infinite] opacity-0" style={{ animationDelay: '2.5s' }}>
                      <text x="50" y="70" fontSize="12" fill="#00c87a" fontWeight="bold">∞</text>
                    </g>
                  </svg>
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {isComplete
                ? 'Export Complete!'
                : `Exporting ${exportType === 'pdf' ? 'PDF' : 'PowerPoint'}...`}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isComplete
                ? 'Your file has been downloaded successfully.'
                : 'Please wait while we generate your document with AI-powered images.'}
            </p>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>{progressMessage || 'Preparing...'}</span>
              <span className="font-mono">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3 transition-all duration-500" />
          </div>

          {/* Step indicators */}
          <div className="space-y-3 mb-8">
            {steps.map((step, idx) => {
              const isActive = idx === currentStep;
              const isDone = idx < currentStep || isComplete;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-500 ${
                    isActive
                      ? 'bg-primary/10 border border-primary/30 shadow-sm'
                      : isDone
                      ? 'bg-muted/50'
                      : 'opacity-40'
                  }`}
                >
                  {/* Step icon */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isDone
                        ? 'bg-primary text-white'
                        : isActive
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      step.icon
                    )}
                  </div>

                  {/* Step text */}
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        isDone
                          ? 'text-primary'
                          : isActive
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                      {isDone && (
                        <span className="text-xs ml-2 text-primary/70">Done</span>
                      )}
                    </p>
                    {isActive && (
                      <p className="text-xs text-muted-foreground truncate">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fun fact section (hidden when complete) */}
          {!isComplete && (
            <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
                    Did you know?
                  </p>
                  <p
                    className={`text-xs text-muted-foreground leading-relaxed transition-opacity duration-400 ${
                      factFade ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {mathFacts[currentFactIndex]}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Close button (only visible when complete) */}
          {isComplete && (
            <div className="flex justify-center mt-2">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-md hover:shadow-lg"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Keyframe styles injected inline */}
      <style>{`
        @keyframes float-symbol {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-20px) rotate(5deg); }
          50% { transform: translateY(-10px) rotate(-3deg); }
          75% { transform: translateY(-25px) rotate(4deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes scale-in {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes float-up {
          0% {
            transform: translateY(0) scale(0.5);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(-60px) scale(1.5);
            opacity: 0;
          }
        }
        @keyframes stir {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-15deg);
          }
          50% {
            transform: rotate(0deg);
          }
          75% {
            transform: rotate(15deg);
          }
        }
      `}</style>
    </div>
  );
};

export default ExportProgressModal;
