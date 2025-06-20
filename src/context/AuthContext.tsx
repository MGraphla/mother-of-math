import { createContext, useContext, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

type UserRole = 'teacher' | 'parent' | 'student';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  school?: string;
  created_at: string;
  // For teachers: IDs of students they manage
  managed_student_ids?: string[];
  // For students: ID of their assigned teacher
  teacher_id?: string;
  // For students: IDs of parent accounts linked to this student
  parent_ids?: string[];
  // For parents: IDs of children/students linked to this parent
  children_ids?: string[];
  // Additional academic info for students
  grade_level?: string;
  subjects?: string[];
}

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role: 'teacher' | 'parent', fullName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  setUserProfile: (profile: UserProfile) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user data
const mockUser: User = {
  id: 'mock-user-id',
  email: 'contact@ebaseafrica.org',
  created_at: new Date().toISOString(),
  aud: 'authenticated',
  role: 'authenticated',
  user_metadata: {},
  app_metadata: {},
};

const mockProfile: UserProfile = {
  id: 'mock-user-id',
  email: 'contact@ebaseafrica.org',
  role: 'teacher',
  full_name: 'eBASE africa',
  created_at: new Date().toISOString(),
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(mockUser);
  const [profile, setProfile] = useState<UserProfile | null>(mockProfile);
  const [isLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true); // Set to true for demo purposes

  const signIn = async (email: string, password: string) => {
    // For student login, check if this matches any student accounts
    if (email.includes('student')) {
      // Create a mock student profile
      const studentProfile: UserProfile = {
        id: `student-${Date.now()}`,
        email: email,
        role: 'student',
        full_name: email.split('@')[0],
        created_at: new Date().toISOString(),
        grade_level: 'Primary 5',
        subjects: ['Mathematics'],
        teacher_id: 'teacher-1'
      };
      
      setUser({
        ...mockUser,
        id: studentProfile.id,
        email: email
      });
      setProfile(studentProfile);
    }
    
    setIsAuthenticated(true);
    toast.success('Signed in successfully!');
  };

  const signUp = async (email: string, password: string, role: 'teacher' | 'parent', fullName: string) => {
    toast.success('Account created successfully!');
  };

  const signInWithGoogle = async () => {
    toast.success('Signed in with Google successfully!');
  };

  const signOut = async () => {
    setUser(null);
    setProfile(null);
    setIsAuthenticated(false);
    toast.success('Signed out successfully');
  };
  
  // Function to set user profile directly (useful for student accounts)
  const setUserProfile = (newProfile: UserProfile) => {
    setProfile(newProfile);
    setUser({
      ...mockUser,
      id: newProfile.id,
      email: newProfile.email
    });
    setIsAuthenticated(true);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      isAuthenticated,
      isLoading, 
      signIn, 
      signUp, 
      signInWithGoogle, 
      signOut,
      setUserProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
