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
  Building2,
  Users,
  GraduationCap,
  BookOpen,
  MapPin,
  RefreshCw,
  Search,
  TrendingUp,
  Globe,
} from 'lucide-react';
import { KPICard, KPIGrid } from '@/components/admin/KPICard';
import { getAllSchools, getTeachersByCountry } from '@/services/adminService';
import type { SchoolInfo, TeachersByCountry } from '@/types/admin';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const SchoolsManagementPage: React.FC = () => {
  const [schools, setSchools] = useState<SchoolInfo[]>([]);
  const [teachersByCountry, setTeachersByCountry] = useState<TeachersByCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [schoolsData, countriesData] = await Promise.all([
        getAllSchools(),
        getTeachersByCountry(),
      ]);
      setSchools(schoolsData);
      setTeachersByCountry(countriesData);
    } catch (error) {
      console.error('Error fetching schools data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalSchools = schools.length;
  const totalTeachersInSchools = schools.reduce((acc, s) => acc + s.teacherCount, 0);
  const totalStudentsInSchools = schools.reduce((acc, s) => acc + s.studentCount, 0);
  const avgStudentsPerSchool = totalSchools > 0 ? Math.round(totalStudentsInSchools / totalSchools) : 0;

  const filteredSchools = schools.filter(school =>
    school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    school.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    school.country?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Prepare chart data
  const schoolTypeData = schools.reduce((acc, school) => {
    const type = school.type || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const schoolTypeChartData = Object.entries(schoolTypeData).map(([name, value]) => ({
    name,
    value,
  }));

  const topSchoolsByStudents = [...schools]
    .sort((a, b) => b.studentCount - a.studentCount)
    .slice(0, 10);

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Schools & Organizations</h1>
            <p className="text-gray-400">
              Schools and educational institutions using the platform
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
            title="Total Schools"
            value={totalSchools}
            icon={<Building2 className="h-5 w-5" />}
            loading={loading}
          />
          <KPICard
            title="Teachers in Schools"
            value={totalTeachersInSchools}
            icon={<Users className="h-5 w-5" />}
            loading={loading}
          />
          <KPICard
            title="Students in Schools"
            value={totalStudentsInSchools}
            icon={<GraduationCap className="h-5 w-5" />}
            loading={loading}
          />
          <KPICard
            title="Avg Students/School"
            value={avgStudentsPerSchool}
            icon={<TrendingUp className="h-5 w-5" />}
            loading={loading}
          />
        </KPIGrid>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Schools by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {schoolTypeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={schoolTypeChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {schoolTypeChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No school type data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Schools by Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {topSchoolsByStudents.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topSchoolsByStudents}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={150}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value.length > 20 ? `${value.substring(0, 20)}...` : value}
                      />
                      <Tooltip />
                      <Bar dataKey="studentCount" fill="#6366f1" name="Students" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No school data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Teachers by Country */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Teachers by Country
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {teachersByCountry.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teachersByCountry.slice(0, 15)}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="country" angle={-45} textAnchor="end" height={80} fontSize={12} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" name="Teachers" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No country data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Schools Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Schools</CardTitle>
            <CardDescription>
              {filteredSchools.length} schools found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search schools by name, city, or country..."
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
                    <TableHead>School Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Teachers</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        Loading schools...
                      </TableCell>
                    </TableRow>
                  ) : filteredSchools.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <Building2 className="h-8 w-8 text-muted-foreground" />
                          <p className="text-muted-foreground">No schools found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSchools.map((school, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{school.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {school.type || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {[school.city, school.country].filter(Boolean).join(', ') || 'Unknown'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {school.teacherCount}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {school.studentCount}
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

export default SchoolsManagementPage;
