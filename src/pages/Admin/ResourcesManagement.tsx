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
import { getAllResources } from "@/services/adminService";
import type { ResourceStats } from "@/types/admin";
import {
  Search,
  FolderOpen,
  Download,
  ExternalLink,
  FileText,
  Image,
  Video,
  Link2,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const ResourcesManagement = () => {
  const [resources, setResources] = useState<ResourceStats[]>([]);
  const [filteredResources, setFilteredResources] = useState<ResourceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await getAllResources();
      setResources(data);
      setFilteredResources(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredResources(resources);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredResources(
        resources.filter(
          (r) =>
            r.title.toLowerCase().includes(query) ||
            r.description?.toLowerCase().includes(query) ||
            r.teacher_name?.toLowerCase().includes(query) ||
            r.topic?.toLowerCase().includes(query) ||
            r.file_type?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, resources]);

  const exportToCSV = () => {
    const headers = ['Title', 'Type', 'Topic', 'Grade', 'Teacher', 'Public', 'Downloads', 'Created'];
    const csvData = filteredResources.map(r => [
      r.title.replace(/,/g, ';'),
      r.file_type || '',
      r.topic?.replace(/,/g, ';') || '',
      r.grade_level || '',
      r.teacher_name || '',
      r.is_public ? 'Yes' : 'No',
      r.download_count,
      r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd') : '',
    ]);
    
    const csv = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resources-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getFileIcon = (fileType: string | null) => {
    switch (fileType?.toLowerCase()) {
      case 'image':
        return <Image className="w-4 h-4 text-green-400" />;
      case 'video':
        return <Video className="w-4 h-4 text-red-400" />;
      case 'link':
        return <Link2 className="w-4 h-4 text-blue-400" />;
      case 'pdf':
      case 'document':
      default:
        return <FileText className="w-4 h-4 text-amber-400" />;
    }
  };

  // Stats calculations
  const totalDownloads = resources.reduce((sum, r) => sum + r.download_count, 0);
  const publicResources = resources.filter(r => r.is_public).length;
  const typeStats = resources.reduce((acc, r) => {
    const type = r.file_type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Resources</h1>
          <p className="text-gray-400 mt-1">
            View all uploaded resources ({resources.length} total)
          </p>
        </div>
        <Button
          onClick={exportToCSV}
          className="bg-emerald-600 hover:bg-emerald-700"
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
              <FolderOpen className="w-8 h-8 text-indigo-400" />
              <div>
                <p className="text-2xl font-bold text-white">{resources.length}</p>
                <p className="text-xs text-gray-400">Total Resources</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Download className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="text-2xl font-bold text-white">{totalDownloads}</p>
                <p className="text-xs text-gray-400">Total Downloads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ExternalLink className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">{publicResources}</p>
                <p className="text-xs text-gray-400">Public Resources</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-1">
              {Object.entries(typeStats).slice(0, 4).map(([type, count]) => (
                <Badge key={type} variant="outline" className="text-xs">
                  {type}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search resources by title, topic, type, or teacher..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-gray-900/50 border-gray-700 text-white"
        />
      </div>

      {/* Resources Table */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-400">Title</TableHead>
                  <TableHead className="text-gray-400">Topic</TableHead>
                  <TableHead className="text-gray-400">Grade</TableHead>
                  <TableHead className="text-gray-400">Teacher</TableHead>
                  <TableHead className="text-gray-400">Public</TableHead>
                  <TableHead className="text-gray-400">Downloads</TableHead>
                  <TableHead className="text-gray-400">Created</TableHead>
                  <TableHead className="text-gray-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-400 py-8">
                      {resources.length === 0 ? "No resources found in the database" : "No matching resources found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredResources.map((resource) => (
                    <TableRow key={resource.id} className="border-gray-800 hover:bg-gray-800/50">
                      <TableCell>
                        {getFileIcon(resource.file_type)}
                      </TableCell>
                      <TableCell className="text-white font-medium max-w-xs truncate">
                        {resource.title}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {resource.topic || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {resource.grade_level || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {resource.teacher_name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {resource.is_public ? (
                          <Badge className="bg-green-500/20 text-green-400">Yes</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-400">No</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {resource.download_count}
                      </TableCell>
                      <TableCell className="text-gray-300 text-sm">
                        {resource.created_at
                          ? format(new Date(resource.created_at), "MMM d, yyyy")
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {resource.file_url && (
                          <a
                            href={resource.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResourcesManagement;
