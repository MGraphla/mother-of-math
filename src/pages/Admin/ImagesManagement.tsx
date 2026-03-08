import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAllImages, type ImageStats } from "@/services/adminService";
import {
  Search,
  Image,
  Download,
  Heart,
  User,
  Calendar,
  ExternalLink,
  Grid,
  List,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const ImagesManagement = () => {
  const [images, setImages] = useState<ImageStats[]>([]);
  const [filteredImages, setFilteredImages] = useState<ImageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await getAllImages();
      setImages(data);
      setFilteredImages(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredImages(images);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredImages(
        images.filter(
          (img) =>
            img.prompt.toLowerCase().includes(query) ||
            img.user_name?.toLowerCase().includes(query) ||
            img.style?.toLowerCase().includes(query) ||
            img.aspect_ratio?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, images]);

  const exportToCSV = () => {
    const headers = ['Teacher', 'Prompt', 'Style', 'Aspect Ratio', 'Favorite', 'Created'];
    const csvData = filteredImages.map(img => [
      img.user_name.replace(/,/g, ';'),
      img.prompt.replace(/,/g, ';').substring(0, 100),
      img.style || '',
      img.aspect_ratio,
      img.is_favorite ? 'Yes' : 'No',
      img.created_at ? format(new Date(img.created_at), 'yyyy-MM-dd') : '',
    ]);
    
    const csv = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated-images-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  // Group by teacher
  const teacherStats = images.reduce((acc, img) => {
    const name = img.user_name || 'Unknown';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Group by style
  const styleStats = images.reduce((acc, img) => {
    const style = img.style || 'Default';
    acc[style] = (acc[style] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Image className="w-7 h-7 text-violet-400" />
            Generated Images
          </h1>
          <p className="text-gray-400 mt-1">
            View all AI-generated images across the platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="border-gray-700 hover:bg-gray-800"
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="border-gray-700 hover:bg-gray-800"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Image className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{images.length}</p>
                <p className="text-xs text-gray-400">Total Images</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Heart className="w-5 h-5 text-pink-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {images.filter(i => i.is_favorite).length}
                </p>
                <p className="text-xs text-gray-400">Favorites</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {Object.keys(teacherStats).length}
                </p>
                <p className="text-xs text-gray-400">Teachers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Grid className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {Object.keys(styleStats).length}
                </p>
                <p className="text-xs text-gray-400">Styles Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by prompt, teacher, style..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-900/50 border-gray-700 focus:border-violet-500"
          />
        </div>
        <p className="text-sm text-gray-400">
          Showing {filteredImages.length} of {images.length} images
        </p>
      </div>

      {/* Images Display */}
      {filteredImages.length === 0 ? (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-12 text-center">
            <Image className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No images found</p>
            <p className="text-sm text-gray-500 mt-1">
              {searchQuery ? "Try adjusting your search" : "No images have been generated yet"}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredImages.map((img, index) => (
            <motion.div
              key={img.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
            >
              <Card className="bg-gray-900/50 border-gray-800 overflow-hidden hover:border-gray-700 transition-colors group">
                <div className="relative aspect-square bg-gray-800">
                  <img
                    src={img.image_url}
                    alt={img.prompt.substring(0, 50)}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23374151" width="100" height="100"/><text fill="%239ca3af" x="50" y="50" text-anchor="middle" dominant-baseline="middle" font-size="12">No Image</text></svg>';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <a
                      href={img.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-white" />
                    </a>
                  </div>
                  {img.is_favorite && (
                    <div className="absolute top-2 right-2">
                      <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <p className="text-sm text-white truncate" title={img.prompt}>
                    {img.prompt.substring(0, 60)}{img.prompt.length > 60 ? '...' : ''}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-400 truncate flex-1" title={img.user_name}>
                      {img.user_name}
                    </p>
                    <div className="flex items-center gap-1">
                      {img.style && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {img.style}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-gray-700">
                        {img.aspect_ratio}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {img.created_at ? format(new Date(img.created_at), 'MMM d, yyyy HH:mm') : 'N/A'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase">Image</th>
                    <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase">Prompt</th>
                    <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase">Teacher</th>
                    <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase">Style</th>
                    <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase">Ratio</th>
                    <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredImages.map((img) => (
                    <tr key={img.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="p-4">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800">
                          <img
                            src={img.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-white max-w-xs truncate" title={img.prompt}>
                          {img.prompt}
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-gray-300">{img.user_name}</p>
                      </td>
                      <td className="p-4">
                        {img.style ? (
                          <Badge variant="secondary" className="text-xs">
                            {img.style}
                          </Badge>
                        ) : (
                          <span className="text-gray-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="text-xs border-gray-700">
                          {img.aspect_ratio}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-sm text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {img.created_at ? format(new Date(img.created_at), 'MMM d, yyyy') : 'N/A'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teacher breakdown */}
      {Object.keys(teacherStats).length > 0 && (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-white mb-3">Images by Teacher</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(teacherStats)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([name, count]) => (
                  <Badge key={name} variant="secondary" className="text-xs">
                    {name}: {count}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImagesManagement;
