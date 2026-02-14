
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
    // No modo demo, aceitamos qualquer e-mail institucional @escola.com.br
    return lowerEmail.endsWith('@escola.com.br') || MANAGEMENT_EMAILS.includes(lowerEmail);
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
          const { data: authorized, error: authCheckError } = await (window as any).supabase
            .from('authorized_professors')
            .select('email')
            .eq('email', displayEmail.toLowerCase().trim())
            .single();

          if (!authorized && !isProfessorRegistered(displayEmail)) {
            console.error('❌ [LOGIN] E-mail não autorizado no banco:', displayEmail);
            await supabase.auth.signOut();
            throw new Error('ACESSO NEGADO: SEU E-MAIL NÃO ESTÁ AUTORIZADO NA PLATAFORMA. CONTATE A GESTÃO.');
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
          const { data: authorized } = await (window as any).supabase
            .from('authorized_professors')
            .select('email')
            .eq('email', lowerEmail)
            .single();

          if (!authorized && !isProfessorRegistered(lowerEmail)) {
            console.error('❌ [CADASTRO] E-mail não autorizado:', lowerEmail);
            await supabase.auth.signOut();
            throw new Error('ACESSO NEGADO: SEU E-MAIL NÃO ESTÁ AUTORIZADO. CONTATE A GESTÃO.');
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

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#000d1a] p-4 font-sans relative overflow-hidden fixed inset-0">
      <div className="absolute inset-0 bg-gradient-to-br from-[#000d1a] via-[#001a35] to-[#002b5c] opacity-100"></div>

      <div className="w-full max-w-[440px] bg-white rounded-[60px] shadow-[0_40px_80px_rgba(0,0,0,0.7)] flex flex-col items-center z-10 relative py-10 px-10 border border-white/10 animate-fade-in overflow-y-auto max-h-[95vh] custom-scrollbar">

        <div className="mb-4 mt-2 relative">
          <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full"></div>
          <img src={LOGO_PEP_CIRCULAR} alt="PEP Logo" className="w-20 h-20 object-contain relative z-10 drop-shadow-2xl" />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-[#002b5c] text-lg font-black uppercase tracking-tight">
            {authMode === 'login' ? 'PORTAL Plataforma Pro' : authMode === 'register' ? 'CRIAR NOVA CONTA' : 'RECUPERAR ACESSO'}
          </h1>
          <div className="h-1.5 w-10 bg-teal-500 mx-auto mt-2 rounded-full"></div>
          <p className="text-gray-400 text-[8px] font-black uppercase tracking-[0.4em] mt-3">
            SISTEMA DE GESTÃO 2026
          </p>
        </div>

        {authMode === 'login' && (
          <form onSubmit={handleLogin} className="w-full space-y-4 flex flex-col items-center animate-fade-in">
            <div className="space-y-1 w-full text-left">
              <label className="text-[9px] font-black text-[#002b5c] uppercase ml-6 tracking-widest opacity-70">E-mail Institucional</label>
              <input
                required
                type="email"
                placeholder="nome@escola.com.br"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-12 px-6 bg-gray-50 border border-gray-100 rounded-full text-xs font-bold text-[#002b5c] outline-none focus:ring-2 focus:ring-teal-500 transition-all lowercase"
              />
            </div>

            <div className="space-y-1 w-full text-left">
              <div className="flex justify-between items-center px-6">
                <label className="text-[9px] font-black text-[#002b5c] uppercase tracking-widest opacity-70">Senha</label>
                <button type="button" onClick={() => setAuthMode('forgot')} className="text-[8px] font-black text-teal-600 uppercase hover:underline">Esqueci a senha</button>
              </div>
              <input
                required
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-12 px-6 bg-gray-50 border border-gray-100 rounded-full text-xs font-bold text-[#002b5c] outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              />
            </div>

            {error && <div className="p-3 w-full bg-red-50 text-red-600 rounded-[24px] text-[8.5px] font-black text-center uppercase border border-red-100 animate-shake leading-tight">{error}</div>}
            {message && <div className="p-3 w-full bg-teal-50 text-teal-600 rounded-[24px] text-[8.5px] font-black text-center uppercase border border-teal-100 leading-tight">{message}</div>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-gradient-to-r from-blue-400 to-blue-900 hover:scale-[1.02] text-white rounded-full font-black text-[10px] uppercase tracking-[0.25em] shadow-xl transition-all active:scale-95 disabled:opacity-50 mt-4"
            >
              {isLoading ? 'VERIFICANDO...' : 'ENTRAR NO PORTAL'}
            </button>

            <button
              type="button"
              onClick={() => { setAuthMode('register'); setError(''); setMessage(''); }}
              className="mt-4 text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-[#002b5c] transition-colors"
            >
              Primeiro acesso? <span className="text-teal-600">Cadastre-se aqui</span>
            </button>
          </form>
        )}

        {authMode === 'register' && (
          <form onSubmit={handleRegister} className="w-full space-y-3 flex flex-col items-center animate-fade-in">
            <div className="space-y-1 w-full text-left">
              <label className="text-[9px] font-black text-[#002b5c] uppercase ml-6 tracking-widest opacity-70">E-mail Institucional</label>
              <input required type="email" placeholder="nome@escola.com.br" value={email} onChange={e => setEmail(e.target.value)} className="w-full h-11 px-6 bg-gray-50 border border-gray-100 rounded-full text-xs font-bold text-[#002b5c] outline-none focus:ring-2 focus:ring-teal-500 transition-all lowercase" />
            </div>
            <div className="space-y-1 w-full text-left">
              <label className="text-[9px] font-black text-[#002b5c] uppercase ml-6 tracking-widest opacity-70">Criar Senha</label>
              <input required type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} className="w-full h-11 px-6 bg-gray-50 border border-gray-100 rounded-full text-xs font-bold text-[#002b5c] outline-none focus:ring-2 focus:ring-teal-500 transition-all" />
            </div>
            <div className="space-y-1 w-full text-left">
              <label className="text-[9px] font-black text-[#002b5c] uppercase ml-6 tracking-widest opacity-70">Confirmar Senha</label>
              <input required type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full h-11 px-6 bg-gray-50 border border-gray-100 rounded-full text-xs font-bold text-[#002b5c] outline-none focus:ring-2 focus:ring-teal-500 transition-all" />
            </div>

            {error && <div className="p-3 w-full bg-red-50 text-red-600 rounded-[24px] text-[8.5px] font-black text-center uppercase border border-red-100 leading-tight">{error}</div>}
            {message && <div className="p-3 w-full bg-teal-50 text-teal-600 rounded-[24px] text-[8.5px] font-black text-center uppercase border border-teal-100 leading-tight">{message}</div>}

            <button type="submit" disabled={isLoading} className="w-full h-14 bg-gradient-to-r from-teal-400 to-teal-700 hover:scale-[1.02] text-white rounded-full font-black text-[10px] uppercase tracking-[0.25em] shadow-xl transition-all active:scale-95 disabled:opacity-50 mt-4">
              {isLoading ? 'CRIANDO CONTA...' : 'CRIAR MINHA CONTA'}
            </button>

            <button type="button" onClick={() => { setAuthMode('login'); setError(''); setMessage(''); }} className="mt-4 text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-[#002b5c] transition-colors">
              Já tem conta? <span className="text-teal-600">Voltar para o Login</span>
            </button>
          </form>
        )}

        {authMode === 'forgot' && (
          <form onSubmit={handleResetPassword} className="w-full space-y-6 flex flex-col items-center animate-fade-in">
            <div className="text-center px-4">
              <p className="text-[9px] font-bold text-gray-400 uppercase leading-relaxed">Insira seu e-mail institucional abaixo para receber as instruções de redefinição.</p>
            </div>
            <div className="space-y-1 w-full text-left">
              <label className="text-[9px] font-black text-[#002b5c] uppercase ml-6 tracking-widest opacity-70">E-mail Institucional</label>
              <input required type="email" placeholder="nome@escola.com.br" value={email} onChange={e => setEmail(e.target.value)} className="w-full h-12 px-6 bg-gray-50 border border-gray-100 rounded-full text-xs font-bold text-[#002b5c] outline-none focus:ring-2 focus:ring-teal-500 transition-all lowercase" />
            </div>

            {error && <div className="p-3 w-full bg-red-50 text-red-600 rounded-[24px] text-[8.5px] font-black text-center uppercase border border-red-100 leading-tight">{error}</div>}
            {message && <div className="p-3 w-full bg-teal-50 text-teal-600 rounded-[24px] text-[8.5px] font-black text-center uppercase border border-teal-100 leading-tight">{message}</div>}

            <button type="submit" disabled={isLoading} className="w-full h-14 bg-gradient-to-r from-orange-400 to-orange-700 hover:scale-[1.02] text-white rounded-full font-black text-[10px] uppercase tracking-[0.25em] shadow-xl transition-all active:scale-95 disabled:opacity-50 mt-4">
              {isLoading ? 'ENVIANDO...' : 'ENVIAR INSTRUÇÕES'}
            </button>

            <button type="button" onClick={() => { setAuthMode('login'); setError(''); setMessage(''); }} className="mt-4 text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-[#002b5c] transition-colors">
              Lembrei a senha! <span className="text-teal-600">Voltar</span>
            </button>
          </form>
        )}

        <div className="mt-8 text-center w-full">
          <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest leading-relaxed">
            ESTE PORTAL É DE USO EXCLUSIVO DA CONTA DEMO<br />PLATAFORMA ESCOLAR PRO
          </p>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-50 w-full text-center">
          <p className="text-[9px] font-bold text-gray-200 uppercase tracking-widest">SECRETARIA DA EDUCAÇÃO DO ESTADO DE SÃO PAULO</p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default Login;

