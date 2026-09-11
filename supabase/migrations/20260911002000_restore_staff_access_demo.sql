create schema if not exists private;

create table if not exists private.staff_invites (
  email text primary key,
  full_name text not null,
  role text not null check (role in ('admin','atendimento','tecnico','financeiro')),
  active boolean not null default true,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into private.staff_invites(email,full_name,role,active,used_at)
select lower(u.email),coalesce(p.full_name,split_part(u.email,'@',1)),coalesce(p.role,'atendimento'),coalesce(p.active,true),u.created_at
from auth.users u left join public.profiles p on p.id=u.id
where u.email is not null
on conflict(email) do update set full_name=excluded.full_name,role=excluded.role,active=excluded.active,used_at=coalesce(private.staff_invites.used_at,excluded.used_at),updated_at=now();

create or replace function public.list_staff_access()
returns table(email text,full_name text,role text,active boolean,has_account boolean,profile_id uuid,invite_used_at timestamptz,created_at timestamptz)
language plpgsql security definer set search_path=public,private,auth,pg_temp as $$
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role='admin') then raise exception 'Apenas administradores podem gerenciar usuários'; end if;
  return query
  select lower(coalesce(u.email,i.email))::text,coalesce(p.full_name,i.full_name,'Usuário')::text,coalesce(p.role,i.role,'atendimento')::text,coalesce(p.active,i.active,false),(u.id is not null),u.id,i.used_at,coalesce(u.created_at,i.created_at)
  from private.staff_invites i full join auth.users u on lower(u.email)=i.email left join public.profiles p on p.id=u.id
  where i.email is not null or u.id is not null order by coalesce(p.full_name,i.full_name,u.email);
end; $$;

create or replace function public.manage_staff_access(p_email text,p_full_name text,p_role text,p_active boolean default true)
returns void language plpgsql security definer set search_path=public,private,auth,pg_temp as $$
declare v_email text:=lower(trim(coalesce(p_email,'')));v_name text:=trim(coalesce(p_full_name,''));v_user_id uuid;begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role='admin') then raise exception 'Apenas administradores podem gerenciar usuários'; end if;
  if v_email='' or position('@' in v_email)<2 then raise exception 'Informe um e-mail válido'; end if;
  if v_name='' then raise exception 'Informe o nome do usuário'; end if;
  if p_role not in ('admin','atendimento','tecnico','financeiro') then raise exception 'Perfil inválido'; end if;
  select u.id into v_user_id from auth.users u where lower(u.email)=v_email limit 1;
  if v_user_id=auth.uid() and (p_role<>'admin' or p_active=false) then raise exception 'Você não pode remover seu próprio acesso administrativo'; end if;
  insert into private.staff_invites(email,full_name,role,active,used_at)
  values(v_email,v_name,p_role,p_active,case when v_user_id is null and p_active then null else (select si.used_at from private.staff_invites si where si.email=v_email) end)
  on conflict(email) do update set full_name=excluded.full_name,role=excluded.role,active=excluded.active,used_at=case when v_user_id is null and excluded.active then null else private.staff_invites.used_at end,updated_at=now();
  if v_user_id is not null then insert into public.profiles(id,full_name,role,active) values(v_user_id,v_name,p_role,p_active) on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,active=excluded.active,updated_at=now(); end if;
end; $$;

create or replace function public.delete_staff_access(p_email text)
returns void language plpgsql security definer set search_path=public,private,auth,pg_temp as $$
declare v_email text:=lower(trim(coalesce(p_email,'')));v_user_id uuid;v_role text;v_active boolean;v_admins integer;begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role='admin') then raise exception 'Apenas administradores podem excluir usuários'; end if;
  select u.id into v_user_id from auth.users u where lower(u.email)=v_email limit 1;
  if v_user_id=auth.uid() then raise exception 'Você não pode excluir sua própria conta'; end if;
  select coalesce(p.role,i.role),coalesce(p.active,i.active,false) into v_role,v_active from private.staff_invites i left join public.profiles p on p.id=v_user_id where i.email=v_email limit 1;
  if v_role='admin' and coalesce(v_active,false) then select count(*)::integer into v_admins from private.staff_invites i where i.role='admin' and i.active=true; if v_admins<=1 then raise exception 'Não é possível excluir o último administrador ativo'; end if; end if;
  if v_user_id is not null then delete from public.profiles where id=v_user_id; delete from auth.users where id=v_user_id; end if;
  delete from private.staff_invites where email=v_email;
end; $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare invite_row private.staff_invites%rowtype;begin
  if new.email is null then raise exception 'Cadastro não autorizado'; end if;
  select * into invite_row from private.staff_invites where email=lower(new.email) and active=true and used_at is null for update;
  if not found then raise exception 'E-mail não autorizado para acesso ao COMPACT Centro Automotivo'; end if;
  insert into public.profiles(id,full_name,role,active) values(new.id,invite_row.full_name,invite_row.role,true)
  on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,active=true,updated_at=now();
  update private.staff_invites set used_at=now(),updated_at=now() where email=invite_row.email;
  return new;
end; $$;

revoke all on function public.list_staff_access() from public,anon;
revoke all on function public.manage_staff_access(text,text,text,boolean) from public,anon;
revoke all on function public.delete_staff_access(text) from public,anon;
grant execute on function public.list_staff_access() to authenticated;
grant execute on function public.manage_staff_access(text,text,text,boolean) to authenticated;
grant execute on function public.delete_staff_access(text) to authenticated;
