
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Menu, X, BookHeart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Header = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-green-700 bg-green-600 text-white shadow-lg">
      <div className="container flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo and Brand Name */}
        <Link to="/" className="flex items-center gap-2">
          <BookHeart className="h-8 w-8 text-white" />
          <span className="text-xl font-bold tracking-tight">
            Mama Math
          </span>
        </Link>

        {/* Desktop Action Buttons */}
        <div className="hidden md:flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="ghost" className="hover:bg-green-700 hover:text-white" onClick={() => navigate('/sign-in')}>
              Sign In
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button className="bg-white text-green-600 hover:bg-gray-100 shadow-md" onClick={() => navigate('/sign-up')}>
              Sign Up
            </Button>
          </motion.div>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <Button onClick={toggleMenu} variant="ghost" size="icon" className="hover:bg-green-700">
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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
            className="md:hidden overflow-hidden bg-green-600"
          >
            <div className="container px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full">
                <Button variant="ghost" className="w-full text-white hover:bg-green-700 hover:text-white text-lg" onClick={() => { navigate('/sign-in'); setIsMenuOpen(false); }}>
                  Sign In
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full">
                <Button className="w-full bg-white text-green-600 hover:bg-gray-100 text-lg shadow-md" onClick={() => { navigate('/sign-up'); setIsMenuOpen(false); }}>
                  Sign Up
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;

