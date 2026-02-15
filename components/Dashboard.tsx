
import React, { useState, useMemo, useRef } from 'react';
import { Incident, User, Student } from '../types';
import { generateIncidentPDF, uploadPDFToStorage } from '../services/pdfService';
import StatusBadge from './StatusBadge';
import { supabase } from '../services/supabaseClient';
import { DEMO_PROFESSORS_LIST } from '../professorsData';

interface DashboardProps {
  user: User;
  incidents: Incident[];
  students: Student[];
  classes: string[];
  onSave: (incident: Incident) => void;
  onDelete: (id: string) => void;
  onLogout: () => void;
  onOpenSearch: () => void;
  onUpdateIncident?: (incident: Incident) => void;
  onSyncStudents?: () => Promise<void>;
  onRefresh?: () => void;
  isSyncing?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({
  user, incidents, students, classes, onSave, onDelete, onLogout, onOpenSearch, onUpdateIncident, onSyncStudents,
  onRefresh, isSyncing
}) => {
  const [classRoom, setClassRoom] = useState('');
  const [studentName, setStudentName] = useState('');
  const [professorName, setProfessorName] = useState('');
  const [classification, setClassification] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [selectedIrregularities, setSelectedIrregularities] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [registerDate, setRegisterDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnDate, setReturnDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const regDateRef = useRef<HTMLInputElement>(null);
  const retDateRef = useRef<HTMLInputElement>(null);

  const [isUpdatingStatus, setIsUpdatingStatus] = useState<Incident | null>(null);
  const [newStatus, setNewStatus] = useState<Incident['status']>('Pendente');
  const [feedback, setFeedback] = useState('');

  // Estados para Gerenciamento de Professores
  const [showProfessorsModal, setShowProfessorsModal] = useState(false);
  const [professorsList, setProfessorsList] = useState<{ email: string, nome: string }[]>([]);
  const [newProfEmail, setNewProfEmail] = useState('');
  const [newProfNome, setNewProfNome] = useState('');
  const [isManagingProfs, setIsManagingProfs] = useState(false);

  // Estados para Busca no Histórico Permanente
  const [showPermanentSearch, setShowPermanentSearch] = useState(false);
  const [permanentSearchTerm, setPermanentSearchTerm] = useState('');
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<Student | null>(null);
  const [studentHistory, setStudentHistory] = useState<Incident[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const ra = useMemo(() => {
    const s = students.find(st => st.nome === studentName && st.turma === classRoom);
    return s ? s.ra : '---';
  }, [studentName, classRoom, students]);

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

  const filteredStudents = useMemo(() => {
    if (!permanentSearchTerm) return [];
    return students.filter(s =>
      s.nome.toUpperCase().startsWith(permanentSearchTerm.toUpperCase())
    ).slice(0, 10); // Limitar a 10 resultados para performance e UI
  }, [students, permanentSearchTerm]);

  const triggerPicker = (ref: React.RefObject<HTMLInputElement>) => {
    if (ref.current) {
      try {
        if ((ref.current as any).showPicker) {
          (ref.current as any).showPicker();
        } else {
          ref.current.focus();
        }
      } catch (err) {
        ref.current.focus();
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || !description || !classRoom || !classification || !professorName) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    setIsSaving(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = registerDate.split('-').reverse().join('/');
    const uniqueId = `gest-${Date.now()}`;

    const newInc: Incident = {
      id: uniqueId,
      classRoom,
      studentName: studentName.toUpperCase(),
      professorName: professorName.toUpperCase(),
      ra,
      date: formattedDate,
      time: timeStr,
      registerDate: formattedDate,
      returnDate: classification === 'MEDIDA EDUCATIVA' && returnDate ? returnDate.split('-').reverse().join('/') : undefined,
      discipline: (discipline || 'N/A').toUpperCase(),
      irregularities: selectedIrregularities.join(', '),
      description: description.toUpperCase(),
      severity: 'Média',
      status: 'Pendente',
      category: classification,
      source: 'gestao',
      authorEmail: user.email
    };

    onSave(newInc);
    setStudentName('');
    setDescription('');
    setReturnDate('');
    setIsSaving(false);
  };

  const openUpdateModal = (inc: Incident) => {
    setIsUpdatingStatus(inc);
    setNewStatus(inc.status);
    setFeedback(inc.managementFeedback || '');
  };

  const handleUpdateStatus = () => {
    if (!isUpdatingStatus || !onUpdateIncident) return;

    const updated: Incident = {
      ...isUpdatingStatus,
      status: newStatus,
      managementFeedback: feedback.toUpperCase(),
      lastViewedAt: new Date().toISOString()
    };

    onUpdateIncident(updated);
    setIsUpdatingStatus(null);
  };

  const fetchProfessors = async () => {
    setIsManagingProfs(true);
    // Para modo demonstração/apresentação, usamos a lista fixa de professores fictícios
    // Isso evita mostrar dados reais de professores cadastrados no Supabase
    setProfessorsList(DEMO_PROFESSORS_LIST);
    setIsManagingProfs(false);
  };

  const handleAddProfessor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfEmail || !newProfNome) return;

    // Apenas simulação local para a demo
    setProfessorsList(prev => [...prev, { email: newProfEmail.toLowerCase().trim(), nome: newProfNome.toUpperCase().trim() }]);
    setNewProfEmail('');
    setNewProfNome('');
  };

  const handleRemoveProfessor = async (email: string) => {
    if (!confirm(`Deseja remover o acesso de ${email}?`)) return;

    // Apenas simulação local para a demo
    setProfessorsList(prev => prev.filter(p => p.email !== email));
  };

  const history = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return incidents.filter(i =>
      (i.studentName || "").toLowerCase().includes(term) ||
      (i.classRoom || "").toLowerCase().includes(term) ||
      (i.professorName || "").toLowerCase().includes(term)
    );
  }, [incidents, searchTerm]);

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
            onClick={() => { setShowProfessorsModal(true); fetchProfessors(); }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase shadow-lg transition-all active:scale-95 flex items-center gap-2 border border-white/20"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            Professors
          </button>
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

      <main className="max-w-[1700px] mx-auto mt-6 sm:mt-8 px-4 sm:px-6 space-y-8 sm:space-y-10">
        <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden border border-white/10">
          <div className="bg-[#0d47a1] py-3 text-center border-b border-white/10">
            <h2 className="text-white font-black text-[10px] sm:text-xs uppercase tracking-widest">EFETUAR NOVO REGISTRO ADMINISTRATIVO</h2>
          </div>

          <div className="p-6 sm:p-10 bg-gradient-to-b from-[#1e3a8a] via-[#0d47a1] to-black">
            <form onSubmit={handleSave} className="space-y-6 sm:space-y-8">
              <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-end">
                <div className="flex flex-col gap-2 w-full lg:w-48">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest ml-1">TURMA / SÉRIE</label>
                  <select
                    value={classRoom}
                    onChange={e => { setClassRoom(e.target.value); setStudentName(''); }}
                    className="h-12 sm:h-14 border border-gray-200 rounded-2xl px-5 text-xs font-bold !text-black bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer w-full"
                  >
                    <option value="">Selecione...</option>
                    {classes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2 w-full lg:flex-1">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest ml-1">NOME DO ALUNO</label>
                  <select
                    value={studentName}
                    onChange={e => setStudentName(e.target.value)}
                    disabled={!classRoom}
                    className="h-12 sm:h-14 border border-gray-200 rounded-2xl px-5 text-xs font-bold !text-black bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm disabled:opacity-50 cursor-pointer w-full"
                  >
                    <option value="">Selecione o Aluno...</option>
                    {students.filter(s => s.turma === classRoom).map(s => <option key={s.ra} value={s.nome}>{s.nome}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2 w-full lg:w-64">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest ml-1">REGISTRO DO ALUNO (RA)</label>
                  <div className="h-12 sm:h-14 flex items-center px-6 bg-white/20 rounded-2xl font-black text-white text-xs border border-white/20 shadow-inner backdrop-blur-sm w-full">
                    {ra}
                  </div>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-end">
                <div className="flex flex-col gap-2 w-full lg:flex-1">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest ml-1">RESPONSÁVEL PELO REGISTRO</label>
                  <input
                    type="text"
                    value={professorName}
                    onChange={e => setProfessorName(e.target.value)}
                    placeholder="Nome do Gestor ou Professor"
                    className="h-12 sm:h-14 border border-gray-200 rounded-2xl px-5 text-xs font-bold !text-black bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm uppercase w-full"
                  />
                </div>
                <div className="flex flex-col gap-2 w-full lg:w-80">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest ml-1">CATEGORIA DA MEDIDA</label>
                  <select
                    value={classification}
                    onChange={e => setClassification(e.target.value)}
                    className="h-12 sm:h-14 border border-gray-200 rounded-2xl px-5 text-xs font-bold !text-black bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer w-full"
                  >
                    <option value="">Selecione...</option>
                    <option value="OCORRÊNCIA DISCIPLINAR">OCORRÊNCIA DISCIPLINAR</option>
                    <option value="OCORRÊNCIA PEDAGÓGICA">OCORRÊNCIA PEDAGÓGICA</option>
                    <option value="MEDIDA EDUCATIVA">MEDIDA EDUCATIVA</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2 cursor-pointer" onClick={() => triggerPicker(regDateRef)}>
                  <label className="text-[10px] font-black text-white uppercase tracking-widest ml-1 cursor-pointer">DATA DO REGISTRO</label>
                  <input
                    ref={regDateRef}
                    type="date"
                    value={registerDate}
                    onChange={e => setRegisterDate(e.target.value)}
                    className="h-12 sm:h-14 border border-gray-200 rounded-2xl px-5 text-xs font-bold !text-black bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer w-full"
                  />
                </div>

                {classification === 'MEDIDA EDUCATIVA' && (
                  <div className="flex flex-col gap-2 cursor-pointer animate-fade-in" onClick={() => triggerPicker(retDateRef)}>
                    <label className="text-[10px] font-black text-white uppercase tracking-widest ml-1 cursor-pointer">DATA DE RETORNO (PÓS-MEDIDA)</label>
                    <input
                      ref={retDateRef}
                      type="date"
                      value={returnDate}
                      onChange={e => setReturnDate(e.target.value)}
                      className="h-12 sm:h-14 border border-orange-300 rounded-2xl px-5 text-xs font-bold !text-black bg-white focus:ring-2 focus:ring-orange-500 outline-none shadow-sm cursor-pointer w-full"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-white uppercase tracking-widest ml-1">DESCRIÇÃO</label>
                <textarea
                  rows={5}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-6 border border-gray-200 rounded-[28px] text-xs font-bold !text-black bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-sm uppercase placeholder:text-gray-300"
                  placeholder="Relatório detalhado da ocorrência e medidas tomadas..."
                ></textarea>
              </div>

              <div className="flex justify-center pt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-auto px-16 py-5 bg-gradient-to-b from-[#42a5f5] to-[#1e88e5] hover:from-[#1e88e5] hover:to-[#1565c0] text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 border-b-4 border-[#0d47a1]"
                >
                  {isSaving ? 'Gravando...' : 'Lançar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <section className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
          <div className="px-6 py-4 bg-[#0d47a1] text-white flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col">
              <h3 className="text-[10px] font-black uppercase tracking-widest">Feed de Ocorrências e Devolutivas</h3>
              <button
                onClick={() => setShowPermanentSearch(true)}
                className="text-[9px] text-blue-300 font-black uppercase text-left hover:underline flex items-center gap-1 group"
              >
                Buscar no Histórico Permanente
                <svg className="w-2.5 h-2.5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <span className="bg-blue-500 text-white text-[8px] sm:text-[9px] px-3 py-1 rounded-full font-black uppercase whitespace-nowrap">{history.length} Recentes</span>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Filtrar recentes..."
                  className="w-full pl-10 pr-6 py-2 rounded-xl bg-white/10 border border-white/20 text-[9px] sm:text-[10px] text-white outline-none"
                />
                <svg className="w-4 h-4 absolute left-3 top-2.5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <button
                onClick={onOpenSearch}
                className="bg-blue-500 hover:bg-blue-600 text-white p-2.5 rounded-xl transition-all shadow-lg flex items-center gap-2"
                title="Busca Profunda na Planilha"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <span className="text-[10px] font-black uppercase hidden sm:inline">Busca Permanente</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar bg-gray-50/30">
            <table className="w-full text-left text-[10px] min-w-[1200px]">
              <thead className="bg-[#f8fafc] border-b text-black sticky top-0 z-10">
                <tr>
                  <th className="p-4 font-black uppercase">Data</th>
                  <th className="p-4 font-black uppercase">Status</th>
                  <th className="p-4 font-black uppercase">Aluno</th>
                  <th className="p-4 font-black uppercase">Turma</th>
                  <th className="p-4 font-black uppercase">Tipo</th>
                  <th className="p-4 font-black uppercase">Responsável</th>
                  <th className="p-4 font-black uppercase">Relato</th>
                  <th className="p-4 text-center font-black uppercase">Documento</th>
                  <th className="p-4 text-center font-black uppercase">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {history.length > 0 ? history.map(inc => (
                  <tr key={inc.id} className="hover:bg-blue-50/40 transition-all">
                    <td className="p-4 font-black text-gray-500">{inc.date}</td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={inc.status} size="small" />
                        {inc.lastViewedAt && (
                          <span className="text-[7px] font-bold text-blue-600 uppercase">Visualizado</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-black text-[#002b5c] uppercase">{inc.studentName}</span>
                        <span className="text-[8px] font-bold text-gray-400">RA: {inc.ra}</span>
                      </div>
                    </td>
                    <td className="p-4 font-bold text-blue-600">{inc.classRoom}</td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${inc.category === 'MEDIDA EDUCATIVA' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {inc.category}
                      </span>
                    </td>
                    <td className="p-4 font-black text-[#002b5c] uppercase truncate max-w-[150px]">{inc.professorName}</td>
                    <td className="p-4 max-sm truncate text-gray-600 italic">
                      <div>{inc.description}</div>
                      {inc.managementFeedback && (
                        <div className="mt-2 p-2 bg-blue-50 border-l-2 border-blue-500 text-blue-800 font-bold text-[8px]">
                          DEVOLUTIVA: {inc.managementFeedback}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => generateIncidentPDF(inc, 'view')} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
                        <button onClick={() => generateIncidentPDF(inc, 'download')} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openUpdateModal(inc)}
                          className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                          title="Atualizar Status / Devolutiva"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        {(user.role === 'gestor' || inc.authorEmail === user.email) && (
                          <button onClick={() => onDelete(inc.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all" title="Excluir registro"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={9} className="p-20 text-center text-gray-300 font-black uppercase text-xs tracking-widest">Nenhum registro recente encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Modal de Atualização de Status e Devolutiva */}
      {isUpdatingStatus && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in shadow-2xl">
          <div className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden flex flex-col border border-white/20">
            <div className="bg-[#0d47a1] p-6 text-center border-b-4 border-blue-500">
              <h3 className="text-white font-black text-xs uppercase tracking-[0.2em]">Sinalizar Estágio da Ocorrência</h3>
              <p className="text-blue-400 text-[9px] font-bold mt-1 uppercase">{isUpdatingStatus.studentName}</p>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Status da Ocorrência</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-2xl text-[11px] font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black"
                >
                  <option value="Pendente">🔴 PENDENTE</option>
                  <option value="Em Análise">🟡 EM ANÁLISE</option>
                  <option value="Resolvido">🟢 RESOLVIDO</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-2">Justificativa / Devolutiva</label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                  placeholder="Descreva o estágio atual ou a resolução da ocorrência..."
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black uppercase"
                ></textarea>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setIsUpdatingStatus(null)}
                  className="flex-1 py-4 bg-gray-100 text-gray-500 font-black text-[10px] uppercase rounded-2xl hover:bg-gray-200 transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateStatus}
                  className="flex-1 py-4 bg-blue-500 text-white font-black text-[10px] uppercase rounded-2xl hover:bg-blue-600 transition-all shadow-md active:scale-95"
                >
                  Salvar Devolutiva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Busca no Histórico Permanente */}
      {showPermanentSearch && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in shadow-2xl">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] overflow-hidden flex flex-col border border-white/20">
            <div className="bg-[#0d47a1] p-6 text-center shrink-0 border-b-4 border-orange-500">
              <h3 className="text-white font-black text-xs uppercase tracking-[0.2em]">Busca Criteriosa no Histórico Permanente</h3>
              <p className="text-orange-400 text-[9px] font-bold mt-1 uppercase">Localizar Aluno e Registros</p>
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
                      className="w-full h-16 pl-14 pr-6 bg-gray-50 border-2 border-gray-100 rounded-3xl text-sm font-black outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all text-black uppercase tracking-wider"
                    />
                    <svg className="w-6 h-6 absolute left-5 top-5 text-gray-300 group-focus-within:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Resultados da Busca (Alunos) */}
                {permanentSearchTerm && !selectedStudentForHistory && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in">
                    {filteredStudents.length > 0 ? filteredStudents.map((s, idx) => (
                      <button
                        key={s.ra}
                        onClick={() => fetchStudentHistory(s)}
                        className={`flex flex-col items-start p-4 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-orange-50 border border-gray-100 hover:border-orange-200 rounded-2xl transition-all group`}
                      >
                        <span className="text-[11px] font-black text-[#002b5c] group-hover:text-orange-600 transition-colors">{s.nome}</span>
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
                    <div className="p-6 bg-orange-50 border border-orange-100 rounded-[32px] flex flex-col md:flex-row justify-between items-center gap-4">
                      <div>
                        <h4 className="text-orange-800 font-black text-xs uppercase tracking-wider">{selectedStudentForHistory.nome}</h4>
                        <p className="text-orange-600/60 text-[9px] font-bold uppercase">RA: {selectedStudentForHistory.ra} | TURMA: {selectedStudentForHistory.turma}</p>
                      </div>
                      <button
                        onClick={() => setSelectedStudentForHistory(null)}
                        className="text-[9px] font-black text-orange-600 uppercase hover:underline"
                      >
                        Trocar Aluno
                      </button>
                    </div>

                    <div className="space-y-4">
                      <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Histórico Acadêmico/Disciplinar</h5>
                      {isLoadingHistory ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
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
                className="px-12 py-4 bg-[#0d47a1] text-white font-black text-[10px] uppercase rounded-full hover:shadow-xl transition-all active:scale-95"
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Professores */}
      {showProfessorsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in shadow-2xl">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] overflow-hidden flex flex-col border border-white/20">
            <div className="bg-gradient-to-r from-[#1e3a8a] to-[#0d47a1] p-6 text-center shrink-0 border-b border-white/10 shadow-xl">
              <h3 className="text-white font-black text-xs uppercase tracking-[0.2em]">Gerenciar Professores Autorizados</h3>
              <p className="text-blue-300 text-[9px] font-bold mt-1 uppercase tracking-widest">Controle de Acesso à Plataforma</p>
            </div>

            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar flex flex-col lg:flex-row gap-8 bg-gradient-to-b from-[#1e3a8a] via-[#0d47a1] to-black">

              {/* Formulário lateral */}
              <div className="lg:w-1/3 space-y-6 shrink-0">
                <form onSubmit={handleAddProfessor} className="p-6 bg-white/10 backdrop-blur-md rounded-[32px] border border-white/10 space-y-4 shadow-xl">
                  <h4 className="text-[10px] font-black text-blue-300 uppercase text-center mb-2 tracking-widest">Novo Professor</h4>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block ml-2">E-mail</label>
                    <input
                      required
                      type="email"
                      value={newProfEmail}
                      onChange={e => setNewProfEmail(e.target.value)}
                      placeholder="exemplo@escola.com.br"
                      className="w-full h-11 px-4 bg-white border border-gray-200 rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all text-black"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block ml-2">Nome Completo</label>
                    <input
                      required
                      type="text"
                      value={newProfNome}
                      onChange={e => setNewProfNome(e.target.value)}
                      placeholder="NOME DO PROFESSOR"
                      className="w-full h-11 px-4 bg-white border border-gray-200 rounded-2xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all uppercase text-black"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isManagingProfs}
                    className="w-full py-4 bg-blue-500 text-white font-black text-[10px] uppercase rounded-2xl hover:bg-blue-600 transition-all shadow-md active:scale-95 disabled:opacity-50"
                  >
                    {isManagingProfs ? 'Salvando...' : 'Adicionar Professor'}
                  </button>
                </form>

                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl backdrop-blur-sm">
                  <p className="text-[8px] font-bold text-orange-400 uppercase leading-relaxed tracking-wider">
                    ⚠️ Somente professores cadastrados nesta lista poderão criar contas ou fazer login no portal.
                  </p>
                </div>

              </div>

              {/* Lista Principal */}
              <div className="flex-1 min-h-[400px] flex flex-col">
                <div className="flex justify-between items-center mb-4 px-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase">{professorsList.length} Professores Cadastrados</p>
                </div>
                <div className="flex-1 bg-white/5 backdrop-blur-md rounded-[32px] border border-white/10 overflow-hidden flex flex-col shadow-2xl">
                  <div className="overflow-y-auto custom-scrollbar flex-1">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-black/20 border-b border-white/10 text-blue-300 sticky top-0 z-10">
                        <tr>
                          <th className="p-4 font-black uppercase tracking-widest">Professor</th>
                          <th className="p-4 font-black uppercase tracking-widest text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 bg-transparent">

                        {professorsList.map(prof => (
                          <tr key={prof.email} className="hover:bg-white/5 transition-all group">
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-black text-white uppercase group-hover:text-blue-300 transition-colors">{prof.nome}</span>
                                <span className="text-[9px] font-bold text-white/40 tracking-tight">{prof.email}</span>
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleRemoveProfessor(prof.email)}
                                className="p-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-90 border border-red-500/20"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-6 bg-black/40 backdrop-blur-md border-t border-white/10 flex justify-center shrink-0">
              <button
                onClick={() => setShowProfessorsModal(false)}
                className="px-12 py-4 bg-white/10 hover:bg-white/20 text-white font-black text-[10px] uppercase rounded-full border border-white/20 hover:shadow-xl transition-all active:scale-95"
              >
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default Dashboard;

