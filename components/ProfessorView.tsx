
import React, { useState, useMemo, useEffect } from 'react';
import { Incident, User, Student } from '../types';
import { generateIncidentPDF, uploadPDFToStorage } from '../services/pdfService';
import { getProfessorNameFromEmail } from '../professorsData';
import StatusBadge from './StatusBadge';
import { supabase } from '../services/supabaseClient';

interface ProfessorViewProps {
  user: User;
  incidents: Incident[];
  students: Student[];
  classes: string[];
  onSave: (incident: Incident | Incident[]) => void;
  onDelete: (id: string) => void;
  onLogout: () => void;
  onSyncStudents?: () => Promise<void>;
  onRefresh?: () => void;
  isSyncing?: boolean;
}

const LISTA_IRREGULARIDADES = [
  'ATRASO', 'SEM MATERIAL', 'USO DE CELULAR', 'CONVERSA', 'DESRESPEITO',
  'INDISCIPLINA', 'DESACATO', 'SEM TAREFA', 'SAIU SEM PERMISSÃO'
];

const ProfessorView: React.FC<ProfessorViewProps> = ({
  user, incidents, students, classes, onSave, onDelete, onLogout, onSyncStudents,
  onRefresh, isSyncing
}) => {
  const [professorName, setProfessorName] = useState('');
  const [classRoom, setClassRoom] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [discipline, setDiscipline] = useState('');
  const [selectedIrregularities, setSelectedIrregularities] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [registerDate, setRegisterDate] = useState(new Date().toISOString().split('T')[0]);
  const [classification, setClassification] = useState('OCORRÊNCIA DISCIPLINAR');
  const [returnDate, setReturnDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para Busca no Histórico Permanente
  const [showPermanentSearch, setShowPermanentSearch] = useState(false);
  const [permanentSearchTerm, setPermanentSearchTerm] = useState('');
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<Student | null>(null);
  const [studentHistory, setStudentHistory] = useState<Incident[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const studentsInClass = useMemo(() => students.filter(a => a.turma === classRoom), [classRoom, students]);

  // Preenche automaticamente o nome do professor baseado no e-mail
  useEffect(() => {
    if (user?.email) {
      const autoName = getProfessorNameFromEmail(user.email);
      setProfessorName(autoName);
    }
  }, [user]);

  const fetchStudentHistory = async (student: Student) => {
    setIsLoadingHistory(true);
    setSelectedStudentForHistory(student);
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .eq('ra', student.ra)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setStudentHistory(data.map(i => ({
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
        })));
      }
    } catch (e) {
      console.error("Erro ao buscar histórico:", e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const filteredStudentsForSearch = useMemo(() => {
    if (!permanentSearchTerm) return [];
    return students.filter(s =>
      s.nome.toUpperCase().startsWith(permanentSearchTerm.toUpperCase())
    ).slice(0, 10);
  }, [students, permanentSearchTerm]);

  const toggleStudent = (nome: string) => {
    setSelectedStudents(prev =>
      prev.includes(nome) ? prev.filter(s => s !== nome) : [...prev, nome]
    );
  };

  const toggleIrregularity = (item: string) => {
    setSelectedIrregularities(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!professorName || !classRoom || selectedStudents.length === 0 || !description) {
      alert("Preencha Nome, Turma, selecione o(s) Aluno(s) e relate o fato.");
      return;
    }

    setIsSaving(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = registerDate.split('-').reverse().join('/');

    const newIncidents: Incident[] = selectedStudents.map((nome, index) => {
      const studentData = students.find(s => s.nome === nome && s.turma === classRoom);
      return {
        id: `prof-${Date.now()}-${index}`,
        date: formattedDate,
        professorName: professorName.toUpperCase(),
        classRoom,
        studentName: nome.toUpperCase(),
        ra: studentData ? studentData.ra : '---',
        discipline: (discipline || 'N/A').toUpperCase(),
        irregularities: selectedIrregularities.join(', ') || 'NENHUMA',
        description: description.toUpperCase(),
        time: timeStr,
        registerDate: formattedDate,
        returnDate: classification === 'MEDIDA EDUCATIVA' && returnDate ? returnDate.split('-').reverse().join('/') : undefined,
        category: classification,
        severity: 'Média',
        status: 'Pendente',
        source: 'professor',
        authorEmail: user.email
      } as Incident;
    });

    try {
      // Upload dos PDFs em paralelo
      console.log(`📤 Iniciando upload de ${newIncidents.length} PDFs...`);
      const pdfUrls = await Promise.all(
        newIncidents.map((inc, index) => {
          console.log(`📄 Upload ${index + 1}/${newIncidents.length}: ${inc.studentName}`);
          return uploadPDFToStorage(inc);
        })
      );

      // Atualizar cada incidente com sua URL
      let failedUploads = 0;
      newIncidents.forEach((inc, index) => {
        if (pdfUrls[index]) {
          inc.pdfUrl = pdfUrls[index];
          console.log(`✅ PDF ${index + 1}/${newIncidents.length} enviado:`, inc.studentName);
          console.log(`🔗 URL:`, pdfUrls[index]);
        } else {
          failedUploads++;
          console.warn(`⚠️ Falha no upload do PDF ${index + 1}/${newIncidents.length}:`, inc.studentName);
        }
      });

      if (failedUploads > 0) {
        alert(`⚠️ ATENÇÃO: ${failedUploads} PDF(s) não puderam ser gerados. Os registros serão salvos mas sem os links dos documentos.`);
      }

      onSave(newIncidents);
      alert(`${newIncidents.length} registros gravados.`);
      setSelectedStudents([]);
      setDescription('');
      setSelectedIrregularities([]);
      setReturnDate('');
    } catch (err) {
      console.error('❌ Erro ao salvar registros:', err);
      alert("Erro ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredHistory = useMemo(() => {
    const term = searchTerm.toLowerCase();

    // Se há busca ativa por aluno, mostrar histórico completo daquele aluno
    // Senão, mostrar apenas as ocorrências do professor logado
    let baseIncidents = incidents;

    if (!term) {
      // Sem busca: mostrar apenas minhas ocorrências
      baseIncidents = incidents.filter(i => i.authorEmail === user.email);
    }

    // Aplicar filtro de busca
    return baseIncidents.filter(i =>
      (i.studentName || "").toLowerCase().includes(term) ||
      (i.classRoom || "").toLowerCase().includes(term) ||
      (i.professorName || "").toLowerCase().includes(term)
    );
  }, [incidents, searchTerm, user.email]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2c3e50] via-[#4a5568] to-[#1e3a8a] font-sans pb-12 overflow-x-hidden">
      <header className="bg-gradient-to-r from-[#1e3a8a] to-[#0d47a1] text-white px-4 sm:px-8 py-4 flex flex-col sm:flex-row justify-between items-center sticky top-0 z-50 shadow-2xl gap-4 sm:gap-0 border-b border-white/10">
        <div className="flex flex-col items-center sm:items-start">
          <h1 className="text-sm font-black uppercase text-blue-300">GESTÃO PRO</h1>
          <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest">EQUIPE GESTORA</p>
        </div>
        <div className="flex gap-4 sm:gap-6 items-center">
          <span className="text-[10px] font-bold text-white/70">{user.email}</span>
          <button onClick={onLogout} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-5 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-lg transition-all">Sair</button>
          <button
            onClick={onRefresh}
            disabled={isSyncing}
            className={`bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl border border-white/20 transition-all ${isSyncing ? 'animate-pulse opacity-50' : 'active:scale-90'}`}
            title="Sincronizar com o Banco de Dados"
          >
            <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto mt-4 sm:mt-8 px-4 sm:px-6 space-y-8">
        <div className="bg-[#0f2862] rounded-3xl shadow-2xl overflow-hidden border border-white/10">
          <div className="bg-[#0d47a1] py-3 text-center border-b border-white/10">
            <h2 className="text-white font-black text-[10px] sm:text-xs uppercase tracking-widest">LANÇAMENTO DE REGISTROS DISCIPLINARES</h2>
          </div>
          <div className="p-4 sm:p-8 bg-gradient-to-b from-[#1e3a8a] via-[#0d47a1] to-black">
            <form onSubmit={handleSave} className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-black text-white uppercase block ml-2">PROFESSOR RESPONSÁVEL</label>
                  <input type="text" value={professorName} onChange={e => setProfessorName(e.target.value)} placeholder="SEU NOME" className="w-full h-11 px-4 rounded-xl text-xs font-bold uppercase !text-black bg-white shadow-inner outline-none focus:ring-2 focus:ring-orange-500 transition-all" />
                </div>
                <div className="w-full md:w-64 space-y-1">
                  <label className="text-[10px] font-black text-white uppercase block ml-2">TURMA / SÉRIE</label>
                  <select value={classRoom} onChange={e => { setClassRoom(e.target.value); setSelectedStudents([]); }} className="w-full h-11 px-4 rounded-xl text-xs font-bold !text-black bg-white shadow-inner outline-none focus:ring-2 focus:ring-orange-500 transition-all cursor-pointer">
                    <option value="">Selecione...</option>
                    {classes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center mb-2 px-2">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest">SELECIONE OS ALUNOS</label>
                  <span className="text-[9px] font-black text-white bg-black/30 px-3 py-1 rounded-full uppercase">{selectedStudents.length} selecionado(s)</span>
                </div>
                <div className="h-64 overflow-y-auto border-2 border-white/10 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-black/10 backdrop-blur-sm custom-scrollbar">
                  {studentsInClass.length > 0 ? studentsInClass.map((a, idx) => (
                    <label
                      key={a.ra}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer 
                        ${selectedStudents.includes(a.nome)
                          ? 'bg-[#003d7a] border-blue-400 text-white shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5)] translate-y-0.5'
                          : `${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/50'} border-white/10 text-black shadow-[4px_4px_10px_rgba(0,0,0,0.2),-2px_-2px_8px_rgba(255,255,255,0.1)] hover:bg-gray-50`}`}
                    >
                      <input type="checkbox" checked={selectedStudents.includes(a.nome)} onChange={() => toggleStudent(a.nome)} className="hidden" />
                      <div className="flex flex-col truncate">
                        <span className="text-[9px] font-black uppercase truncate">{a.nome}</span>
                        <span className="text-[7px] opacity-40">RA: {a.ra}</span>
                      </div>
                    </label>
                  )) : (
                    <div className="col-span-full h-full flex items-center justify-center text-white/20 text-[10px] font-black uppercase italic tracking-widest text-center">Selecione uma turma para carregar os alunos</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-white uppercase block ml-2">IRREGULARIDADES</label>
                <div className="flex flex-wrap gap-2 px-2">
                  {LISTA_IRREGULARIDADES.map(item => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleIrregularity(item)}
                      className={`px-4 py-2 rounded-lg border transition-all text-[9px] font-bold 
                        ${selectedIrregularities.includes(item) ? 'bg-[#002b5c] text-white border-transparent shadow-lg scale-105' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-black text-white uppercase block ml-2">CATEGORIA DA MEDIDA</label>
                  <select
                    value={classification}
                    onChange={e => setClassification(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl text-xs font-bold !text-black bg-white shadow-inner outline-none focus:ring-2 focus:ring-orange-500 transition-all cursor-pointer"
                  >
                    <option value="OCORRÊNCIA DISCIPLINAR">OCORRÊNCIA DISCIPLINAR</option>
                    <option value="OCORRÊNCIA PEDAGÓGICA">OCORRÊNCIA PEDAGÓGICA</option>
                    <option value="MEDIDA EDUCATIVA">MEDIDA EDUCATIVA</option>
                  </select>
                </div>
                {classification === 'MEDIDA EDUCATIVA' && (
                  <div className="flex-1 space-y-1 animate-fade-in">
                    <label className="text-[10px] font-black text-white uppercase block ml-2">DATA DE RETORNO (PÓS-MEDIDA)</label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={e => setReturnDate(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl text-xs font-bold !text-black bg-white shadow-inner outline-none focus:ring-2 focus:ring-orange-500 transition-all cursor-pointer"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-white uppercase block ml-2 tracking-widest">DESCRIÇÃO</label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="RELATE O OCORRIDO DETALHADAMENTE..." className="w-full p-4 rounded-xl text-xs font-bold uppercase !text-black bg-white shadow-inner outline-none focus:ring-2 focus:ring-orange-500 transition-all"></textarea>
              </div>

              <div className="flex justify-center pb-2">
                <button
                  type="submit"
                  disabled={isSaving || selectedStudents.length === 0}
                  className="w-auto px-16 py-5 bg-gradient-to-b from-[#42a5f5] to-[#1e88e5] hover:from-[#1e88e5] hover:to-[#1565c0] text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 border-b-4 border-[#0d47a1]"
                >
                  {isSaving ? 'Gravando...' : `Registrar para ${selectedStudents.length} Aluno(s)`}
                </button>
              </div>
            </form>
          </div>
        </div>

        <section className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
          <div className="px-6 py-4 bg-[#0d47a1] text-white flex justify-between items-center">
            <div className="flex flex-col">
              <h3 className="text-[10px] font-black uppercase tracking-widest">Histórico Recente</h3>
              <button
                onClick={() => setShowPermanentSearch(true)}
                className="text-[9px] text-blue-300 font-black uppercase text-left hover:underline flex items-center gap-1 group"
              >
                Ir para Histórico Permanente
                <svg className="w-2.5 h-2.5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Filtrar histórico..." className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-[10px] text-white placeholder:text-white/40 outline-none focus:bg-white focus:text-black" />
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-[9px] min-w-[1000px]">
              <thead className="bg-gray-50 border-b font-black uppercase text-gray-400">
                <tr>
                  <th className="p-4">Data</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Aluno</th>
                  <th className="p-4">Turma</th>
                  <th className="p-4">Responsável</th>
                  <th className="p-4">Descrição</th>
                  <th className="p-4 text-center">Documento</th>
                  <th className="p-4 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {filteredHistory.length > 0 ? filteredHistory.map(inc => (
                  <tr key={inc.id} className="hover:bg-blue-50/50 transition-all">
                    <td className="p-4 font-bold text-gray-500">{inc.date}</td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={inc.status} size="small" />
                        {inc.lastViewedAt && (
                          <span className="text-[7px] font-black text-teal-600 uppercase tracking-tighter">Visualizado pela Gestão</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4"><span className="font-black text-blue-900 uppercase">{inc.studentName}</span></td>
                    <td className="p-4 font-black text-blue-600">{inc.classRoom}</td>
                    <td className="p-4 uppercase font-bold text-gray-400">{inc.professorName}</td>
                    <td className="p-4 max-w-xs text-gray-500 italic">
                      <div className="truncate">{inc.description}</div>
                      {inc.managementFeedback && (
                        <div className={`mt-2 p-3 rounded-lg border-l-4 font-bold text-[8px] not-italic leading-tight shadow-sm animate-fade-in
                          ${inc.status === 'Resolvido' ? 'bg-green-50 border-green-500 text-green-800' :
                            inc.status === 'Em Análise' ? 'bg-yellow-50 border-yellow-500 text-yellow-800' :
                              'bg-red-50 border-red-500 text-red-800'}`}>
                          <div className="flex items-center gap-1 mb-1">
                            <span>{inc.status === 'Resolvido' ? '✅' : inc.status === 'Em Análise' ? '🟡' : '🔴'}</span>
                            <span className="uppercase tracking-widest">Devolutiva da Gestão:</span>
                          </div>
                          {inc.managementFeedback}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => generateIncidentPDF(inc, 'view')}
                          className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                          title="Visualizar PDF"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => generateIncidentPDF(inc, 'download')}
                          className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all"
                          title="Baixar PDF"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {(inc.authorEmail === user.email) && (
                        <button
                          onClick={() => onDelete(inc.id)}
                          className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all"
                          title="Excluir meu registro"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="p-12 text-center text-gray-300 font-black uppercase tracking-widest italic">Nenhum registro recente</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Modal de Busca no Histórico Permanente */}
      {showPermanentSearch && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in shadow-2xl">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] overflow-hidden flex flex-col border border-white/20">
            <div className="bg-[#1e3a8a] p-6 text-center shrink-0 border-b-4 border-blue-400">
              <h3 className="text-white font-black text-xs uppercase tracking-[0.2em]">Busca Criteriosa no Histórico Permanente</h3>
              <p className="text-blue-300 text-[9px] font-bold mt-1 uppercase">Localizar Aluno e Registros</p>
            </div>

            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex flex-col gap-6">
                {/* Campo de Busca */}
                <div className="relative group">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-4 mb-2">Digite as iniciais do aluno</label>
                  <div className="relative">
                    <input
                      autoFocus
                      type="text"
                      value={permanentSearchTerm}
                      onChange={(e) => {
                        setPermanentSearchTerm(e.target.value.toUpperCase());
                        setSelectedStudentForHistory(null);
                        setStudentHistory([]);
                      }}
                      placeholder="(CARREGARÁ APENAS INICIAIS CORRESPONDENTES)"
                      className="w-full h-16 pl-14 pr-6 bg-gray-50 border-2 border-gray-100 rounded-3xl text-sm font-black outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all text-black uppercase tracking-wider"
                    />
                    <svg className="w-6 h-6 absolute left-5 top-5 text-gray-300 group-focus-within:text-teal-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Resultados da Busca (Alunos) */}
                {permanentSearchTerm && !selectedStudentForHistory && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in">
                    {filteredStudentsForSearch.length > 0 ? filteredStudentsForSearch.map((s, idx) => (
                      <button
                        key={s.ra}
                        onClick={() => fetchStudentHistory(s)}
                        className={`flex flex-col items-start p-4 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-teal-50 border border-gray-100 hover:border-teal-200 rounded-2xl transition-all group`}
                      >
                        <span className="text-[11px] font-black text-[#002b5c] group-hover:text-teal-600 transition-colors">{s.nome}</span>
                        <div className="flex gap-3 mt-1">
                          <span className="text-[9px] font-bold text-gray-400 uppercase">Turma: {s.turma}</span>
                          <span className="text-[9px] font-bold text-gray-400 uppercase">RA: {s.ra}</span>
                        </div>
                      </button>
                    )) : (
                      <div className="col-span-full py-10 text-center">
                        <p className="text-gray-300 font-black uppercase text-[10px] tracking-[0.2em]">Nenhum aluno encontrado com estas iniciais</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Histórico do Aluno Selecionado */}
                {selectedStudentForHistory && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="p-6 bg-teal-50 border border-teal-100 rounded-[32px] flex flex-col md:flex-row justify-between items-center gap-4">
                      <div>
                        <h4 className="text-teal-800 font-black text-xs uppercase tracking-wider">{selectedStudentForHistory.nome}</h4>
                        <p className="text-teal-600/60 text-[9px] font-bold uppercase">RA: {selectedStudentForHistory.ra} | TURMA: {selectedStudentForHistory.turma}</p>
                      </div>
                      <button
                        onClick={() => setSelectedStudentForHistory(null)}
                        className="text-[9px] font-black text-teal-600 uppercase hover:underline"
                      >
                        Trocar Aluno
                      </button>
                    </div>

                    <div className="space-y-4">
                      <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Histórico Acadêmico/Disciplinar</h5>
                      {isLoadingHistory ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      ) : studentHistory.length > 0 ? (
                        <div className="space-y-4">
                          {studentHistory.map(inc => (
                            <div key={inc.id} className="p-6 bg-white border border-gray-100 rounded-[28px] shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-black text-gray-500">{inc.date}</span>
                                  <StatusBadge status={inc.status} size="small" />
                                </div>
                                <span className="px-3 py-1 bg-gray-100 rounded-lg text-[8px] font-black text-gray-500 uppercase">{inc.category}</span>
                              </div>
                              <p className="text-[10px] font-bold text-gray-600 uppercase italic line-clamp-3">{inc.description}</p>
                              <div className="pt-2 border-t border-gray-50 flex justify-between items-center">
                                <span className="text-[8px] font-bold text-gray-400 uppercase">PROF: {inc.professorName}</span>
                                <div className="flex gap-2">
                                  <button onClick={() => generateIncidentPDF(inc, 'view')} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
                                  <button onClick={() => generateIncidentPDF(inc, 'download')} className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-14 text-center bg-gray-50 rounded-[32px] border border-dashed border-gray-200">
                          <p className="text-gray-300 font-black uppercase text-[10px] tracking-[0.2em]">Nenhum registro encontrado para este aluno</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-center shrink-0">
              <button
                onClick={() => {
                  setShowPermanentSearch(false);
                  setPermanentSearchTerm('');
                  setSelectedStudentForHistory(null);
                }}
                className="px-12 py-4 bg-[#002b5c] text-white font-black text-[10px] uppercase rounded-full hover:shadow-xl transition-all active:scale-95"
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #14b8a6; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #0d9488; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default ProfessorView;

