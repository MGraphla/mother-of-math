import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { commentService, Comment, CommentReaction } from '@/services/commentService';
import { useToast } from '@/hooks/use-toast';
import { 
  MessageSquare, 
  Send, 
  Reply, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Smile,
  Paperclip,
  X,
  Check,
  Clock,
  Loader2,
  FileText,
  Image as ImageIcon,
  File
} from 'lucide-react';

interface AssignmentCommentsProps {
  assignmentId: string;
  currentUserId: string;
  currentUserRole: 'teacher' | 'student';
  currentUserName: string;
}

// Available emoji reactions
const EMOJI_OPTIONS = [
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '😊', label: 'Smile' },
  { emoji: '🎉', label: 'Celebrate' },
  { emoji: '🤔', label: 'Thinking' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '✅', label: 'Check' },
  { emoji: '🔥', label: 'Fire' },
];

interface CommentWithReactions extends Comment {
  reactions?: CommentReaction[];
  isEditing?: boolean;
  editText?: string;
}

export function AssignmentComments({ 
  assignmentId, 
  currentUserId, 
  currentUserRole,
  currentUserName 
}: AssignmentCommentsProps) {
  const [comments, setComments] = useState<CommentWithReactions[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingBroadcast = useRef<number>(0);

  // Fetch comments and reactions
  const fetchComments = useCallback(async () => {
    try {
      const fetchedComments = await commentService.getComments(assignmentId);
      
      // Fetch reactions for all comments
      const commentsWithReactions = await Promise.all(
        fetchedComments.map(async (comment) => {
          try {
            const reactions = await commentService.getReactions(comment.id);
            return { ...comment, reactions };
          } catch {
            return { ...comment, reactions: [] };
          }
        })
      );
      
      setComments(commentsWithReactions);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchComments();
    
    // Poll for new comments every 10 seconds
    const interval = setInterval(fetchComments, 10000);
    return () => clearInterval(interval);
  }, [fetchComments]);

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  // Typing indicator logic
  const handleTyping = useCallback(() => {
    const now = Date.now();
    
    // Broadcast typing status at most once every 2 seconds
    if (now - lastTypingBroadcast.current > 2000) {
      lastTypingBroadcast.current = now;
      // In a real app, this would broadcast to other users via WebSocket
      setIsTyping(true);
    }
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing indicator after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 3000);
  }, []);

  // Submit new comment
  const handleSubmit = async () => {
    if (!newComment.trim() && !attachedFile) return;
    
    setSending(true);
    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;
      
      // Handle file upload
      if (attachedFile) {
        setUploadingFile(true);
        // In a real implementation, upload to storage
        // For now, we'll just store the file name
        attachmentName = attachedFile.name;
        // attachmentUrl = await uploadFile(attachedFile);
        setUploadingFile(false);
      }
      
      await commentService.addComment({
        assignment_id: assignmentId,
        user_id: currentUserId,
        user_role: currentUserRole,
        content: newComment.trim() || `📎 ${attachmentName}`,
        author_name: currentUserName,
      });
      
      setNewComment('');
      setAttachedFile(null);
      setIsTyping(false);
      await fetchComments();
      
      toast({
        title: 'Comment posted',
        description: 'Your comment has been added.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to post comment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  // Submit reply
  const handleReply = async (parentId: string) => {
    if (!replyText.trim()) return;
    
    setSending(true);
    try {
      await commentService.addComment({
        assignment_id: assignmentId,
        user_id: currentUserId,
        user_role: currentUserRole,
        content: replyText.trim(),
        parent_id: parentId,
        author_name: currentUserName,
      });
      
      setReplyTo(null);
      setReplyText('');
      await fetchComments();
      
      toast({
        title: 'Reply posted',
        description: 'Your reply has been added.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to post reply. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  // Edit comment
  const handleEdit = async (commentId: string, newContent: string) => {
    try {
      await commentService.updateComment(commentId, newContent);
      setComments(prev => prev.map(c => 
        c.id === commentId 
          ? { ...c, content: newContent, isEditing: false, editText: undefined }
          : c
      ));
      
      toast({
        title: 'Comment updated',
        description: 'Your comment has been edited.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update comment. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Delete comment
  const handleDelete = async () => {
    if (!commentToDelete) return;
    
    try {
      await commentService.deleteComment(commentToDelete);
      setComments(prev => prev.filter(c => c.id !== commentToDelete));
      setDeleteDialogOpen(false);
      setCommentToDelete(null);
      
      toast({
        title: 'Comment deleted',
        description: 'Your comment has been removed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete comment. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Toggle emoji reaction
  const handleReaction = async (commentId: string, emoji: string) => {
    try {
      const comment = comments.find(c => c.id === commentId);
      const existingReaction = comment?.reactions?.find(
        r => r.user_id === currentUserId && r.emoji === emoji
      );
      
      if (existingReaction) {
        await commentService.removeReaction(existingReaction.id);
      } else {
        await commentService.addReaction({
          comment_id: commentId,
          user_id: currentUserId,
          emoji,
        });
      }
      
      // Refresh reactions
      const reactions = await commentService.getReactions(commentId);
      setComments(prev => prev.map(c => 
        c.id === commentId ? { ...c, reactions } : c
      ));
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update reaction.',
        variant: 'destructive',
      });
    }
  };

  // Start editing a comment
  const startEditing = (comment: CommentWithReactions) => {
    setComments(prev => prev.map(c => 
      c.id === comment.id 
        ? { ...c, isEditing: true, editText: c.content }
        : { ...c, isEditing: false }
    ));
  };

  // Cancel editing
  const cancelEditing = (commentId: string) => {
    setComments(prev => prev.map(c => 
      c.id === commentId 
        ? { ...c, isEditing: false, editText: undefined }
        : c
    ));
  };

  // File attachment handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Maximum file size is 10MB.',
          variant: 'destructive',
        });
        return;
      }
      setAttachedFile(file);
    }
  };

  // Get file icon based on type
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <ImageIcon className="h-4 w-4" />;
    }
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) {
      return <FileText className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  // Format relative time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Get initials from name or ID
  const getInitials = (name: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Group reactions by emoji
  const groupReactions = (reactions: CommentReaction[] = []) => {
    const grouped: Record<string, CommentReaction[]> = {};
    reactions.forEach(r => {
      if (!grouped[r.emoji]) grouped[r.emoji] = [];
      grouped[r.emoji].push(r);
    });
    return grouped;
  };

  // Separate parent comments and replies
  const parentComments = comments.filter(c => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  // Render single comment
  const renderComment = (comment: CommentWithReactions, isReply = false) => {
    const isOwn = comment.user_id === currentUserId;
    const replies = isReply ? [] : getReplies(comment.id);
    const groupedReactions = groupReactions(comment.reactions);
    
    return (
      <div key={comment.id} className={`${isReply ? 'ml-10 mt-3' : ''}`}>
        <div className={`flex gap-3 group ${isOwn ? '' : ''}`}>
          <Avatar className={`h-8 w-8 ${isReply ? 'h-7 w-7' : ''}`}>
            <AvatarFallback className={`text-xs ${
              comment.user_role === 'teacher' 
                ? 'bg-primary/20 text-primary' 
                : 'bg-muted text-foreground'
            }`}>
              {getInitials(comment.author_name || comment.user_id)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">
                {isOwn ? 'You' : (comment.author_name || comment.user_id.slice(0, 8))}
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {comment.user_role}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(comment.created_at)}
              </span>
              {comment.updated_at && comment.updated_at !== comment.created_at && (
                <span className="text-xs text-muted-foreground">(edited)</span>
              )}
            </div>
            
            {comment.isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={comment.editText || ''}
                  onChange={(e) => setComments(prev => prev.map(c => 
                    c.id === comment.id ? { ...c, editText: e.target.value } : c
                  ))}
                  className="min-h-[60px] text-sm"
                />
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleEdit(comment.id, comment.editText || '')}
                    disabled={!comment.editText?.trim()}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => cancelEditing(comment.id)}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                {comment.content}
              </p>
            )}
            
            {/* Reactions display */}
            {Object.keys(groupedReactions).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(groupedReactions).map(([emoji, reactions]) => (
                  <TooltipProvider key={emoji}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleReaction(comment.id, emoji)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                            reactions.some(r => r.user_id === currentUserId)
                              ? 'bg-primary/10 border-primary/30'
                              : 'bg-muted border-transparent hover:border-muted-foreground/20'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span>{reactions.length}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{reactions.map(r => r.user_id.slice(0, 6)).join(', ')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            )}
            
            {/* Action buttons */}
            {!comment.isEditing && (
              <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Emoji picker */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2">
                      <Smile className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <div className="flex gap-1">
                      {EMOJI_OPTIONS.map(({ emoji, label }) => (
                        <TooltipProvider key={emoji}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleReaction(comment.id, emoji)}
                                className="p-1.5 hover:bg-muted rounded transition-colors text-lg"
                              >
                                {emoji}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>{label}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                
                {/* Reply button (only for parent comments) */}
                {!isReply && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2"
                    onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                  >
                    <Reply className="h-3.5 w-3.5 mr-1" />
                    Reply
                  </Button>
                )}
                
                {/* Edit/Delete for own comments */}
                {isOwn && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => startEditing(comment)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => {
                          setCommentToDelete(comment.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
            
            {/* Reply input */}
            {replyTo === comment.id && (
              <div className="mt-3 flex gap-2">
                <Textarea
                  placeholder="Write a reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="min-h-[60px] text-sm flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleReply(comment.id);
                    }
                  }}
                />
                <div className="flex flex-col gap-1">
                  <Button 
                    size="sm"
                    onClick={() => handleReply(comment.id)}
                    disabled={!replyText.trim() || sending}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => {
                      setReplyTo(null);
                      setReplyText('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Render replies */}
        {replies.length > 0 && (
          <div className="border-l-2 border-muted ml-4 pl-2 mt-2">
            {replies.map(reply => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-primary" />
          Comments
          {comments.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {comments.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Comments list */}
        <ScrollArea className="flex-1 px-6" ref={scrollRef}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No comments yet</p>
              <p className="text-xs">Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {parentComments.map(comment => renderComment(comment))}
            </div>
          )}
          
          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pb-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>{typingUsers.join(', ')} typing...</span>
            </div>
          )}
        </ScrollArea>
        
        {/* New comment input */}
        <div className="p-4 border-t bg-muted/30">
          {/* Attached file preview */}
          {attachedFile && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-md">
              {getFileIcon(attachedFile.name)}
              <span className="text-sm flex-1 truncate">{attachedFile.name}</span>
              <span className="text-xs text-muted-foreground">
                {(attachedFile.size / 1024).toFixed(1)}KB
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setAttachedFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Textarea
                placeholder={`Comment as ${currentUserName || currentUserRole}... (Ctrl+Enter to send)`}
                value={newComment}
                onChange={(e) => {
                  setNewComment(e.target.value);
                  handleTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSubmit();
                  }
                }}
                className="min-h-[80px] pr-10 resize-none"
              />
              
              {/* Attachment button */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute bottom-2 right-2 h-8 w-8 p-0"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            
            <Button 
              onClick={handleSubmit}
              disabled={(!newComment.trim() && !attachedFile) || sending || uploadingFile}
              className="self-end"
            >
              {sending || uploadingFile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2">
            Press Ctrl+Enter to send • Supports images and documents
          </p>
        </div>
      </CardContent>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your comment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default AssignmentComments;
