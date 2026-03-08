import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UploadCloud, Brain } from 'lucide-react';
import { toast } from 'sonner';
import { sendMessage, fileToBase64 } from '@/services/api';

// This will be a more specific page for AI analysis of student work.
// We will need to define its specific features and workflow based on user requirements.

const DetailedStudentAnalysis = () => {
  const [file, setFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // TODO: Add states for student selection, assignment selection if needed

  // Clean up object URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
      setAnalysisResult(null); // Clear previous results

      // Revoke previous object URL if it exists
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }

      if (selectedFile.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(selectedFile);
        setImagePreviewUrl(previewUrl);
      } else {
        setImagePreviewUrl(null); // Not an image, so no preview
      }
      
      handleAnalyze(selectedFile); // Automatically start analysis
    }
  };

  const handleAnalyze = async (fileToAnalyze?: File) => {
    const currentFile = fileToAnalyze || file;
    if (!currentFile) {
      toast.error('Please select a file to analyze.');
      return;
    }

    setIsLoading(true);
    setAnalysisResult(null);
    try {
      const base64 = await fileToBase64(currentFile);
      const response = await sendMessage(
        'Please analyze this student math work. Identify errors, explain what the student did correctly and incorrectly, and suggest remediation activities.',
        base64,
        'text'
      );
      setAnalysisResult(response.text);
      toast.success('Analysis complete!');
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast.error(error.message || 'Analysis failed. Please try again.');
      setAnalysisResult('Failed to analyze the document. Please check your API key configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Brain className="mr-2 h-6 w-6 text-mama-purple" />
            Detailed Student Work Analysis
          </CardTitle>
          <CardDescription>
            Upload a student's work (e.g., a PDF or image of their math assignment) for detailed AI-powered analysis.
            {/* TODO: Add options to select student/assignment here if needed */}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="student-work-upload" className="text-base">Upload Student Work</Label>
            <div className="mt-2 flex items-center justify-center w-full">
              <label
                htmlFor="student-work-upload"
                className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600 dark:hover:border-gray-500"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className="w-10 h-10 mb-3 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">PDF, PNG, JPG (MAX. 10MB)</p>
                </div>
                <Input id="student-work-upload" type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" />
              </label>
            </div>
            {file && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Selected file: {file.name}</p>
            )}
            {imagePreviewUrl && (
              <div className="mt-4">
                <Label className="text-base">Image Preview:</Label>
                <img src={imagePreviewUrl} alt="Preview" className="mt-2 rounded-lg border max-h-60 w-auto" />
              </div>
            )}
          </div>

          <Button onClick={() => handleAnalyze()} disabled={!file || isLoading} className="w-full bg-mama-purple hover:bg-mama-purple/90">
            {isLoading ? 'Analyzing...' : (analysisResult ? 'Re-analyze Work' : 'Analyze Work')}
          </Button>

          {analysisResult && (
            <div>
              <h3 className="text-xl font-semibold mb-2">Analysis Result:</h3>
              <Textarea value={analysisResult} readOnly rows={10} className="bg-gray-50 dark:bg-gray-700" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DetailedStudentAnalysis;
