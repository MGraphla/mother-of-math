import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTeacherAccount } from "@/services/adminService";
import { UserPlus, Mail, Lock, User, School, MapPin, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

const CreateTeacher = () => {
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    school_name: '',
    country: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError('');
    setSuccess(false);
  };

  const validateForm = () => {
    if (!formData.email || !formData.full_name || !formData.password) {
      setError('Email, name, and password are required');
      return false;
    }
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      const result = await createTeacherAccount({
        email: formData.email,
        full_name: formData.full_name,
        school_name: formData.school_name || undefined,
        country: formData.country || undefined,
        password: formData.password,
      });

      if (result.success) {
        setSuccess(true);
        setFormData({
          email: '',
          full_name: '',
          school_name: '',
          country: '',
          password: '',
          confirmPassword: '',
        });
      } else {
        setError(result.error || 'Failed to create teacher account');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Create Teacher Account</h1>
        <p className="text-gray-400 mt-1">
          Manually create a new teacher account
        </p>
      </div>

      {/* Form Card */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            New Teacher Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Success Message */}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20"
              >
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400">Teacher account created successfully!</span>
              </motion.div>
            )}

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20"
              >
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span className="text-red-400">{error}</span>
              </motion.div>
            )}

            {/* Full Name */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <User className="w-4 h-4" /> Full Name *
              </Label>
              <Input
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Enter teacher's full name"
                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <Mail className="w-4 h-4" /> Email Address *
              </Label>
              <Input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="teacher@school.com"
                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>

            {/* School Name */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <School className="w-4 h-4" /> School Name
              </Label>
              <Input
                name="school_name"
                value={formData.school_name}
                onChange={handleChange}
                placeholder="Enter school name (optional)"
                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>

            {/* Country */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Country
              </Label>
              <Input
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="Enter country (optional)"
                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Password *
              </Label>
              <div className="relative">
                <Input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 8 characters"
                  className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Confirm Password *
              </Label>
              <Input
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter password"
                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Teacher Account
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-4">
          <p className="text-sm text-gray-400">
            <strong className="text-gray-300">Note:</strong> The teacher will receive an email 
            confirmation. They can log in using the email and password you provide. Make sure 
            to share the credentials securely with the teacher.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateTeacher;
