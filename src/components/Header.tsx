
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Menu, X, BookHeart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navLinks = [
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact Us' },
];

const Header = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-t-2 border-primary border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-7xl items-center justify-between">
        {/* Logo and Brand Name */}
        <Link to="/" className="flex items-center gap-2">
          <BookHeart className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold tracking-tight text-foreground">
            Mama Math
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          {navLinks.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              onClick={() => navigate(link.href)}
            >
              {link.label}
            </Button>
          ))}
        </nav>

        {/* Desktop Action Buttons */}
        <div className="hidden md:flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/sign-in')}>
            Sign In
          </Button>
          <Button onClick={() => navigate('/sign-up')}>
            Sign Up
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <Button onClick={toggleMenu} variant="ghost" size="icon">
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-16 inset-x-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
          >
            <div className="container py-4 flex flex-col gap-4">
              {navLinks.map((link) => (
                <Button
                  key={link.href}
                  variant="ghost"
                  className="w-full justify-start text-lg font-medium"
                  onClick={() => { navigate(link.href); setIsMenuOpen(false); }}
                >
                  {link.label}
                </Button>
              ))}
              <div className="border-t border-border/40 pt-4 flex flex-col gap-4">
                <Button variant="outline" onClick={() => { navigate('/sign-in'); setIsMenuOpen(false); }}>
                  Sign In
                </Button>
                <Button onClick={() => { navigate('/sign-up'); setIsMenuOpen(false); }}>
                  Sign Up
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
