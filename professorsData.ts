export const PROFESSORS_DB = [
    { email: 'professor@escola.com', nome: 'PROFESSOR DEMO' },
    { email: 'gestao@escola.com', nome: 'GESTOR DEMO' },
];

export const DEMO_PROFESSORS_LIST = [
    { email: 'ana.silva@escola.demo.com', nome: 'ANA SILVA' },
    { email: 'bruno.oliveira@escola.demo.com', nome: 'BRUNO OLIVEIRA' },
    { email: 'carla.santos@escola.demo.com', nome: 'CARLA SANTOS' },
    { email: 'diego.lima@escola.demo.com', nome: 'DIEGO LIMA' },
    { email: 'elena.pereira@escola.demo.com', nome: 'ELENA PEREIRA' },
    { email: 'fabio.rodrigues@escola.demo.com', nome: 'FÁBIO RODRIGUES' },
    { email: 'giselle.costa@escola.demo.com', nome: 'GISELLE COSTA' },
    { email: 'helio.souza@escola.demo.com', nome: 'HÉLIO SOUZA' },
    { email: 'iris.melo@escola.demo.com', nome: 'ÍRIS MELO' },
    { email: 'joao.almeida@escola.demo.com', nome: 'JOÃO ALMEIDA' }
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
};
