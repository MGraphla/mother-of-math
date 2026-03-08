import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import GoogleIcon from "@/components/icons/GoogleIcon";
import {
  BookHeart,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  School,
  Briefcase,
  Calendar,
  GraduationCap,
  Users,
  Globe,
  MessageCircle,
  ChevronRight,
  ChevronLeft,
  Check,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";

// ── Country list ──────────────────────────────────────────
const COUNTRIES = [
  "Cameroon", "Nigeria"
];

const SCHOOL_TYPES = [
  "Public / Government",
  "Private",
  "Faith-based / Mission",
  "International",
  "Community",
  "Home School",
  "Other",
];

const EDUCATION_LEVELS = [
  "High School Diploma",
  "Associate Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "PhD / Doctorate",
  "Teaching Certificate",
  "Other",
];

const LANGUAGES = [
  "English",
  "French",
  "Pidgin English",
  "Fulfulde",
  "Ewondo",
  "Duala",
  "Bassa",
  "Other",
];

const GRADE_LEVELS = [
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
];

// ── Step configuration ────────────────────────────────────
const STEPS = [
  { id: 1, title: "Account", icon: Lock },
  { id: 2, title: "Personal", icon: User },
  { id: 3, title: "School", icon: School },
  { id: 4, title: "Contact", icon: Phone },
];

// ── Animations ────────────────────────────────────────────
const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

const SignUp = () => {
  const navigate = useNavigate();
  const { signUp, signInWithGoogle } = useAuth();
  const { t } = useLanguage();

  // Form state
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Step 1 – Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"teacher" | "parent">("teacher");

  // Step 2 – Personal
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("Cameroon");
  const [city, setCity] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [bio, setBio] = useState("");

  // Step 3 – School
  const [schoolName, setSchoolName] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [schoolType, setSchoolType] = useState("");
  const [numberOfStudents, setNumberOfStudents] = useState("");
  const [subjectsTaught, setSubjectsTaught] = useState("");
  const [gradeLevels, setGradeLevels] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [educationLevel, setEducationLevel] = useState("");

  // Step 4 – Contact
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");

  // ── Navigation ────────────────────────────────────────
  const goNext = () => {
    if (!validateStep()) return;
    setDirection(1);
    setStep((s) => Math.min(s + 1, 4));
  };
  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  };

  const validateStep = (): boolean => {
    setErrorMessage("");
    if (step === 1) {
      if (!email || !password || !confirmPassword) {
        setErrorMessage(t('auth.error.fillAllRequired') || "Please fill in all required fields.");
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setErrorMessage(t('auth.error.invalidEmail') || "Please enter a valid email address.");
        return false;
      }
      if (password.length < 8) {
        setErrorMessage(t('auth.error.passwordLength') || "Password must be at least 8 characters.");
        return false;
      }
      if (password !== confirmPassword) {
        setErrorMessage(t('auth.error.passwordMismatch') || "Passwords do not match.");
        return false;
      }
    }
    if (step === 2) {
      if (!fullName.trim()) {
        setErrorMessage(t('auth.error.fullNameRequired') || "Full name is required.");
        return false;
      }
      if (!country) {
        setErrorMessage(t('auth.error.countryRequired') || "Country is required.");
        return false;
      }
    }
    if (step === 3) {
      if (!schoolName.trim()) {
        setErrorMessage(t('auth.error.schoolNameRequired') || "School name is required.");
        return false;
      }
    }
    if (step === 4) {
      if (!phoneNumber.trim()) {
        setErrorMessage(t('auth.error.phoneRequired') || "Phone number is required.");
        return false;
      }
      if (phoneNumber) {
        if (country === "Cameroon") {
          const cameroonRegex = /^(?:\+237|237)?\s*?[26]\d{8}$/;
          if (!cameroonRegex.test(phoneNumber.replace(/\s+/g, ''))) {
            setErrorMessage(t('auth.error.invalidPhoneCameroon') || "Please enter a valid Cameroon phone number (e.g., +237 6XX XXX XXX).");
            return false;
          }
        } else if (country === "Nigeria") {
          const nigeriaRegex = /^(?:\+234|234)?\s*?[789][01]\d{8}$|^0[789][01]\d{8}$/;
          if (!nigeriaRegex.test(phoneNumber.replace(/\s+/g, ''))) {
            setErrorMessage(t('auth.error.invalidPhoneNigeria') || "Please enter a valid Nigeria phone number (e.g., +234 8XX XXX XXXX).");
            return false;
          }
        }
      }
      if (whatsappNumber) {
        if (country === "Cameroon") {
          const cameroonRegex = /^(?:\+237|237)?\s*?[26]\d{8}$/;
          if (!cameroonRegex.test(whatsappNumber.replace(/\s+/g, ''))) {
            setErrorMessage(t('auth.error.invalidWhatsappCameroon') || "Please enter a valid Cameroon WhatsApp number.");
            return false;
          }
        } else if (country === "Nigeria") {
          const nigeriaRegex = /^(?:\+234|234)?\s*?[789][01]\d{8}$|^0[789][01]\d{8}$/;
          if (!nigeriaRegex.test(whatsappNumber.replace(/\s+/g, ''))) {
            setErrorMessage(t('auth.error.invalidWhatsappNigeria') || "Please enter a valid Nigeria WhatsApp number.");
            return false;
          }
        }
      }
    }
    return true;
  };

  // ── Submit ────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep()) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await signUp(email, password, {
        full_name: fullName,
        role,
        date_of_birth: dateOfBirth || null,
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
      // Navigate to the OTP verification screen with the email
      navigate("/verify-email", { state: { email } });
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage("");
      await signInWithGoogle();
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to sign in with Google.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Shared input classes ──────────────────────────────
  const inputClass =
    "h-11 bg-white/70 border border-gray-200 rounded-xl px-4 text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all placeholder:text-gray-400";
  const selectClass =
    "h-11 w-full bg-white/70 border border-gray-200 rounded-xl px-3 text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all appearance-none cursor-pointer";
  const labelClass = "text-sm font-medium text-gray-700 flex items-center gap-1.5";

  // ── Render steps ──────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className={labelClass}>
                <Mail className="h-3.5 w-3.5 text-green-600" /> Email address *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className={labelClass}>
                <Lock className="h-3.5 w-3.5 text-green-600" /> Password *
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Password strength indicator */}
              {password && (
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        password.length >= i * 3
                          ? password.length >= 12
                            ? "bg-green-500"
                            : password.length >= 8
                            ? "bg-yellow-500"
                            : "bg-red-400"
                          : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className={labelClass}>
                <Lock className="h-3.5 w-3.5 text-green-600" /> Confirm password *
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className={labelClass}>
                <User className="h-3.5 w-3.5 text-green-600" /> Full name *
              </Label>
              <Input
                id="fullName"
                placeholder="e.g. Ngwa Emilia Tanyi"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dateOfBirth" className={labelClass}>
                  <Calendar className="h-3.5 w-3.5 text-green-600" /> Date of birth
                </Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className={inputClass}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gender" className={labelClass}>Gender</Label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preferredLanguage" className={labelClass}>
                  <Globe className="h-3.5 w-3.5 text-green-600" /> Language
                </Label>
                <select
                  id="preferredLanguage"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className={selectClass}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="country" className={labelClass}>
                  <Globe className="h-3.5 w-3.5 text-green-600" /> Country *
                </Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={selectClass}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city" className={labelClass}>
                  <MapPin className="h-3.5 w-3.5 text-green-600" /> City / Town
                </Label>
                <Input
                  id="city"
                  placeholder="e.g. Yaoundé"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio" className={labelClass}>Short bio</Label>
              <textarea
                id="bio"
                placeholder="Tell us a little about yourself and your teaching journey... (optional)"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full bg-white/70 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all placeholder:text-gray-400 resize-none"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="schoolName" className={labelClass}>
                <School className="h-3.5 w-3.5 text-green-600" /> School name *
              </Label>
              <Input
                id="schoolName"
                placeholder="e.g. Government Bilingual High School"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="schoolAddress" className={labelClass}>
                <MapPin className="h-3.5 w-3.5 text-green-600" /> School address / location
              </Label>
              <Input
                id="schoolAddress"
                placeholder="e.g. Molyko, Buea"
                value={schoolAddress}
                onChange={(e) => setSchoolAddress(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="schoolType" className={labelClass}>School type</Label>
                <select
                  id="schoolType"
                  value={schoolType}
                  onChange={(e) => setSchoolType(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select</option>
                  {SCHOOL_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="numberOfStudents" className={labelClass}>
                  <Users className="h-3.5 w-3.5 text-green-600" /> No. of students
                </Label>
                <Input
                  id="numberOfStudents"
                  type="number"
                  placeholder="e.g. 150"
                  value={numberOfStudents}
                  onChange={(e) => setNumberOfStudents(e.target.value)}
                  className={inputClass}
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="subjectsTaught" className={labelClass}>Subjects taught</Label>
                <Input
                  id="subjectsTaught"
                  placeholder="e.g. Math, Science"
                  value={subjectsTaught}
                  onChange={(e) => setSubjectsTaught(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gradeLevels" className={labelClass}>Grade levels</Label>
                <select
                  id="gradeLevels"
                  value={gradeLevels}
                  onChange={(e) => setGradeLevels(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select</option>
                  {GRADE_LEVELS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="yearsOfExperience" className={labelClass}>
                  <Briefcase className="h-3.5 w-3.5 text-green-600" /> Years of experience
                </Label>
                <Input
                  id="yearsOfExperience"
                  type="number"
                  placeholder="e.g. 5"
                  value={yearsOfExperience}
                  onChange={(e) => setYearsOfExperience(e.target.value)}
                  className={inputClass}
                  min="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="educationLevel" className={labelClass}>
                  <GraduationCap className="h-3.5 w-3.5 text-green-600" /> Education level
                </Label>
                <select
                  id="educationLevel"
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select</option>
                  {EDUCATION_LEVELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phoneNumber" className={labelClass}>
                <Phone className="h-3.5 w-3.5 text-green-600" /> Mobile phone number *
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder={country === "Nigeria" ? "+234 8XX XXX XXXX" : "+237 6XX XXX XXX"}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="whatsappNumber" className={labelClass}>
                <MessageCircle className="h-3.5 w-3.5 text-green-600" /> WhatsApp number
              </Label>
              <Input
                id="whatsappNumber"
                type="tel"
                placeholder={country === "Nigeria" ? "+234 8XX XXX XXXX" : "+237 6XX XXX XXX"}
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className={inputClass}
              />
              <p className="text-xs text-gray-400">We use WhatsApp for important notifications &amp; community updates.</p>
            </div>

            {/* Summary preview */}
            <div className="mt-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-green-800 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Account Summary
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                <span className="font-medium text-gray-700">Name:</span>
                <span className="truncate">{fullName || "—"}</span>
                <span className="font-medium text-gray-700">Email:</span>
                <span className="truncate">{email || "—"}</span>
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

            <p className="text-xs text-gray-400 text-center">
              By creating an account you agree to our{" "}
              <a href="#" className="underline hover:text-green-600">Terms of Service</a> and{" "}
              <a href="#" className="underline hover:text-green-600">Privacy Policy</a>.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen p-4 overflow-hidden" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 30%, #047857 55%, #1a3a2a 100%)' }}>

      {/* African Kente geometric pattern overlay - slowly drifting */}
      <motion.div
        className="absolute inset-[-20%] opacity-[0.06] pointer-events-none"
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='none'/%3E%3Cline x1='0' y1='20' x2='80' y2='20' stroke='%23fbbf24' stroke-width='2'/%3E%3Cline x1='0' y1='40' x2='80' y2='40' stroke='%2334d399' stroke-width='2'/%3E%3Cline x1='0' y1='60' x2='80' y2='60' stroke='%23fbbf24' stroke-width='2'/%3E%3Cline x1='20' y1='0' x2='20' y2='80' stroke='%2334d399' stroke-width='2'/%3E%3Cline x1='40' y1='0' x2='40' y2='80' stroke='%23fbbf24' stroke-width='2'/%3E%3Cline x1='60' y1='0' x2='60' y2='80' stroke='%2334d399' stroke-width='2'/%3E%3Cpolygon points='20%2C14 26%2C20 20%2C26 14%2C20' fill='%23fbbf24'/%3E%3Cpolygon points='40%2C34 46%2C40 40%2C46 34%2C40' fill='%2334d399'/%3E%3Cpolygon points='60%2C14 66%2C20 60%2C26 54%2C20' fill='%23fbbf24'/%3E%3Cpolygon points='20%2C54 26%2C60 20%2C66 14%2C60' fill='%2334d399'/%3E%3Cpolygon points='60%2C54 66%2C60 60%2C66 54%2C60' fill='%23fbbf24'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '80px 80px' }}
      />

      {/* Animated amber/gold glowing orbs */}
      <motion.div className="absolute top-[-80px] right-[-80px] w-[420px] h-[420px] rounded-full pointer-events-none" animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }} style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.5) 0%, rgba(245,158,11,0.15) 60%, transparent 100%)' }} />
      <motion.div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full pointer-events-none" animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.35, 0.2] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2 }} style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.4) 0%, rgba(16,185,129,0.1) 60%, transparent 100%)' }} />
      <motion.div className="absolute top-1/2 left-[-60px] w-[300px] h-[300px] rounded-full pointer-events-none" animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.28, 0.15] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 4 }} style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.35) 0%, transparent 70%)' }} />

      {/* Top-left decorative triangle accent */}
      <div className="absolute top-0 left-0 w-0 h-0 pointer-events-none" style={{ borderLeft: '120px solid rgba(251,191,36,0.12)', borderBottom: '120px solid transparent' }} />
      {/* Bottom-right decorative triangle accent */}
      <div className="absolute bottom-0 right-0 w-0 h-0 pointer-events-none" style={{ borderRight: '150px solid rgba(52,211,153,0.1)', borderTop: '150px solid transparent' }} />

      {/* Floating math symbols - with rotation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {['π', '∑', '√', '∞', 'Δ', '÷', '×', '+', '=', '%', '∫', 'θ'].map((sym, i) => (
          <motion.span
            key={i}
            className="absolute font-bold text-white/10 select-none"
            style={{ left: `${(i * 8.3) % 100}%`, top: `${(i * 13 + 10) % 90}%`, fontSize: `${20 + (i % 3) * 12}px` }}
            animate={{ y: [0, -40, 0], opacity: [0.05, 0.2, 0.05], rotate: [0, 360] }}
            transition={{ duration: 12 + i * 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
          >
            {sym}
          </motion.span>
        ))}
      </div>

      {/* Shooting sparkle particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={`sparkle-${i}`}
            className="absolute w-1 h-1 bg-amber-300 rounded-full"
            style={{ left: `${10 + i * 11}%`, top: '-5%' }}
            animate={{
              y: ['0vh', '110vh'],
              x: [0, (i % 2 === 0 ? 30 : -30)],
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1.2, 1, 0.5],
            }}
            transition={{
              duration: 4 + i * 0.8,
              repeat: Infinity,
              ease: 'linear',
              delay: i * 1.2,
            }}
          />
        ))}
      </div>

      {/* Pulsing glow behind the card */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
        animate={{ scale: [1, 1.15, 1], opacity: [0.12, 0.25, 0.12] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.2) 0%, transparent 60%)' }}
      />
      {/* Decorative background */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-green-200/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-200/30 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl shadow-green-900/5 overflow-hidden">
          {/* Header */}
          <div className="relative px-6 pt-8 pb-6 text-center bg-gradient-to-b from-green-50/80 to-transparent">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-xl shadow-lg shadow-green-500/20">
                <BookHeart className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-extrabold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                Mama Math
              </span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              {t('auth.createYourAccount')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('auth.joinEducators')}
            </p>
          </div>

          {/* Step progress bar */}
          <div className="px-6 pb-2">
            <div className="flex items-center justify-between mb-2">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = step === s.id;
                const isDone = step > s.id;
                return (
                  <div key={s.id} className="flex items-center flex-1 last:flex-initial">
                    <button
                      onClick={() => {
                        if (s.id < step) {
                          setDirection(-1);
                          setStep(s.id);
                        }
                      }}
                      className={`flex flex-col items-center gap-1 transition-all ${
                        isActive
                          ? "text-green-600"
                          : isDone
                          ? "text-green-500 cursor-pointer"
                          : "text-gray-300"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-300 ${
                          isActive
                            ? "border-green-500 bg-green-50 shadow-md shadow-green-500/20"
                            : isDone
                            ? "border-green-400 bg-green-500 text-white"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        {isDone ? (
                          <Check className="h-4 w-4 text-white" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      <span className="text-[10px] font-medium hidden sm:block">{s.title}</span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <div className="flex-1 mx-2 hidden sm:block">
                        <div
                          className={`h-0.5 rounded-full transition-colors duration-500 ${
                            step > s.id ? "bg-green-400" : "bg-gray-200"
                          }`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form content */}
          <div className="px-6 pb-6">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>

            {/* Error message */}
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

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-6 gap-3">
              {step > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={goBack}
                  className="rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50 px-5"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <Button
                  type="button"
                  onClick={goNext}
                  className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25 px-6"
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25 px-8"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('auth.signingUp')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      {t('auth.createAccount')} <Sparkles className="h-4 w-4 ml-1" />
                    </span>
                  )}
                </Button>
              )}
            </div>

            {/* Divider */}
            {step === 1 && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-gray-400 font-medium">{t('auth.orContinueWith')}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 rounded-xl border-gray-200 hover:bg-gray-50 font-medium text-gray-700 transition-all"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting}
                >
                  <GoogleIcon className="mr-2 h-4 w-4" />
                  {t('auth.continueWithGoogle')}
                </Button>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-6 py-4 text-center bg-gray-50/50">
            <p className="text-sm text-gray-500">
              {t('auth.alreadyHaveAccount')}{" "}
              <Link
                to="/sign-in"
                className="font-semibold text-green-600 hover:text-green-700 hover:underline transition-colors"
              >
                {t('auth.signIn')}
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SignUp;
