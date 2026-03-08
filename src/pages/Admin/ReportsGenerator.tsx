import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Download,
  Calendar,
  RefreshCw,
  Plus,
  Clock,
  CheckCircle,
  FileSpreadsheet,
  FileType,
  Play,
  Trash2,
  Edit,
  Copy,
} from 'lucide-react';
import { KPICard, KPIGrid } from '@/components/admin/KPICard';
import { DateRangeSelector } from '@/components/admin/DateRangeSelector';
import { useAdminDateRange } from '@/context/AdminDateRangeContext';
import {
  getAllTeachers,
  getAllStudents,
  getAllLessonPlans,
  getAllAssignments,
  getAllChatConversations,
} from '@/services/adminService';
import { format } from 'date-fns';

// Report types
const reportTypes = [
  { id: 'user_activity', name: 'User Activity Report', description: 'Teacher and student activity summary' },
  { id: 'usage_stats', name: 'Platform Usage Statistics', description: 'Overall platform usage metrics' },
  { id: 'growth_report', name: 'Growth Report', description: 'User growth and retention metrics' },
  { id: 'content_report', name: 'Content Creation Report', description: 'Lesson plans, assignments, resources' },
  { id: 'engagement_report', name: 'Engagement Report', description: 'AI chatbot usage and engagement' },
  { id: 'school_report', name: 'School Performance Report', description: 'Per-school analytics' },
  { id: 'custom', name: 'Custom Report', description: 'Build your own custom report' },
];

const exportFormats = [
  { id: 'csv', name: 'CSV', icon: <FileSpreadsheet className="h-4 w-4" /> },
  { id: 'xlsx', name: 'Excel', icon: <FileSpreadsheet className="h-4 w-4" /> },
  { id: 'pdf', name: 'PDF', icon: <FileType className="h-4 w-4" /> },
  { id: 'json', name: 'JSON', icon: <FileText className="h-4 w-4" /> },
];

const dataFields = [
  { id: 'teachers', name: 'Teachers', fields: ['id', 'full_name', 'email', 'school_name', 'country', 'created_at'] },
  { id: 'students', name: 'Students', fields: ['id', 'full_name', 'grade_level', 'teacher_name', 'created_at'] },
  { id: 'lesson_plans', name: 'Lesson Plans', fields: ['id', 'title', 'grade_level', 'teacher_name', 'created_at'] },
  { id: 'assignments', name: 'Assignments', fields: ['id', 'title', 'subject', 'grade_level', 'teacher_name', 'due_date'] },
  { id: 'conversations', name: 'Conversations', fields: ['id', 'title', 'grade', 'teacher_name', 'message_count', 'created_at'] },
];

interface ScheduledReport {
  id: string;
  name: string;
  type: string;
  schedule: string;
  format: string;
  lastRun: string | null;
  nextRun: string;
  status: 'active' | 'paused';
}

interface GeneratedReport {
  id: string;
  name: string;
  type: string;
  format: string;
  rows: number;
  size: string;
  generatedAt: string;
  downloadUrl?: string;
}

const ReportsGeneratorPage: React.FC = () => {
  const { dateRange } = useAdminDateRange();
  const [loading, setLoading] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [selectedDataSource, setSelectedDataSource] = useState('teachers');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [reportName, setReportName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');

  // Mock data - In production, this would come from the database
  const [scheduledReports] = useState<ScheduledReport[]>([
    {
      id: '1',
      name: 'Weekly User Activity',
      type: 'user_activity',
      schedule: 'Weekly',
      format: 'xlsx',
      lastRun: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
    },
    {
      id: '2',
      name: 'Monthly Growth Report',
      type: 'growth_report',
      schedule: 'Monthly',
      format: 'pdf',
      lastRun: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      nextRun: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
    },
  ]);

  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);

  // Get current data source fields
  const currentDataSource = dataFields.find(d => d.id === selectedDataSource);

  // Handle field selection
  const toggleField = (field: string) => {
    setSelectedFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const selectAllFields = () => {
    if (currentDataSource) {
      setSelectedFields(currentDataSource.fields);
    }
  };

  const clearFields = () => {
    setSelectedFields([]);
  };

  // Generate report
  const handleGenerateReport = async () => {
    if (!selectedReportType && selectedReportType !== 'custom') {
      alert('Please select a report type');
      return;
    }

    setIsGenerating(true);
    try {
      // Fetch data based on selection
      let data: any[] = [];
      let rowCount = 0;

      switch (selectedDataSource) {
        case 'teachers':
          data = await getAllTeachers();
          break;
        case 'students':
          data = await getAllStudents();
          break;
        case 'lesson_plans':
          data = await getAllLessonPlans();
          break;
        case 'assignments':
          data = await getAllAssignments();
          break;
        case 'conversations':
          data = await getAllChatConversations();
          break;
      }

      rowCount = data.length;

      // Filter by date range
      const filteredData = data.filter(item => {
        const createdAt = new Date(item.created_at);
        return createdAt >= dateRange.from && createdAt <= dateRange.to;
      });

      // Generate export
      const exportData = filteredData.map(item => {
        const filtered: Record<string, any> = {};
        selectedFields.forEach(field => {
          filtered[field] = item[field];
        });
        return filtered;
      });

      // For CSV, create downloadable file
      if (selectedFormat === 'csv' && exportData.length > 0) {
        const headers = selectedFields.join(',');
        const rows = exportData.map(row =>
          selectedFields.map(field => {
            const value = row[field];
            if (typeof value === 'string' && value.includes(',')) {
              return `"${value}"`;
            }
            return value ?? '';
          }).join(',')
        );
        const csvContent = [headers, ...rows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportName || 'report'}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }

      // Add to generated reports
      const newReport: GeneratedReport = {
        id: Date.now().toString(),
        name: reportName || `${selectedDataSource} Report`,
        type: selectedReportType || 'custom',
        format: selectedFormat,
        rows: filteredData.length,
        size: `${Math.round(JSON.stringify(exportData).length / 1024)} KB`,
        generatedAt: new Date().toISOString(),
      };

      setGeneratedReports(prev => [newReport, ...prev]);

    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports Generator</h1>
            <p className="text-muted-foreground">
              Generate custom reports and schedule automated exports
            </p>
          </div>
          <DateRangeSelector showAutoRefresh={false} />
        </div>

        {/* Quick Stats */}
        <KPIGrid columns={4}>
          <KPICard
            title="Scheduled Reports"
            value={scheduledReports.length}
            icon={<Clock className="h-5 w-5" />}
          />
          <KPICard
            title="Generated Today"
            value={generatedReports.filter(r => 
              new Date(r.generatedAt).toDateString() === new Date().toDateString()
            ).length}
            icon={<FileText className="h-5 w-5" />}
          />
          <KPICard
            title="Available Types"
            value={reportTypes.length}
            icon={<FileSpreadsheet className="h-5 w-5" />}
          />
          <KPICard
            title="Export Formats"
            value={exportFormats.length}
            icon={<Download className="h-5 w-5" />}
          />
        </KPIGrid>

        {/* Main Content */}
        <Tabs defaultValue="generate" className="space-y-4">
          <TabsList>
            <TabsTrigger value="generate" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Generate Report
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Scheduled Reports
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Report History
            </TabsTrigger>
          </TabsList>

          {/* Generate Report Tab */}
          <TabsContent value="generate">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Report Configuration */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Report Configuration</CardTitle>
                  <CardDescription>Configure your report parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Report Name */}
                  <div className="space-y-2">
                    <Label>Report Name</Label>
                    <Input
                      placeholder="Enter report name..."
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                    />
                  </div>

                  {/* Report Type */}
                  <div className="space-y-2">
                    <Label>Report Type</Label>
                    <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select report type" />
                      </SelectTrigger>
                      <SelectContent>
                        {reportTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            <div>
                              <p className="font-medium">{type.name}</p>
                              <p className="text-xs text-muted-foreground">{type.description}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Data Source */}
                  <div className="space-y-2">
                    <Label>Data Source</Label>
                    <Select value={selectedDataSource} onValueChange={setSelectedDataSource}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select data source" />
                      </SelectTrigger>
                      <SelectContent>
                        {dataFields.map((source) => (
                          <SelectItem key={source.id} value={source.id}>
                            {source.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Fields Selection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Fields to Include</Label>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={selectAllFields}>
                          Select All
                        </Button>
                        <Button variant="ghost" size="sm" onClick={clearFields}>
                          Clear
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {currentDataSource?.fields.map((field) => (
                        <div key={field} className="flex items-center space-x-2">
                          <Checkbox
                            id={field}
                            checked={selectedFields.includes(field)}
                            onCheckedChange={() => toggleField(field)}
                          />
                          <label
                            htmlFor={field}
                            className="text-sm cursor-pointer"
                          >
                            {field.replace(/_/g, ' ')}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Export Format */}
                  <div className="space-y-2">
                    <Label>Export Format</Label>
                    <div className="flex gap-2">
                      {exportFormats.map((format) => (
                        <Button
                          key={format.id}
                          variant={selectedFormat === format.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedFormat(format.id)}
                          className="flex items-center gap-2"
                        >
                          {format.icon}
                          {format.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleGenerateReport}
                      disabled={isGenerating || selectedFields.length === 0}
                      className="flex-1"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Generate Report
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowScheduleDialog(true)}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Schedule
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Report Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                  <CardDescription>Report summary</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Report Name</p>
                    <p className="text-sm text-muted-foreground">
                      {reportName || 'Untitled Report'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Date Range</p>
                    <p className="text-sm text-muted-foreground">
                      {format(dateRange.from, 'MMM d, yyyy')} - {format(dateRange.to, 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Data Source</p>
                    <p className="text-sm text-muted-foreground">
                      {currentDataSource?.name || 'None selected'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Fields ({selectedFields.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedFields.map((field) => (
                        <Badge key={field} variant="secondary" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                      {selectedFields.length === 0 && (
                        <p className="text-sm text-muted-foreground">No fields selected</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Format</p>
                    <Badge>{selectedFormat.toUpperCase()}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Scheduled Reports Tab */}
          <TabsContent value="scheduled">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Reports</CardTitle>
                <CardDescription>
                  Automated reports that run on a schedule
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Format</TableHead>
                        <TableHead>Last Run</TableHead>
                        <TableHead>Next Run</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledReports.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">No scheduled reports</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        scheduledReports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell className="font-medium">{report.name}</TableCell>
                            <TableCell>{report.type}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{report.schedule}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge>{report.format.toUpperCase()}</Badge>
                            </TableCell>
                            <TableCell>
                              {report.lastRun ? format(new Date(report.lastRun), 'MMM d, yyyy') : 'Never'}
                            </TableCell>
                            <TableCell>
                              {format(new Date(report.nextRun), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              <Badge className={report.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                {report.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm">
                                  <Play className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-600">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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

          {/* Report History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Generated Reports</CardTitle>
                <CardDescription>
                  History of previously generated reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Format</TableHead>
                        <TableHead>Rows</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Generated</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {generatedReports.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">No reports generated yet</p>
                            <p className="text-sm text-muted-foreground">
                              Generate a report to see it here
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        generatedReports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell className="font-medium">{report.name}</TableCell>
                            <TableCell>{report.type}</TableCell>
                            <TableCell>
                              <Badge>{report.format.toUpperCase()}</Badge>
                            </TableCell>
                            <TableCell>{report.rows.toLocaleString()}</TableCell>
                            <TableCell>{report.size}</TableCell>
                            <TableCell>
                              {format(new Date(report.generatedAt), 'MMM d, yyyy HH:mm')}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm">
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-600">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
        </Tabs>

        {/* Schedule Dialog */}
        <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Report</DialogTitle>
              <DialogDescription>
                Set up automatic report generation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Email Recipients</Label>
                <Input placeholder="Enter email addresses..." />
                <p className="text-xs text-muted-foreground">
                  Separate multiple emails with commas
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowScheduleDialog(false)}>
                Schedule Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
};

export default ReportsGeneratorPage;
