import React, { useState } from 'react';
import {
  Activity, Eye, EyeOff, Lock, Mail, Phone, User, Calendar, Ruler,
  Weight, Sparkles, CheckCircle2, AlertCircle, ArrowLeft, KeyRound, Search
} from 'lucide-react';
import { UserProfile } from '../types/motion';
import {
  loginUser, registerUser, findUserEmail, resetUserPassword, generateRandomTestUser
} from '../services/authAndStorageService';

interface AuthPortalProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const AuthPortal: React.FC<AuthPortalProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'find-id' | 'find-pw'>('login');

  // Login states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign up states
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [age, setAge] = useState<number>(27);
  const [height, setHeight] = useState<number>(176);
  const [weight, setWeight] = useState<number>(72);
  const [phone, setPhone] = useState('010-1234-5678');

  // Find ID states
  const [findIdName, setFindIdName] = useState('');
  const [findIdPhone, setFindIdPhone] = useState('');
  const [foundEmail, setFoundEmail] = useState<string | null>(null);

  // Find PW states
  const [findPwEmail, setFindPwEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Notifications & Loading
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // "테스트용 랜덤 정보 입력" button handler
  const handleRandomFill = () => {
    const dummy = generateRandomTestUser();
    setSignupEmail(dummy.email);
    setSignupPassword(dummy.password);
    setSignupConfirmPassword(dummy.password);
    setName(dummy.name);
    setGender(dummy.gender);
    setAge(dummy.age);
    setHeight(dummy.height);
    setWeight(dummy.weight);
    setPhone(dummy.phone);
    setError(null);
    setSuccess('테스트용 사용자 정보가 자동으로 채워졌습니다.');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await loginUser(loginEmail, loginPassword);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await loginUser('demo@motion.ai', 'demo1234');
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || '데모 계정 로그인 실패');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (signupPassword !== signupConfirmPassword) {
      setError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    if (signupPassword.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const registered = await registerUser({
        email: signupEmail,
        password: signupPassword,
        name,
        gender,
        age: Number(age),
        height: Number(height),
        weight: Number(weight),
        phone,
      });

      // Clear signup form
      const savedEmail = signupEmail;
      setSignupEmail('');
      setSignupPassword('');
      setSignupConfirmPassword('');
      setName('');
      
      // Auto-login with registered user or direct to login
      setMode('login');
      setLoginEmail(savedEmail);
      setSuccess(`회원가입이 완료되었습니다! Firebase Authentication에 등록되었습니다.`);
    } catch (err: any) {
      setError(err.message || '회원가입 실패');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFindIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFoundEmail(null);
    try {
      const email = findUserEmail(findIdName, findIdPhone);
      setFoundEmail(email);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResetPwSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword && newPassword !== newPasswordConfirm) {
      setError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetUserPassword(findPwEmail, newPassword);
      setSuccess(res.message);
      setLoginEmail(findPwEmail);
      setMode('login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-slate-950 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Brand Header */}
      <div className="mb-6 text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
          <Activity className="w-3.5 h-3.5" />
          <span>AI Motion Biomechanics System</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          AI MotionLab
        </h1>
        <p className="text-xs text-slate-400 max-w-sm">
          정밀한 운동역학 분석 및 1:1 맞춤형 피드백을 위해 먼저 로그인해 주세요
        </p>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          <span>Firebase Auth & Firestore 실시간 연동 (video-app-3daf9)</span>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative z-10 space-y-6">
        {/* Tab switchers if in login or signup */}
        {(mode === 'login' || mode === 'signup') && (
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                mode === 'login'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                mode === 'signup'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              회원가입
            </button>
          </div>
        )}

        {/* Back button for find id / pw */}
        {(mode === 'find-id' || mode === 'find-pw') && (
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccess(null);
              }}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>로그인 화면으로 돌아가기</span>
            </button>
            <span className="text-xs font-bold text-slate-300">
              {mode === 'find-id' ? '아이디(이메일) 찾기' : '비밀번호 재설정'}
            </span>
          </div>
        )}

        {/* Error / Success Alerts */}
        {error && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
        )}

        {/* MODE 1: LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                이메일 아이디
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@motion.ai"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">비밀번호</label>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('find-id');
                      setError(null);
                      setSuccess(null);
                    }}
                    className="hover:text-emerald-400 transition"
                  >
                    아이디 찾기
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('find-pw');
                      setError(null);
                      setSuccess(null);
                    }}
                    className="hover:text-emerald-400 transition"
                  >
                    비밀번호 찾기
                  </button>
                </div>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-950/50 transition flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Firebase 인증 확인 중...</span>
                </>
              ) : (
                <span>로그인</span>
              )}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-3 text-[11px] text-slate-500">빠른 테스트</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleDemoLogin}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 font-semibold rounded-xl text-xs border border-slate-700/80 transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              데모 계정으로 1초 로그인 (demo@motion.ai)
            </button>
          </form>
        )}

        {/* MODE 2: SIGN UP */}
        {mode === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-slate-300">신체 및 계정 정보 입력</span>
              {/* Mandatory Test Data Fill Button */}
              <button
                type="button"
                onClick={handleRandomFill}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition shadow-sm"
              >
                <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
                테스트용 랜덤 정보 입력
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                이메일 <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="athlete@motion.ai"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  비밀번호 <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="최소 6자"
                    className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
                  >
                    {showSignupPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  비밀번호 확인 <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showSignupConfirmPassword ? 'text' : 'password'}
                    required
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="재입력"
                    className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
                  >
                    {showSignupConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  이름 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">성별</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                  <option value="other">기타</option>
                </select>
              </div>
            </div>

            {/* Anthropometric parameters for Dempster model & Gemini */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">나이 (세)</label>
                <input
                  type="number"
                  min={10}
                  max={99}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-center text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">신장 (cm)</label>
                <input
                  type="number"
                  min={100}
                  max={250}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-center text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">체중 (kg)</label>
                <input
                  type="number"
                  min={30}
                  max={200}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-center text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                전화번호
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-950/50 transition mt-2 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Firebase 계정 생성 중...</span>
                </>
              ) : (
                <span>회원가입 완료하기 (Firebase 계정 등록)</span>
              )}
            </button>
          </form>
        )}

        {/* MODE 3: FIND ID (아이디 찾기) */}
        {mode === 'find-id' && (
          <form onSubmit={handleFindIdSubmit} className="space-y-4">
            <p className="text-xs text-slate-400">
              가입 시 입력하셨던 <strong>이름</strong>과 <strong>전화번호</strong>를 입력하시면 등록된 이메일 계정을 찾아드립니다.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">이름</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={findIdName}
                  onChange={(e) => setFindIdName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">전화번호</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="tel"
                  required
                  value={findIdPhone}
                  onChange={(e) => setFindIdPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              아이디(이메일) 조회하기
            </button>

            {foundEmail && (
              <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-center space-y-2">
                <div className="text-xs text-slate-300">조회된 이메일 계정:</div>
                <div className="text-sm font-bold text-emerald-400 font-mono">{foundEmail}</div>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail(foundEmail);
                    setMode('login');
                  }}
                  className="mt-2 text-xs font-semibold px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition"
                >
                  이 계정으로 로그인하기
                </button>
              </div>
            )}
          </form>
        )}

        {/* MODE 4: FIND PW / RESET (비밀번호 찾기 및 재설정) */}
        {mode === 'find-pw' && (
          <form onSubmit={handleResetPwSubmit} className="space-y-4">
            <p className="text-xs text-slate-400">
              가입하신 이메일을 입력하시고 새로운 비밀번호를 설정해 주세요.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">가입 이메일</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={findPwEmail}
                  onChange={(e) => setFindPwEmail(e.target.value)}
                  placeholder="athlete@motion.ai"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">새 비밀번호</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="최소 6자"
                    className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-2 text-slate-400"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">비밀번호 확인</label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  placeholder="재입력"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              비밀번호 재설정 완료
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
