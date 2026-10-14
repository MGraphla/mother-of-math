import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientShimmer } from "@/components/ui/gradient-shimmer";
import { motion } from "framer-motion";

const examplePrompts = [
  "Give me a lesson on Sets and Logic for Class 1",
  "Create a math exercise about counting to 20 using local examples",
  "create a lesson plan for teaching addition and subtraction",
  "Analyze this student work and provide feedback",
];

const WelcomeMessage = ({ onExamplePrompt }: { onExamplePrompt?: (prompt: string) => void }) => {
  return (
    <Card className="mb-8 shadow-xl border-2 border-mama-purple/10 bg-gradient-to-br from-mama-light to-white animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl md:text-3xl font-extrabold text-mama-purple drop-shadow-lg">
          Welcome to{" "}
          <GradientShimmer
            gradient="bubble"
            easing="smooth"
            duration={1.45}
            spread={3}
            angle={105}
            pauseBetween={1000}
            baseColor="currentColor"
            className="text-2xl md:text-3xl font-extrabold text-mama-purple"
          >
            Mother Of Mathematics
          </GradientShimmer>
          !
        </CardTitle>
        <CardDescription className="text-lg text-mama-purple/80">What do you want to teach today?</CardDescription>
      </CardHeader>
      <CardContent>
        <motion.p className="mb-4 text-base font-medium" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          I'm here to help with:
        </motion.p>
        <ul className="list-disc pl-5 space-y-2 text-mama-dark/90">
          <li>Creating structured lesson plans for Cameroon primary math curriculum</li>
          <li>Analyzing photos of student work to identify errors</li>
          <li>Providing remediation advice based on math error analysis</li>
          <li>Generating weekly performance summaries</li>
        </ul>
        <div className="mt-6 bg-mama-light/80 p-4 rounded-md border border-mama-purple/10">
          <p className="text-sm font-semibold text-mama-purple">Try asking:</p>
          <ul className="text-sm mt-2 space-y-2">
            {examplePrompts.map((prompt, idx) => (
              <motion.li
                key={prompt}
                className="italic cursor-pointer font-medium transition-colors px-2 py-2 rounded border border-mama-purple bg-mama-purple/10 hover:bg-mama-purple/20 hover:border-mama-purple/80 text-mama-purple"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onExamplePrompt && onExamplePrompt(prompt)}
                tabIndex={0}
                role="button"
                aria-label={`Try: ${prompt}`}
              >
                {`"${prompt}"`}
              </motion.li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default WelcomeMessage;
