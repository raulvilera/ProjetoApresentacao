
export interface Student {
  id?: string;
  nome: string;
  ra: string;
  turma: string;
}

export interface ClassRoom {
  id: string;
  name: string;
}

export interface Incident {
  id: string;
  professorName?: string;
  classRoom?: string;
  studentName: string;
  ra?: string;
  date: string;
  time?: string;
  registerDate?: string;
  returnDate?: string;
  discipline?: string;
  irregularities?: string;
  description: string;
  severity: 'Baixa' | 'Média' | 'Alta' | 'Crítica';
  aiAnalysis?: string;
  status: 'Pendente' | 'Em Análise' | 'Resolvido';
  category?: string;
  source: 'professor' | 'gestao';
  pdfUrl?: string;
  authorEmail?: string; // E-mail do autor do registro para controle de exclusão
  managementFeedback?: string;
  lastViewedAt?: string;
  created_at?: string;
}

export type View = 'login' | 'dashboard';

export interface User {
  email: string;
  role: 'gestor' | 'professor';
}

