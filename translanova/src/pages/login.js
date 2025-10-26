import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useNavigate } from 'react-router-dom';
import "../styles/login.css";
import login_img from '../images/login.png';
import authService from '../services/authService';

function Login() {
  const h1Ref = useRef(null);
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' or 'signup' or 'forgot'
  const [message, setMessage] = useState(null);

  return (
    <div className="login_main">
      <div className="login_pg2">
      </div>
      <div className="login_signup_box">
        <div className="container">
          <div className="row">
            <div className="col-lg-7">
              <img src={login_img} alt="login_img" />
            </div>
            <div className="col-lg-5">
              <div className="auth_tabs">
                <button
                  className={mode === 'login' ? 'active' : ''}
                  onClick={() => { setMode('login'); setMessage(null); }}
                >Login</button>
                <button
                  className={mode === 'signup' ? 'active' : ''}
                  onClick={() => { setMode('signup'); setMessage(null); }}
                >Sign up</button>
              </div>

              {message && <div className={`auth_message ${message.type}`}>{message.text}</div>}

              {mode === 'login' ? (
                <LoginForm 
                  onSuccess={() => { 
                    setMessage({ type: 'success', text: 'Login successful — redirecting...' }); 
                    setTimeout(() => navigate('/'), 900); 
                  }} 
                  onError={(text) => setMessage({ type: 'error', text })}
                  onForgotPassword={() => { 
                    setMode('forgot'); 
                    setMessage(null); 
                  }}
                />
              ) : mode === 'signup' ? (
                <SignupForm 
                  onSuccess={() => { 
                    setMessage({ type: 'success', text: 'Signup successful — you can now log in' }); 
                    setMode('login'); 
                  }} 
                  onError={(text) => setMessage({ type: 'error', text })} 
                />
              ) : (
                <ForgotPasswordForm
                  onSuccess={() => {
                    setMessage({ type: 'success', text: 'Password reset instructions sent to your email' });
                    setMode('login');
                  }}
                  onError={(text) => setMessage({ type: 'error', text })}
                  onBack={() => {
                    setMode('login');
                    setMessage(null);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

  );
}

function SignupForm({ onSuccess, onError }){
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e){
    e.preventDefault();
    if(!username || !email || !password){ 
      onError('Please fill all fields'); 
      return; 
    }

    setIsLoading(true);
    try {
      await authService.register(username, email, password);
      onSuccess && onSuccess();
    } catch (error) {
      onError(error.toString());
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="auth_form" onSubmit={handleSubmit}>
      <input 
        value={username} 
        onChange={e=>setUsername(e.target.value)} 
        type="text" 
        placeholder="Username" 
        disabled={isLoading}
      />
      <input 
        value={email} 
        onChange={e=>setEmail(e.target.value)} 
        type="email" 
        placeholder="Email" 
        disabled={isLoading}
      />
      <input 
        value={password} 
        onChange={e=>setPassword(e.target.value)} 
        type="password" 
        placeholder="Password" 
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  );
}

function LoginForm({ onSuccess, onError, onForgotPassword }){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e){
    e.preventDefault();
    if(!email || !password){ 
      onError('Please enter credentials'); 
      return; 
    }

    setIsLoading(true);
    try {
      await authService.login(email, password);
      onSuccess && onSuccess();
    } catch (error) {
      onError(error.toString());
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="auth_form" onSubmit={handleSubmit}>
      <input 
        value={email} 
        onChange={e=>setEmail(e.target.value)} 
        type="text" 
        placeholder="Email" 
        disabled={isLoading}
      />
      <input 
        value={password} 
        onChange={e=>setPassword(e.target.value)} 
        type="password" 
        placeholder="Password" 
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
      <button 
        type="button" 
        className="forgot_password_link" 
        onClick={onForgotPassword}
        disabled={isLoading}
      >
        Forgot Password?
      </button>
    </form>
  );
}

function ForgotPasswordForm({ onSuccess, onError, onBack }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email) {
      onError('Please enter your email');
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Implement password reset endpoint in the backend
      // await authService.requestPasswordReset(email);
      // For now, we'll just show success message
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (error) {
      onError(error.toString());
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="auth_form" onSubmit={handleSubmit}>
      <h3>Reset Password</h3>
      <p className="form_description">
        Enter your email address and we'll send you instructions to reset your password.
      </p>
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
        type="email"
        placeholder="Email"
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Sending instructions...' : 'Send Reset Instructions'}
      </button>
      <button 
        type="button" 
        className="back_to_login" 
        onClick={onBack}
        disabled={isLoading}
      >
        Back to Login
      </button>
    </form>
  );
}

export default Login;
