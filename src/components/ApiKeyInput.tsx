import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface ApiKeyInputProps {
  onApiKeySet: () => void;
}

const ApiKeyInput = ({ onApiKeySet }: ApiKeyInputProps) => {
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApiKeySet();
    
    toast({
      title: "Ready to Start",
      description: "You can now use the application with the configured API key",
    });
  };
  
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Welcome to Math Mama Mentor</CardTitle>
        <CardDescription>
          The application is configured with an OpenRouter API key and ready to use
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Button type="submit" className="w-full">
              Start Using Application
            </Button>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col items-start">
        <p className="text-sm text-muted-foreground">
          Learn more about{" "}
          <a
            href="https://openrouter.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-mama-purple hover:underline"
          >
            OpenRouter
          </a>
        </p>
      </CardFooter>
    </Card>
  );
};

export default ApiKeyInput;
