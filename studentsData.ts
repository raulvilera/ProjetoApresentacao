export interface Student {
  id?: string;
  nome: string;
  ra: string;
  turma: string;
}

const turmas = [
  '6º ANO A', '6º ANO B', '6º ANO C',
  '7º ANO A', '7º ANO B', '7º ANO C',
  '8º ANO A', '8º ANO B', '8º ANO C',
  '9º ANO A', '9º ANO B', '9º ANO C',
  '1ª SÉRIE A', '2ª SÉRIE A', '3ª SÉRIE A'
];

const generateMockStudents = (): Student[] => {
  const students: Student[] = [];
  let idCounter = 1;

  turmas.forEach(turma => {
    for (let i = 1; i <= 20; i++) {
      const raSuffix = idCounter.toString().padStart(4, '0');
      students.push({
        nome: `ALUNO DEMO ${turma.split(' ')[0]} - ${i.toString().padStart(2, '0')}`,
        ra: `123.456.789-${raSuffix}`,
        turma: turma
      });
      idCounter++;
    }
  });

  return students;
};

export const STUDENTS_DB: Student[] = generateMockStudents();
