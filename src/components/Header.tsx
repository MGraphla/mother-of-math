
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Menu, X, BookHeart, ArrowRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/context/LanguageContext';

const Header = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { label: t('nav.features'), href: '#features' },
    { label: t('nav.howItWorks'), href: '#how-it-works' },
    { label: t('nav.testimonials'), href: '#testimonials' },
  ];

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const handleSmoothScroll = (href: string) => {
    setIsMenuOpen(false);
    if (href.startsWith('#')) {
      const el = document.querySelector(href);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    navigate(href);
  };

  return (
    <>
      {/* Top announcement bar */}
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="relative z-[60] bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500 text-white"
      >
        <div className="container max-w-7xl mx-auto flex items-center justify-center gap-2 px-4 py-1.5 text-xs sm:text-sm font-medium">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          <span>{t('home.tagline')}</span>
          <span className="hidden sm:inline text-white/60">—</span>
          <button
            onClick={() => navigate('/sign-up')}
            className="hidden sm:inline-flex items-center gap-1 underline underline-offset-2 decoration-white/40 hover:decoration-white transition-all font-semibold"
          >
            {t('home.startFree')} <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </motion.div>

      {/* Main header */}
      <motion.header
        className="sticky top-0 z-50 w-full border-b border-green-700/40 bg-green-600 shadow-md"
      >
        <div className="container flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <motion.div
              whileHover={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.5 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-white/20 rounded-xl blur-lg group-hover:bg-white/30 transition-colors" />
              <div className="relative bg-white/20 border border-white/30 p-2 rounded-xl shadow-lg">
                <BookHeart className="h-5 w-5 text-white" />
              </div>
            </motion.div>
            <div className="flex flex-col">
              <span className="text-lg font-extrabold tracking-tight text-white leading-tight">
                Mama Math
              </span>
              <span className="text-[10px] font-medium text-white/70 tracking-wider uppercase leading-tight hidden sm:block">
                Mothers for Mathematics
              </span>
            </div>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleSmoothScroll(link.href)}
                className="relative px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors rounded-lg group"
              >
                {link.label}
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-white rounded-full group-hover:w-3/4 transition-all duration-300" />
              </button>
            ))}
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher variant="compact" className="text-white/90 hover:text-white hover:bg-green-700" />
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                variant="ghost"
                className="text-white hover:text-white hover:bg-green-700 font-medium transition-all"
                onClick={() => navigate('/sign-in')}
              >
                {t('nav.signIn')}
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                className="bg-white text-green-600 hover:bg-green-50 shadow-lg shadow-green-900/20 font-semibold px-5 rounded-full transition-all duration-300"
                onClick={() => navigate('/sign-up')}
              >
                {t('nav.getStarted')}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </motion.div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              onClick={toggleMenu}
              variant="ghost"
              size="icon"
              className="hover:bg-green-700 text-white relative"
            >
              <AnimatePresence mode="wait">
                {isMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="h-5 w-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu className="h-5 w-5" />
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="sr-only">Toggle menu</span>
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="md:hidden overflow-hidden border-t border-green-700/40 bg-green-600"
            >
              <div className="container px-4 sm:px-6 py-4 flex flex-col gap-1">
                {navLinks.map((link, i) => (
                  <motion.button
                    key={link.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleSmoothScroll(link.href)}
                    className="flex items-center gap-3 px-4 py-3 text-white hover:text-white hover:bg-green-700 rounded-xl text-sm font-medium transition-all text-left"
                  >
                    {link.label}
                  </motion.button>
                ))}

                <div className="border-t border-green-700/40 my-2" />

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                  className="flex flex-col gap-2 pt-1"
                >
                  <div className="flex justify-center pb-2">
                    <LanguageSwitcher variant="default" />
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-center text-white hover:text-white hover:bg-green-700 font-medium"
                    onClick={() => { navigate('/sign-in'); setIsMenuOpen(false); }}
                  >
                    {t('nav.signIn')}
                  </Button>
                  <Button
                    className="w-full bg-white text-green-600 hover:bg-green-50 shadow-lg font-semibold rounded-full"
                    onClick={() => { navigate('/sign-up'); setIsMenuOpen(false); }}
                  >
                    {t('nav.getStarted')}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    </>
  );
};

export default Header;

