# COMPACT Centro Automotivo

Projeto-mestre replicável para oficinas e centros automotivos. A aplicação separa a landing page pública da área administrativa autenticada e usa Supabase como backend.

## O que já está nesta base

- Landing page responsiva na identidade preta + dourado COMPACT.
- Login administrativo com Supabase Auth.
- Dashboard operacional.
- Clientes e veículos.
- Ordens de serviço.
- Orçamentos.
- Catálogo de serviços.
- Estoque e peças.
- Agenda.
- Financeiro e despesas.
- Relatórios.
- Usuários e perfis.
- Configurações da oficina.
- Acompanhamento público da OS por token.
- Páginas individuais de serviços.
- Schema SQL completo para uma instalação nova.

## Instalação para uma nova oficina

1. Duplique este repositório para o cliente.
2. Crie um projeto Supabase exclusivo para essa oficina.
3. Execute `supabase/migrations/20260910180000_compact_oficina_base.sql` no projeto novo.
4. Copie `.env.example` para `.env` e preencha somente as chaves do Supabase dessa oficina.
5. Instale as dependências com `bun install`.
6. Rode `bun run dev`.
7. Crie o primeiro usuário em Supabase Authentication. O trigger cria automaticamente o perfil administrativo.
8. Entre em `/admin` e preencha os dados em **Configurações da oficina**.

## Variáveis de ambiente

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Nunca coloque `service_role`, `sb_secret_*` ou outras credenciais privadas no frontend ou no GitHub.

## Personalização de marca

A identidade padrão fica centralizada em `src/lib/brand.ts`. Nome, slogan, cores e caminhos dos logos podem ser alterados ali. Os dados comerciais específicos de cada oficina — telefone, WhatsApp, CNPJ, endereço, e-mail e site — ficam na tabela `app_settings` e são editáveis no painel.

Assets atuais:

- `public/compact-logo.webp`
- `public/compact-icon.webp`

## Rotas principais

- `/` — site público
- `/login` — login
- `/admin` — sistema administrativo protegido
- `/acompanhar/:token` — acompanhamento público de uma OS
- `/servicos/:slug` — página de serviço

## Segurança e replicação

Este projeto não contém o `.env` nem as credenciais do PORFIRID. Cada cliente deve usar seu próprio banco e suas próprias chaves. O vínculo `.lovable` do projeto original também não foi copiado, evitando que novas implantações fiquem presas ao projeto antigo.
