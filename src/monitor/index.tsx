/**
 * Monitor module — lazy entry that exposes the route subtree to App.tsx.
 *
 * Usage in App.tsx:
 *   const MonitorRoutes = lazy(() => import('@/monitor'));
 *   <Route path="/monitor/*" element={<MonitorRoutes />} />
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import MonitorLogin from './pages/MonitorLogin';
import MonitorLayout from './components/MonitorLayout';
import MonitorProtected from './components/MonitorProtected';
import MonitorOverview from './pages/MonitorOverview';
import MonitorActivity from './pages/MonitorActivity';
import MonitorTeachers from './pages/MonitorTeachers';
import MonitorTeacherDetail from './pages/MonitorTeacherDetail';
import MonitorChatbot from './pages/MonitorChatbot';
import MonitorLessonPlans from './pages/MonitorLessonPlans';
import MonitorUploads from './pages/MonitorUploads';
import MonitorErrorAnalysis from './pages/MonitorErrorAnalysis';
import MonitorImages from './pages/MonitorImages';
import MonitorAssignments from './pages/MonitorAssignments';
import MonitorSchools from './pages/MonitorSchools';
import MonitorLearnersParents from './pages/MonitorLearnersParents';

const MonitorRoutes = () => (
  <Routes>
    <Route path="login" element={<MonitorLogin />} />

    <Route element={<MonitorProtected />}>
      <Route element={<MonitorLayout />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<MonitorOverview />} />
        <Route path="activity" element={<MonitorActivity />} />
        <Route path="teachers" element={<MonitorTeachers />} />
        <Route path="learners" element={<MonitorLearnersParents />} />
        <Route path="teachers/:id" element={<MonitorTeacherDetail />} />
        <Route path="chatbot" element={<MonitorChatbot />} />
        <Route path="lesson-plans" element={<MonitorLessonPlans />} />
        <Route path="uploads" element={<MonitorUploads />} />
        <Route path="error-analysis" element={<MonitorErrorAnalysis />} />
        <Route path="images" element={<MonitorImages />} />
        <Route path="assignments" element={<MonitorAssignments />} />
        <Route path="schools" element={<MonitorSchools />} />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/monitor/overview" replace />} />
  </Routes>
);

export default MonitorRoutes;
