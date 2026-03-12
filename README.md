# Cemil Provas - Construtor de Provas SaaS

Este é um sistema full-stack para criação e exportação de provas em formato .DOCX, com suporte a múltiplos blocos de conteúdo, autenticação e controle de acesso (RBAC).

## Funcionalidades
- **Autenticação Segura**: Login com JWT e senhas criptografadas (Bcrypt).
- **Controle de Acesso (RBAC)**: Perfis de Admin e Professor.
- **Construtor Dinâmico**: Adição de textos de apoio, imagens e questões objetivas.
- **Exportação DOCX**: Gera arquivos Word formatados (Times New Roman 12pt, 2 colunas).
- **Gestão de Usuários**: Admin pode cadastrar e excluir professores.

## Tecnologias
- **Frontend**: React, Tailwind CSS, Lucide React.
- **Backend**: Node.js, Express, Better-SQLite3.
- **Documentos**: docx.js.

## Guia de Publicação (Deploy)

Para publicar esta aplicação em produção, siga os passos abaixo:

### 1. Preparação do Banco de Dados
O projeto utiliza SQLite (`better-sqlite3`) para persistência local. Para produção, recomenda-se:
- **Opção A (Simples)**: Manter SQLite se a plataforma de hospedagem suportar volumes persistentes (ex: Railway, Render com Disk).
- **Opção B (Escalável)**: Migrar para PostgreSQL ou MongoDB. Você precisará atualizar a lógica de conexão no `server.ts`.

### 2. Variáveis de Ambiente
Configure as seguintes variáveis no seu painel de controle da nuvem:
- `JWT_SECRET`: Uma string longa e aleatória para assinar os tokens.
- `NODE_ENV`: Defina como `production`.

### 3. Hospedagem (Sugestões)

#### Render / Railway (Full-Stack)
1. Conecte seu repositório GitHub.
2. Escolha "Web Service".
3. **Build Command**: `npm install && npm run build`
4. **Start Command**: `npm start` (Certifique-se de que o `package.json` tem `"start": "node server.ts"` ou use `tsx` se preferir manter TS em produção).
   - *Nota*: No AI Studio, o comando de start é `tsx server.ts`. Para produção real, recomenda-se compilar para JS.

#### Vercel (Frontend) + Render (Backend)
Se preferir separar:
1. **Frontend (Vercel)**: Faça o deploy da pasta `dist` após o build.
2. **Backend (Render)**: Faça o deploy do `server.ts` e configure o CORS para permitir o domínio da Vercel.

### 4. Segurança em Produção
- Certifique-se de que o site está rodando sob **HTTPS**.
- O `server.ts` já está configurado para usar cookies `secure: true` quando `NODE_ENV === "production"`.

## Acesso Inicial
- **Admin Padrão**: `admin@cemil.com`
- **Senha**: `admin123`
- *Recomendação*: Altere a senha do admin assim que fizer o primeiro login.
