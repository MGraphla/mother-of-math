import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, User, Phone, Mail, MapPin, Calendar, Globe, Heart,
  School, GraduationCap, FileText, Shield, Camera, Upload, Edit2, CheckCircle2
} from "lucide-react";
import {
  Student,
  getStudentSession,
  refreshStudentSession,
  uploadProfilePhoto,
  updateStudentProfilePhoto,
  setStudentSession
} from "@/services/studentService";

interface InfoItem {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
}

const StudentProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    const s = getStudentSession();
    if (!s) { navigate("/student-login", { replace: true }); return; }
    try {
      const fresh = await refreshStudentSession();
      setStudent(fresh || s);
    } catch {
      // safe fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !student) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadProfilePhoto(file, student.id);
      await updateStudentProfilePhoto(student.id, url);
      
      const updatedStudent = { ...student, profile_photo_url: url };
      setStudent(updatedStudent);
      setStudentSession(updatedStudent);
      
      toast({ title: "Profile updated", description: "Your profile photo has been updated." });
    } catch (error) {
      toast({ title: "Update failed", description: "Could not update profile photo.", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading profile...</span>
      </div>
    );
  }

  if (!student) return null;

  const sections: { title: string; icon: React.ReactNode; items: InfoItem[] }[] = [
    {
      title: "Basic Information",
      icon: <User className="h-5 w-5 text-primary" />,
      items: [
        { label: "Full Name", value: student.full_name, icon: <User className="h-4 w-4" /> },
        { label: "Date of Birth", value: student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : null, icon: <Calendar className="h-4 w-4" /> },
        { label: "Gender", value: student.gender },
        { label: "Nationality", value: student.nationality, icon: <Globe className="h-4 w-4" /> },
        { label: "Place of Birth", value: student.place_of_birth, icon: <MapPin className="h-4 w-4" /> },
        { label: "Home Language", value: student.home_language },
      ],
    },
    {
      title: "Guardian & Contact",
      icon: <Phone className="h-5 w-5 text-primary" />,
      items: [
        { label: "Parent/Guardian", value: student.parent_name, icon: <User className="h-4 w-4" /> },
        { label: "Phone Number", value: student.parent_phone, icon: <Phone className="h-4 w-4" /> },
        { label: "Email", value: student.parent_email, icon: <Mail className="h-4 w-4" /> },
        { label: "Relationship", value: student.parent_relationship },
        { label: "Home Address", value: student.home_address, icon: <MapPin className="h-4 w-4" /> },
      ],
    },
    {
      title: "School Details",
      icon: <School className="h-5 w-5 text-primary" />,
      items: [
        { label: "School Name", value: student.school_name, icon: <School className="h-4 w-4" /> },
        { label: "Grade Level", value: student.grade_level, icon: <GraduationCap className="h-4 w-4" /> },
        { label: "Class Name", value: student.class_name },
        { label: "Student ID", value: student.student_code || student.admission_number },
        { label: "Academic Year", value: student.academic_year },
      ],
    },
    {
      title: "Health & Special Needs",
      icon: <Heart className="h-5 w-5 text-primary" />,
      items: [
        { label: "Blood Group", value: student.blood_group, icon: <Heart className="h-4 w-4" /> },
        { label: "Medical Conditions", value: student.medical_conditions },
        { label: "Allergies", value: student.allergies },
        { label: "Special Needs", value: student.special_needs },
        { label: "Disability Status", value: student.disability_status },
      ],
    },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-muted/30 pb-10">
      {/* Header Banner */}
      <div className="h-48 bg-primary w-full relative overflow-hidden">
        <div className="absolute inset-0 bg-white/10 opacity-20 pattern-dots" />
        <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-blob animation-delay-2000" />
      </div>

      <div className="container max-w-5xl px-4 mx-auto -mt-20 relative z-10">
        <Card className="border-none shadow-xl overflow-hidden bg-background/95 backdrop-blur-sm">
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row gap-8 p-8 items-center md:items-start text-center md:text-left">
              {/* Profile Photo Section */}
              <div className="relative group shrink-0">
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-background shadow-lg overflow-hidden relative bg-muted flex items-center justify-center group-hover:shadow-xl transition-all duration-300">
                  {student.profile_photo_url ? (
                    <img 
                      src={student.profile_photo_url} 
                      alt={student.full_name} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <User className="h-16 w-16 text-muted-foreground/50" />
                  )}
                  
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                      <Loader2 className="h-8 w-8 text-white animate-spin" />
                    </div>
                  )}
                </div>
                
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute bottom-2 right-2 h-10 w-10 rounded-full shadow-lg border-2 border-background hover:bg-primary hover:text-primary-foreground transition-all duration-300 hover:scale-110"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Camera className="h-5 w-5" />
                </Button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>

              {/* Basic Info */}
              <div className="flex-1 pt-2 md:pt-4 min-w-0 w-full">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold truncate text-foreground tracking-tight mb-2">
                      {student.full_name}
                    </h1>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-muted-foreground">
                      <Badge variant="secondary" className="px-3 py-1 text-sm font-medium gap-1.5">
                        <GraduationCap className="h-4 w-4" /> 
                        {student.grade_level}
                      </Badge>
                      {student.class_name && (
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                          {student.class_name}
                        </span>
                      )}
                      {student.school_name && (
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                          {student.school_name}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <Badge 
                    variant={student.account_status === 'active' ? 'default' : 'destructive'} 
                    className={cn(
                      "w-fit mx-auto md:mx-0 capitalize px-4 py-1.5 text-sm shadow-sm",
                      student.account_status === 'active' && "bg-emerald-500 hover:bg-emerald-600"
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    {student.account_status} Account
                  </Badge>
                </div>
                
                <div className="flex flex-wrap gap-3 justify-center md:justify-start mt-6">
                  <Button variant="outline" className="gap-2 shadow-sm hover:border-primary/50 hover:bg-primary/5 transition-all" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Upload Photo
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="bg-muted/30 border-t px-8 py-5 flex flex-wrap gap-x-12 gap-y-4 text-sm text-muted-foreground justify-center md:justify-start">
              <span className="flex items-center gap-2.5 bg-background px-3 py-1.5 rounded-full border shadow-sm">
                <Calendar className="h-4 w-4 text-primary" /> 
                <span className="font-medium">Joined {new Date().getFullYear()}</span>
              </span>
              <span className="flex items-center gap-2.5 bg-background px-3 py-1.5 rounded-full border shadow-sm">
                <Shield className="h-4 w-4 text-primary" /> 
                <span className="font-medium">Portal Access Active</span>
              </span>
              {student.student_code && (
                <span className="flex items-center gap-2.5 bg-background px-3 py-1.5 rounded-full border shadow-sm font-mono text-primary/80">
                  Code: {student.student_code}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {sections.map((section, idx) => (
            <Card key={idx} className="overflow-hidden hover:shadow-lg transition-all duration-300 border-none shadow-sm group">
              <CardHeader className="border-b py-4 px-6 flex flex-row items-center gap-3 bg-muted/20">
                <div className="p-2 rounded-lg shadow-sm bg-white text-primary">
                  {section.icon}
                </div>
                <CardTitle className="text-base font-semibold tracking-wide text-foreground/80">
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border/50">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex flex-col sm:flex-row sm:items-center px-6 py-4 hover:bg-muted/20 transition-colors group-hover:bg-muted/5">
                      <span className="w-full sm:w-1/3 text-sm font-medium text-muted-foreground flex items-center gap-2.5 mb-1 sm:mb-0">
                        <div className="p-1 rounded bg-muted/50 text-muted-foreground/70">
                          {item.icon}
                        </div> 
                        {item.label}
                      </span>
                      <span className="text-sm font-medium text-foreground break-words flex-1 sm:pl-4">
                        {item.value || <span className="text-muted-foreground/30 italic">Not provided</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
