'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  isAdminAuthenticated,
  authenticateAdmin,
  logoutAdmin,
  getAdminCode,
  setAdminCode,
} from '@/lib/storage';

// Master reset code — hardcoded, never stored in localStorage
const MASTER_RESET_CODE = 'NEWDELHI2026';

interface AdminGuardProps {
  children: (isAdmin: boolean) => React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  // --- Change Password state (Feature 1) ---
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [cpCurrentPin, setCpCurrentPin] = useState('');
  const [cpNewPin, setCpNewPin] = useState('');
  const [cpConfirmPin, setCpConfirmPin] = useState('');
  const [cpError, setCpError] = useState('');
  const [cpSuccess, setCpSuccess] = useState('');

  // --- Forgot Password state (Feature 2) ---
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [fpMasterCode, setFpMasterCode] = useState('');
  const [fpMasterVerified, setFpMasterVerified] = useState(false);
  const [fpNewPin, setFpNewPin] = useState('');
  const [fpConfirmPin, setFpConfirmPin] = useState('');
  const [fpError, setFpError] = useState('');

  useEffect(() => {
    setIsAdmin(isAdminAuthenticated());
  }, []);

  // --- PIN login handlers ---
  const handleUnlock = useCallback(() => {
    setShowPinModal(true);
    setPin('');
    setError('');
    setShowForgotPassword(false);
  }, []);

  const handleLock = useCallback(() => {
    logoutAdmin();
    setIsAdmin(false);
  }, []);

  const handleSubmitPin = useCallback(() => {
    if (authenticateAdmin(pin)) {
      setIsAdmin(true);
      setShowPinModal(false);
      setPin('');
      setError('');
    } else {
      setError('קוד שגוי, נסה שוב');
      setPin('');
    }
  }, [pin]);

  // --- Change Password handlers (Feature 1) ---
  const openChangePassword = useCallback(() => {
    setCpCurrentPin('');
    setCpNewPin('');
    setCpConfirmPin('');
    setCpError('');
    setCpSuccess('');
    setShowChangePassword(true);
  }, []);

  const closeChangePassword = useCallback(() => {
    setShowChangePassword(false);
    setCpCurrentPin('');
    setCpNewPin('');
    setCpConfirmPin('');
    setCpError('');
    setCpSuccess('');
  }, []);

  const handleChangePassword = useCallback(() => {
    setCpError('');
    setCpSuccess('');

    // Validate current PIN
    if (cpCurrentPin !== getAdminCode()) {
      setCpError('הקוד הנוכחי שגוי');
      return;
    }

    // Validate new PIN length
    if (cpNewPin.length < 4) {
      setCpError('הקוד החדש חייב להכיל לפחות 4 ספרות');
      return;
    }

    // Validate match
    if (cpNewPin !== cpConfirmPin) {
      setCpError('הקודות החדשים אינם תואמים');
      return;
    }

    // Save
    setAdminCode(cpNewPin);
    setCpSuccess('הסיסמה שונתה בהצלחה \u2713');
    setCpCurrentPin('');
    setCpNewPin('');
    setCpConfirmPin('');

    // Auto-close after a short delay
    setTimeout(() => {
      closeChangePassword();
    }, 1500);
  }, [cpCurrentPin, cpNewPin, cpConfirmPin, closeChangePassword]);

  // --- Forgot Password handlers (Feature 2) ---
  const openForgotPassword = useCallback(() => {
    setShowPinModal(false);
    setFpMasterCode('');
    setFpMasterVerified(false);
    setFpNewPin('');
    setFpConfirmPin('');
    setFpError('');
    setShowForgotPassword(true);
  }, []);

  const closeForgotPassword = useCallback(() => {
    setShowForgotPassword(false);
    setFpMasterCode('');
    setFpMasterVerified(false);
    setFpNewPin('');
    setFpConfirmPin('');
    setFpError('');
  }, []);

  const handleVerifyMasterCode = useCallback(() => {
    if (fpMasterCode === MASTER_RESET_CODE) {
      setFpMasterVerified(true);
      setFpError('');
    } else {
      setFpError('קוד שחזור שגוי');
    }
  }, [fpMasterCode]);

  const handleResetPassword = useCallback(() => {
    setFpError('');

    if (fpNewPin.length < 4) {
      setFpError('הקוד החדש חייב להכיל לפחות 4 ספרות');
      return;
    }

    if (fpNewPin !== fpConfirmPin) {
      setFpError('הקודות אינם תואמים');
      return;
    }

    // Save new PIN, auto-login, close
    setAdminCode(fpNewPin);
    authenticateAdmin(fpNewPin);
    setIsAdmin(true);
    closeForgotPassword();
  }, [fpNewPin, fpConfirmPin, closeForgotPassword]);

  // Shared PIN input classes
  const pinInputClasses =
    'w-full rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white text-center text-xl tracking-[0.3em] p-3 min-h-[44px] outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:text-sm placeholder:tracking-normal';

  return (
    <>
      {/* Admin toggle button + Change Password button */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
        <button
          onClick={isAdmin ? handleLock : handleUnlock}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white dark:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700 shadow-lg"
          aria-label={isAdmin ? 'נעל מצב מנהל' : 'פתח מצב מנהל'}
        >
          <span className="text-xl">{isAdmin ? '\uD83D\uDD13' : '\uD83D\uDD12'}</span>
        </button>

        {/* Change Password button — only visible when admin is logged in */}
        {isAdmin && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={openChangePassword}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white dark:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700 shadow-lg"
            aria-label="שנה סיסמה"
          >
            <span className="text-lg">{'\u2699\uFE0F'}</span>
          </motion.button>
        )}
      </div>

      {/* ============================== */}
      {/* PIN Login Modal (existing)     */}
      {/* ============================== */}
      <AnimatePresence>
        {showPinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setShowPinModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-4">
                הזן קוד מנהל
              </h2>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitPin()}
                placeholder="קוד PIN"
                className="w-full rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white text-center text-2xl tracking-[0.5em] p-4 min-h-[44px] outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:text-base placeholder:tracking-normal"
                autoFocus
              />
              {error && (
                <p className="text-red-500 dark:text-red-400 text-sm text-center mt-2">{error}</p>
              )}
              <button
                onClick={handleSubmitPin}
                className="w-full mt-4 bg-blue-500 text-white font-bold rounded-xl p-3 min-h-[44px] active:bg-blue-600"
              >
                כניסה
              </button>
              <button
                onClick={() => setShowPinModal(false)}
                className="w-full mt-2 text-slate-500 dark:text-slate-400 text-sm p-2 min-h-[44px]"
              >
                ביטול
              </button>

              {/* Forgot Password link */}
              <button
                onClick={openForgotPassword}
                className="w-full mt-1 text-blue-500 dark:text-blue-400 text-sm p-2 min-h-[44px] active:text-blue-400 dark:active:text-blue-300"
              >
                שכחתי סיסמה
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================== */}
      {/* Change Password Modal (Feat 1) */}
      {/* ============================== */}
      <AnimatePresence>
        {showChangePassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
            onClick={closeChangePassword}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-4">
                שינוי סיסמה
              </h2>

              {/* Current PIN */}
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                קוד נוכחי
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={cpCurrentPin}
                onChange={(e) => setCpCurrentPin(e.target.value)}
                placeholder="הזן קוד נוכחי"
                className={pinInputClasses}
                autoFocus
              />

              {/* New PIN */}
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 mt-3">
                קוד חדש
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={cpNewPin}
                onChange={(e) => setCpNewPin(e.target.value)}
                placeholder="לפחות 4 ספרות"
                className={pinInputClasses}
              />

              {/* Confirm New PIN */}
              <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 mt-3">
                אימות קוד חדש
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={cpConfirmPin}
                onChange={(e) => setCpConfirmPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
                placeholder="הזן שוב את הקוד החדש"
                className={pinInputClasses}
              />

              {/* Error / Success messages */}
              {cpError && (
                <p className="text-red-500 dark:text-red-400 text-sm text-center mt-3">{cpError}</p>
              )}
              {cpSuccess && (
                <p className="text-green-600 dark:text-green-400 text-sm text-center mt-3">{cpSuccess}</p>
              )}

              {/* Actions */}
              <button
                onClick={handleChangePassword}
                className="w-full mt-4 bg-blue-500 text-white font-bold rounded-xl p-3 min-h-[44px] active:bg-blue-600"
              >
                שמור
              </button>
              <button
                onClick={closeChangePassword}
                className="w-full mt-2 text-slate-500 dark:text-slate-400 text-sm p-2 min-h-[44px]"
              >
                ביטול
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================== */}
      {/* Forgot Password Modal (Feat 2) */}
      {/* ============================== */}
      <AnimatePresence>
        {showForgotPassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
            onClick={closeForgotPassword}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-4">
                שחזור סיסמה
              </h2>

              {!fpMasterVerified ? (
                <>
                  {/* Step 1: Master reset code */}
                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                    קוד שחזור ראשי
                  </label>
                  <input
                    type="text"
                    value={fpMasterCode}
                    onChange={(e) => setFpMasterCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyMasterCode()}
                    placeholder="הזן קוד שחזור"
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white text-center text-lg p-3 min-h-[44px] outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:text-sm"
                    autoFocus
                  />

                  {fpError && (
                    <p className="text-red-500 dark:text-red-400 text-sm text-center mt-3">{fpError}</p>
                  )}

                  <button
                    onClick={handleVerifyMasterCode}
                    className="w-full mt-4 bg-blue-500 text-white font-bold rounded-xl p-3 min-h-[44px] active:bg-blue-600"
                  >
                    אימות
                  </button>
                </>
              ) : (
                <>
                  {/* Step 2: Set new PIN */}
                  <p className="text-green-600 dark:text-green-400 text-sm text-center mb-3">
                    קוד שחזור אומת בהצלחה
                  </p>

                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                    קוד חדש
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={fpNewPin}
                    onChange={(e) => setFpNewPin(e.target.value)}
                    placeholder="לפחות 4 ספרות"
                    className={pinInputClasses}
                    autoFocus
                  />

                  <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1 mt-3">
                    אימות קוד חדש
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={fpConfirmPin}
                    onChange={(e) => setFpConfirmPin(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                    placeholder="הזן שוב את הקוד החדש"
                    className={pinInputClasses}
                  />

                  {fpError && (
                    <p className="text-red-500 dark:text-red-400 text-sm text-center mt-3">{fpError}</p>
                  )}

                  <button
                    onClick={handleResetPassword}
                    className="w-full mt-4 bg-blue-500 text-white font-bold rounded-xl p-3 min-h-[44px] active:bg-blue-600"
                  >
                    שמור וכניסה
                  </button>
                </>
              )}

              <button
                onClick={closeForgotPassword}
                className="w-full mt-2 text-slate-500 dark:text-slate-400 text-sm p-2 min-h-[44px]"
              >
                ביטול
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {children(isAdmin)}
    </>
  );
}
