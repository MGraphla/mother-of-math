import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Target, Award, Globe } from 'lucide-react';

const FlippableImageCard = () => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div style={{ perspective: '1000px' }} className="relative w-full max-w-2xl h-[480px] cursor-pointer" onClick={handleFlip}>
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.7, ease: 'easeInOut' }}
      >
        {/* Front of the card */}
        <div className="absolute w-full h-full" style={{ backfaceVisibility: 'hidden' }}>
          <img src="/teacher-students.svg" alt="Teacher and students" className="rounded-3xl shadow-2xl object-contain w-full h-full" />
          <div className="absolute bottom-4 right-4 bg-black/60 text-white px-4 py-2 rounded-full text-sm font-semibold backdrop-blur-sm">
            Click to see an example
          </div>
        </div>

        {/* Back of the card */}
        <div
          className="absolute w-full h-full bg-gradient-to-br from-primary to-green-700 rounded-3xl shadow-2xl p-8 text-white flex flex-col"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="border-2 border-white/30 rounded-2xl p-6 h-full flex flex-col">
            <div className="flex items-center mb-4">
              <Globe className="w-8 h-8 mr-3 text-yellow-300" />
              <h3 className="text-2xl font-bold">Sample Lesson: Cocoa Farming Math</h3>
            </div>
            <p className="text-lg mb-4 font-light">A practical lesson plan for Class 1 students, aligned with the Cameroonian curriculum.</p>
            
            <div className="flex-grow space-y-4 text-left mt-4">
              <div className="flex items-start">
                <BookOpen className="w-6 h-6 mr-3 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold">Topic</h4>
                  <p className="text-white/80">Calculating Area & Yield</p>
                </div>
              </div>
              <div className="flex items-start">
                <Target className="w-6 h-6 mr-3 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold">Objective</h4>
                  <p className="text-white/80">Students will calculate the potential cocoa yield from a 1-hectare farm.</p>
                </div>
              </div>
              <div className="flex items-start">
                <Award className="w-6 h-6 mr-3 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold">Real-World Skill</h4>
                  <p className="text-white/80">Applies geometry and multiplication to local agriculture.</p>
                </div>
              </div>
            </div>
            <p className="text-center text-yellow-300 font-semibold text-lg mt-6">Click again to flip back</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default FlippableImageCard;
