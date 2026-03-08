
import { Heart } from 'lucide-react';
import { useLanguage } from "@/context/LanguageContext";

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="relative bg-gray-950 text-gray-300 overflow-hidden">
      {/* Bottom bar */}
      <div className="relative border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500 text-center sm:text-left">
              &copy; {new Date().getFullYear()} Mothers for Mathematics. {t('footer.rightsReserved')}
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              Made with <Heart className="h-3 w-3 text-red-400 fill-red-400 inline" /> for Cameroonian educators
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
