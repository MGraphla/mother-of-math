import { useState, useEffect, useRef, ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { supabase, upsertUserProfile } from "@/lib/supabase";
import type { UserProfile, UserRole } from "@/lib/supabase";
import {
  User,
  Mail,
  Phone,
  MapPin,
  School,
  Briefcase,
  GraduationCap,
  Globe,
  MessageCircle,
  Camera,
  Shield,
  Bell,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Check,
  AlertTriangle,
  Trash2,
  Calendar,
  Users,
  BookOpen,
  Lock,
  Settings as SettingsIcon,
  ChevronRight,
  Pencil,
} from "lucide-react";

// Constants (same as SignUp)
const COUNTRIES = [
  "Cameroon", "Nigeria", "Ghana", "South Africa", "Kenya", "Ethiopia", "Tanzania",
  "Uganda", "Rwanda", "Senegal", "Ivory Coast", "DR Congo", "Mali", "Benin",
  "Burkina Faso", "Niger", "Togo", "Chad", "Gabon", "Congo", "Central African Republic",
  "Equatorial Guinea", "Angola", "Mozambique", "Zimbabwe", "Zambia", "Malawi",
  "Madagascar", "Other African Country", "France", "United Kingdom", "United States",
  "Canada", "Germany", "Belgium", "Switzerland", "Other",
];
const SCHOOL_TYPES = [
  "Public / Government", "Private", "Faith-based / Mission", "International",
  "Community", "Home School", "Other",
];
const EDUCATION_LEVELS = [
  "High School Diploma", "Associate Degree", "Bachelor's Degree",
  "Master's Degree", "PhD / Doctorate", "Teaching Certificate", "Other",
];
const LANGUAGES = [
  "English", "French", "Pidgin English", "Fulfulde", "Ewondo", "Duala", "Bassa", "Other",
];
const GRADE_LEVELS = [
  "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
];

// Section nav config
type SectionId = "profile" | "personal" | "school" | "contact" | "security" | "notifications" | "danger";
const SECTIONS: { id: SectionId; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "personal", label: "Personal Info", icon: BookOpen },
  { id: "school", label: "School Info", icon: School },
  { id: "contact", label: "Contact", icon: Phone },
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle },
];

// Shared styles  using app primary green
const inputClass =
  "h-11 bg-white border border-gray-200 rounded-xl px-4 text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all placeholder:text-gray-400";
const selectClass =
  "h-11 w-full bg-white border border-gray-200 rounded-xl px-3 text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all appearance-none cursor-pointer";
const labelClass = "text-sm font-medium text-gray-700 flex items-center gap-1.5";
const sectionCardClass =
  "bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow";

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

/** Resize an image file to max 256x256 and return a base64 JPEG data URL */
const resizeImageToBase64 = (file: File, maxSize = 256): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > h) { h = Math.round((h / w) * maxSize); w = maxSize; }
        else { w = Math.round((w / h) * maxSize); h = maxSize; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// SETTINGS PAGE
const Settings = () => {
  const { user, profile, refreshProfile } = useAuth();

  const [activeSection, setActiveSection] = useState<SectionId>("profile");

  // Profile form state
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    date_of_birth: "",
    gender: "",
    country: "",
    city: "",
    preferred_language: "",
    bio: "",
    school_name: "",
    school_address: "",
    school_type: "",
    number_of_students: "",
    subjects_taught: "",
    grade_levels: "",
    years_of_experience: "",
    education_level: "",
    phone_number: "",
    whatsapp_number: "",
  });

  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification prefs
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    assignmentReminders: true,
    gradeUpdates: true,
    courseAnnouncements: true,
  });

  // Saving states
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Populate form from profile or user metadata
  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        email: profile.email ?? user?.email ?? "",
        date_of_birth: profile.date_of_birth ?? "",
        gender: profile.gender ?? "",
        country: profile.country ?? "",
        city: profile.city ?? "",
        preferred_language: profile.preferred_language ?? "",
        bio: profile.bio ?? "",
        school_name: profile.school_name ?? "",
        school_address: profile.school_address ?? "",
        school_type: profile.school_type ?? "",
        number_of_students: profile.number_of_students?.toString() ?? "",
        subjects_taught: profile.subjects_taught ?? "",
        grade_levels: profile.grade_levels ?? "",
        years_of_experience: profile.years_of_experience?.toString() ?? "",
        education_level: profile.education_level ?? "",
        phone_number: profile.phone_number ?? "",
        whatsapp_number: profile.whatsapp_number ?? "",
      });
      setAvatarUrl(profile.avatar_url ?? null);
    } else if (user) {
      // Fallback if profile row is missing but user is logged in
      setForm(prev => ({
        ...prev,
        email: user.email || "",
        full_name: user.user_metadata?.full_name || "",
      }));
    }
  }, [profile, user]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setProfileSaved(false);
  };

  // Avatar upload  resizes to 256x256, stores as base64 in profile (no storage bucket needed)
  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please choose an image under 5 MB.", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file.", variant: "destructive" });
      return;
    }

    setUploadingAvatar(true);
    try {
      // Resize and convert to base64  avoids storage bucket dependency
      const base64Url = await resizeImageToBase64(file, 256);

      // Save directly to profile
      await upsertUserProfile({ 
        id: user.id, 
        email: user.email!, 
        full_name: user.user_metadata?.full_name || '',
        role: (user.user_metadata?.role as UserRole) || 'teacher',
        avatar_url: base64Url 
      });
      setAvatarUrl(base64Url);
      await refreshProfile();

      toast({ title: "Avatar updated", description: "Your profile picture has been updated." });
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast({
        title: "Upload failed",
        description: err.message || "Could not process the image. Please try a different file.",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Save profile
  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const payload: Partial<UserProfile> & { id: string } = {
        id: user.id,
        email: user.email!, 
        role: (user.user_metadata?.role as UserRole) || 'teacher',
        full_name: form.full_name,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        country: form.country || null,
        city: form.city || null,
        preferred_language: form.preferred_language || null,
        bio: form.bio || null,
        school_name: form.school_name || null,
        school_address: form.school_address || null,
        school_type: form.school_type || null,
        number_of_students: form.number_of_students ? parseInt(form.number_of_students) : null,
        subjects_taught: form.subjects_taught || null,
        grade_levels: form.grade_levels || null,
        years_of_experience: form.years_of_experience ? parseInt(form.years_of_experience) : null,
        education_level: form.education_level || null,
        phone_number: form.phone_number || null,
        whatsapp_number: form.whatsapp_number || null,
      };

      await upsertUserProfile(payload);
      await refreshProfile();
      setProfileSaved(true);

      toast({ title: "Profile updated", description: "Your information has been saved successfully." });
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) {
      console.error("Save profile error:", err);
      toast({ title: "Save failed", description: err.message || "Unable to save your profile.", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: "Missing fields", description: "Please fill in both password fields.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not update password.", variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeletingAccount(true);
    try {
      if (user) {
        await supabase.from("profiles").delete().eq("id", user.id);
      }
      await supabase.auth.signOut();
      toast({ title: "Account deleted", description: "Your profile data has been removed." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not delete account.", variant: "destructive" });
    } finally {
      setDeletingAccount(false);
      setConfirmDelete(false);
    }
  };

  // Password strength
  const getPasswordStrength = () => {
    if (!newPassword) return 0;
    let s = 0;
    if (newPassword.length >= 8) s++;
    if (newPassword.length >= 12) s++;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) s++;
    if (/\d/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return Math.min(s, 5);
  };
  const pwStrength = getPasswordStrength();
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  const strengthColors = ["", "bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-400", "bg-green-600"];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auto-close mobile menu on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (mobileMenuOpen) setMobileMenuOpen(false);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mobileMenuOpen]);

  const scrollToSection = (id: SectionId) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const activeSectionLabel = SECTIONS.find((s) => s.id === activeSection)?.label || "Settings";
  const activeSectionIcon = SECTIONS.find((s) => s.id === activeSection)?.icon || SettingsIcon;
  const ActiveIcon = activeSectionIcon;

  return (
    <div className="min-h-screen bg-neutral-50/50 pb-20 lg:pb-0">
      {/* Mobile Sticky Navigation Header (Creative Professional View) */}
      <div className="lg:hidden sticky top-0 z-50 px-4 py-3 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <div className="p-2 bg-green-100 text-green-700 rounded-xl">
                 <ActiveIcon className="h-5 w-5" />
              </div>
              <span className="font-semibold text-gray-900 text-lg">{activeSectionLabel}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-full"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <ChevronRight className={`h-5 w-5 transition-transform duration-300 ${mobileMenuOpen ? "rotate-90 text-green-600" : "rotate-0"}`} />
            </Button>
        </div>

        {/* Expandable Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-2"
            >
              <div className="py-2 space-y-1">
                {SECTIONS.map((s) => {
                  const Icon = s.icon;
                  const active = activeSection === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => scrollToSection(s.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                        active
                          ? "bg-green-50 text-green-700 shadow-sm ring-1 ring-green-100"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${active ? "text-green-600" : "text-gray-400 group-hover:text-gray-600"}`} />
                        <span className="text-base">{s.label}</span>
                      </div>
                      {active && <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop Header (Hidden on Mobile) */}
      <div className="hidden lg:block border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-xl">
            <SettingsIcon className="h-5 w-5 text-green-700" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
            <p className="text-sm text-gray-500">Manage your account, profile and preferences</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex gap-6">
        {/* Side navigation (Desktop Only) */}
        <nav className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 space-y-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-green-100 text-green-800 shadow-sm"
                      : s.id === "danger"
                      ? "text-red-500 hover:bg-red-50"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {s.label}
                  <ChevronRight className={`h-3.5 w-3.5 ml-auto transition-transform ${active ? "rotate-90" : ""}`} />
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile section tabs REMOVED - using top nav instead */}

        {/* Main content */}
        <main className="flex-1 space-y-6 pb-24 lg:pb-6">
          {/* PROFILE SECTION */}
          <section id="section-profile" className={sectionCardClass}>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar */}
              <div className="relative group">
                <div className="w-28 h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-600/20">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-white">
                      {getInitials(form.full_name || user?.email || "U")}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-2 -right-2 p-2 bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg hover:bg-green-50 group-hover:scale-110 transition-all"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-4 w-4 text-green-700 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 text-green-700" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              {/* Info */}
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-2xl font-bold text-gray-900">{form.full_name || "Your Name"}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{form.email}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3 justify-center sm:justify-start">
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 capitalize font-medium px-3"
                  >
                    {profile?.role || "teacher"}
                  </Badge>
                  {form.country && (
                    <Badge variant="outline" className="text-gray-600">
                      <MapPin className="h-3 w-3 mr-1" /> {form.country}
                    </Badge>
                  )}
                  {form.school_name && (
                    <Badge variant="outline" className="text-gray-600">
                      <School className="h-3 w-3 mr-1" /> {form.school_name}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Quick save */}
              <div className="shrink-0">
                <Button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-600/25 px-6"
                >
                  {savingProfile ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : profileSaved ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {savingProfile ? "Saving..." : profileSaved ? "Saved!" : "Save All Changes"}
                </Button>
              </div>
            </div>

            {/* Joined date */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Joined{" "}
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })
                  : "\u2014"}
              </span>
              <span className="flex items-center gap-1">
                <Pencil className="h-3.5 w-3.5" /> Last updated{" "}
                {profile?.updated_at
                  ? new Date(profile.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "\u2014"}
              </span>
            </div>
          </section>

          {/* PERSONAL INFO */}
          <section id="section-personal" className={sectionCardClass}>
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-green-100 rounded-lg">
                <User className="h-4 w-4 text-green-700" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="full_name" className={labelClass}>
                  <User className="h-3.5 w-3.5 text-green-600" /> Full name
                </Label>
                <Input
                  id="full_name"
                  name="full_name"
                  placeholder="e.g. Ngwa Emilia Tanyi"
                  value={form.full_name}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className={labelClass}>
                  <Mail className="h-3.5 w-3.5 text-green-600" /> Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  readOnly
                  className={`${inputClass} bg-gray-50 text-gray-500 cursor-not-allowed`}
                />
                <p className="text-xs text-gray-400">Email cannot be changed</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="date_of_birth" className={labelClass}>
                  <Calendar className="h-3.5 w-3.5 text-green-600" /> Date of birth
                </Label>
                <Input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                  value={form.date_of_birth}
                  onChange={handleChange}
                  className={inputClass}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gender" className={labelClass}>Gender</Label>
                <select id="gender" name="gender" value={form.gender} onChange={handleChange} className={selectClass}>
                  <option value="">Select</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="country" className={labelClass}>
                  <Globe className="h-3.5 w-3.5 text-green-600" /> Country
                </Label>
                <select id="country" name="country" value={form.country} onChange={handleChange} className={selectClass}>
                  <option value="">Select</option>
                  {COUNTRIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city" className={labelClass}>
                  <MapPin className="h-3.5 w-3.5 text-green-600" /> City / Town
                </Label>
                <Input id="city" name="city" placeholder="e.g. Yaound&#233;" value={form.city} onChange={handleChange} className={inputClass} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="preferred_language" className={labelClass}>
                  <Globe className="h-3.5 w-3.5 text-green-600" /> Preferred language
                </Label>
                <select id="preferred_language" name="preferred_language" value={form.preferred_language} onChange={handleChange} className={selectClass}>
                  <option value="">Select</option>
                  {LANGUAGES.map((l) => (<option key={l} value={l}>{l}</option>))}
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="bio" className={labelClass}>
                  <BookOpen className="h-3.5 w-3.5 text-green-600" /> Short bio
                </Label>
                <textarea
                  id="bio"
                  name="bio"
                  placeholder="Tell us about yourself and your teaching journey..."
                  value={form.bio}
                  onChange={handleChange}
                  rows={3}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all placeholder:text-gray-400 resize-none"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button onClick={handleSaveProfile} disabled={savingProfile} size="sm" className="rounded-xl bg-green-600 hover:bg-green-700 text-white">
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Personal Info
              </Button>
            </div>
          </section>

          {/* SCHOOL INFO */}
          <section id="section-school" className={sectionCardClass}>
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-green-100 rounded-lg">
                <School className="h-4 w-4 text-green-700" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">School Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="school_name" className={labelClass}>
                  <School className="h-3.5 w-3.5 text-green-600" /> School name
                </Label>
                <Input id="school_name" name="school_name" placeholder="e.g. Government Bilingual High School" value={form.school_name} onChange={handleChange} className={inputClass} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="school_address" className={labelClass}>
                  <MapPin className="h-3.5 w-3.5 text-green-600" /> School address
                </Label>
                <Input id="school_address" name="school_address" placeholder="e.g. Molyko, Buea" value={form.school_address} onChange={handleChange} className={inputClass} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="school_type" className={labelClass}>School type</Label>
                <select id="school_type" name="school_type" value={form.school_type} onChange={handleChange} className={selectClass}>
                  <option value="">Select</option>
                  {SCHOOL_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="number_of_students" className={labelClass}>
                  <Users className="h-3.5 w-3.5 text-green-600" /> Number of students
                </Label>
                <Input id="number_of_students" name="number_of_students" type="number" placeholder="e.g. 150" value={form.number_of_students} onChange={handleChange} className={inputClass} min="0" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subjects_taught" className={labelClass}>
                  <BookOpen className="h-3.5 w-3.5 text-green-600" /> Subjects taught
                </Label>
                <Input id="subjects_taught" name="subjects_taught" placeholder="e.g. Math, Science" value={form.subjects_taught} onChange={handleChange} className={inputClass} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="grade_levels" className={labelClass}>Grade levels</Label>
                <select id="grade_levels" name="grade_levels" value={form.grade_levels} onChange={handleChange} className={selectClass}>
                  <option value="">Select</option>
                  {GRADE_LEVELS.map((g) => (<option key={g} value={g}>{g}</option>))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="years_of_experience" className={labelClass}>
                  <Briefcase className="h-3.5 w-3.5 text-green-600" /> Years of experience
                </Label>
                <Input id="years_of_experience" name="years_of_experience" type="number" placeholder="e.g. 5" value={form.years_of_experience} onChange={handleChange} className={inputClass} min="0" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="education_level" className={labelClass}>
                  <GraduationCap className="h-3.5 w-3.5 text-green-600" /> Education level
                </Label>
                <select id="education_level" name="education_level" value={form.education_level} onChange={handleChange} className={selectClass}>
                  <option value="">Select</option>
                  {EDUCATION_LEVELS.map((l) => (<option key={l} value={l}>{l}</option>))}
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button onClick={handleSaveProfile} disabled={savingProfile} size="sm" className="rounded-xl bg-green-600 hover:bg-green-700 text-white">
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save School Info
              </Button>
            </div>
          </section>

          {/* CONTACT INFO */}
          <section id="section-contact" className={sectionCardClass}>
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-green-100 rounded-lg">
                <Phone className="h-4 w-4 text-green-700" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone_number" className={labelClass}>
                  <Phone className="h-3.5 w-3.5 text-green-600" /> Mobile phone number
                </Label>
                <Input id="phone_number" name="phone_number" type="tel" placeholder="+237 6XX XXX XXX" value={form.phone_number} onChange={handleChange} className={inputClass} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="whatsapp_number" className={labelClass}>
                  <MessageCircle className="h-3.5 w-3.5 text-green-600" /> WhatsApp number
                </Label>
                <Input id="whatsapp_number" name="whatsapp_number" type="tel" placeholder="+237 6XX XXX XXX" value={form.whatsapp_number} onChange={handleChange} className={inputClass} />
                <p className="text-xs text-gray-400">Used for important notifications &amp; community updates.</p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button onClick={handleSaveProfile} disabled={savingProfile} size="sm" className="rounded-xl bg-green-600 hover:bg-green-700 text-white">
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Contact Info
              </Button>
            </div>
          </section>

          {/* SECURITY */}
          <section id="section-security" className={sectionCardClass}>
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-green-100 rounded-lg">
                <Shield className="h-4 w-4 text-green-700" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Security</h3>
            </div>

            <div className="max-w-md space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className={labelClass}>
                  <Lock className="h-3.5 w-3.5 text-green-600" /> New password
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPw ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`${inputClass} pr-10`}
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {newPassword && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${pwStrength >= i ? strengthColors[pwStrength] : "bg-gray-200"}`} />
                      ))}
                    </div>
                    <p className={`text-xs ${pwStrength >= 4 ? "text-green-600" : pwStrength >= 3 ? "text-yellow-600" : "text-red-500"}`}>
                      {strengthLabels[pwStrength]}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className={labelClass}>
                  <Lock className="h-3.5 w-3.5 text-green-600" /> Confirm new password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPw ? "text" : "password"}
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`${inputClass} pr-10`}
                  />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
              >
                {savingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                {savingPassword ? "Updating..." : "Change Password"}
              </Button>
            </div>
          </section>

          {/* NOTIFICATIONS */}
          <section id="section-notifications" className={sectionCardClass}>
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-green-100 rounded-lg">
                <Bell className="h-4 w-4 text-green-700" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
            </div>

            <div className="space-y-4 max-w-lg">
              {([
                { key: "emailNotifications" as const, label: "Email Notifications", desc: "Receive notifications via email" },
                { key: "assignmentReminders" as const, label: "Assignment Reminders", desc: "Get reminders about upcoming assignments" },
                { key: "gradeUpdates" as const, label: "Grade Updates", desc: "Be notified when grades are updated" },
                { key: "courseAnnouncements" as const, label: "Course Announcements", desc: "Notifications about course announcements" },
              ]).map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                  <Switch
                    checked={notifications[item.key]}
                    onCheckedChange={() => setNotifications((p) => ({ ...p, [item.key]: !p[item.key] }))}
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                size="sm"
                className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
                onClick={() => toast({ title: "Preferences saved", description: "Notification settings updated." })}
              >
                <Save className="h-4 w-4 mr-2" /> Save Preferences
              </Button>
            </div>
          </section>

          {/* DANGER ZONE */}
          <section id="section-danger" className="bg-white border-2 border-red-100 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-red-700">Danger Zone</h3>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-red-50/50 border border-red-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">Delete your account</p>
                  <p className="text-xs text-gray-500">
                    Permanently remove your account and all associated data. This action cannot be undone.
                  </p>
                </div>
                <AnimatePresence mode="wait">
                  {confirmDelete ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2"
                    >
                      <span className="text-xs text-red-600 font-medium">Are you sure?</span>
                      <Button variant="destructive" size="sm" onClick={handleDeleteAccount} disabled={deletingAccount} className="rounded-xl">
                        {deletingAccount ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                        Yes, delete
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} className="rounded-xl">
                        Cancel
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div key="initial" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={handleDeleteAccount}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete Account
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Settings;