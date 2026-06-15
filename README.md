# EARJ Team Space

Sistema de gestão da equipe de TI da Escola Americana do Rio de Janeiro.

## Funcionalidades

- **Lista de Pedidos** — solicitações com prioridade, status e área de produto
- **Lista de Tarefas** — tarefas com responsáveis, prazo e status
- **Páginas dinâmicas**: Notas, Checklist, Calendário de Reuniões, Mural de Avisos, Agenda de Contatos, Kanban
- **Gerenciamento de usuários** (admin)
- Identidade visual EARJ (azul #1A3A8C + navy #111827)

---

## Deploy — passo a passo

### 1. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta grátis
2. Clique em **New Project** e configure nome, senha e região (South America - São Paulo)
3. Aguarde o projeto inicializar (~2 min)

### 2. Criar o banco de dados

1. No painel do Supabase, vá em **SQL Editor**
2. Clique em **New query**
3. Cole o conteúdo do arquivo `supabase-schema.sql`
4. Clique em **Run**

### 3. Criar o primeiro usuário admin

1. No Supabase, vá em **Authentication → Users**
2. Clique em **Add user → Create new user**
3. Preencha email e senha
4. Após criar, vá em **Table Editor → profiles**
5. Encontre o usuário e mude o campo `role` para `admin`

### 4. Configurar variáveis de ambiente

1. No Supabase, vá em **Project Settings → API**
2. Copie a **Project URL** e a **anon public key**
3. Na raiz do projeto, crie um arquivo `.env`:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
```

### 5. Deploy no Vercel

1. Crie uma conta em [vercel.com](https://vercel.com)
2. Instale o Vercel CLI: `npm i -g vercel`
3. Na pasta do projeto, rode:

```bash
npm install
vercel
```

4. Ou suba para um repositório GitHub e conecte no Vercel (recomendado)
5. No Vercel, configure as variáveis de ambiente (mesmas do `.env`)

### 6. Testar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173`

---

## Estrutura do projeto

```
src/
  components/
    AppLayout.tsx        # Sidebar e layout principal
    AddPageDialog.tsx    # Dialog para criar páginas dinâmicas
    TeamColumnsManager.tsx # Colunas customizadas
    ui/                  # Componentes shadcn/ui
  contexts/
    AuthContext.tsx      # Autenticação Supabase
  hooks/
    useSettings.ts       # Configurações e defaults
  integrations/
    supabase/client.ts   # Cliente Supabase
  pages/
    Login.tsx            # Tela de login
    Home.tsx             # Dashboard inicial
    TeamRequests.tsx     # Lista de Pedidos
    TeamTasks.tsx        # Lista de Tarefas
    TeamPageView.tsx     # Páginas dinâmicas
    UserManagement.tsx   # Gerenciar usuários
```

---

## Cores EARJ

| Cor | Hex | Uso |
|-----|-----|-----|
| Azul primário | `#1A3A8C` | Sidebar, botões, links |
| Navy | `#111827` | Fundo sidebar (dark) |
| Vermelho | `#C0272D` | Destructive / alertas |
| Verde | `#2E7D32` | Sucesso |
| Âmbar | `#F5A623` | Avisos |

---

## Contato de TI

cpinho@earj.com.br · jvmattos@earj.com.br · gfurtado@earj.com.br
