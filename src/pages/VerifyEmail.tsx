import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyEmail, resendVerification, authStorage, ApiError } from '../app/auth/api';

type Status =
  | { type: 'loading' }
  | { type: 'success' }
  | { type: 'no-token' }
  | { type: 'invalid' }
  | { type: 'expired' };

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>(token ? { type: 'loading' } : { type: 'no-token' });
  const [resendEmail, setResendEmail] = useState('');
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [showResendForm, setShowResendForm] = useState(false);

  useEffect(() => {
    if (!token) return;

    verifyEmail(token)
      .then((auth) => {
        authStorage.save(auth);
        setStatus({ type: 'success' });
        navigate('/editor', { replace: true });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.code === 'AUTH_TOKEN_EXPIRED') {
          setStatus({ type: 'expired' });
        } else if (err instanceof ApiError && err.code === 'AUTH_TOKEN_INVALID') {
          setStatus({ type: 'invalid' });
        } else {
          setStatus({ type: 'invalid' });
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendState('sending');
    await resendVerification(resendEmail);
    setResendState('sent');
  };

  return (
    <div style={page}>
      <div style={card}>
        <h2 style={heading}>Email Verification</h2>

        {status.type === 'loading' && (
          <p style={body}>Verifying your email…</p>
        )}

        {status.type === 'success' && (
          <p style={body}>Verified! Redirecting you now…</p>
        )}

        {status.type === 'no-token' && (
          <p style={errorText}>Invalid link.</p>
        )}

        {status.type === 'invalid' && (
          <p style={errorText}>This link is invalid.</p>
        )}

        {status.type === 'expired' && (
          <>
            <p style={errorText}>This link has expired.</p>
            {!showResendForm && resendState === 'idle' && (
              <button style={primaryBtn} onClick={() => setShowResendForm(true)}>
                Resend verification email
              </button>
            )}
            {showResendForm && resendState !== 'sent' && (
              <form onSubmit={handleResend} style={{ marginTop: 16 }}>
                <label htmlFor="resend-email" style={label}>Enter your email address</label>
                <input
                  id="resend-email"
                  style={input}
                  type="email"
                  required
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                />
                <button style={primaryBtn} disabled={resendState === 'sending'} type="submit">
                  {resendState === 'sending' ? 'Sending…' : 'Send new link'}
                </button>
              </form>
            )}
            {resendState === 'sent' && (
              <p style={successText}>If that address is registered, a new link is on its way.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #ecfdf5 0%, #f0fdf4 60%, #ffffff 100%)',
  padding: 24,
};

const card: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  background: '#ffffff',
  border: '1px solid #bbf7d0',
  borderRadius: 16,
  padding: 32,
  boxShadow: '0 10px 30px rgba(16,185,129,0.10)',
};

const heading: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: 20,
  fontWeight: 700,
  color: '#064e3b',
};

const body: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
  color: '#065f46',
};

const errorText: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
  color: '#7f1d1d',
};

const successText: React.CSSProperties = {
  marginTop: 12,
  fontSize: 14,
  color: '#065f46',
};

const label: React.CSSProperties = {
  display: 'block',
  color: '#065f46',
  marginBottom: 6,
  fontSize: 13,
};

const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #F0D9A6',
  background: '#ffffff',
  color: '#065f46',
  outline: 'none',
  boxSizing: 'border-box',
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  marginTop: 12,
  padding: '10px 12px',
  background: 'linear-gradient(135deg, #CDAE6B, #A6812D)',
  color: '#2f2819',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  fontWeight: 600,
};
