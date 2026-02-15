-- Esquema do Banco de Dados - Plataforma Escolar
-- Última atualização: 2026-02-15 19:05 (Fix: Missing professor_name column)

-- Tabela de Incidências (Ocorrências)
CREATE TABLE public.incidents (
    id text PRIMARY KEY,
    student_name text,
    student_class text, -- Mapped to classRoom in frontend
    professor_name text,
    date date DEFAULT CURRENT_DATE,
    period text,
    type text,
    description text,
    author_email text,
    created_at timestamp with time zone DEFAULT now(),
    student_id text,
    student_ra text,
    time text,
    register_date text,
    return_date text,
    irregularities text,
    category text,
    severity text DEFAULT 'Média'::text,
    status text DEFAULT 'Pendente'::text,
    source text DEFAULT 'professor'::text,
    pdf_url text,
    management_feedback text,
    last_viewed_at timestamp with time zone,
    discipline text
);

-- Tabela de Professores Autorizados
CREATE TABLE public.authorized_professors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    name text,
    role text DEFAULT 'professor'::text,
    created_at timestamp with time zone DEFAULT now()
);

-- Tabela de Alunos (Cache/Sincronização)
CREATE TABLE public.students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    class text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Políticas de RLS para a tabela incidents
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated select" ON public.incidents
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON public.incidents
    FOR INSERT TO authenticated WITH CHECK (lower(auth.jwt() ->> 'email') = lower(author_email));

CREATE POLICY "Allow update for author or gestor" ON public.incidents
    FOR UPDATE TO authenticated
    USING (
        lower(auth.jwt() ->> 'email') = lower(author_email) OR 
        EXISTS (SELECT 1 FROM authorized_professors WHERE lower(email) = lower(auth.jwt() ->> 'email') AND role = 'gestor')
    );

CREATE POLICY "Allow delete for author or gestor" ON public.incidents
    FOR DELETE TO authenticated
    USING (
        lower(auth.jwt() ->> 'email') = lower(author_email) OR 
        EXISTS (SELECT 1 FROM authorized_professors WHERE lower(email) = lower(auth.jwt() ->> 'email') AND role = 'gestor')
    );

-- Garantir permissões básicas para o funcionamento da API
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Dar acesso às tabelas para usuários LOGADOS (authenticated)
-- A segurança real é feita linha a linha pelas políticas de RLS acima
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Negar acesso a tabelas para usuários NÃO LOGADOS (anon) por segurança
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
