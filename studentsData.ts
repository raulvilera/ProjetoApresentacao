export interface Student {
  id?: string;
  nome: string;
  ra: string;
  turma: string;
}

export const STUDENTS_DB: Student[] = [
  { nome: "ALUNO EXEMPLO 01", ra: "123.456.789-1", turma: "1º ANO A" },
  { nome: "ALUNO EXEMPLO 02", ra: "123.456.789-2", turma: "1º ANO A" },
  { nome: "ALUNO EXEMPLO 03", ra: "123.456.789-3", turma: "2º ANO B" },
  { nome: "ALUNO EXEMPLO 04", ra: "123.456.789-4", turma: "2º ANO B" },
  { nome: "ALUNO EXEMPLO 05", ra: "123.456.789-5", turma: "3º ANO C" },
  { nome: "ALUNO EXEMPLO 06", ra: "123.456.789-6", turma: "3º ANO C" },
  { nome: "ALUNO EXEMPLO 07", ra: "123.456.789-7", turma: "9º ANO D" },
  { nome: "ALUNO EXEMPLO 08", ra: "123.456.789-8", turma: "9º ANO D" },
  { nome: "ALUNO EXEMPLO 09", ra: "123.456.789-9", turma: "8º ANO E" },
  { nome: "ALUNO EXEMPLO 10", ra: "123.456.789-0", turma: "8º ANO E" }
];

