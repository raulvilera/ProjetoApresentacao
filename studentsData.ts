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
  const firstNames = [
    'Carlos', 'Ágatta', 'Juliana', 'Marcos', 'Fernanda', 'Ricardo', 'Beatriz', 'Gabriel', 'Larissa', 'Thiago',
    'Camila', 'Rafael', 'Amanda', 'Bruno', 'Isabela', 'Lucas', 'Sofia', 'Matheus', 'Giovanna', 'Vinícius',
    'Heitor', 'Valentina', 'Enzo', 'Alice', 'Davi', 'Helena', 'Bernardo', 'Sophia', 'Samuel', 'Manuela',
    'João', 'Laura', 'Pedro', 'Isabella', 'Gabriel', 'Luiza', 'Gustavo', 'Lorena', 'Isaac', 'Júlia'
  ];

  const students: Student[] = [];
  let idCounter = 1;

  turmas.forEach(turma => {
    for (let i = 0; i < 20; i++) {
      const nameIndex = (idCounter - 1) % firstNames.length;
      const raSuffix = idCounter.toString().padStart(4, '0');
      students.push({
        nome: `${firstNames[nameIndex]} (Demo)`,
        ra: `123.456.789-${raSuffix}`,
        turma: turma
      });
      idCounter++;
    }
  });

  return students;
};

export const STUDENTS_DB: Student[] = generateMockStudents();
