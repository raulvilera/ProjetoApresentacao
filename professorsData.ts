export const PROFESSORS_DB = [
    { email: 'professor@escola.com.br', nome: 'PROFESSOR DEMO' },
    { email: 'gestor@escola.com.br', nome: 'GESTOR DEMO' },
    { email: 'vilera@prof.educacao.sp.gov.br', nome: 'RAUL VILERA' }
];

export const isProfessorRegistered = (email: string): boolean => {
    const lowerEmail = email.toLowerCase().trim();
    const demoManagementEmails = ['gestor@escola.com.br', 'gestao@escola.com'];
    if (demoManagementEmails.includes(lowerEmail)) return true;

    return PROFESSORS_DB.some(p => p.email.toLowerCase() === lowerEmail);
};

export const getProfessorNameFromEmail = (email: string) => {
    const prof = PROFESSORS_DB.find(p => p.email.toLowerCase() === email.toLowerCase());
    return prof ? prof.nome : '';

