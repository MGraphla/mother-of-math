import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Shield,
  Download,
  Trash2,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  Lock,
  Search,
  Database,
} from 'lucide-react';
import { KPICard, KPIGrid } from '@/components/admin/KPICard';
import { getDataRequests, getAdminAuditLogs } from '@/services/adminService';
import type { DataRequest, AdminAuditLog } from '@/types/admin';
import { format, formatDistanceToNow } from 'date-fns';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const requestTypeIcons: Record<string, React.ReactNode> = {
  export: <Download className="h-4 w-4" />,
  delete: <Trash2 className="h-4 w-4" />,
  access: <Eye className="h-4 w-4" />,
};

const DataManagementPage: React.FC = () => {
  const [dataRequests, setDataRequests] = useState<DataRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<DataRequest | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [requests, logs] = await Promise.all([
        getDataRequests(),
        getAdminAuditLogs(50),
      ]);
      setDataRequests(requests);
      setAuditLogs(logs);
    } catch (error) {
      console.error('Error fetching data management info:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const pendingRequests = dataRequests.filter(r => r.status === 'pending');
  const exportRequests = dataRequests.filter(r => r.request_type === 'export');
  const deleteRequests = dataRequests.filter(r => r.request_type === 'delete');

  const filteredRequests = dataRequests.filter(request =>
    request.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.user_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Data Management</h1>
            <p className="text-muted-foreground">
              GDPR compliance, data exports, and audit logs
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
            title="Pending Requests"
            value={pendingRequests.length}
            icon={<Clock className="h-5 w-5" />}
            colorScheme={pendingRequests.length > 0 ? 'warning' : 'default'}
            loading={loading}
          />
          <KPICard
            title="Export Requests"
            value={exportRequests.length}
            icon={<Download className="h-5 w-5" />}
            loading={loading}
          />
          <KPICard
            title="Deletion Requests"
            value={deleteRequests.length}
            icon={<Trash2 className="h-5 w-5" />}
            colorScheme={deleteRequests.length > 0 ? 'danger' : 'default'}
            loading={loading}
          />
          <KPICard
            title="Audit Events"
            value={auditLogs.length}
            icon={<Shield className="h-5 w-5" />}
            loading={loading}
          />
        </KPIGrid>

        {/* Tabs */}
        <Tabs defaultValue="requests" className="space-y-4">
          <TabsList>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Data Requests
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Audit Logs
            </TabsTrigger>
            <TabsTrigger value="retention" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Retention
            </TabsTrigger>
          </TabsList>

          {/* Data Requests Tab */}
          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>Data Subject Requests</CardTitle>
                <CardDescription>
                  Handle data export, access, and deletion requests (GDPR/CCPA compliance)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by user name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            Loading requests...
                          </TableCell>
                        </TableRow>
                      ) : filteredRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <div className="flex flex-col items-center gap-2">
                              <Lock className="h-8 w-8 text-muted-foreground" />
                              <p className="text-muted-foreground">No data requests</p>
                              <p className="text-sm text-muted-foreground">
                                Data subject requests will appear here
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRequests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {requestTypeIcons[request.request_type]}
                                <span className="capitalize">{request.request_type}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{request.user_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {request.user_email}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[request.status]}>
                                {request.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <p className="max-w-[200px] truncate text-sm">
                                {request.reason || 'No reason provided'}
                              </p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">
                                {format(new Date(request.created_at), 'MMM d, yyyy')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                              </p>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setIsDetailDialogOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                                {request.status === 'completed' && request.download_url && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                  >
                                    <a href={request.download_url} target="_blank" rel="noreferrer">
                                      <Download className="h-4 w-4" />
                                    </a>
                                  </Button>
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
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Audit Trail</CardTitle>
                <CardDescription>
                  Track all administrative actions for compliance and security
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Admin</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Timestamp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            Loading audit logs...
                          </TableCell>
                        </TableRow>
                      ) : auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            <div className="flex flex-col items-center gap-2">
                              <Shield className="h-8 w-8 text-muted-foreground" />
                              <p className="text-muted-foreground">No audit logs</p>
                              <p className="text-sm text-muted-foreground">
                                Admin actions will be logged here
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">
                              {log.admin_user}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="capitalize">{log.resource_type}</span>
                              {log.resource_id && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({log.resource_id.substring(0, 8)}...)
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {log.ip_address || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Retention Tab */}
          <TabsContent value="retention">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Data Retention Policies</CardTitle>
                  <CardDescription>
                    Configure how long different types of data are retained
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Chat Messages</p>
                      <p className="text-sm text-muted-foreground">Conversation history with AI</p>
                    </div>
                    <Badge>Indefinite</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Generated Images</p>
                      <p className="text-sm text-muted-foreground">AI-generated educational images</p>
                    </div>
                    <Badge>Indefinite</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Audit Logs</p>
                      <p className="text-sm text-muted-foreground">Administrative action history</p>
                    </div>
                    <Badge>90 days</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Session Data</p>
                      <p className="text-sm text-muted-foreground">Login and session information</p>
                    </div>
                    <Badge>30 days</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Compliance Status</CardTitle>
                  <CardDescription>
                    Current compliance with data protection regulations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">GDPR</p>
                        <p className="text-sm text-muted-foreground">EU General Data Protection</p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Compliant</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">CCPA</p>
                        <p className="text-sm text-muted-foreground">California Consumer Privacy</p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Compliant</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">FERPA</p>
                        <p className="text-sm text-muted-foreground">Education Records Privacy</p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Compliant</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                      <div>
                        <p className="font-medium">COPPA</p>
                        <p className="text-sm text-muted-foreground">Children's Online Privacy</p>
                      </div>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800">Review Needed</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Request Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Data Request Details</DialogTitle>
              <DialogDescription>
                View and manage data subject request
              </DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Request Type</label>
                    <div className="flex items-center gap-2 mt-1">
                      {requestTypeIcons[selectedRequest.request_type]}
                      <span className="capitalize">{selectedRequest.request_type}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <div className="mt-1">
                      <Badge className={statusColors[selectedRequest.status]}>
                        {selectedRequest.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">User</label>
                  <p className="text-sm">{selectedRequest.user_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.user_email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Reason</label>
                  <p className="text-sm">{selectedRequest.reason || 'No reason provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Data Categories</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedRequest.data_categories.length > 0 ? (
                      selectedRequest.data_categories.map((cat, i) => (
                        <Badge key={i} variant="outline">{cat}</Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">All data</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Created</label>
                    <p className="text-sm">
                      {format(new Date(selectedRequest.created_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                  {selectedRequest.completed_at && (
                    <div>
                      <label className="text-sm font-medium">Completed</label>
                      <p className="text-sm">
                        {format(new Date(selectedRequest.completed_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
                Close
              </Button>
              {selectedRequest?.status === 'pending' && (
                <>
                  <Button variant="outline" className="text-red-600">
                    Reject
                  </Button>
                  <Button>
                    Process Request
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
};

export default DataManagementPage;
