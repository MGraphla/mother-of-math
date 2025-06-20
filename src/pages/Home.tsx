import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useTransform, useMotionValue, useScroll, useSpring } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FlippableImageCard from '@/components/FlippableImageCard';
import { 
  ArrowRight, 
  BookOpen, 
  Target, 
  Zap, 
  Users, 
  Sparkles, 
  Bell, 
  ChevronUp, 
  Newspaper, 
  Trophy, 
  Star, 
  Award, 
  Lightbulb, 
  Heart,
  Rocket,
  GraduationCap,
  School,
  Globe,
  Edit,
  Download,
  ArrowLeft
} from 'lucide-react';

const FloatingShapes = () => {
  const shapes = Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 30 + 10,
    duration: Math.random() * 15 + 15,
    delay: Math.random() * 5,
    rotation: Math.random() * 360,
  }));

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden z-0">
      {shapes.map(shape => (
        <motion.div
          key={shape.id}
          className="absolute bg-gradient-to-br from-primary/20 to-green-700/20 rounded-full backdrop-blur-sm"
          initial={{ x: `${shape.x}vw`, y: `${shape.y}vh`, scale: 0, rotate: 0 }}
          animate={{
            x: [`${shape.x}vw`, `${shape.x + (Math.random() - 0.5) * 15}vw`],
            y: [`${shape.y}vh`, `${shape.y + (Math.random() - 0.5) * 15}vh`],
            scale: [0, 1, 0],
            rotate: [0, shape.rotation],
          }}
          transition={{
            duration: shape.duration,
            repeat: Infinity,
            repeatType: 'mirror',
            ease: 'easeInOut',
            delay: shape.delay,
          }}
          style={{
            width: shape.size,
            height: shape.size,
            filter: 'blur(1px)',
          }}
        />
      ))}
    </div>
  );
};

const TimelineItem = ({ year, title, description, icon: Icon, isLast = false }) => (
  <motion.div
    className="relative pl-16 pb-16"
    initial={{ opacity: 0, y: 50 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.3 }}
    transition={{ duration: 0.6, ease: 'easeOut' }}
  >
    {!isLast && (
      <div className="absolute top-5 left-5 -ml-px mt-1 w-0.5 h-full bg-gray-200" aria-hidden="true" />
    )}
    <div className="relative flex items-start group">
      <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-primary to-green-600 rounded-full flex items-center justify-center shadow-lg ring-8 ring-gray-50">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="ml-6">
        <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 w-full">
          <span className="text-primary font-bold text-sm uppercase tracking-wider">{year}</span>
          <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-gray-800">{title}</h3>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-4 sm:mb-6">{description}</p>
        </div>
      </div>
    </div>
  </motion.div>
);

const StatsCounter = ({ end, duration = 2, prefix = '', suffix = '' }) => {
  const [count, setCount] = useState(0);
  const countRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let startTime = null;
          const animate = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / (duration * 1000), 1);
            setCount(Math.floor(progress * end));
            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );

    if (countRef.current) {
      observer.observe(countRef.current);
    }

    return () => observer.disconnect();
  }, [end, duration]);

  return (
    <div ref={countRef} className="text-center">
      <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
        {prefix}{count}{suffix}
      </div>
    </div>
  );
};

const NewsCard = ({ news }) => (
  <motion.div
    className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
    whileHover={{ y: -5 }}
  >
    <div className="relative h-48">
      <img src={news.image} alt={news.title} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
      <div className="absolute bottom-4 left-4 text-white">
        <span className="text-sm bg-primary/80 px-2 py-1 rounded-full">{news.category}</span>
      </div>
    </div>
    <div className="p-6">
      <h3 className="text-xl font-semibold mb-2">{news.title}</h3>
      <p className="text-gray-600 mb-4">{news.excerpt}</p>
      <Button variant="ghost" className="text-primary hover:text-primary/80">
        Read More <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  </motion.div>
);

const FloatingActionButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          className="fixed bottom-8 right-8 bg-primary text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-shadow duration-300 z-50"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <ChevronUp className="w-6 h-6" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};

const NotificationBadge = () => (
  <motion.div
    className="fixed top-24 right-8 bg-white rounded-lg shadow-lg p-4 max-w-sm z-50"
    initial={{ opacity: 0, x: 100 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 2 }}
  >
    <div className="flex items-start space-x-3">
      <div className="bg-primary/10 p-2 rounded-full">
        <Bell className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h4 className="font-semibold text-gray-900">New Feature Available!</h4>
        <p className="text-sm text-gray-600">Try our new AI-powered homework checker</p>
      </div>
    </div>
  </motion.div>
);

const HowItWorks = () => {
  const [activeStep, setActiveStep] = useState(0);
  const ref = useRef(null);

  // Hooks for 3D parallax effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [10, -10]);
  const rotateY = useTransform(x, [-100, 100], [-10, 10]);

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set(event.clientX - rect.left - rect.width / 2);
    y.set(event.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const steps = [
    { icon: BookOpen, title: "1. Enter Your Topic", description: "Start with any math topic, from algebra to geometry. Our AI is ready for anything you throw at it." },
    { icon: Sparkles, title: "2. AI Drafts the Outline", description: "Instantly receive a structured lesson outline, complete with sections like Introduction, Activities, and Assessment." },
    { icon: Edit, title: "3. Customize & Refine", description: "You're in control. Easily drag, drop, edit, add, or remove sections to perfectly match your teaching style." },
    { icon: Lightbulb, title: "4. Generate the Full Lesson", description: "With one click, the AI expands your outline into a rich, detailed lesson plan filled with engaging content." },
    { icon: Download, title: "5. Review & Export", description: "Make final tweaks to the generated plan, then export it as a PDF or Word document for classroom use." },
  ];

  // Inner component for visual panel content
  const StepVisual = ({ stepIndex }: { stepIndex: number }) => {
    const visuals = [
      // Step 1 Visual
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <BookOpen className="w-24 h-24 text-primary/20 mb-6" />
        <p className="text-gray-500 mb-4">Enter lesson topic...</p>
        <div className="w-full max-w-xs bg-gray-100 rounded-lg p-4 flex items-center">
          <span className="font-mono text-gray-800">Algebra</span>
          <motion.div className="w-0.5 h-6 bg-primary ml-1" animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1, repeat: Infinity }}></motion.div>
        </div>
      </div>,
      // Step 2 Visual
      <div className="flex flex-col justify-start h-full p-8">
        <h4 className="font-bold text-gray-800 mb-4">Lesson Outline:</h4>
        <ul className="space-y-3">
          {['Introduction', 'Key Concepts', 'Activities', 'Assessment'].map((item, i) => (
            <motion.li key={item} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.2 }} className="flex items-center text-gray-600">
              <Sparkles className="w-4 h-4 text-primary/50 mr-3 flex-shrink-0" /> {item}
            </motion.li>
          ))}
        </ul>
      </div>,
      // Step 3 Visual
      <div className="flex flex-col justify-start h-full p-8">
        <h4 className="font-bold text-gray-800 mb-4">Customizing...</h4>
        <ul className="space-y-3">
          <motion.li className="flex items-center text-gray-600 bg-green-100/50 p-2 rounded-lg border border-primary/20"><Edit className="w-4 h-4 text-primary/50 mr-3 flex-shrink-0" /> Introduction</motion.li>
          <li className="flex items-center text-gray-600"><Sparkles className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" /> Key Concepts</li>
          <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center text-gray-600"><Sparkles className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" /> Group Project (New)</motion.li>
        </ul>
      </div>,
      // Step 4 Visual
      <div className="flex flex-col justify-start h-full p-8 overflow-hidden">
        <h4 className="font-bold text-gray-800 mb-4">Generating Content...</h4>
        <motion.div initial={{ y: 0 }} animate={{ y: '-80%' }} transition={{ duration: 5, ease: 'linear', repeat: Infinity }} className="space-y-2 text-sm text-gray-500">
          <p>The lesson begins with a captivating hook... students will explore quadratic equations through real-world examples... a hands-on activity involves building catapults... assessment includes a short quiz and a creative project...</p>
          <p>Differentiation for advanced learners includes exploring complex polynomials... support for struggling students involves guided practice worksheets...</p>
        </motion.div>
      </div>,
      // Step 5 Visual
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Lightbulb className="w-24 h-24 text-primary/20 mb-6" />
        <h4 className="font-bold text-2xl text-gray-800 mb-6">Lesson Plan Complete!</h4>
        <div className="flex gap-4">
          <Button variant="secondary"><Download className="w-4 h-4 mr-2" /> PDF</Button>
          <Button variant="secondary"><Download className="w-4 h-4 mr-2" /> Word</Button>
        </div>
      </div>
    ];
    return visuals[stepIndex] || null;
  };

  return (
    <section id="how-it-works" className="py-16 sm:py-20 md:py-24 bg-gray-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-20">
          <span className="text-primary font-semibold mb-2 block">Our Process</span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500 mb-4">How Lesson Plan Generation Works</h2>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-700 max-w-xl mx-auto md:mx-0">
            From a simple idea to a complete, downloadable lesson plan in just a few clicks.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          {/* Left Column: Steps */}
          <div className="flex flex-col gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                className="py-4"
                onViewportEnter={() => setActiveStep(index)}
              >
                <motion.div 
                  className="p-8 rounded-2xl relative"
                  animate={{ scale: activeStep === index ? 1.05 : 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                  <motion.div 
                    className="absolute inset-0 bg-white rounded-2xl shadow-lg"
                    animate={{ opacity: activeStep === index ? 1 : 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                  {activeStep === index && (
                    <motion.div
                      className="absolute -inset-px rounded-2xl z-0"
                      animate={{
                        boxShadow: [
                          '0 0 20px rgba(34, 197, 94, 0.4)',
                          '0 0 30px rgba(139, 92, 246, 0.4)',
                          '0 0 20px rgba(34, 197, 94, 0.4)',
                        ]
                      }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                  <div className="relative z-10">
                    <div className="flex items-center">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-6 transition-all duration-300 ${activeStep === index ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                        <step.icon className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-3">{step.title}</h3>
                    </div>
                    <p className="text-sm sm:text-base text-gray-600 mt-4 pl-16">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>

          {/* Right Column: Sticky Visual Panel */}
          <div className="hidden lg:block sticky top-24">
             <motion.div
              ref={ref}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{ perspective: '1000px' }}
              className="relative w-full h-[600px] rounded-2xl shadow-inner border border-gray-200/50 overflow-hidden bg-white"
            >
              <motion.div
                style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
                className="w-full h-full"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100" />
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0"
                  >
                    <StepVisual stepIndex={activeStep} />
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const springY = useSpring(y, { stiffness: 100, damping: 30 });

  const handleGetStarted = () => {
    navigate('/sign-up');
  };

  const features = [
    {
      title: 'AI-Powered Analysis',
      description: 'Upload student work and get instant, detailed feedback. Our AI identifies error patterns and suggests targeted interventions.',
      icon: <Zap className="w-8 h-8 text-primary" />,
    },
    {
      title: 'Curriculum-Aligned Lessons',
      description: 'Access a rich library of lesson plans and materials, all perfectly aligned with the official Cameroonian curriculum.',
      icon: <BookOpen className="w-8 h-8 text-primary" />,
    },
    {
      title: 'Student Progress Tracking',
      description: 'Monitor individual and class-wide performance with intuitive dashboards. Understand strengths and weaknesses at a glance.',
      icon: <Target className="w-8 h-8 text-primary" />,
    },
    {
      title: 'Collaborative Platform',
      description: 'A space for teachers and parents to connect, share insights, and support student learning journeys together.',
      icon: <Users className="w-8 h-8 text-primary" />,
    },
  ];

  const testimonials = [
    {
      quote: "This platform is a game-changer. The AI analysis saves me hours and gives me concrete ways to help my students.",
      author: "Mrs. Fanba, Teacher in Yaoundé",
      image: "https://i.pravatar.cc/150?u=a042581f4e29026704d",
    },
    {
      quote: "For the first time, I feel like I can truly support my child's math education. The curriculum alignment is fantastic.",
      author: "Mr. Manka'a, Parent in Douala",
      image: "https://i.pravatar.cc/150?u=a042581f4e29026704e",
    },
    {
      quote: "The progress tracking is incredibly insightful. I can now tailor my teaching to the specific needs of my class.",
      author: "Ms. Bi Suh, Educator in Bafoussam",
      image: "https://i.pravatar.cc/150?u=a042581f4e29026704f",
    },
  ];

  const news = [
    {
      title: "New AI Features Released",
      excerpt: "Our latest update brings powerful new AI capabilities to help teachers better understand student performance.",
      image: "https://images.unsplash.com/photo-1581092921461-39b9d08a9b21?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
      category: "Updates",
    },
    {
      title: "Success Story: Douala School District",
      excerpt: "How one district improved math scores by 40% using our platform.",
      image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
      category: "Success Stories",
    },
    {
      title: "Teacher Training Program",
      excerpt: "Join our comprehensive training program to master all platform features.",
      image: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
      category: "Events",
    },
  ];

  const partners = [
    { name: "Ministry of Education", logo: "https://via.placeholder.com/150?text=MOE" },
    { name: "Cameroon Teachers Union", logo: "https://via.placeholder.com/150?text=CTU" },
    { name: "African Education Initiative", logo: "https://via.placeholder.com/150?text=AEI" },
    { name: "Global Learning Fund", logo: "https://via.placeholder.com/150?text=GLF" },
  ];

  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right
  const timerRef = useRef(null);

  const testimonialCount = testimonials.length;

  // Carousel navigation handlers
  const paginate = (newDirection) => {
    setDirection(newDirection);
    setCurrentTestimonial((prev) => {
      let next = prev + newDirection;
      if (next < 0) return testimonialCount - 1;
      if (next >= testimonialCount) return 0;
      return next;
    });
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') paginate(-1);
      if (e.key === 'ArrowRight') paginate(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Autoplay with reset on manual navigation
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      paginate(1);
    }, 5000);
    return () => clearInterval(timerRef.current);
  }, [currentTestimonial]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white text-gray-800">
      <Header />
      <FloatingActionButton />

      {/* Hero Section */}
      <section className="relative w-full min-h-[90vh] bg-gradient-to-br from-mint-100 to-white flex items-center overflow-hidden px-0">
        <div className="absolute inset-0 z-0">
        <FloatingShapes />
        </div>
        <div className="w-full flex flex-col md:flex-row items-center justify-between py-32 px-0 relative z-10">
          <div className="w-full md:w-1/2 text-center md:text-left px-4 md:px-8 lg:px-16 xl:pl-32 z-10">
            <span className="inline-block mb-6 px-6 py-2 bg-green-100 text-green-700 rounded-full font-semibold text-lg tracking-wide">
              Transforming Mathematics Education
            </span>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold text-gray-900 mb-8 sm:mb-10 leading-tight font-[Poppins,Inter,sans-serif]">
              Mothers for <motion.span
                animate={{
                  color: ["#22c55e", "#ec4899", "#8b5cf6", "#22c55e"],
                  textShadow: [
                    "0 0 12px rgba(34, 197, 94, 0.9)",
                    "0 0 12px rgba(236, 72, 153, 0.9)",
                    "0 0 12px rgba(139, 92, 246, 0.9)",
                    "0 0 12px rgba(34, 197, 94, 0.9)"
                  ]
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                Mathematics
              </motion.span>
            </h1>
            <p className="text-xl sm:text-2xl md:text-3xl text-gray-700 mb-10 sm:mb-12 font-[Open_Sans,sans-serif] max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto md:mx-0">
                We are transforming mathematics in Cameroon with AI-assisted education, fully aligned with the national curriculum.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start mb-10">
              <Button size="lg" onClick={handleGetStarted} variant="default" className="w-full sm:w-auto px-8 py-4 rounded-full text-lg font-bold shadow-xl hover:bg-green-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center">
                Get Started for Free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent border-primary text-primary px-8 py-4 rounded-full text-lg font-bold shadow-lg hover:bg-primary/10 transition-all duration-300 transform hover:scale-105">
                Watch Demo
              </Button>
            </div>
          </div>
          <div className="relative w-full md:w-1/2 flex justify-center mt-16 md:mt-0">
            {/* High-quality photo or animated SVG illustration */}
            <FlippableImageCard />
            {/* Optional: animated shapes or SVG overlays */}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="pt-8 sm:pt-12 md:pt-16 pb-16 sm:pb-20 md:pb-24 px-4 bg-gradient-to-b from-gray-50 to-sky-50 overflow-hidden w-full">
        <div className="w-full px-0">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-primary font-semibold mb-2 block">Features</span>
            <h2 className="text-6xl md:text-7xl font-extrabold text-gray-900 mb-8 tracking-tight">What It Does?</h2>
            <p className="text-3xl text-secondary mt-4 max-w-4xl mx-auto font-medium">Empowering teachers and parents to unlock every child's potential in mathematics.</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 lg:gap-10">
            <motion.div className="bg-white rounded-3xl shadow-2xl p-12 flex flex-col items-center border-t-4 border-primary" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Zap className="w-14 h-14 text-primary mb-6" />
              <div className="text-2xl sm:text-3xl font-extrabold text-primary mb-4 text-center">AI-Powered Analysis</div>
              <div className="text-base sm:text-lg text-gray-700 text-center font-medium">Upload student work and get instant, detailed feedback. Our AI identifies error patterns and suggests targeted interventions.</div>
            </motion.div>
            <motion.div className="bg-white rounded-3xl shadow-2xl p-12 flex flex-col items-center border-t-4 border-green-700" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <BookOpen className="w-14 h-14 text-green-700 mb-6" />
              <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-green-700 mb-4 text-center">Curriculum-Aligned Lessons</div>
              <div className="text-base sm:text-lg md:text-xl text-gray-700 text-center font-medium">Access a rich library of lesson plans and materials, all perfectly aligned with the official Cameroonian curriculum.</div>
            </motion.div>
            <motion.div className="bg-white rounded-3xl shadow-2xl p-12 flex flex-col items-center border-t-4 border-yellow-400" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <Target className="w-14 h-14 text-yellow-400 mb-6" />
              <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-yellow-400 mb-4 text-center">Student Progress Tracking</div>
              <div className="text-base sm:text-lg md:text-xl text-gray-700 text-center font-medium">Monitor individual and class-wide performance with intuitive dashboards. Understand strengths and weaknesses at a glance.</div>
            </motion.div>
            <motion.div className="bg-white rounded-3xl shadow-2xl p-12 flex flex-col items-center border-t-4 border-pink-400" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <Users className="w-14 h-14 text-pink-400 mb-6" />
              <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-pink-400 mb-4 text-center">Collaborative Platform</div>
              <div className="text-base sm:text-lg md:text-xl text-gray-700 text-center font-medium">A space for teachers and parents to connect, share insights, and support student learning journeys together.</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Timeline Section (How it Works) */}
      <HowItWorks />

      {/* Testimonials Section */}
      <section className="relative py-16 sm:py-20 md:py-24 lg:py-32 px-4 sm:px-6 lg:px-8 w-full bg-gradient-to-br from-green-50 via-white to-purple-50 overflow-x-clip">
        {/* Decorative background shapes */}
        <motion.div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-gradient-to-br from-primary/20 to-green-400/10 rounded-full blur-3xl z-0" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-gradient-to-br from-pink-400/10 to-primary/10 rounded-full blur-3xl z-0" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }} />
        <div className="relative z-10 w-full">
          <span className="text-primary font-semibold mb-2 block text-center">Testimonials</span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-16 text-center">Loved by Cameroonian Educators</h2>
          <div className="flex items-center justify-center gap-2 w-full px-2 md:px-8 lg:px-24">
            {/* Left arrow */}
            <button
              className="flex-shrink-0 bg-white/80 hover:bg-primary/20 text-primary rounded-full p-3 shadow-lg z-20 transition focus:outline-none focus:ring-2 focus:ring-primary absolute left-2 md:left-8 top-1/2 -translate-y-1/2"
              onClick={() => paginate(-1)}
              aria-label="Previous testimonial"
              style={{ boxShadow: '0 4px 24px 0 rgba(34,197,94,0.08)' }}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            {/* Multi-card carousel */}
            <div className="relative flex-1 w-full max-w-full overflow-visible">
              <div className="flex justify-center items-center gap-6 w-full">
                {[...Array(3)].map((_, idx) => {
                  // idx: 0 = left, 1 = center, 2 = right
                  const offset = idx - 1;
                  let tIndex = (currentTestimonial + offset + testimonials.length) % testimonials.length;
                  let scale = idx === 1 ? 1 : 0.92;
                  let opacity = idx === 1 ? 1 : 0.7;
                  let blur = idx === 1 ? 'blur-0' : 'blur-sm';
                  let zIndex = idx === 1 ? 'z-20' : 'z-10';
                  // Responsive: hide left/right on mobile, show 2 on md, 3 on lg
                  let hiddenClass = '';
                  if (idx === 0) hiddenClass = 'hidden md:block';
                  if (idx === 2) hiddenClass = 'hidden sm:block';
                  return (
                    <motion.div
                      key={tIndex}
                      className={`relative ${zIndex} px-2 py-8 md:px-8 md:py-12 bg-white/70 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/40 flex flex-col items-center transition-all duration-300 ${blur} ${hiddenClass}`}
                      style={{
                        minWidth: '320px',
                        maxWidth: '400px',
                        transform: `scale(${scale})`,
                        opacity,
                        boxShadow: idx === 1 ? '0 8px 32px 0 rgba(34,197,94,0.10)' : '0 2px 8px 0 rgba(34,197,94,0.06)'
                      }}
                    >
                      <span className="mb-4">
                        <svg width="48" height="48" fill="none" viewBox="0 0 56 56" className="text-primary opacity-80">
                          <path d="M21 38c0-7.732 6.268-14 14-14V10C20.617 10 8 22.617 8 38c0 6.627 5.373 12 12 12h0c0-5.523-4.477-10-10-10zM48 24v-10C34.617 14 22 26.617 22 42c0 6.627 5.373 12 12 12h0c0-5.523-4.477-10-10-10 0-7.732 6.268-14 14-14z" fill="currentColor"/>
                      </svg>
                    </span>
                    <p className={`text-base sm:text-lg md:text-xl italic text-gray-800 font-semibold leading-relaxed mb-4 sm:mb-6 max-w-xs mx-auto ${idx === 1 ? 'md:text-2xl' : ''}`}>“{testimonials[tIndex].quote}”</p>
                    {idx === 1 && (
                      <div className="mt-2 mb-6 flex flex-col items-center">
                        <span className="font-bold text-lg text-primary">{testimonials[tIndex].author.split(',')[0]}</span>
                        <span className="block text-gray-500 text-base mt-1">{testimonials[tIndex].author.split(',')[1]}</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
            {/* Dots below cards */}
            <div className="flex justify-center space-x-2 mt-12">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setDirection(index > currentTestimonial ? 1 : -1);
                    setCurrentTestimonial(index);
                  }}
                  className={`transition-all duration-300 h-2.5 w-8 rounded-full ${currentTestimonial === index ? 'bg-gradient-to-r from-primary to-green-600 shadow-lg' : 'bg-gray-300 hover:bg-gray-400 w-2.5'}`}
                  aria-label={`Show testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>
          {/* Right arrow */}
          <button
            className="flex-shrink-0 bg-white/80 hover:bg-primary/20 text-primary rounded-full p-3 shadow-lg z-20 transition focus:outline-none focus:ring-2 focus:ring-primary absolute right-2 md:right-8 top-1/2 -translate-y-1/2"
            onClick={() => paginate(1)}
            aria-label="Next testimonial"
            style={{ boxShadow: '0 4px 24px 0 rgba(34,197,94,0.08)' }}
          >
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </section>

    {/* CTA Section */}
    <section className="py-20 sm:py-24 md:py-32 px-4 bg-gradient-to-br from-primary to-green-700 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
      <div className="max-w-4xl mx-auto text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <span className="inline-block px-4 py-2 bg-white/10 rounded-full text-sm font-semibold backdrop-blur-sm">
            Join the Revolution
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">
            Ready to Transform Mathematics in Your Classroom?
          </h2>
          <p className="text-lg sm:text-xl mb-6 sm:mb-8 opacity-90 max-w-2xl mx-auto">
            Join hundreds of teachers and parents across Cameroon making a difference.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              variant="secondary" 
              onClick={handleGetStarted} 
              className="bg-white text-primary hover:bg-gray-100 font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300"
            >
              Start Your Journey Today
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-2 border-white/20 hover:border-white text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300"
            >
              Schedule a Demo
            </Button>
          </div>
        </motion.div>
      </div>
    </section>

      <Footer />
    </div>
  );
};

export default Home;

