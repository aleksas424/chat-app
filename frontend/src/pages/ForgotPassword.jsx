import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await forgotPassword(email);
    setLoading(false);
    if (result.success) {
      toast.success('Kodą išsiuntėme į el. paštą');
      setStep(2);
    } else {
      toast.error(result.error);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await resetPassword(email, code, newPassword);
    setLoading(false);
    if (result.success) {
      toast.success('Slaptažodis atnaujintas!');
      navigate('/login');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full space-y-8"
      >
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Atstatyti slaptažodį
          </h2>
        </div>
        {step === 1 && (
          <form className="mt-8 space-y-6" onSubmit={handleSendCode}>
            <div>
              <label htmlFor="email" className="sr-only">
                El. pašto adresas
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm dark:bg-gray-800"
                placeholder="El. pašto adresas"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Siunčiama...' : 'Gauti kodą'}
              </button>
            </div>
            <div className="text-center">
              <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
                Grįžti į prisijungimą
              </Link>
            </div>
          </form>
        )}
        {step === 2 && (
          <form className="mt-8 space-y-6" onSubmit={handleReset}>
            <div>
              <label htmlFor="code" className="sr-only">
                Kodas
              </label>
              <input
                id="code"
                name="code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm dark:bg-gray-800"
                placeholder="Įveskite kodą iš el. pašto"
              />
            </div>
            <div>
              <label htmlFor="new-password" className="sr-only">
                Naujas slaptažodis
              </label>
              <input
                id="new-password"
                name="new-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm dark:bg-gray-800"
                placeholder="Naujas slaptažodis"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Atnaujinama...' : 'Atnaujinti slaptažodį'}
              </button>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
              >
                Grįžti atgal
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ForgotPassword; 