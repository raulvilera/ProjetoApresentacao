import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Incident, User, Student } from './types';

interface ProfessorViewProps {
  user: User;
  incidents: Incident[];
  students: Student[];
  classes: string[];
  onSave: (incident: Incident | Incident[]) => void;
  onLogout: () => void;
}


const LISTA_IRREGULARIDADES = [
  'ATRASO', 'SEM MATERIAL', 'USO DE CELULAR', 'CONVERSA', 'DESRESPEITO',
  'INDISCIPLINA', 'DESACATO', 'SEM TAREFA', 'SAIU SEM PERMISSÃO'
];

const ProfessorView: React.FC<ProfessorViewProps> = ({ user, incidents, students, classes, onSave, onLogout }) => {
  const [professorName, setProfessorName] = useState('');
  const [classRoom, setClassRoom] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [discipline, setDiscipline] = useState('');
  const [selectedIrregularities, setSelectedIrregularities] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [registerDate, setRegisterDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const dateInputRef = useRef<HTMLInputElement>(null);

  const studentsInClass = useMemo(() => students.filter(a => a.turma === classRoom), [classRoom, students]);

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

  const triggerCalendar = () => {
    if (dateInputRef.current) {
      try {
        if ((dateInputRef.current as any).showPicker) {
          (dateInputRef.current as any).showPicker();
        } else {
          dateInputRef.current.focus();
        }
      } catch (err) {
        dateInputRef.current.focus();
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!professorName || !classRoom || selectedStudents.length === 0 || !description) {
      alert("Por favor, preencha seu Nome, Turma, selecione ao menos um Aluno e relate o fato.");
      return;
    }

    setIsSaving(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const [year, month, day] = registerDate.split('-');
    const formattedDate = `${day}/${month}/${year}`;

    const newIncidents: Incident[] = selectedStudents.map((nome, index) => {
      const studentData = students.find(s => s.nome === nome && s.turma === classRoom);
      return {
        id: `prof-${Date.now()}-${index}`,
        date: formattedDate,
        professorName: professorName.toUpperCase(),
        classRoom: classRoom,
        studentName: nome.toUpperCase(),
        ra: studentData ? studentData.ra : '---',
        discipline: (discipline || 'N/A').toUpperCase(),
        irregularities: selectedIrregularities.length > 0 ? selectedIrregularities.join(', ') : 'NENHUMA',
        description: description.toUpperCase(),
        time: timeStr,
        category: 'OCORRÊNCIA',
        severity: 'Média',
        status: 'Pendente',
        source: 'professor'
      } as Incident;
    });

    try {
      onSave(newIncidents);
      alert(`${newIncidents.length} registro(s) gravado(s) com sucesso na grade de histórico.`);
      setSelectedStudents([]);
      setDescription('');
      setSelectedIrregularities([]);
      setDiscipline('');
    } catch (err) {
      alert("Erro ao gravar os registros.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredHistory = useMemo(() => {
    if (!incidents) return [];
    const term = searchTerm.toLowerCase();
    return incidents.filter(i =>
      (i.studentName || "").toLowerCase().includes(term) ||
      (i.classRoom || "").toLowerCase().includes(term) ||
      (i.professorName || "").toLowerCase().includes(term)
    );
  }, [incidents, searchTerm]);

  return (
    <div className="min-h-screen bg-[#001a35] font-sans pb-12">
      <header className="bg-[#002b5c] text-white px-8 py-3 flex justify-between items-center border-b border-white/10 shadow-lg sticky top-0 z-[50]">
        <div className="flex flex-col">
          <h1 className="text-sm font-black uppercase tracking-tighter">Área do Professor 2026</h1>
          <p className="text-[9px] font-bold text-blue-200/60 uppercase tracking-widest leading-none">Escola Modelo de Tecnologia</p>
        </div>
        <div className="flex gap-6 items-center">
          <span className="text-[10px] font-bold text-white/70">{user.email}</span>
          <button onClick={onLogout} className="bg-white text-[#002b5c] px-4 py-1.5 rounded text-[10px] font-black uppercase hover:bg-gray-100 transition-all shadow-md">Sair</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto mt-8 px-6 space-y-8">
        <div className="bg-[#001a35] rounded-xl shadow-2xl overflow-hidden border border-white/5">
          <div className="bg-[#004a99] py-3 text-center border-b border-white/10">
            <h2 className="text-white font-black text-xs uppercase tracking-widest">LANÇAMENTO DE REGISTROS DISCIPLINARES</h2>
          </div>
          <div className="p-8 bg-gradient-to-br from-[#115e59] via-[#14b8a6] to-[#ea580c]">
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest">PROFESSOR RESPONSÁVEL (DIGITE SEU NOME)</label>
                  <input
                    type="text"
                    value={professorName}
                    onChange={e => setProfessorName(e.target.value)}
                    placeholder="Digite seu nome completo..."
                    className="w-full h-11 px-4 bg-white border border-gray-300 rounded-xl text-xs font-bold text-black outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest">TURMA / SÉRIE</label>
                  <select value={classRoom} onChange={e => { setClassRoom(e.target.value); setSelectedStudents([]); }} className="w-full h-11 px-4 bg-white border border-gray-300 rounded-xl text-xs font-bold text-black outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">Selecione a turma...</option>
                    {classes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest">SELECIONE OS ALUNOS</label>
                  <span className="text-[9px] font-black bg-white/10 text-white px-3 py-1 rounded-full uppercase">{selectedStudents.length} Selecionado(s)</span>
                </div>
                <div className="w-full h-64 overflow-y-auto bg-white/95 border border-gray-300 rounded-2xl p-4 custom-scrollbar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 shadow-inner">
                  {classRoom ? studentsInClass.map((a, idx) => (
                    <label key={a.ra || idx} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${selectedStudents.includes(a.nome) ? 'bg-blue-600 border-blue-400 text-white shadow-md' : 'bg-white border-gray-100 text-black hover:border-blue-200'}`}>
                      <input type="checkbox" checked={selectedStudents.includes(a.nome)} onChange={() => toggleStudent(a.nome)} className="w-5 h-5 rounded-md text-blue-600" />
                      <span className="text-[10px] font-black uppercase truncate">{a.nome}</span>
                    </label>
                  )) : (
                    <div className="col-span-full h-full flex items-center justify-center text-gray-400 text-[10px] font-black uppercase italic">Selecione uma turma para carregar os alunos...</div>
                  )}
                </div>
              </div>

              <div className="bg-black/40 rounded-2xl p-4 border border-white/10 shadow-inner">
                <h3 className="text-yellow-400 font-black text-[9px] uppercase tracking-widest mb-3 flex items-center gap-2">CONFERÊNCIA DE NOMES E RAs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {selectedStudents.length > 0 ? selectedStudents.map((name, i) => {
                    const student = students.find(s => s.nome === name && s.turma === classRoom);
                    return (
                      <div key={i} className="flex justify-between items-center bg-white/10 px-3 py-2 rounded-lg border border-white/5">
                        <span className="text-[9px] font-bold text-white uppercase truncate mr-2">{name}</span>
                        <span className="bg-yellow-400 text-blue-900 px-2 py-0.5 rounded text-[10px] font-black shadow-sm font-mono">{student?.ra}</span>
                      </div>
                    );
                  }) : (
                    <div className="col-span-full py-2 text-center text-white/20 text-[9px] font-black uppercase italic">Nenhum aluno selecionado</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-white uppercase tracking-widest">IRREGULARIDADES</label>
                <div className="flex flex-wrap gap-2">
                  {LISTA_IRREGULARIDADES.map(item => (
                    <button key={item} type="button" onClick={() => toggleIrregularity(item)} className={`px-4 py-2 rounded-lg border transition-all text-[10px] font-bold ${selectedIrregularities.includes(item) ? 'bg-[#064e3b] text-white border-transparent shadow-lg' : 'bg-white/10 text-white/60 border-white/20 hover:bg-white/20'}`}>{item}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest">DISCIPLINA</label>
                  <input type="text" value={discipline} onChange={e => setDiscipline(e.target.value)} className="w-full h-11 px-4 bg-white border border-gray-300 rounded-xl text-xs font-bold text-black outline-none" placeholder="Ex: Português" />
                </div>
                <div className="space-y-1 cursor-pointer" onClick={triggerCalendar}>
                  <label className="text-[10px] font-black text-white uppercase tracking-widest block cursor-pointer">DATA DO OCORRIDO</label>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={registerDate}
                    onChange={e => setRegisterDate(e.target.value)}
                    className="w-full h-11 px-4 bg-white border border-gray-300 rounded-xl text-xs font-bold text-black outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-white uppercase tracking-widest">RELATO DOS FATOS (DESCRIÇÃO)</label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="w-full p-4 bg-white border border-gray-300 rounded-2xl text-xs font-bold text-black outline-none" placeholder="Descreva o ocorrido detalhadamente..."></textarea>
              </div>

              <div className="flex justify-center pt-2">
                <button type="submit" disabled={isSaving || selectedStudents.length === 0} className="px-16 py-5 bg-[#f97316] hover:bg-[#ea580c] text-blue-900 font-black text-[13px] uppercase tracking-[0.2em] rounded-2xl shadow-2xl transition-all border-b-[6px] border-orange-800 disabled:opacity-50 active:translate-y-1 active:border-b-0">
                  {isSaving ? 'GRAVANDO...' : `EFETUAR REGISTRO PARA ${selectedStudents.length} ALUNO(S)`}
                </button>
              </div>
            </form>
          </div>
        </div>

        <section className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-300">
          <div className="px-8 py-5 border-b border-gray-300 flex items-center justify-between bg-[#004a99]">
            <h3 className="text-white font-black text-xs uppercase tracking-widest">HISTÓRICO RECENTE DE REGISTROS</h3>
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Filtrar histórico..." className="bg-white/10 border border-white/20 rounded px-4 py-2 text-[10px] font-bold outline-none focus:bg-white focus:text-black w-64 text-white placeholder:text-white/40 shadow-inner" />
          </div>

          <div className="max-h-[600px] overflow-auto custom-scrollbar bg-gray-50">
            <table className="w-full border-collapse border border-gray-300">
              <thead className="sticky top-0 bg-[#f8fafc] z-20">
                <tr className="bg-[#14b8a6] text-white">
                  <th className="border border-gray-300 px-3 py-3 text-[9px] font-black uppercase text-center w-[100px]">DATA</th>
                  <th className="border border-gray-300 px-3 py-3 text-[9px] font-black uppercase text-left">PROFESSOR</th>
                  <th className="border border-gray-300 px-3 py-3 text-[9px] font-black uppercase text-center w-[90px]">TURMA</th>
                  <th className="border border-gray-300 px-3 py-3 text-[9px] font-black uppercase text-left">ALUNO</th>
                  <th className="border border-gray-300 px-3 py-3 text-[9px] font-black uppercase text-center w-[110px]">RA</th>
                  <th className="border border-gray-300 px-3 py-3 text-[9px] font-black uppercase text-left">DISCIPLINA</th>
                  <th className="border border-gray-300 px-3 py-3 text-[9px] font-black uppercase text-left">IRREGULARIDADES</th>
                  <th className="border border-gray-300 px-3 py-3 text-[9px] font-black uppercase text-left">DESCRIÇÃO</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredHistory.length > 0 ? filteredHistory.map((inc) => (
                  <tr key={inc.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="border border-gray-300 px-3 py-2 text-[9px] font-bold text-gray-500 text-center whitespace-nowrap bg-gray-50/50">{inc.date}</td>
                    <td className="border border-gray-300 px-3 py-2 text-[9px] font-black text-gray-800 uppercase truncate max-w-[150px]">{inc.professorName}</td>
                    <td className="border border-gray-300 px-3 py-2 text-[9px] font-black text-center text-blue-900 uppercase bg-blue-50/20">{inc.classRoom}</td>
                    <td className="border border-gray-300 px-3 py-2 text-[9px] font-black text-gray-900 uppercase">{inc.studentName}</td>
                    <td className="border border-gray-300 px-3 py-2 text-[9px] font-bold text-center text-blue-700 font-mono tracking-tighter">{inc.ra}</td>
                    <td className="border border-gray-300 px-3 py-2 text-[9px] font-bold text-gray-600 uppercase italic truncate max-w-[120px]">{inc.discipline || '---'}</td>
                    <td className="border border-gray-300 px-3 py-2 text-[9px] font-bold text-red-600 uppercase max-w-[180px] truncate">{inc.irregularities || '---'}</td>
                    <td className="border border-gray-300 px-3 py-2 text-[9px] font-medium text-gray-400 max-w-[250px] truncate">{inc.description}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} className="px-6 py-16 text-center text-gray-400 text-[10px] font-black uppercase italic tracking-[0.2em] bg-white">Os registros gravados aparecerão automaticamente nesta grade...</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-[#f8fafc] px-8 py-3 border-t border-gray-300 flex justify-between items-center">
            <span className="text-[9px] font-black text-gray-400 uppercase">Sistema de Ocorrências EE PEP • v2026.1</span>
            <span className="text-[10px] font-black text-[#004a99] uppercase">{filteredHistory.length} registros no histórico</span>
          </div>
        </section>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 7px; width: 7px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #14b8a6; border-radius: 20px; }
      `}</style>
    </div>
  );
};

export default ProfessorView;
