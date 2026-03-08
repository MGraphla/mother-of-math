import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth, isProfileComplete, getDashboardPath } from "@/context/AuthContext";
import { upsertUserProfile } from "@/lib/supabase";
import {
  BookHeart,
  User,
  Phone,
  MapPin,
  School,
  Briefcase,
  GraduationCap,
  Users,
  Globe,
  MessageCircle,
  Sparkles,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

// ── Lists (same as SignUp) ─────────────────────────────
const COUNTRIES = [
  "Cameroon", "Nigeria"
];

const SCHOOL_TYPES = [
  "Public / Government", "Private", "Faith-based / Mission",
  "International", "Community", "Home School", "Other",
];

const EDUCATION_LEVELS = [
  "High School Diploma", "Associate Degree", "Bachelor's Degree",
  "Master's Degree", "PhD / Doctorate", "Teaching Certificate", "Other",
];

const LANGUAGES = [
  "English", "French", "Pidgin English", "Fulfulde",
  "Ewondo", "Duala", "Bassa", "Other",
];

const GRADE_LEVELS = [
  "Primary 1", "Primary 2", "Primary 3",
  "Primary 4", "Primary 5", "Primary 6",
];

// ── Steps for completion ──────────────────────────────
const STEPS = [
  { id: 1, title: "Role & Personal", icon: User },
  { id: 2, title: "School", icon: School },
  { id: 3, title: "Contact", icon: Phone },
];

const CompleteProfile = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Pre-fill from what Google already gave us
  const [role, setRole] = useState<"teacher" | "parent">(
    (profile?.role as "teacher" | "parent") ?? "teacher"
  );
  const [fullName, setFullName] = useState(profile?.full_name ?? user?.user_metadata?.full_name ?? "");
  const [gender, setGender] = useState(profile?.gender ?? "");
  const [country, setCountry] = useState(profile?.country ?? "Cameroon");
  const [city, setCity] = useState(profile?.city ?? "");
  const [preferredLanguage, setPreferredLanguage] = useState(profile?.preferred_language ?? "English");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [schoolName, setSchoolName] = useState(profile?.school_name ?? "");
  const [schoolAddress, setSchoolAddress] = useState(profile?.school_address ?? "");
  const [schoolType, setSchoolType] = useState(profile?.school_type ?? "");
  const [numberOfStudents, setNumberOfStudents] = useState(
    profile?.number_of_students ? String(profile.number_of_students) : ""
  );
  const [subjectsTaught, setSubjectsTaught] = useState(profile?.subjects_taught ?? "");
  const [gradeLevels, setGradeLevels] = useState(profile?.grade_levels ?? "");
  const [yearsOfExperience, setYearsOfExperience] = useState(
    profile?.years_of_experience ? String(profile.years_of_experience) : ""
  );
  const [educationLevel, setEducationLevel] = useState(profile?.education_level ?? "");
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(profile?.whatsapp_number ?? "");

  // If profile is already complete, skip this page
  useEffect(() => {
    if (isProfileComplete(profile)) {
      navigate(getDashboardPath(profile), { replace: true });
    }
  }, [profile, navigate]);

  // If not logged in, go to sign-in
  useEffect(() => {
    if (!user) navigate("/sign-in", { replace: true });
  }, [user, navigate]);

  const validateStep = (): boolean => {
    setErrorMessage("");
    if (step === 1) {
      if (!fullName.trim()) {
        setErrorMessage("Full name is required.");
        return false;
      }
      if (!country) {
        setErrorMessage("Please select your country.");
        return false;
      }
    }
    if (step === 2) {
      if (!schoolName.trim()) {
        setErrorMessage("School name is required.");
        return false;
      }
    }
    if (step === 3) {
      if (!phoneNumber.trim()) {
        setErrorMessage("Phone number is required.");
        return false;
      }
      if (phoneNumber) {
        if (country === "Cameroon") {
          const cameroonRegex = /^(?:\+237|237)?\s*?[26]\d{8}$/;
          if (!cameroonRegex.test(phoneNumber.replace(/\s+/g, ''))) {
            setErrorMessage("Please enter a valid Cameroon phone number (e.g., +237 6XX XXX XXX).");
            return false;
          }
        } else if (country === "Nigeria") {
          const nigeriaRegex = /^(?:\+234|234)?\s*?[789][01]\d{8}$|^0[789][01]\d{8}$/;
          if (!nigeriaRegex.test(phoneNumber.replace(/\s+/g, ''))) {
            setErrorMessage("Please enter a valid Nigeria phone number (e.g., +234 8XX XXX XXXX).");
            return false;
          }
        }
      }
      if (whatsappNumber) {
        if (country === "Cameroon") {
          const cameroonRegex = /^(?:\+237|237)?\s*?[26]\d{8}$/;
          if (!cameroonRegex.test(whatsappNumber.replace(/\s+/g, ''))) {
            setErrorMessage("Please enter a valid Cameroon WhatsApp number.");
            return false;
          }
        } else if (country === "Nigeria") {
          const nigeriaRegex = /^(?:\+234|234)?\s*?[789][01]\d{8}$|^0[789][01]\d{8}$/;
          if (!nigeriaRegex.test(whatsappNumber.replace(/\s+/g, ''))) {
            setErrorMessage("Please enter a valid Nigeria WhatsApp number.");
            return false;
          }
        }
      }
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, 3));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    if (!validateStep()) return;
    if (!user) return;

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await upsertUserProfile({
        id: user.id,
        email: user.email ?? "",
        full_name: fullName,
        role,
        gender: gender || null,
        country: country || null,
        city: city || null,
        school_name: schoolName || null,
        school_address: schoolAddress || null,
        school_type: schoolType || null,
        number_of_students: numberOfStudents ? parseInt(numberOfStudents) : null,
        subjects_taught: subjectsTaught || null,
        grade_levels: gradeLevels || null,
        years_of_experience: yearsOfExperience ? parseInt(yearsOfExperience) : null,
        education_level: educationLevel || null,
        phone_number: phoneNumber || null,
        whatsapp_number: whatsappNumber || null,
        bio: bio || null,
        preferred_language: preferredLanguage || null,
      });
      await refreshProfile();
      // Role is set during this form, use it directly for navigation
      const dashPath = role === 'parent' ? '/parent-dashboard' : '/dashboard';
      navigate(dashPath, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "h-11 bg-white/70 border border-gray-200 rounded-xl px-4 text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all placeholder:text-gray-400";
  const selectClass =
    "h-11 w-full bg-white/70 border border-gray-200 rounded-xl px-3 text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all appearance-none cursor-pointer";
  const labelClass = "text-sm font-medium text-gray-700 flex items-center gap-1.5";

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cp-fullName" className={labelClass}>
                <User className="h-3.5 w-3.5 text-green-600" /> Full name *
              </Label>
              <Input
                id="cp-fullName"
                placeholder="e.g. Ngwa Emilia Tanyi"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-gender" className={labelClass}>Gender</Label>
                <select id="cp-gender" value={gender} onChange={(e) => setGender(e.target.value)} className={selectClass}>
                  <option value="">Select</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-lang" className={labelClass}>
                  <Globe className="h-3.5 w-3.5 text-green-600" /> Language
                </Label>
                <select id="cp-lang" value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)} className={selectClass}>
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-country" className={labelClass}>
                  <Globe className="h-3.5 w-3.5 text-green-600" /> Country *
                </Label>
                <select id="cp-country" value={country} onChange={(e) => setCountry(e.target.value)} className={selectClass}>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-city" className={labelClass}>
                  <MapPin className="h-3.5 w-3.5 text-green-600" /> City / Town
                </Label>
                <Input id="cp-city" placeholder="e.g. Yaoundé" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-bio" className={labelClass}>Short bio</Label>
              <textarea
                id="cp-bio"
                placeholder="Tell us about yourself... (optional)"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                className="w-full bg-white/70 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all placeholder:text-gray-400 resize-none"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cp-school" className={labelClass}>
                <School className="h-3.5 w-3.5 text-green-600" /> School name *
              </Label>
              <Input id="cp-school" placeholder="e.g. Government Bilingual High School" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className={inputClass} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-schoolAddr" className={labelClass}>
                <MapPin className="h-3.5 w-3.5 text-green-600" /> School address
              </Label>
              <Input id="cp-schoolAddr" placeholder="e.g. Molyko, Buea" value={schoolAddress} onChange={(e) => setSchoolAddress(e.target.value)} className={inputClass} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-schoolType" className={labelClass}>School type</Label>
                <select id="cp-schoolType" value={schoolType} onChange={(e) => setSchoolType(e.target.value)} className={selectClass}>
                  <option value="">Select</option>
                  {SCHOOL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-numStudents" className={labelClass}>
                  <Users className="h-3.5 w-3.5 text-green-600" /> No. of students
                </Label>
                <Input id="cp-numStudents" type="number" placeholder="e.g. 150" value={numberOfStudents} onChange={(e) => setNumberOfStudents(e.target.value)} className={inputClass} min="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-subjects" className={labelClass}>Subjects taught</Label>
                <Input id="cp-subjects" placeholder="e.g. Math, Science" value={subjectsTaught} onChange={(e) => setSubjectsTaught(e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-grades" className={labelClass}>Grade levels</Label>
                <select id="cp-grades" value={gradeLevels} onChange={(e) => setGradeLevels(e.target.value)} className={selectClass}>
                  <option value="">Select</option>
                  {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cp-exp" className={labelClass}>
                  <Briefcase className="h-3.5 w-3.5 text-green-600" /> Years of experience
                </Label>
                <Input id="cp-exp" type="number" placeholder="e.g. 5" value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)} className={inputClass} min="0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-edu" className={labelClass}>
                  <GraduationCap className="h-3.5 w-3.5 text-green-600" /> Education level
                </Label>
                <select id="cp-edu" value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} className={selectClass}>
                  <option value="">Select</option>
                  {EDUCATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cp-phone" className={labelClass}>
                <Phone className="h-3.5 w-3.5 text-green-600" /> Mobile phone number *
              </Label>
              <Input id="cp-phone" type="tel" placeholder={country === "Nigeria" ? "+234 8XX XXX XXXX" : "+237 6XX XXX XXX"} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className={inputClass} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-whatsapp" className={labelClass}>
                <MessageCircle className="h-3.5 w-3.5 text-green-600" /> WhatsApp number
              </Label>
              <Input id="cp-whatsapp" type="tel" placeholder={country === "Nigeria" ? "+234 8XX XXX XXXX" : "+237 6XX XXX XXX"} value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} className={inputClass} />
              <p className="text-xs text-gray-400">Used for important notifications &amp; community updates.</p>
            </div>

            {/* Summary */}
            <div className="mt-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-green-800 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Profile Summary
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                <span className="font-medium text-gray-700">Name:</span>
                <span className="truncate">{fullName || "—"}</span>
                <span className="font-medium text-gray-700">Email:</span>
                <span className="truncate">{user?.email || "—"}</span>
                <span className="font-medium text-gray-700">Role:</span>
                <span className="capitalize">{role}</span>
                <span className="font-medium text-gray-700">Country:</span>
                <span>{country || "—"}</span>
                <span className="font-medium text-gray-700">School:</span>
                <span className="truncate">{schoolName || "—"}</span>
                <span className="font-medium text-gray-700">Phone:</span>
                <span>{phoneNumber || "—"}</span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-emerald-50/40 p-4 overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-green-200/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-200/30 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-lg"
      >
        <Card className="border border-white/60 bg-white/80 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden">
          {/* Header */}
          <CardHeader className="text-center pb-2 bg-gradient-to-b from-green-50/80 to-transparent pt-8 px-6">
            <Link to="/" className="inline-flex items-center justify-center gap-2 mb-3">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-xl shadow-lg shadow-green-500/20">
                <BookHeart className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-extrabold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                Mama Math
              </span>
            </Link>
            <CardTitle className="text-2xl font-bold text-gray-900">Complete Your Profile</CardTitle>
            <CardDescription className="text-gray-500 mt-1">
              We need a few more details to set up your dashboard.
            </CardDescription>
          </CardHeader>

          {/* Step indicators */}
          <div className="px-6 pb-2">
            <div className="flex items-center justify-between">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = step === s.id;
                const isDone = step > s.id;
                return (
                  <div key={s.id} className="flex items-center flex-1 last:flex-initial">
                    <div className={`flex flex-col items-center gap-1 transition-all ${isActive ? "text-green-600" : isDone ? "text-green-500" : "text-gray-300"}`}>
                      <div className={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all ${isActive ? "border-green-500 bg-green-50 shadow-md shadow-green-500/20" : isDone ? "border-green-400 bg-green-500 text-white" : "border-gray-200 bg-white"}`}>
                        {isDone ? <Sparkles className="h-4 w-4 text-white" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <span className="text-[10px] font-medium hidden sm:block">{s.title}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="flex-1 mx-2 hidden sm:block">
                        <div className={`h-0.5 rounded-full transition-colors ${step > s.id ? "bg-green-400" : "bg-gray-200"}`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <CardContent className="px-6 pb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -40, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm"
                >
                  {errorMessage}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Nav buttons */}
            <div className="flex items-center justify-between mt-6 gap-3">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={goBack} className="rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50 px-5">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              ) : <div />}

              {step < 3 ? (
                <Button type="button" onClick={goNext} className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25 px-6">
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25 px-8">
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      Complete Setup <Sparkles className="h-4 w-4 ml-1" />
                    </span>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default CompleteProfile;
