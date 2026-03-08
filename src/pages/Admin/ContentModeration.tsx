import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Flag,
  RefreshCw,
  SearchIcon,
  ImageIcon,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { KPICard, KPIGrid } from '@/components/admin/KPICard';
import { getAllContentFlags, getModerationStats, reviewContentFlag } from '@/services/adminService';
import type { ContentFlag, ModerationStats } from '@/types/admin';
import { format } from 'date-fns';

const severityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  removed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  dismissed: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const contentTypeIcons: Record<string, React.ReactNode> = {
  message: <MessageSquare className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
  resource: <FileText className="h-4 w-4" />,
  assignment: <FileText className="h-4 w-4" />,
  comment: <MessageSquare className="h-4 w-4" />,
};

const ContentModerationPage: React.FC = () => {
  const [flags, setFlags] = useState<ContentFlag[]>([]);
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedFlag, setSelectedFlag] = useState<ContentFlag | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [flagsData, statsData] = await Promise.all([
        getAllContentFlags(),
        getModerationStats(),
      ]);
      setFlags(flagsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching moderation data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReview = async (status: 'approved' | 'removed' | 'dismissed') => {
    if (!selectedFlag) return;

    const success = await reviewContentFlag(
      selectedFlag.id,
      status,
      'admin', // TODO: Get actual admin username
      reviewNotes
    );

    if (success) {
      setIsReviewDialogOpen(false);
      setSelectedFlag(null);
      setReviewNotes('');
      fetchData();
    }
  };

  const openReviewDialog = (flag: ContentFlag) => {
    setSelectedFlag(flag);
    setReviewStatus(flag.status);
    setReviewNotes('');
    setIsReviewDialogOpen(true);
  };

  const filteredFlags = flags.filter((flag) => {
    const matchesSearch =
      flag.content_preview?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.flag_reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || flag.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || flag.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const pendingFlags = flags.filter(f => f.status === 'pending');
  const criticalFlags = flags.filter(f => f.severity === 'critical' && f.status === 'pending');

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Content Moderation</h1>
            <p className="text-muted-foreground">
              Review and moderate flagged content across the platform
            </p>
          </div>
          <Button onClick={fetchData} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <KPIGrid columns={4}>
          <KPICard
            title="Pending Review"
            value={stats?.pending_flags || pendingFlags.length}
            icon={<Flag className="h-5 w-5" />}
            colorScheme={pendingFlags.length > 5 ? 'warning' : 'default'}
            loading={loading}
          />
          <KPICard
            title="Critical Flags"
            value={criticalFlags.length}
            icon={<AlertTriangle className="h-5 w-5" />}
            colorScheme={criticalFlags.length > 0 ? 'danger' : 'default'}
            loading={loading}
          />
          <KPICard
            title="Approved"
            value={stats?.approved_flags || 0}
            icon={<CheckCircle className="h-5 w-5" />}
            colorScheme="success"
            loading={loading}
          />
          <KPICard
            title="Removed"
            value={stats?.removed_flags || 0}
            icon={<XCircle className="h-5 w-5" />}
            colorScheme="danger"
            loading={loading}
          />
        </KPIGrid>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Flagged Content Queue
            </CardTitle>
            <CardDescription>
              {filteredFlags.length} items to review
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="removed">Removed</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Flags Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Content Preview</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Flagged</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Loading flagged content...
                      </TableCell>
                    </TableRow>
                  ) : filteredFlags.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <Shield className="h-8 w-8 text-muted-foreground" />
                          <p className="text-muted-foreground">No flagged content</p>
                          <p className="text-sm text-muted-foreground">
                            All content is clear or has been reviewed
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredFlags.map((flag) => (
                      <TableRow key={flag.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {contentTypeIcons[flag.content_type] || <FileText className="h-4 w-4" />}
                            <span className="capitalize">{flag.content_type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-[300px] truncate text-sm">
                            {flag.content_preview || 'No preview available'}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {flag.flag_reason}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={severityColors[flag.severity]}>
                            {flag.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[flag.status]}>
                            {flag.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{format(new Date(flag.created_at), 'MMM d, yyyy')}</p>
                            <p className="text-muted-foreground text-xs">
                              by {flag.flagged_by}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openReviewDialog(flag)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                            {flag.status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => {
                                    setSelectedFlag(flag);
                                    handleReview('approved');
                                  }}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => {
                                    setSelectedFlag(flag);
                                    handleReview('removed');
                                  }}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Analytics Cards */}
        {stats && (
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">By Content Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.flags_by_type || {}).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {contentTypeIcons[type] || <FileText className="h-4 w-4" />}
                        <span className="text-sm capitalize">{type}</span>
                      </div>
                      <span className="font-medium">{count as number}</span>
                    </div>
                  ))}
                  {Object.keys(stats.flags_by_type || {}).length === 0 && (
                    <p className="text-sm text-muted-foreground">No data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">By Reason</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.flags_by_reason || {}).map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{reason}</span>
                      <span className="font-medium">{count as number}</span>
                    </div>
                  ))}
                  {Object.keys(stats.flags_by_reason || {}).length === 0 && (
                    <p className="text-sm text-muted-foreground">No data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">By Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.flags_by_severity || {}).map(([severity, count]) => (
                    <div key={severity} className="flex items-center justify-between">
                      <Badge className={severityColors[severity]}>{severity}</Badge>
                      <span className="font-medium">{count as number}</span>
                    </div>
                  ))}
                  {Object.keys(stats.flags_by_severity || {}).length === 0 && (
                    <p className="text-sm text-muted-foreground">No data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Review Dialog */}
        <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Flagged Content</DialogTitle>
              <DialogDescription>
                Review the content and take appropriate action
              </DialogDescription>
            </DialogHeader>
            {selectedFlag && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Content Type</label>
                    <p className="text-sm capitalize">{selectedFlag.content_type}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Severity</label>
                    <Badge className={severityColors[selectedFlag.severity]}>
                      {selectedFlag.severity}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Flag Reason</label>
                  <p className="text-sm">{selectedFlag.flag_reason}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Content Preview</label>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedFlag.content_preview || 'No preview available'}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Review Notes</label>
                  <Textarea
                    placeholder="Add notes about your decision..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleReview('dismissed')}
              >
                Dismiss
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleReview('approved')}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleReview('removed')}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
};

export default ContentModerationPage;
