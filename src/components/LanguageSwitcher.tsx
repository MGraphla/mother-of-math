import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  variant?: 'default' | 'compact' | 'icon-only';
  className?: string;
}

const languages = [
  { code: 'en' as const, label: 'English', flag: '🇬🇧' },
  { code: 'fr' as const, label: 'Français', flag: '🇫🇷' },
];

export const LanguageSwitcher = ({ variant = 'default', className }: LanguageSwitcherProps) => {
  const { language, setLanguage, t } = useLanguage();

  const currentLang = languages.find(l => l.code === language) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={variant === 'icon-only' ? 'icon' : 'sm'}
          className={cn(
            'gap-2 font-medium transition-all',
            variant === 'icon-only' && 'w-9 h-9 p-0',
            className
          )}
        >
          {variant === 'icon-only' ? (
            <Globe className="h-4 w-4" />
          ) : variant === 'compact' ? (
            <>
              <span className="text-base">{currentLang.flag}</span>
              <span className="text-xs font-semibold uppercase">{currentLang.code}</span>
            </>
          ) : (
            <>
              <Globe className="h-4 w-4" />
              <span className="text-base">{currentLang.flag}</span>
              <span className="hidden sm:inline">{currentLang.label}</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={cn(
              'flex items-center gap-3 cursor-pointer',
              language === lang.code && 'bg-green-50 text-green-700'
            )}
          >
            <span className="text-lg">{lang.flag}</span>
            <span className="flex-1">{lang.label}</span>
            {language === lang.code && (
              <Check className="h-4 w-4 text-green-600" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Simple toggle button for sidebar use
export const LanguageToggle = ({ className }: { className?: string }) => {
  const { language, setLanguage } = useLanguage();

  const toggle = () => {
    setLanguage(language === 'en' ? 'fr' : 'en');
  };

  return (
    <button
      onClick={toggle}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
        'hover:bg-white/10 text-white/80 hover:text-white',
        className
      )}
    >
      <Globe className="h-4 w-4" />
      <span className="flex items-center gap-1.5">
        <span className={cn(
          'px-1.5 py-0.5 rounded text-xs font-bold transition-colors',
          language === 'en' ? 'bg-white/20' : 'opacity-50'
        )}>
          EN
        </span>
        <span className="text-white/40">/</span>
        <span className={cn(
          'px-1.5 py-0.5 rounded text-xs font-bold transition-colors',
          language === 'fr' ? 'bg-white/20' : 'opacity-50'
        )}>
          FR
        </span>
      </span>
    </button>
  );
};

export default LanguageSwitcher;
