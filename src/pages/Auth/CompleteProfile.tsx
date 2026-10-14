import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getDashboardPath, needsProfileCompletion, useAuth } from '@/context/AuthContext';
import { toAuthError } from '@/lib/authErrors';
import {
  CLASS_COUNTS,
  COUNTRIES,
  LANGUAGES,
  PHONE_RULES,
  SCHOOL_TYPES,
  STUDENT_COUNTS,
  parseOptionalInt,
  toOptions,
} from '@/lib/profileOptions';
import {
  AuthLayout,
  AuthStatus,
  Choice,
  Field,
  FormMessage,
  PrimaryButton,
  SelectField,
  TextButton,
} from '@/components/auth/AuthUI';
import { fill, useAuthCopy } from './authCopy';

type Role = 'teacher' | 'parent';

const CompleteProfile = () => {
  const c = useAuthCopy();
  const navigate = useNavigate();
  const { user, profile, isLoading, saveProfile, signOut } = useAuth();

  const [role, setRole] = useState<Role>('teacher');
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('Cameroon');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [language, setLanguage] = useState('English');
  const [schoolName, setSchoolName] = useState('');
  const [schoolType, setSchoolType] = useState('');
  const [classes, setClasses] = useState('');
  const [students, setStudents] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const seeded = useRef(false);

  // Prefill once from what we already know: the profile row, else the details
  // given at sign-up (account metadata) or by Google.
  useEffect(() => {
    if (seeded.current || isLoading || !user) return;
    seeded.current = true;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const pick = (key: keyof NonNullable<typeof profile>, metaKey: string = key as string): string => {
      const v = profile?.[key] ?? meta[metaKey];
      return v === null || v === undefined ? '' : String(v);
    };
    setRole(pick('role') === 'parent' ? 'parent' : 'teacher');
    setFullName(pick('full_name') || String(meta.name ?? ''));
    const savedCountry = pick('country');
    if (COUNTRIES.includes(savedCountry)) setCountry(savedCountry);
    setPhone(pick('phone_number'));
    setCity(pick('city'));
    setLanguage(pick('preferred_language') || 'English');
    setSchoolName(pick('school_name'));
    setSchoolType(pick('school_type'));
    setClasses(pick('number_of_classes'));
    setStudents(pick('number_of_students'));
  }, [isLoading, user, profile]);

  if (isLoading) return <AuthStatus title={c.completeTitle} />;
  if (!user) return <Navigate to="/sign-in" replace />;
  if (!busy && !needsProfileCompletion(user, profile)) return <Navigate to={getDashboardPath(profile)} replace />;

  const rule = PHONE_RULES[country];
  const teacher = role === 'teacher';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) return setError(c.errName);
    if (rule && !rule.pattern.test(phone.replace(/\s+/g, ''))) {
      return setError(fill(c.errPhone, { country, example: rule.example }));
    }
    if (teacher && !schoolName.trim()) return setError(c.errSchool);

    setBusy(true);
    try {
      const next = await saveProfile({
        role,
        full_name: fullName.trim(),
        country,
        phone_number: phone.trim(),
        city: city.trim() || null,
        preferred_language: language,
        school_name: schoolName.trim() || null,
        school_type: teacher ? schoolType || null : profile?.school_type ?? null,
        number_of_classes: teacher ? parseOptionalInt(classes) : profile?.number_of_classes ?? null,
        number_of_students: teacher ? parseOptionalInt(students) : profile?.number_of_students ?? null,
        google_extra_profile_completed: true,
      });
      navigate(getDashboardPath(next ?? { role }), { replace: true });
    } catch (err) {
      setError(toAuthError(err).message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={c.completeTitle}
      subtitle={c.completeSub}
      footer={
        <TextButton
          className="font-medium text-[#5F6B63]"
          onClick={async () => {
            await signOut();
            navigate('/sign-in', { replace: true });
          }}
        >
          {c.signOut}
        </TextButton>
      }
    >
      <form noValidate className="space-y-4" onSubmit={submit}>
        <Choice<Role>
          label={c.iAm}
          value={role}
          onChange={setRole}
          options={[
            { value: 'teacher', label: c.teacher },
            { value: 'parent', label: c.parent },
          ]}
        />
        <Field label={c.fullName} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-3">
          <SelectField label={c.country} value={country} onChange={(e) => setCountry(e.target.value)} options={toOptions(COUNTRIES)} />
          <Field
            label={c.phone}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder={rule?.example}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={c.city} optional optionalLabel={c.optional} value={city} onChange={(e) => setCity(e.target.value)} />
          <SelectField label={c.language} value={language} onChange={(e) => setLanguage(e.target.value)} options={toOptions(LANGUAGES)} />
        </div>

        {teacher && (
          <>
            <Field label={c.schoolName} value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
            <SelectField label={c.schoolType} optional optionalLabel={c.optional} value={schoolType} onChange={(e) => setSchoolType(e.target.value)} options={toOptions(SCHOOL_TYPES)} placeholder={c.select} />
            <div className="grid grid-cols-2 gap-3">
              <SelectField label={c.classes} optional optionalLabel={c.optional} value={classes} onChange={(e) => setClasses(e.target.value)} options={CLASS_COUNTS} placeholder={c.select} />
              <SelectField label={c.students} optional optionalLabel={c.optional} value={students} onChange={(e) => setStudents(e.target.value)} options={STUDENT_COUNTS} placeholder={c.select} />
            </div>
          </>
        )}

        <FormMessage>{error}</FormMessage>
        <PrimaryButton loading={busy} loadingText={c.saving}>
          {c.saveContinue}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
};

export default CompleteProfile;
