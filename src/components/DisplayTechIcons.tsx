import React from 'react';

// A simple utility to get logo URLs. In a real app, this could be more sophisticated.
const getTechLogo = (tech: string): string | null => {
  const techLower = tech.toLowerCase();
  switch (techLower) {
    case 'react':
      return 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg';
    case 'javascript':
      return 'https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png';
    case 'typescript':
      return 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg';
    default:
      return null; // Return null if no logo is found
  }
};

interface TechIconProps {
  techStack: string[];
}

const DisplayTechIcons: React.FC<TechIconProps> = ({ techStack }) => {
  if (!techStack || techStack.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-row">
      {techStack.slice(0, 3).map((tech, index) => {
        const logoUrl = getTechLogo(tech);
        if (!logoUrl) return null; // Don't render anything if no logo is found

        return (
          <div
            key={tech}
            className={`relative group bg-gray-700 rounded-full p-2 flex items-center justify-center ${index >= 1 ? '-ml-3' : ''}`}>
            <span className="absolute bottom-full mb-2 w-max px-2 py-1 text-sm text-white bg-black rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              {tech}
            </span>
            <img
              src={logoUrl}
              alt={tech}
              className="w-5 h-5 object-contain"
            />
          </div>
        );
      })}
    </div>
  );
};

export default DisplayTechIcons;
