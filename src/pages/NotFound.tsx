import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-green-50">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
          <span className="text-4xl">🔍</span>
        </div>
        <h1 className="text-6xl font-extrabold text-gray-800">404</h1>
        <p className="text-xl text-gray-600">Oops! Page not found</p>
        <p className="text-sm text-gray-500 max-w-md">
          The page <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">{location.pathname}</code> doesn&apos;t exist.
        </p>
        <Link to="/">
          <Button className="mt-4" variant="default">
            <Home className="mr-2 h-4 w-4" /> Return to Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
