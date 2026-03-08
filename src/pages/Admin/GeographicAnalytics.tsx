import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Globe,
  MapPin,
  Users,
  GraduationCap,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { KPICard, KPIGrid } from '@/components/admin/KPICard';
import { getTeachersByCountry, getAllSchools, getAllTeachers } from '@/services/adminService';
import type { TeachersByCountry, SchoolInfo, TeacherStats } from '@/types/admin';
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
  ComposedChart,
  Line,
  Legend,
  Treemap,
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#14b8a6', '#f97316'];

// Country code mapping for common countries
const countryCodeMap: Record<string, string> = {
  'United States': 'US',
  'USA': 'US',
  'United Kingdom': 'GB',
  'UK': 'GB',
  'Canada': 'CA',
  'Australia': 'AU',
  'Germany': 'DE',
  'France': 'FR',
  'India': 'IN',
  'Brazil': 'BR',
  'Nigeria': 'NG',
  'South Africa': 'ZA',
  'Kenya': 'KE',
  'Egypt': 'EG',
  'Morocco': 'MA',
  'Ghana': 'GH',
  'Tanzania': 'TZ',
  'Ethiopia': 'ET',
  'Uganda': 'UG',
  'Algeria': 'DZ',
  'Sudan': 'SD',
  'Japan': 'JP',
  'China': 'CN',
  'Mexico': 'MX',
  'Spain': 'ES',
  'Italy': 'IT',
  'Netherlands': 'NL',
  'Belgium': 'BE',
  'Poland': 'PL',
  'Sweden': 'SE',
  'Norway': 'NO',
  'Denmark': 'DK',
  'Finland': 'FI',
  'Ireland': 'IE',
  'Portugal': 'PT',
  'Greece': 'GR',
  'Turkey': 'TR',
  'Russia': 'RU',
  'Ukraine': 'UA',
  'Saudi Arabia': 'SA',
  'UAE': 'AE',
  'Qatar': 'QA',
  'Kuwait': 'KW',
  'Bahrain': 'BH',
  'Oman': 'OM',
  'Jordan': 'JO',
  'Lebanon': 'LB',
  'Israel': 'IL',
  'Pakistan': 'PK',
  'Bangladesh': 'BD',
  'Sri Lanka': 'LK',
  'Nepal': 'NP',
  'Thailand': 'TH',
  'Vietnam': 'VN',
  'Indonesia': 'ID',
  'Malaysia': 'MY',
  'Singapore': 'SG',
  'Philippines': 'PH',
  'South Korea': 'KR',
  'Taiwan': 'TW',
  'New Zealand': 'NZ',
};

const GeographicAnalyticsPage: React.FC = () => {
  const [teachersByCountry, setTeachersByCountry] = useState<TeachersByCountry[]>([]);
  const [schools, setSchools] = useState<SchoolInfo[]>([]);
  const [teachers, setTeachers] = useState<TeacherStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [countriesData, schoolsData, teachersData] = await Promise.all([
        getTeachersByCountry(),
        getAllSchools(),
        getAllTeachers(),
      ]);
      setTeachersByCountry(countriesData);
      setSchools(schoolsData);
      setTeachers(teachersData);
    } catch (error) {
      console.error('Error fetching geographic data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalCountries = teachersByCountry.length;
  const totalTeachers = teachersByCountry.reduce((acc, c) => acc + c.count, 0);
  const topCountry = teachersByCountry[0];
  const avgTeachersPerCountry = totalCountries > 0 ? Math.round(totalTeachers / totalCountries) : 0;

  // Group countries by region (simplified)
  const regionData = teachersByCountry.reduce((acc, country) => {
    let region = 'Other';
    const code = countryCodeMap[country.country] || '';
    
    if (['US', 'CA', 'MX'].includes(code)) region = 'North America';
    else if (['BR', 'AR', 'CL', 'CO', 'PE'].includes(code)) region = 'South America';
    else if (['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'PL', 'SE', 'NO', 'DK', 'FI', 'IE', 'PT', 'GR'].includes(code)) region = 'Europe';
    else if (['NG', 'ZA', 'KE', 'EG', 'MA', 'GH', 'TZ', 'ET', 'UG', 'DZ', 'SD'].includes(code)) region = 'Africa';
    else if (['IN', 'PK', 'BD', 'LK', 'NP'].includes(code)) region = 'South Asia';
    else if (['CN', 'JP', 'KR', 'TW', 'TH', 'VN', 'ID', 'MY', 'SG', 'PH'].includes(code)) region = 'East Asia';
    else if (['SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'JO', 'LB', 'IL', 'TR'].includes(code)) region = 'Middle East';
    else if (['AU', 'NZ'].includes(code)) region = 'Oceania';
    
    acc[region] = (acc[region] || 0) + country.count;
    return acc;
  }, {} as Record<string, number>);

  const regionChartData = Object.entries(regionData)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Prepare treemap data for countries
  const treemapData = teachersByCountry.slice(0, 20).map((country, index) => ({
    name: country.country,
    size: country.count,
    color: COLORS[index % COLORS.length],
  }));

  // Cities distribution from schools
  const citiesData = schools.reduce((acc, school) => {
    if (school.city) {
      acc[school.city] = (acc[school.city] || 0) + school.teacherCount;
    }
    return acc;
  }, {} as Record<string, number>);

  const topCities = Object.entries(citiesData)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Geographic Analytics</h1>
            <p className="text-muted-foreground">
              Analyze user distribution across countries and regions
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
            title="Countries Reached"
            value={totalCountries}
            icon={<Globe className="h-5 w-5" />}
            loading={loading}
          />
          <KPICard
            title="Total Teachers"
            value={totalTeachers}
            icon={<Users className="h-5 w-5" />}
            loading={loading}
          />
          <KPICard
            title="Top Country"
            value={topCountry?.country || 'N/A'}
            icon={<TrendingUp className="h-5 w-5" />}
            loading={loading}
          />
          <KPICard
            title="Avg per Country"
            value={avgTeachersPerCountry}
            icon={<MapPin className="h-5 w-5" />}
            loading={loading}
          />
        </KPIGrid>

        {/* Charts Row 1 */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Teachers by Region</CardTitle>
              <CardDescription>Distribution across global regions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {regionChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={regionChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {regionChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No regional data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Countries</CardTitle>
              <CardDescription>Countries with most teachers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {teachersByCountry.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={teachersByCountry.slice(0, 10)}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" />
                      <YAxis
                        dataKey="country"
                        type="category"
                        width={100}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" name="Teachers" />
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
        </div>

        {/* Top Cities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Top Cities
            </CardTitle>
            <CardDescription>Cities with most teachers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {topCities.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCities}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" name="Teachers" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No city data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Country List */}
        <Card>
          <CardHeader>
            <CardTitle>All Countries</CardTitle>
            <CardDescription>
              {teachersByCountry.length} countries with registered teachers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
              {loading ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  Loading countries...
                </div>
              ) : teachersByCountry.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <Globe className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No country data available</p>
                </div>
              ) : (
                teachersByCountry.map((country, index) => (
                  <div
                    key={country.country}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {getCountryFlag(country.country)}
                      </span>
                      <span className="font-medium text-sm truncate max-w-[120px]">
                        {country.country}
                      </span>
                    </div>
                    <Badge variant="secondary">
                      {country.count}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Growth Indicators */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Regional Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {regionChartData.slice(0, 5).map((region, index) => (
                  <div key={region.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index] }}
                      />
                      <span className="text-sm">{region.name}</span>
                    </div>
                    <span className="font-medium">{region.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Coverage Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">Global Reach</span>
                    <span className="text-sm font-medium">
                      {Math.round((totalCountries / 195) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{ width: `${Math.min((totalCountries / 195) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Reaching {totalCountries} out of 195 countries worldwide
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Expansion Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Regions with growth potential:
                </p>
                <div className="space-y-2">
                  {['South America', 'Southeast Asia', 'Eastern Europe'].map((region) => (
                    <div key={region} className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{region}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
    </div>
  );
};

// Helper function to get country flag emoji
function getCountryFlag(countryName: string): string {
  const code = countryCodeMap[countryName];
  if (!code) return '🌍';
  
  const codePoints = code
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export default GeographicAnalyticsPage;
