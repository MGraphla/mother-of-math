import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getPostAuthPath, type VerificationChannel } from '@/context/AuthContext';
import { toAuthError } from '@/lib/authErrors';
import { maskE164, normalizePhoneToE164 } from '@/lib/phone';
import {
  CLASS_COUNTS,
  COUNTRIES,
  EDUCATION_LEVELS,
  GENDERS,
  GRADE_LEVELS,
  LANGUAGES,
  PHONE_RULES,
  SCHOOL_TYPES,
  STUDENT_COUNTS,
  parseOptionalInt,
  toOptions,
} from '@/lib/profileOptions';
import {
  AuthLayout,
  Choice,
  Divider,
  Field,
  FormMessage,
  GoogleButton,
  PasswordField,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  TextLink,
} from '@/components/auth/AuthUI';
import { EMAIL_RE, fill, useAuthCopy } from './authCopy';

type Role = 'teacher' | 'parent';
type Step = 'account' | 'about' | 'school' | 'verify';

const SignUp = () => {
  const c = useAuthCopy();
  const navigate = useNavigate();
  const { signUp, signInWithGoogle, user, profile, isLoading } = useAuth();

  const [step, setStep] = useState<Step>('account');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'submit' | 'google' | null>(null);

  const [role, setRole] = useState<Role>('teacher');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('Cameroon');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [language, setLanguage] = useState('English');
  const [gender, setGender] = useState('');

  const [schoolName, setSchoolName] = useState('');
  const [schoolType, setSchoolType] = useState('');
  const [classes, setClasses] = useState('');
  const [students, setStudents] = useState('');
  const [grades, setGrades] = useState('');
  const [subjects, setSubjects] = useState('');
  const [experience, setExperience] = useState('');
  const [education, setEducation] = useState('');

  const [channel, setChannel] = useState<VerificationChannel>('email');

  // Already signed in (e.g. back button after verifying) → straight to the app.
  useEffect(() => {
    if (!isLoading && user && !busy) navigate(getPostAuthPath(user, profile), { replace: true });
  }, [isLoading, user, profile, busy, navigate]);

  const steps: Step[] = useMemo(
    () => (role === 'teacher' ? ['account', 'about', 'school', 'verify'] : ['account', 'about', 'verify']),
    [role],
  );
  const index = steps.indexOf(step);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const phoneRule = PHONE_RULES[country];

  const validate = (s: Step): string => {
    if (s === 'account') {
      if (!EMAIL_RE.test(email.trim())) return c.errEmail;
      if (password.length < 8) return c.errPasswordShort;
    }
    if (s === 'about') {
      if (!fullName.trim()) return c.errName;
      if (phoneRule && !phoneRule.pattern.test(phone.replace(/\s+/g, ''))) {
        return fill(c.errPhone, { country, example: phoneRule.example });
      }
    }
    if (s === 'school' && !schoolName.trim()) return c.errSchool;
    return '';
  };

  const goNext = () => {
    const msg = validate(step);
    if (msg) return setError(msg);
    setError('');
    setStep(steps[index + 1]);
  };

  const goBack = () => {
    setError('');
    if (index > 0) setStep(steps[index - 1]);
  };

  const handleSubmit = async () => {
    for (const s of steps) {
      const msg = validate(s);
      if (msg) {
        setStep(s);
        return setError(msg);
      }
    }
    setError('');
    setBusy('submit');
    try {
      const teacher = role === 'teacher';
      const pending = await signUp(
        {
          email,
          password,
          role,
          full_name: fullName.trim(),
          country,
          phone_number: phone.trim(),
          city: city.trim() || null,
          preferred_language: language,
          gender: gender || null,
          school_name: teacher ? schoolName.trim() : null,
          school_type: teacher ? schoolType || null : null,
          number_of_classes: teacher ? parseOptionalInt(classes) : null,
          number_of_students: teacher ? parseOptionalInt(students) : null,
          grade_levels: teacher ? grades || null : null,
          subjects_taught: teacher ? subjects.trim() || null : null,
          years_of_experience: teacher ? parseOptionalInt(experience) : null,
          education_level: teacher ? education || null : null,
        },
        channel,
      );
      if (pending) {
        navigate('/verify-email');
        return;
      }
      // No verification required: AuthProvider loads the profile, then route.
      setBusy(null);
    } catch (err) {
      const ae = toAuthError(err);
      setError(ae.message);
      // Send the user back to the field that needs fixing.
      if (ae.code === 'already_registered') setStep('account');
      else if (/phone/i.test(ae.message)) setStep('about');
      setBusy(null);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setBusy('google');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(toAuthError(err).message);
      setBusy(null);
    }
  };

  const titles: Record<Step, string> = {
    account: c.signUpTitle,
    about: c.aboutTitle,
    school: c.schoolTitle,
    verify: c.verifyChoiceTitle,
  };

  const maskedPhone = phone.trim() ? maskE164(normalizePhoneToE164(phone, country)) : '';

  return (
    <AuthLayout
        title={titles[step]}
        subtitle={step === 'verify' ? c.verifyChoiceSub : undefined}
        progress={{ step: index + 1, total: steps.length }}
        wide={step === 'school'}
        footer={
          <p>
            {c.haveAccount} <TextLink to="/sign-in">{c.signIn}</TextLink>
          </p>
        }
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 'verify') void handleSubmit();
            else goNext();
          }}
          className="space-y-4"
        >
          {step === 'account' && (
            <>
              <Choice<Role>
                label={c.iAm}
                value={role}
                onChange={setRole}
                options={[
                  { value: 'teacher', label: c.teacher },
                  { value: 'parent', label: c.parent },
                ]}
              />
              <Field
                label={c.email}
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                required
              />
              <PasswordField
                label={c.password}
                showLabel={c.show}
                hideLabel={c.hide}
                autoComplete="new-password"
                hint={c.passwordHint}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                minLength={8}
                required
              />
            </>
          )}

          {step === 'about' && (
            <>
              <Field
                label={c.fullName}
                autoComplete="name"
                autoCapitalize="words"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setError('');
                }}
                autoFocus
                required
              />
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-3">
                <SelectField
                  label={c.country}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  options={toOptions(COUNTRIES)}
                />
                <Field
                  label={c.phone}
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder={phoneRule?.example}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setError('');
                  }}
                  required
                />
              </div>
              <Field
                label={c.city}
                optional
                optionalLabel={c.optional}
                autoComplete="address-level2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label={c.language}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  options={toOptions(LANGUAGES)}
                />
                <SelectField
                  label={c.gender}
                  optional
                  optionalLabel={c.optional}
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  options={toOptions(GENDERS)}
                  placeholder={c.select}
                />
              </div>
            </>
          )}

          {step === 'school' && (
            <>
              <Field
                label={c.schoolName}
                autoCapitalize="words"
                value={schoolName}
                onChange={(e) => {
                  setSchoolName(e.target.value);
                  setError('');
                }}
                autoFocus
                required
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SelectField label={c.schoolType} optional optionalLabel={c.optional} value={schoolType} onChange={(e) => setSchoolType(e.target.value)} options={toOptions(SCHOOL_TYPES)} placeholder={c.select} />
                <SelectField label={c.grades} optional optionalLabel={c.optional} value={grades} onChange={(e) => setGrades(e.target.value)} options={toOptions(GRADE_LEVELS)} placeholder={c.select} />
                <SelectField label={c.classes} optional optionalLabel={c.optional} value={classes} onChange={(e) => setClasses(e.target.value)} options={CLASS_COUNTS} placeholder={c.select} />
                <SelectField label={c.students} optional optionalLabel={c.optional} value={students} onChange={(e) => setStudents(e.target.value)} options={STUDENT_COUNTS} placeholder={c.select} />
                <Field label={c.subjects} optional optionalLabel={c.optional} value={subjects} onChange={(e) => setSubjects(e.target.value)} />
                <Field label={c.experience} optional optionalLabel={c.optional} type="number" inputMode="numeric" min={0} max={60} value={experience} onChange={(e) => setExperience(e.target.value)} />
                <SelectField className="sm:col-span-2" label={c.education} optional optionalLabel={c.optional} value={education} onChange={(e) => setEducation(e.target.value)} options={toOptions(EDUCATION_LEVELS)} placeholder={c.select} />
              </div>
            </>
          )}

          {step === 'verify' && (
            <Choice<VerificationChannel>
              value={channel}
              onChange={setChannel}
              options={[
                { value: 'email', label: c.byEmail, detail: email.trim().toLowerCase() },
                { value: 'sms', label: c.bySms, detail: maskedPhone },
              ]}
            />
          )}

          <FormMessage>{error}</FormMessage>

          <div className={index > 0 ? 'grid grid-cols-[auto_1fr] gap-3' : ''}>
            {index > 0 ? (
              <SecondaryButton onClick={goBack} disabled={busy !== null} className="w-auto px-6">
                {c.back}
              </SecondaryButton>
            ) : null}
            <PrimaryButton
              loading={busy === 'submit'}
              loadingText={c.creating}
              disabled={busy !== null}
            >
              {step === 'verify' ? c.createSubmit : c.next}
            </PrimaryButton>
          </div>
        </form>

        {step === 'account' && (
          <>
            <Divider label={c.or} />
            <GoogleButton label={c.google} onClick={handleGoogle} disabled={busy !== null} />
          </>
        )}
    </AuthLayout>
  );
};

export default SignUp;
