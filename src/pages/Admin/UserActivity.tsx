import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUserActivity, ActivityItem } from "@/services/adminService";
import {
  Activity,
  User,
  BookOpen,
  ClipboardList,
  MessageSquare,
  FileText,
  UserPlus,
  GraduationCap,
} from "lucide-react";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";

const UserActivity = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      setLoading(true);
      
      try {
        // Use adminService to fetch activity (bypasses RLS)
        const data = await getUserActivity();
        setActivities(data);
      } catch (error) {
        console.error('Error fetching activity:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'teacher_signup':
        return <UserPlus className="w-4 h-4 text-blue-400" />;
      case 'student_created':
        return <GraduationCap className="w-4 h-4 text-emerald-400" />;
      case 'lesson_plan':
        return <BookOpen className="w-4 h-4 text-purple-400" />;
      case 'assignment':
        return <ClipboardList className="w-4 h-4 text-amber-400" />;
      case 'submission':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      case 'chat':
        return <MessageSquare className="w-4 h-4 text-pink-400" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActivityBadge = (type: string) => {
    switch (type) {
      case 'teacher_signup':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Sign Up</Badge>;
      case 'student_created':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Student</Badge>;
      case 'lesson_plan':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Lesson</Badge>;
      case 'assignment':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Assignment</Badge>;
      case 'submission':
        return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Submission</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400">Activity</Badge>;
    }
  };

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
      <div>
        <h1 className="text-3xl font-bold text-white">Activity Feed</h1>
        <p className="text-gray-400 mt-1">
          Real-time activity across the platform
        </p>
      </div>

      {/* Activity Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <UserPlus className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {activities.filter(a => a.type === 'teacher_signup').length}
                </p>
                <p className="text-xs text-gray-400">Recent Signups</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <BookOpen className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {activities.filter(a => a.type === 'lesson_plan').length}
                </p>
                <p className="text-xs text-gray-400">Lesson Plans</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <ClipboardList className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {activities.filter(a => a.type === 'assignment').length}
                </p>
                <p className="text-xs text-gray-400">Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <FileText className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {activities.filter(a => a.type === 'submission').length}
                </p>
                <p className="text-xs text-gray-400">Submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-0">
          <div className="divide-y divide-gray-800">
            {activities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                className="flex items-start gap-4 p-4 hover:bg-gray-800/30 transition-colors"
              >
                <div className="p-2 rounded-lg bg-gray-800/50">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getActivityBadge(activity.type)}
                    {activity.user_name && (
                      <span className="text-sm text-gray-400">
                        by {activity.user_name}
                      </span>
                    )}
                  </div>
                  <p className="text-white text-sm truncate">
                    {activity.description}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </p>
                  <p className="text-xs text-gray-600">
                    {format(new Date(activity.created_at), 'MMM d, HH:mm')}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
          {activities.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No recent activity</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserActivity;
