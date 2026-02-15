
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProfessorView from './components/ProfessorView';
import ResetPassword from './components/ResetPassword';
import { Incident, User, Student } from './types';

import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { STUDENTS_DB } from './studentsData';
import { saveToGoogleSheets, loadStudentsFromSheets } from './services/sheetsService';
import { isProfessorRegistered } from './professorsData';

// E-mails de gestão permitidos para demonstração
const MANAGEMENT_EMAILS = [
  'gestao@escola.com'
];

// E-mail com acesso dual (gestor + professor) para demonstração
const DUAL_ACCESS_EMAIL = 'gestao@escola.com';

type View = 'login' | 'dashboard' | 'resetPassword';
type ViewMode = 'gestor' | 'professor';

const App: React.FC = () => {
  const [view, setView] = useState<View>('login');
  const [user, setUser] = useState<User | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado para controlar visualização (gestor/professor) para usuários com acesso dual
  const [viewMode, setViewMode] = useState<ViewMode>('gestor');

  const [searchModalOpen, setSearchModalOpen] = useState(false);

  useEffect(() => {
    let authListener: any = null;

    const initApp = async () => {
      // 1. Carregar cache de incidentes
      const cached = localStorage.getItem('PEP_incidents_cache');
      if (cached) setIncidents(JSON.parse(cached));

      if (isSupabaseConfigured && supabase) {
        try {
          // O link de recuperação contém access_token ou type=recovery
          let isDuringRecovery = window.location.hash.includes('type=recovery') ||
            window.location.hash.includes('access_token=');

          if (isDuringRecovery) {
            console.log('🔑 [APP] MODO RECUPERAÇÃO ATIVADO - Bloqueando redirecionamentos');
            setView('resetPassword');
          }

          // 3. Listener de mudanças de estado (Auth)
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('🔔 [AUTH] Evento:', event, 'Sessão:', !!session);

            if (event === 'PASSWORD_RECOVERY') {
              isDuringRecovery = true;
              console.log('🔐 [APP] Redirecionando para tela de redefinição...');
              setView('resetPassword');
              return;
            }

            if (session?.user) {
              if (isDuringRecovery) {
                console.log('🛡️ [APP] Bloqueio de Segurança: Ignorando redirect para Dashboard durante recuperação');
                setView('resetPassword');
                return;
              }

              if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                const email = session.user.email!.toLowerCase();
                if (isProfessorRegistered(email)) {
                  const role = MANAGEMENT_EMAILS.includes(email) ? 'gestor' : 'professor';
                  setUser({ email, role });
                  setView('dashboard');
                } else {
                  console.warn('⚠️ [APP] Usuário não autorizado:', email);
                  await supabase.auth.signOut();
                  setUser(null);
                  setView('login');
                }
              }
            } else if (event === 'SIGNED_OUT') {
              isDuringRecovery = false;
              setUser(null);
              setView('login');
            }
          });

          authListener = subscription;

          // 4. Verificação inicial da sessão
          if (!isDuringRecovery) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              const email = session.user.email!.toLowerCase();
              if (isProfessorRegistered(email)) {
                const role = MANAGEMENT_EMAILS.includes(email) ? 'gestor' : 'professor';
                setUser({ email, role });
                setView('dashboard');
              }
            }
          }
        } catch (e) {
          console.warn("Erro ao inicializar auth:", e);
        }
      }
      setLoading(false);
    };

    initApp();

    return () => {
      if (authListener) authListener.unsubscribe();
    };
  }, []); // Sem dependência de [view] para evitar loop

  useEffect(() => {
    const loadStudentsData = async () => {
      console.log('🛡️ [DEMO] Forçando carregamento de dados mock para modo apresentação');

      // Limpar caches antigos se existirem
      localStorage.removeItem('PEP_students_cache');

      const finalStudents = STUDENTS_DB;
      console.log(`✅ Local: Usando ${STUDENTS_DB.length} alunos (studentsData.ts)`);

      setStudents(finalStudents);

      // Gerar lista de turmas dinamicamente
      const uniqueClasses = Array.from(new Set(finalStudents.map(s => s.turma)));
      const sortedClasses = uniqueClasses.sort((a, b) => {
        const getOrder = (s: string) => {
          // Normaliza: remove acentos e caracteres especiais, mantendo apenas letras e números
          const norm = s.toUpperCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove acentos
            .replace(/[^A-Z0-9]/g, '');      // Mantém apenas letras e números

          if (norm.includes('6ANO')) return 1;
          if (norm.includes('7ANO')) return 2;
          if (norm.includes('8ANO')) return 3;
          if (norm.includes('9ANO')) return 4;
          if (norm.includes('1SERIE')) return 5;
          if (norm.includes('2SERIE')) return 6;
          if (norm.includes('3SERIE')) return 7;
          return 99;
        };

        const orderA = getOrder(a);
        const orderB = getOrder(b);

        if (orderA !== orderB) return orderA - orderB;
        return a.localeCompare(b, 'pt-BR', { numeric: true });
      });

      setClasses(sortedClasses);
    };

    loadStudentsData();
    (window as any).refreshStudents = () => loadStudentsData();
  }, [user]);

  // Sincronização desabilitada na versão demo
  const handleSyncStudents = async () => { };

  useEffect(() => {
    if (user) loadCloudIncidents();
  }, [user]);

  const loadCloudIncidents = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const { data: incData, error } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && incData) {
        const mapped: Incident[] = incData.map(i => ({
          id: i.id,
          studentName: i.student_name,
          ra: i.ra,
          classRoom: i.class_room,
          professorName: i.professor_name,
          discipline: i.discipline,
          date: i.date,
          time: i.time,
          registerDate: i.register_date,
          returnDate: i.return_date,
          description: i.description,
          irregularities: i.irregularities,
          category: i.category,
          severity: i.severity as any,
          status: i.status as any,
          source: i.source as any,
          pdfUrl: i.pdf_url,
          authorEmail: i.author_email,
          managementFeedback: i.management_feedback,
          lastViewedAt: i.last_viewed_at
        }));
        setIncidents(mapped);
        localStorage.setItem('PEP_incidents_cache', JSON.stringify(mapped));
      }
    } catch (e) { console.warn("Sincronização offline."); }
  };

  const handleSaveIncident = async (newIncident: Incident | Incident[]) => {
    if (!user) return;
    const items = (Array.isArray(newIncident) ? newIncident : [newIncident]).map(i => ({
      ...i, authorEmail: user.email
    }));

    // Atualização otimista
    const updatedList = [...items, ...incidents];
    setIncidents(updatedList);
    localStorage.setItem('PEP_incidents_cache', JSON.stringify(updatedList));

    let hasError = false;

    // Importação dinâmica para evitar circular dependency ou carregar desnecessariamente
    const { uploadPDFToStorage } = await import('./services/pdfService');

    for (let item of items) {
      try {
        // 1. Verificar se precisa gerar PDF (se ainda não tem pdfUrl)
        if (!item.pdfUrl) {
          console.log(`📄 Gerando PDF para: ${item.studentName}`);
          const uploadedUrl = await uploadPDFToStorage(item);
          if (uploadedUrl) {
            item.pdfUrl = uploadedUrl;
            // Atualizar no cache também
            const cacheUpdate = updatedList.map(inc => inc.id === item.id ? { ...inc, pdfUrl: uploadedUrl } : inc);
            setIncidents(cacheUpdate);
            localStorage.setItem('PEP_incidents_cache', JSON.stringify(cacheUpdate));
          }
        }

        // 2. Salvar no Google Sheets
        await saveToGoogleSheets(item);

        // 3. Salvar no Supabase
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.from('incidents').insert({
            id: item.id,
            student_name: item.studentName,
            ra: item.ra,
            class_room: item.classRoom,
            professor_name: item.professorName,
            discipline: item.discipline,
            date: item.date,
            time: item.time,
            register_date: item.registerDate,
            return_date: item.returnDate,
            description: item.description,
            irregularities: item.irregularities,
            category: item.category,
            severity: item.severity,
            status: item.status,
            source: item.source,
            pdf_url: item.pdfUrl,
            author_email: item.authorEmail
          });

          if (error) {
            console.error("❌ [SUPABASE] Erro ao salvar incidente:", error.message);
            hasError = true;
          }
        }
      } catch (err) {
        console.error("❌ [ERROR] Falha na persistência:", err);
        hasError = true;
      }
    }

    if (hasError) {
      alert("⚠️ ALERTA: Alguns registros foram salvos localmente, mas podem não ter sido sincronizados com o servidor. Verifique sua conexão.");
    }
  };

  const handleDeleteIncident = async (id: string) => {
    const inc = incidents.find(i => i.id === id);
    if (!inc || !user) return;

    if (inc.authorEmail && inc.authorEmail !== user.email && user.role !== 'gestor') {
      alert("ACESSO NEGADO: Você só pode excluir seus próprios registros.");
      return;
    }

    if (!window.confirm("CONFIRMAR EXCLUSÃO PERMANENTE?")) return;

    // Backup para rollback em caso de erro
    const previousIncidents = [...incidents];

    // Filtro otimista na UI
    const filtered = incidents.filter(i => i.id !== id);
    setIncidents(filtered);
    localStorage.setItem('PEP_incidents_cache', JSON.stringify(filtered));

    if (isSupabaseConfigured && supabase) {
      try {
        console.log(`🗑️ [DELETE] Tentando excluir incidente: ${id}`);
        const { error } = await supabase.from('incidents').delete().eq('id', id);

        if (error) {
          console.error('❌ [DELETE] Erro ao excluir do banco:', error);
          // Rollback em caso de erro de permissão ou rede
          setIncidents(previousIncidents);
          localStorage.setItem('PEP_incidents_cache', JSON.stringify(previousIncidents));

          if (error.message.includes('permission denied')) {
            alert("ERRO DE PERMISSÃO: O banco de dados não permitiu a exclusão. Verifique se você é o autor ou se tem nível de Gestor.");
          } else {
            alert(`Ocorreu um erro ao excluir do servidor: ${error.message}`);
          }
        } else {
          console.log('✅ [DELETE] Excluído com sucesso do banco de dados');
        }
      } catch (err) {
        console.error('❌ [DELETE] Erro inesperado:', err);
        setIncidents(previousIncidents);
        localStorage.setItem('PEP_incidents_cache', JSON.stringify(previousIncidents));
        alert("Erro de conexão ao tentar excluir. O registro foi restaurado.");
      }
    }
  };

  const handleUpdateIncident = async (updated: Incident) => {
    if (!user) return;

    // Atualização local
    const newIncidents = incidents.map(i => i.id === updated.id ? updated : i);
    setIncidents(newIncidents);
    localStorage.setItem('PEP_incidents_cache', JSON.stringify(newIncidents));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('incidents')
          .update({
            status: updated.status,
            management_feedback: updated.managementFeedback,
            last_viewed_at: updated.lastViewedAt
          })
          .eq('id', updated.id);

        if (error) {
          console.error('❌ [UPDATE] Erro ao atualizar no banco:', error);
          alert(`Erro ao salvar atualização: ${error.message}`);
        } else {
          console.log('✅ [UPDATE] Atualizado com sucesso no banco');
        }
      } catch (err) {
        console.error('❌ [UPDATE] Erro inesperado:', err);
      }
    }
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase) await supabase.auth.signOut();
    setUser(null);
    setView('login');
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-gradient-to-br from-[#2c3e50] via-[#4a5568] to-[#1e3a8a] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-white text-[10px] font-black uppercase tracking-[0.3em]">Carregando GESTÃO PRO...</p>
      </div>
    );
  }

  if (view === 'login') return <Login onLogin={u => { setUser(u); setView('dashboard'); }} />;

  if (view === 'resetPassword') {
    return (
      <ResetPassword
        onComplete={async () => {
          // Após resetar senha, fazer logout e voltar para login
          if (isSupabaseConfigured && supabase) {
            await supabase.auth.signOut();
          }
          // Limpar hash da URL
          window.history.replaceState(null, '', window.location.pathname);
          setView('login');
        }}
        onCancel={async () => {
          // Cancelar reset, fazer logout e voltar para login
          if (isSupabaseConfigured && supabase) {
            await supabase.auth.signOut();
          }
          window.history.replaceState(null, '', window.location.pathname);
          setView('login');
        }}
      />
    );
  }

  const hasDualAccess = user?.email === DUAL_ACCESS_EMAIL;

  const handleToggleView = () => {
    setViewMode(prev => prev === 'gestor' ? 'professor' : 'gestor');
  };

  const commonProps = {
    user: user!,
    incidents: incidents,
    students: students,
    classes: classes,
    onSave: handleSaveIncident,
    onDelete: handleDeleteIncident,
    onUpdateIncident: handleUpdateIncident,
    onLogout: handleLogout,
    onOpenSearch: () => setSearchModalOpen(true),
    onSyncStudents: handleSyncStudents
  };

  // Determina qual visualização renderizar
  const shouldShowGestorView = hasDualAccess ? viewMode === 'gestor' : user?.role === 'gestor';

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#2c3e50] via-[#4a5568] to-[#1e3a8a]">
      {/* Botão de alternância para usuários com acesso dual */}
      {hasDualAccess && (
        <button
          onClick={handleToggleView}
          className="fixed top-4 right-4 z-50 bg-gradient-to-r from-blue-400 to-indigo-600 hover:from-blue-500 hover:to-indigo-700 text-white px-6 py-3 rounded-full font-black text-xs uppercase tracking-wider shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 border border-white/20"
          title={`Alternar para área ${viewMode === 'gestor' ? 'do professor' : 'da gestão'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          {viewMode === 'gestor' ? 'Ver como Professor' : 'Ver como Gestão'}
        </button>
      )}

      {shouldShowGestorView ? <Dashboard {...commonProps} /> : <ProfessorView {...commonProps} />}
    </div>
  );
};

export default App;

