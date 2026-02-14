
import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import { supabase } from '../services/supabaseClient';
import { PROFESSORS_DB, isProfessorRegistered, getProfessorNameFromEmail } from '../professorsData';

interface LoginProps {
  onLogin: (user: User) => void;
}

type AuthMode = 'login' | 'register' | 'forgot';

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = 'auto';
      document.body.style.overflow = 'auto';
    };
  }, []);

  // Mapeamento de aliases de e-mail (Opcional)
  const EMAIL_ALIASES: Record<string, string> = {};

  // E-mails de gestão permitidos para demonstração
  const MANAGEMENT_EMAILS = [
    'gestor@escola.com.br'
  ];

  const resolveEmailAlias = (email: string): string => {
    const lowerEmail = email.toLowerCase().trim();
    return EMAIL_ALIASES[lowerEmail] || lowerEmail;
  };

  const validateInstitutionalEmail = (email: string) => {
    const lowerEmail = email.toLowerCase().trim();
    // No modo demo, aceitamos o domínio fictício e o domínio real institucional de SP
    const institutionalDomains = ['@escola.com.br', '@prof.educacao.sp.gov.br', '@educacao.sp.gov.br'];
    return institutionalDomains.some(domain => lowerEmail.endsWith(domain)) || MANAGEMENT_EMAILS.includes(lowerEmail);
  };

  const registeredName = useMemo(() => {
    if (authMode === 'register' && email.includes('@')) {
      return getProfessorNameFromEmail(email);
    }
    return '';
  }, [email, authMode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const lowerEmail = email.toLowerCase().trim();
      const displayEmail = lowerEmail; // Email que o usuário digitou (para exibição)
      const authEmail = resolveEmailAlias(lowerEmail); // Email real para autenticação

      console.log('🔐 [LOGIN] Tentando login com:', displayEmail);
      if (displayEmail !== authEmail) {
        console.log('🔄 [LOGIN] Usando alias: ' + displayEmail + ' → ' + authEmail);
      }

      if (!validateInstitutionalEmail(lowerEmail)) {
        throw new Error('ACESSO NEGADO: UTILIZE SEU E-MAIL INSTITUCIONAL (@PROF).');
      }

      console.log('✅ [LOGIN] E-mail validado como institucional');
      console.log('🔗 [LOGIN] Conectando ao Supabase...');

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail, // Usa o email real para autenticação
        password
      });

      console.log('📊 [LOGIN] Resposta do Supabase:', {
        hasData: !!data,
        hasUser: !!data?.user,
        hasError: !!authError,
        errorMessage: authError?.message,
        errorStatus: authError?.status
      });

      if (authError) {
        console.error('❌ [LOGIN] Erro de autenticação:', authError);
        if (authError.message.includes('Invalid login credentials')) {
          throw new Error('CREDENCIAIS INVÁLIDAS. VERIFIQUE SEUS DADOS OU SE JÁ CONFIRMOU SEU E-MAIL NO LINK ENVIADO (VERIFIQUE TAMBÉM A PASTA DE SPAM).');
        }
        throw new Error(authError.message.toUpperCase());
      }

      if (data.user) {
        console.log('✅ [LOGIN] Login bem-sucedido! Usuário:', data.user.email);

        // VALIDAÇÃO DE WHITELIST: Verifica no banco de dados
        // E-mails de gestão são isentos da verificação de whitelist
        if (!MANAGEMENT_EMAILS.includes(displayEmail)) {
          // No modo demo, se for um e-mail institucional válido, permitimos o acesso
          // A verificação de whitelist no banco é ignorada para facilitar a apresentação
          const isInstitutional = validateInstitutionalEmail(displayEmail);

          if (!isInstitutional && !isProfessorRegistered(displayEmail)) {
            console.error('❌ [LOGIN] E-mail não autorizado:', displayEmail);
            await supabase.auth.signOut();
            throw new Error('ACESSO NEGADO: UTILIZE UM E-MAIL INSTITUCIONAL PARA ACESSAR A DEMO.');
          }
        }

        console.log('✅ [LOGIN] Acesso autorizado!');
        // Define role baseado no email que o usuário digitou (display), não no email real
        const role = MANAGEMENT_EMAILS.includes(displayEmail) ? 'gestor' : 'professor';
        onLogin({ email: displayEmail, role }); // Usa o email de display para manter a experiência
      }

    } catch (err: any) {
      console.error('❌ [LOGIN] Erro capturado:', err);
      setError(err.message.toUpperCase());
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const lowerEmail = email.toLowerCase().trim();

      if (!validateInstitutionalEmail(lowerEmail)) {
        throw new Error('APENAS E-MAILS INSTITUCIONAIS (@PROF) SÃO PERMITIDOS.');
      }

      if (password !== confirmPassword) {
        throw new Error('AS SENHAS NÃO CONFEREM.');
      }

      if (password.length < 6) {
        throw new Error('A SENHA DEVE TER NO MÍNIMO 6 CARACTERES.');
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: lowerEmail,
        password,
      });

      if (signUpError) {
        if (signUpError.message.includes('User already registered')) {
          throw new Error('ESTE E-MAIL JÁ POSSUI CADASTRO NO SISTEMA.');
        }
        throw signUpError;
      }

      if (data.user) {
        // VALIDAÇÃO DE WHITELIST: Verifica no banco de dados
        // E-mails de gestão são isentos da verificação de whitelist
        if (!MANAGEMENT_EMAILS.includes(lowerEmail)) {
          // No modo demo, o registro de qualquer e-mail institucional é permitido automaticamente
          if (!validateInstitutionalEmail(lowerEmail) && !isProfessorRegistered(lowerEmail)) {
            console.error('❌ [CADASTRO] E-mail não autorizado:', lowerEmail);
            await supabase.auth.signOut();
            throw new Error('UTILIZE UM E-MAIL INSTITUCIONAL PARA SE CADASTRAR NA DEMO.');
          }
        }

        // Com confirmação de e-mail desabilitada, o login é automático
        console.log('✅ [CADASTRO] Usuário criado e autenticado automaticamente');
        setMessage('CADASTRO REALIZADO! ENTRANDO NO SISTEMA...');
        const role = MANAGEMENT_EMAILS.includes(lowerEmail) ? 'gestor' : 'professor';
        setTimeout(() => onLogin({ email: data.user!.email!, role }), 1000);
      }

    } catch (err: any) {
      setError(err.message.toUpperCase());
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const lowerEmail = email.toLowerCase().trim();
      const authEmail = resolveEmailAlias(lowerEmail); // Resolve para o email real

      if (!validateInstitutionalEmail(lowerEmail)) {
        throw new Error('E-MAIL INVÁLIDO OU NÃO INSTITUCIONAL.');
      }

      // Verifica se o professor está cadastrado antes de enviar reset
      // E-mails de gestão são isentos da verificação de whitelist
      if (!MANAGEMENT_EMAILS.includes(lowerEmail) && !isProfessorRegistered(lowerEmail)) {
        throw new Error('E-MAIL NÃO CADASTRADO NO SISTEMA. CONTATE A GESTÃO.');
      }

      console.log('🔄 [RESET] Enviando redefinição de senha para:', authEmail);
      if (lowerEmail !== authEmail) {
        console.log('📧 [RESET] Alias detectado: ' + lowerEmail + ' → ' + authEmail);
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(authEmail, {
        redirectTo: window.location.origin,
      });

      if (resetError) {
        console.error('❌ [RESET] Erro ao enviar e-mail:', resetError);

        // Verifica se é erro de SMTP do Resend (Test Mode)
        if (resetError.message.includes('450') || resetError.message.includes('testing emails')) {
          throw new Error('O SERVIÇO DE E-MAIL ESTÁ EM MODO DE TESTE. O DOMÍNIO PRECISA SER VERIFICADO NO RESEND.');
        }

        throw new Error('ERRO AO PROCESSAR SOLICITAÇÃO. VERIFIQUE A CONFIGURAÇÃO SMTP NO SUPABASE OU TENTE NOVAMENTE.');
      }

      setMessage('SE O E-MAIL EXISTIR NO SISTEMA, VOCÊ RECEBERÁ AS INSTRUÇÕES EM BREVE.');
      console.log('✅ [RESET] Solicitação processada para:', lowerEmail);

    } catch (err: any) {
      setError(err.message.toUpperCase());
    } finally {
      setIsLoading(false);
    }
  };

  const LOGO_PEP_CIRCULAR = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjqAsB6ThMLLLLsuZ2yx8qAn8Koh4k4naDt3dSMtnPRxb_wWFP84Ve5mnuUTBLP2COJAi8cfYMRrN0qWKyUFJV8pjQXbhrLb2yc2K8mJ5qsqsSCor4fJcdl2IDn-Xtqtqc31I-5_BWai_JljBZIMRVr-SB5vW04GE8gefLARCWrun9gIx10lkCVN6coAV24/s229/images-removebg-preview.png";

  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[radial-gradient(circle,_#3b82f6_0%,_#1e3a8a_100%)] p-4 font-sans relative overflow-hidden fixed inset-0">
      {/* Decorative Icons (Top Right) */}
      <div className="absolute top-10 right-10 opacity-10 pointer-events-none select-none">
        <svg width="200" height="150" viewBox="0 0 200 150" fill="white">
          <path d="M10,140 L10,100 L40,100 L40,140 Z M50,140 L50,80 L80,80 L80,140 Z M90,140 L90,60 L120,60 L120,140 Z M130,140 L130,40 L160,40 L160,140 Z" />
          <path transform="translate(170, 40) scale(0.5)" d="M100 25c-41.42 0-75 33.58-75 75s33.58 75 75 75 75-33.58 75-75-33.58-75-75-75zm0 135c-33.14 0-60-26.86-60-60s26.86-60 60-60 60 26.86 60 60-26.86 60-60 60zM100 60c-22.09 0-40 17.91-40 40s17.91 40 40 40 40-17.91 40-40-17.91-40-40-40z" />
          <path transform="translate(130, -10) scale(0.4)" d="M100 25c-41.42 0-75 33.58-75 75s33.58 75 75 75 75-33.58 75-75-33.58-75-75-75zm0 135c-33.14 0-60-26.86-60-60s26.86-60 60-60 60 26.86 60 60-26.86 60-60 60z" />
        </svg>
      </div>

      <div className="flex flex-col items-center w-full max-w-[480px] z-10">
        <h1 className="text-white text-4xl font-bold mb-10 tracking-tight drop-shadow-lg">
          Bem-vindo ao Sistema
        </h1>

        <div className="w-full bg-[#0d47a1]/40 backdrop-blur-md rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 p-8 flex flex-col items-center animate-fade-in relative">

          <h2 className="text-white text-xl font-semibold mb-8 uppercase tracking-wider border-b border-white/10 w-full text-center pb-4">
            Acesso ao Sistema
          </h2>

          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="w-full space-y-6 flex flex-col items-center">
              {/* Usuário */}
              <div className="w-full space-y-2">
                <div className="flex items-center space-x-2 px-1">
                  <svg className="w-4 h-4 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  <label className="text-[13px] font-medium text-white/90">Usuário</label>
                </div>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 group-focus-within:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    required
                    type="email"
                    placeholder="Digite seu usuário"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full h-12 pl-12 pr-4 bg-white/10 border border-white/20 rounded-[8px] text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white/20 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="w-full space-y-2">
                <div className="flex items-center space-x-2 px-1">
                  <svg className="w-4 h-4 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <label className="text-[13px] font-medium text-white/90">Senha</label>
                </div>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 group-focus-within:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full h-12 pl-12 pr-20 bg-white/10 border border-white/20 rounded-[8px] text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white/20 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white/90 text-[10px] px-3 py-1 rounded border border-white/20 transition-all"
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              {error && <div className="p-3 w-full bg-red-500/20 text-red-100 rounded-[8px] text-xs font-medium text-center border border-red-500/30 animate-shake">{error}</div>}
              {message && <div className="p-3 w-full bg-blue-500/20 text-blue-100 rounded-[8px] text-xs font-medium text-center border border-blue-500/30">{message}</div>}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 bg-gradient-to-b from-[#42a5f5] to-[#1e88e5] hover:from-[#1e88e5] hover:to-[#1565c0] text-white rounded-[12px] font-bold text-lg shadow-[0_4px_15px_rgba(0,0,0,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 mt-4 active:shadow-inner"
              >
                {isLoading ? 'Acessando...' : 'Entrar'}
              </button>

              <button
                type="button"
                onClick={() => setAuthMode('forgot')}
                className="text-[13px] font-medium text-white/70 hover:text-white transition-colors"
              >
                Esqueceu sua senha?
              </button>

              <button
                type="button"
                onClick={() => { setAuthMode('register'); setError(''); setMessage(''); }}
                className="text-[11px] font-medium text-white/50 hover:text-white transition-colors mt-2"
              >
                Novo por aqui? <span className="text-blue-300">Criar uma conta demo</span>
              </button>
            </form>
          )}

          {authMode === 'register' && (
            <form onSubmit={handleRegister} className="w-full space-y-4 flex flex-col items-center animate-fade-in">
              <div className="w-full space-y-2">
                <label className="text-[13px] font-medium text-white/90 px-1">E-mail Institucional</label>
                <input required type="email" placeholder="nome@escola.com.br" value={email} onChange={e => setEmail(e.target.value)} className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-[8px] text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-400 transition-all" />
              </div>
              <div className="w-full space-y-2">
                <label className="text-[13px] font-medium text-white/90 px-1">Senha</label>
                <input required type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-[8px] text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-400 transition-all" />
              </div>
              <div className="w-full space-y-2">
                <label className="text-[13px] font-medium text-white/90 px-1">Confirmar Senha</label>
                <input required type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-[8px] text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-400 transition-all" />
              </div>

              {error && <div className="p-3 w-full bg-red-500/20 text-red-100 rounded-[8px] text-xs font-medium text-center border border-red-500/30">{error}</div>}

              <button type="submit" disabled={isLoading} className="w-full h-14 bg-gradient-to-b from-[#66bb6a] to-[#43a047] text-white rounded-[12px] font-bold text-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 mt-4">
                {isLoading ? 'Cadastrando...' : 'Criar Conta'}
              </button>

              <button type="button" onClick={() => { setAuthMode('login'); setError(''); setMessage(''); }} className="text-[13px] font-medium text-white/70 hover:text-white transition-colors">
                Voltar para o Login
              </button>
            </form>
          )}

          {authMode === 'forgot' && (
            <form onSubmit={handleResetPassword} className="w-full space-y-6 flex flex-col items-center animate-fade-in">
              <p className="text-[13px] font-medium text-white/70 text-center px-4">Insira seu e-mail para receber as instruções.</p>
              <div className="w-full space-y-2">
                <label className="text-[13px] font-medium text-white/90 px-1">E-mail Institucional</label>
                <input required type="email" placeholder="nome@escola.com.br" value={email} onChange={e => setEmail(e.target.value)} className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-[8px] text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-400 transition-all" />
              </div>

              {error && <div className="p-3 w-full bg-red-500/20 text-red-100 rounded-[8px] text-xs font-medium text-center border border-red-500/30">{error}</div>}
              {message && <div className="p-3 w-full bg-blue-500/20 text-blue-100 rounded-[8px] text-xs font-medium text-center border border-blue-500/30">{message}</div>}

              <button type="submit" disabled={isLoading} className="w-full h-14 bg-gradient-to-b from-[#ffa726] to-[#f57c00] text-white rounded-[12px] font-bold text-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 mt-4">
                {isLoading ? 'Enviando...' : 'Enviar Instruções'}
              </button>

              <button type="button" onClick={() => { setAuthMode('login'); setError(''); setMessage(''); }} className="text-[13px] font-medium text-white/70 hover:text-white transition-colors">
                Lembrei a senha
              </button>
            </form>
          )}

        </div>

        <div className="mt-12 flex flex-col items-center w-full">
          <div className="h-[1px] w-full bg-white/10 mb-4"></div>
          <p className="text-white/60 text-[11px] tracking-wide">
            &copy; 2024 - Todos os direitos reservados.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        .animate-shake { animation: shake 0.2s ease-in-out forwards; }
      `}</style>
    </div>
  );
};

export default Login;

