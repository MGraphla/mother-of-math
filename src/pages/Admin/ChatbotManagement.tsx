import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getAllChatConversations, getChatInputResponseStats } from "@/services/adminService";
import type { ChatbotStats } from "@/types/admin";
import {
  Search,
  MessageSquare,
  Users,
  Calendar,
  Download,
  TrendingUp,
  FileText,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const ChatbotManagement = () => {
  const [conversations, setConversations] = useState<ChatbotStats[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<ChatbotStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiWordsGenerated, setAiWordsGenerated] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [data, chatStats] = await Promise.all([
        getAllChatConversations(),
        getChatInputResponseStats()
      ]);
      setConversations(data);
      setFilteredConversations(data);
      setAiWordsGenerated(chatStats.aiWordsGenerated);
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredConversations(conversations);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredConversations(
        conversations.filter(
          (c) =>
            c.title.toLowerCase().includes(query) ||
            c.grade.toLowerCase().includes(query) ||
            c.user_name?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, conversations]);

  const exportToCSV = () => {
    const headers = ['Title', 'Grade', 'User', 'Messages', 'Created', 'Last Updated'];
    const csvData = filteredConversations.map(c => [
      c.title.replace(/,/g, ';'),
      c.grade,
      c.user_name || '',
      c.message_count,
      c.created_at ? format(new Date(c.created_at), 'yyyy-MM-dd') : '',
      c.updated_at ? format(new Date(c.updated_at), 'yyyy-MM-dd HH:mm') : '',
    ]);
    
    const csv = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatbot-conversations-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  // Calculate stats
  const totalMessages = conversations.reduce((sum, c) => sum + c.message_count, 0);
  const uniqueUsers = new Set(conversations.map(c => c.user_id)).size;

  // Group by grade
  const gradeStats = conversations.reduce((acc, c) => {
    acc[c.grade] = (acc[c.grade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Chatbot Activity</h1>
          <p className="text-gray-400 mt-1">
            Monitor all chatbot conversations and usage
          </p>
        </div>
        <Button 
          onClick={exportToCSV}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{conversations.length}</p>
                <p className="text-xs text-gray-400">Conversations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalMessages}</p>
                <p className="text-xs text-gray-400">Total Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{uniqueUsers}</p>
                <p className="text-xs text-gray-400">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <FileText className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{aiWordsGenerated.toLocaleString()}</p>
                <p className="text-xs text-gray-400">AI Words Generated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grade Distribution */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Conversations by Grade Level</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(gradeStats).sort((a, b) => a[0].localeCompare(b[0])).map(([grade, count]) => (
              <Badge key={grade} variant="outline" className="bg-gray-800/50 border-gray-700 text-white">
                {grade}: <span className="ml-1 text-cyan-400">{count}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by title, grade, or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Conversations Table */}
      <Card className="bg-gray-900/50 border-gray-800 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Title</TableHead>
                  <TableHead className="text-gray-400">Grade</TableHead>
                  <TableHead className="text-gray-400">User</TableHead>
                  <TableHead className="text-gray-400 text-center">Messages</TableHead>
                  <TableHead className="text-gray-400">Created</TableHead>
                  <TableHead className="text-gray-400">Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConversations.map((convo, index) => (
                  <motion.tr
                    key={convo.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-gray-800 hover:bg-gray-800/50"
                  >
                    <TableCell>
                      <p className="font-medium text-white max-w-xs truncate">
                        {convo.title || 'Untitled'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-cyan-500/10 border-cyan-500/30 text-cyan-400">
                        {convo.grade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {convo.user_name || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-purple-400 font-medium">
                        {convo.message_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {convo.created_at
                        ? format(new Date(convo.created_at), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {convo.updated_at
                        ? format(new Date(convo.updated_at), 'MMM d, HH:mm')
                        : '-'}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredConversations.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No conversations found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatbotManagement;
