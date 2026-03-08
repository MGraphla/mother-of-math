import { useState, useRef } from "react";
import jsPDF from "jspdf";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

export type MessageType = "user" | "assistant";
export type MessageContent = {
  text?: string;
  imageUrl?: string;
};

interface ChatMessageProps {
  message: string | MessageContent;
  type: MessageType;
  timestamp: Date;
}

const ChatMessage = ({ message, type, timestamp }: ChatMessageProps) => {
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);
  
  // Convert message to standard format
  const messageContent = typeof message === "string" ? { text: message } : message;
  
  const isUser = type === "user";
  const formattedTime = timestamp.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit'
  });

  const messageRef = useRef<HTMLDivElement>(null);

  // Helper: naive check if this is a lesson plan (customize as needed)
  const isLessonPlan = messageContent.text && (
    messageContent.text.toLowerCase().includes("learning objectives") ||
    messageContent.text.toLowerCase().includes("lesson steps") ||
    messageContent.text.toLowerCase().includes("assessment questions")
  );

  const handleDownloadPDF = () => {
    if (!messageRef.current) return;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    const margin = 72;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = margin;

    // Extract lesson title (first heading or first line)
    let lessonTitle = "Lesson Plan";
    let lines: string[] = [];
    if (messageRef.current) {
      const html = messageRef.current.innerHTML;
      lines = html.replace(/<br\s*\/?>(\s*)/gi, '\n').replace(/<[^>]+>/g, '').split(/\n|\r/).map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        // Use the first non-empty line as the lesson title
        lessonTitle = lines[0];
      }
    }
    // Summarize lesson title to max 4 words for filename
    const summarizedTitle = lessonTitle.split(/\s+/).slice(0, 4).join('_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

    // Header: Mothers Of Mathematics
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(80, 36, 120); // purple
    doc.text('Mothers Of Mathematics', pageWidth / 2, y, { align: 'center' });
    y += 32;

    // Lesson Title
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text(lessonTitle, pageWidth / 2, y, { align: 'center', maxWidth: pageWidth - 2 * margin });
    y += 26;

    // Subtitle
    doc.setFont('times', 'italic');
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('- mothers of mathematics -', pageWidth / 2, y, { align: 'center' });
    y += 20;

    // Decorative line
    doc.setDrawColor(80, 36, 120);
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;

    // Body: parse and style
    function addText(text, fontSize, fontStyle = 'normal', spacing = 12) {
      doc.setFont('times', fontStyle);
      doc.setFontSize(fontSize);
      doc.setTextColor(40, 40, 40);
      // Split long text into lines to fit the page
      const splitLines = doc.splitTextToSize(text, pageWidth - 2 * margin);
      splitLines.forEach(line => {
        doc.text(line, margin, y, { align: 'left' });
        y += fontSize + 2;
      });
      y += spacing - 2;
    }
    if (lines.length > 0) {
      lines.forEach((line, idx) => {
        if (idx === 0) return; // skip title, already used
        if (/^(learning objectives|objectives)/i.test(line)) {
          addText(line, 14, 'bold', 8);
        } else if (/^(materials|materials needed|lesson steps|steps|assessment|assessment questions|conclusion|introduction|practice|development)/i.test(line)) {
          addText(line, 13, 'bold', 6);
        } else if (/^---+$/.test(line)) {
          // skip horizontal rules
        } else {
          addText(line, 11, 'normal', 4);
        }
      });
    }
    doc.save(`${summarizedTitle || 'lesson_plan'}-mothers_of_mathematics.pdf`);
  };

  const handleFeedback = (value: "like" | "dislike") => {
    setFeedback(value);
    // Here you could send the feedback to your API
    console.log(`Feedback for message: ${value}`);
  };

  // Custom markdown components for AI responses
  const markdownComponents = {
    // Headings - clean with green accent
    h1: ({ children }: any) => (
      <h1 className="text-xl font-bold text-[#009e60] mb-3 mt-4 first:mt-0 leading-tight">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-lg font-bold text-[#009e60] mb-2.5 mt-4 first:mt-0 leading-tight">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-base font-semibold text-[#009e60] mb-2 mt-3 first:mt-0 leading-tight">
        {children}
      </h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-sm font-semibold text-[#009e60] mb-2 mt-3 first:mt-0 leading-tight">
        {children}
      </h4>
    ),
    // Paragraphs - clean spacing
    p: ({ children }: any) => (
      <p className="text-[15px] leading-relaxed text-gray-700 mb-3 last:mb-0">
        {children}
      </p>
    ),
    // Bold text - green color
    strong: ({ children }: any) => (
      <strong className="font-semibold text-[#009e60]">
        {children}
      </strong>
    ),
    // Italic
    em: ({ children }: any) => (
      <em className="italic text-gray-600">
        {children}
      </em>
    ),
    // Unordered lists
    ul: ({ children }: any) => (
      <ul className="my-3 ml-1 space-y-2">
        {children}
      </ul>
    ),
    // Ordered lists
    ol: ({ children }: any) => (
      <ol className="my-3 ml-1 space-y-2 list-decimal list-inside">
        {children}
      </ol>
    ),
    // List items
    li: ({ children }: any) => (
      <li className="text-[15px] leading-relaxed text-gray-700 flex items-start gap-2">
        <span className="text-[#009e60] mt-1.5 flex-shrink-0">•</span>
        <span className="flex-1">{children}</span>
      </li>
    ),
    // Code blocks
    code: ({ inline, children }: any) => (
      inline ? (
        <code className="bg-gray-100 text-[#009e60] px-1.5 py-0.5 rounded text-sm font-mono">
          {children}
        </code>
      ) : (
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-3 overflow-x-auto">
          <code className="text-sm font-mono text-gray-800">
            {children}
          </code>
        </pre>
      )
    ),
    // Blockquotes
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-[#009e60]/40 bg-[#009e60]/5 pl-4 py-2 my-3 italic text-gray-600 rounded-r">
        {children}
      </blockquote>
    ),
    // Horizontal rules
    hr: () => (
      <hr className="my-4 border-gray-200" />
    ),
    // Links
    a: ({ href, children }: any) => (
      <a href={href} className="text-[#009e60] hover:underline font-medium" target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  };
  
  return (
    <div className={cn(
      "flex w-full mb-4",
      isUser ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[80%]",
        isUser ? "items-end" : "items-start"
      )}>
        <Card className={cn(
          "p-4",
          isUser 
            ? "bg-gradient-mama text-mama-purple" // User message: purple text
            : "bg-white shadow-sm border-gray-100"
        )}>
          <div ref={messageRef}>
            {messageContent.text && (
              isUser ? (
                // User messages - plain text
                <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
                  {messageContent.text}
                </div>
              ) : (
                // AI messages - rendered markdown with custom styling
                <div className="ai-response-content">
                  <ReactMarkdown components={markdownComponents}>
                    {messageContent.text}
                  </ReactMarkdown>
                </div>
              )
            )}
            {messageContent.imageUrl && (
              <div className="mt-3">
                <img 
                  src={messageContent.imageUrl} 
                  alt="Uploaded content"
                  className="max-w-full rounded-lg shadow-sm" 
                />
              </div>
            )}
          </div>
          {/* Show download button if this is a lesson plan and from assistant */}
          {isLessonPlan && !isUser && (
            <button
              onClick={handleDownloadPDF}
              className="bg-[#009e60] text-white px-4 py-2.5 rounded-lg hover:bg-[#008050] mt-4 w-full font-medium transition-colors"
            >
              Download this lesson as PDF
            </button>
          )}
          <div className={cn(
            "text-xs mt-3 flex items-center pt-2 border-t",
            isUser ? "justify-end text-white/80 border-white/20" : "justify-between text-muted-foreground border-gray-100"
          )}>
            <span>{formattedTime}</span>
            
            {!isUser && (
              <div className="flex space-x-1 ml-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "p-1 h-7 w-7 rounded-full transition-colors",
                    feedback === 'like' ? 'bg-[#009e60]/10 text-[#009e60]' : 'hover:bg-gray-100'
                  )}
                  onClick={() => handleFeedback("like")}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "p-1 h-7 w-7 rounded-full transition-colors",
                    feedback === 'dislike' ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100'
                  )}
                  onClick={() => handleFeedback("dislike")}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ChatMessage;
