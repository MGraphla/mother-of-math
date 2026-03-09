import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createTeacherAccount } from "@/services/adminService";
import {
  UserPlus, Mail, Lock, User, School, MapPin, Eye, EyeOff,
  CheckCircle, AlertCircle, Phone, Calendar, Globe, BookOpen,
  Briefcase, GraduationCap, MessageSquare, Users, Building,
  ClipboardList, Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Constants (mirror SignUp.tsx) ─────────────────────────────────────────

const COUNTRIES = ["Cameroon", "Nigeria"];

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
  "English", "French", "Pidgin English", "Fulfulde",
  "Ewondo", "Duala", "Bassa", "Other",
];

const GRADE_LEVELS = [
  "Primary 1", "Primary 2", "Primary 3",
  "Primary 4", "Primary 5", "Primary 6",
];

// ── Shared style helpers ──────────────────────────────────────────────────

const iCls = "h-10 bg-gray-800/50 border border-gray-700 text-white placeholder:text-gray-500 rounded-lg px-3 text-sm focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all w-full";
const sCls = `${iCls} appearance-none cursor-pointer`;
const lCls = "text-xs font-medium text-gray-400 flex items-center gap-1.5 mb-1.5";

// ── Section wrapper ───────────────────────────────────────────────────────

const Section = ({ icon: Icon, title, children }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 pb-1">
      <div className="h-7 w-7 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-indigo-400" />
      </div>
      <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
      <Separator className="flex-1 bg-gray-800" />
    </div>
    {children}
  </div>
);

// ── Select helper ─────────────────────────────────────────────────────────

const Sel = ({ id, value, onChange, options, placeholder }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) => (
  <select
    id={id}
    value={value}
    onChange={e => onChange(e.target.value)}
    className={sCls}
  >
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

// ── Component ─────────────────────────────────────────────────────────────

const CreateTeacher = () => {
  // Account
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [showCPw, setShowCPw]         = useState(false);

  // Personal
  const [fullName, setFullName]               = useState('');
  const [dateOfBirth, setDateOfBirth]         = useState('');
  const [gender, setGender]                   = useState('');
  const [country, setCountry]                 = useState('Cameroon');
  const [city, setCity]                       = useState('');
  const [preferredLang, setPreferredLang]     = useState('English');
  const [bio, setBio]                         = useState('');

  // School
  const [schoolName, setSchoolName]           = useState('');
  const [schoolAddress, setSchoolAddress]     = useState('');
  const [schoolType, setSchoolType]           = useState('');
  const [numStudents, setNumStudents]         = useState('');
  const [subjects, setSubjects]               = useState('');
  const [gradeLevels, setGradeLevels]         = useState('');
  const [yearsExp, setYearsExp]               = useState('');
  const [eduLevel, setEduLevel]               = useState('');

  // Contact
  const [phone, setPhone]             = useState('');
  const [whatsapp, setWhatsapp]       = useState('');

  // UI
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState<string | null>(null);
  const [error, setError]             = useState('');

  // ── Validation ──────────────────────────────────────────────────────────

  const validate = (): boolean => {
    if (!email || !fullName || !password || !confirmPw) {
      setError('Email, full name, and password are required.'); return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.'); return false;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.'); return false;
    }
    if (password !== confirmPw) {
      setError('Passwords do not match.'); return false;
    }
    if (!schoolName.trim()) {
      setError('School name is required.'); return false;
    }
    if (!phone.trim()) {
      setError('Phone number is required.'); return false;
    }
    return true;
  };

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await createTeacherAccount({
        email,
        password,
        full_name: fullName,
        gender:               gender || undefined,
        date_of_birth:        dateOfBirth || undefined,
        country:              country || undefined,
        city:                 city || undefined,
        preferred_language:   preferredLang || undefined,
        bio:                  bio || undefined,
        school_name:          schoolName || undefined,
        school_address:       schoolAddress || undefined,
        school_type:          schoolType || undefined,
        number_of_students:   numStudents ? parseInt(numStudents) : undefined,
        subjects_taught:      subjects || undefined,
        grade_levels:         gradeLevels || undefined,
        years_of_experience:  yearsExp ? parseInt(yearsExp) : undefined,
        education_level:      eduLevel || undefined,
        phone_number:         phone || undefined,
        whatsapp_number:      whatsapp || undefined,
      });

      if (result.success) {
        setSuccess(`Teacher account created successfully! They can log in immediately with the provided credentials. (User ID: ${result.userId})`);
        // Reset all fields
        setEmail(''); setPassword(''); setConfirmPw('');
        setFullName(''); setDateOfBirth(''); setGender(''); setCountry('Cameroon'); setCity('');
        setPreferredLang('English'); setBio('');
        setSchoolName(''); setSchoolAddress(''); setSchoolType('');
        setNumStudents(''); setSubjects(''); setGradeLevels(''); setYearsExp(''); setEduLevel('');
        setPhone(''); setWhatsapp('');
      } else {
        setError(result.error || 'Failed to create teacher account.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // ── JSX ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-indigo-400" />
          Create Teacher Account
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Admin-created accounts are instantly verified — the teacher can log in right away, no email confirmation needed.
        </p>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/25 text-green-400 text-sm"
          >
            <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{success}</span>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm"
          >
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Account Credentials ────────────────────────────────── */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-6 space-y-5">
            <Section icon={Lock} title="Account Credentials">
              {/* Email */}
              <div>
                <Label htmlFor="email" className={lCls}>
                  <Mail className="h-3.5 w-3.5" /> Email Address *
                </Label>
                <Input id="email" type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="teacher@school.com" className={iCls} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Password */}
                <div>
                  <Label htmlFor="password" className={lCls}>
                    <Lock className="h-3.5 w-3.5" /> Password *
                  </Label>
                  <div className="relative">
                    <Input id="password" type={showPw ? 'text' : 'password'} value={password}
                      onChange={e => { setPassword(e.target.value); setError(''); }}
                      placeholder="Min. 8 characters" className={`${iCls} pr-10`} />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="flex gap-1 mt-1.5">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-0.5 flex-1 rounded-full transition-colors ${
                          password.length >= i * 3
                            ? password.length >= 12 ? 'bg-green-500'
                              : password.length >= 8 ? 'bg-yellow-500' : 'bg-red-500'
                            : 'bg-gray-700'
                        }`} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <Label htmlFor="confirmPw" className={lCls}>
                    <Lock className="h-3.5 w-3.5" /> Confirm Password *
                  </Label>
                  <div className="relative">
                    <Input id="confirmPw" type={showCPw ? 'text' : 'password'} value={confirmPw}
                      onChange={e => { setConfirmPw(e.target.value); setError(''); }}
                      placeholder="Re-enter password" className={`${iCls} pr-10`} />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowCPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showCPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPw && (
                    <p className={`text-[11px] mt-1 ${confirmPw === password ? 'text-green-500' : 'text-red-400'}`}>
                      {confirmPw === password ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </p>
                  )}
                </div>
              </div>
            </Section>
          </CardContent>
        </Card>

        {/* ── Personal Info ──────────────────────────────────────── */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-6 space-y-5">
            <Section icon={User} title="Personal Information">
              {/* Full Name */}
              <div>
                <Label htmlFor="fullName" className={lCls}>
                  <User className="h-3.5 w-3.5" /> Full Name *
                </Label>
                <Input id="fullName" value={fullName}
                  onChange={e => { setFullName(e.target.value); setError(''); }}
                  placeholder="e.g. Ngwa Emilia Tanyi" className={iCls} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Date of Birth */}
                <div>
                  <Label htmlFor="dob" className={lCls}>
                    <Calendar className="h-3.5 w-3.5" /> Date of Birth
                  </Label>
                  <Input id="dob" type="date" value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className={iCls} />
                </div>
                {/* Gender */}
                <div>
                  <Label htmlFor="gender" className={lCls}>Gender</Label>
                  <Sel id="gender" value={gender} onChange={setGender}
                    options={['Male','Female','Prefer not to say']} placeholder="Select gender" />
                </div>
                {/* Preferred Language */}
                <div>
                  <Label htmlFor="lang" className={lCls}>
                    <Globe className="h-3.5 w-3.5" /> Language
                  </Label>
                  <Sel id="lang" value={preferredLang} onChange={setPreferredLang}
                    options={LANGUAGES} placeholder="Select language" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Country */}
                <div>
                  <Label htmlFor="country" className={lCls}>
                    <MapPin className="h-3.5 w-3.5" /> Country
                  </Label>
                  <Sel id="country" value={country} onChange={setCountry}
                    options={COUNTRIES} placeholder="Select country" />
                </div>
                {/* City */}
                <div>
                  <Label htmlFor="city" className={lCls}>
                    <Building className="h-3.5 w-3.5" /> City / Town
                  </Label>
                  <Input id="city" value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="e.g. Yaoundé" className={iCls} />
                </div>
              </div>

              {/* Bio */}
              <div>
                <Label htmlFor="bio" className={lCls}>
                  <MessageSquare className="h-3.5 w-3.5" /> Short Bio
                </Label>
                <textarea id="bio" value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Brief description about the teacher (optional)"
                  rows={3}
                  className={`${iCls} h-auto py-2 resize-none`} />
              </div>
            </Section>
          </CardContent>
        </Card>

        {/* ── School Info ────────────────────────────────────────── */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-6 space-y-5">
            <Section icon={School} title="School Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* School Name */}
                <div>
                  <Label htmlFor="schoolName" className={lCls}>
                    <School className="h-3.5 w-3.5" /> School Name *
                  </Label>
                  <Input id="schoolName" value={schoolName}
                    onChange={e => { setSchoolName(e.target.value); setError(''); }}
                    placeholder="e.g. Government Bilingual Primary School" className={iCls} />
                </div>
                {/* School Type */}
                <div>
                  <Label htmlFor="schoolType" className={lCls}>
                    <Building className="h-3.5 w-3.5" /> School Type
                  </Label>
                  <Sel id="schoolType" value={schoolType} onChange={setSchoolType}
                    options={SCHOOL_TYPES} placeholder="Select type" />
                </div>
              </div>

              {/* School Address */}
              <div>
                <Label htmlFor="schoolAddress" className={lCls}>
                  <MapPin className="h-3.5 w-3.5" /> School Address
                </Label>
                <Input id="schoolAddress" value={schoolAddress}
                  onChange={e => setSchoolAddress(e.target.value)}
                  placeholder="Street, town, region" className={iCls} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Number of Students */}
                <div>
                  <Label htmlFor="numStudents" className={lCls}>
                    <Users className="h-3.5 w-3.5" /> No. of Students
                  </Label>
                  <Input id="numStudents" type="number" min="0" value={numStudents}
                    onChange={e => setNumStudents(e.target.value)}
                    placeholder="e.g. 45" className={iCls} />
                </div>
                {/* Years of Experience */}
                <div>
                  <Label htmlFor="yearsExp" className={lCls}>
                    <Briefcase className="h-3.5 w-3.5" /> Years of Exp.
                  </Label>
                  <Input id="yearsExp" type="number" min="0" value={yearsExp}
                    onChange={e => setYearsExp(e.target.value)}
                    placeholder="e.g. 5" className={iCls} />
                </div>
                {/* Education Level */}
                <div>
                  <Label htmlFor="eduLevel" className={lCls}>
                    <GraduationCap className="h-3.5 w-3.5" /> Education
                  </Label>
                  <Sel id="eduLevel" value={eduLevel} onChange={setEduLevel}
                    options={EDUCATION_LEVELS} placeholder="Select level" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Subjects Taught */}
                <div>
                  <Label htmlFor="subjects" className={lCls}>
                    <BookOpen className="h-3.5 w-3.5" /> Subjects Taught
                  </Label>
                  <Input id="subjects" value={subjects}
                    onChange={e => setSubjects(e.target.value)}
                    placeholder="e.g. Math, English, Science" className={iCls} />
                </div>
                {/* Grade Levels */}
                <div>
                  <Label htmlFor="gradeLevels" className={lCls}>
                    <ClipboardList className="h-3.5 w-3.5" /> Grade Levels
                  </Label>
                  <Sel id="gradeLevels" value={gradeLevels} onChange={setGradeLevels}
                    options={GRADE_LEVELS} placeholder="Select grade" />
                </div>
              </div>
            </Section>
          </CardContent>
        </Card>

        {/* ── Contact Info ───────────────────────────────────────── */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-6 space-y-5">
            <Section icon={Phone} title="Contact Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Phone */}
                <div>
                  <Label htmlFor="phone" className={lCls}>
                    <Phone className="h-3.5 w-3.5" /> Phone Number *
                  </Label>
                  <Input id="phone" type="tel" value={phone}
                    onChange={e => { setPhone(e.target.value); setError(''); }}
                    placeholder="e.g. +237 6XX XXX XXX" className={iCls} />
                </div>
                {/* WhatsApp */}
                <div>
                  <Label htmlFor="whatsapp" className={lCls}>
                    <MessageSquare className="h-3.5 w-3.5" /> WhatsApp Number
                  </Label>
                  <Input id="whatsapp" type="tel" value={whatsapp}
                    onChange={e => setWhatsapp(e.target.value)}
                    placeholder="e.g. +237 6XX XXX XXX (if different)" className={iCls} />
                </div>
              </div>
            </Section>
          </CardContent>
        </Card>

        {/* ── Info banner ────────────────────────────────────────── */}
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-sm text-indigo-300">
          <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-indigo-400" />
          <span>
            This account is <strong>pre-verified</strong> — no confirmation email is sent. 
            The teacher can log in immediately using the credentials above.
            Share them securely (e.g., via WhatsApp or in person).
          </span>
        </div>

        {/* ── Submit ─────────────────────────────────────────────── */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm gap-2 transition-all"
        >
          {loading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              className="h-5 w-5 border-2 border-white border-t-transparent rounded-full"
            />
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              Create Verified Teacher Account
            </>
          )}
        </Button>
      </form>
    </div>
  );
};

export default CreateTeacher;