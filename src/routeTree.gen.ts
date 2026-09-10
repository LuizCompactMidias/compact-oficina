/* eslint-disable */
// @ts-nocheck
// Generated-compatible route tree for the Compact Oficina template.

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as AuthenticatedRouteRouteImport } from './routes/_authenticated/route'
import { Route as LoginRouteImport } from './routes/login'
import { Route as AuthenticatedAdminRouteImport } from './routes/_authenticated/admin'
import { Route as AcompanharTokenRouteImport } from './routes/acompanhar.$token'
import { Route as ServicosSlugRouteImport } from './routes/servicos.$slug'

const IndexRoute = IndexRouteImport.update({ id:'/', path:'/', getParentRoute:()=>rootRouteImport } as any)
const AuthenticatedRouteRoute = AuthenticatedRouteRouteImport.update({ id:'/_authenticated', getParentRoute:()=>rootRouteImport } as any)
const LoginRoute = LoginRouteImport.update({ id:'/login', path:'/login', getParentRoute:()=>rootRouteImport } as any)
const AuthenticatedAdminRoute = AuthenticatedAdminRouteImport.update({ id:'/admin', path:'/admin', getParentRoute:()=>AuthenticatedRouteRoute } as any)
const AcompanharTokenRoute = AcompanharTokenRouteImport.update({ id:'/acompanhar/$token', path:'/acompanhar/$token', getParentRoute:()=>rootRouteImport } as any)
const ServicosSlugRoute = ServicosSlugRouteImport.update({ id:'/servicos/$slug', path:'/servicos/$slug', getParentRoute:()=>rootRouteImport } as any)

export interface FileRoutesByFullPath { '/':typeof IndexRoute; '/login':typeof LoginRoute; '/admin':typeof AuthenticatedAdminRoute; '/acompanhar/$token':typeof AcompanharTokenRoute; '/servicos/$slug':typeof ServicosSlugRoute }
export interface FileRoutesByTo { '/':typeof IndexRoute; '/login':typeof LoginRoute; '/admin':typeof AuthenticatedAdminRoute; '/acompanhar/$token':typeof AcompanharTokenRoute; '/servicos/$slug':typeof ServicosSlugRoute }
export interface FileRoutesById { __root__:typeof rootRouteImport; '/':typeof IndexRoute; '/_authenticated':typeof AuthenticatedRouteRouteWithChildren; '/login':typeof LoginRoute; '/_authenticated/admin':typeof AuthenticatedAdminRoute; '/acompanhar/$token':typeof AcompanharTokenRoute; '/servicos/$slug':typeof ServicosSlugRoute }
export interface FileRouteTypes { fileRoutesByFullPath:FileRoutesByFullPath; fullPaths:'/'|'/login'|'/admin'|'/acompanhar/$token'|'/servicos/$slug'; fileRoutesByTo:FileRoutesByTo; to:'/'|'/login'|'/admin'|'/acompanhar/$token'|'/servicos/$slug'; id:'__root__'|'/'|'/_authenticated'|'/login'|'/_authenticated/admin'|'/acompanhar/$token'|'/servicos/$slug'; fileRoutesById:FileRoutesById }
export interface RootRouteChildren { IndexRoute:typeof IndexRoute; AuthenticatedRouteRoute:typeof AuthenticatedRouteRouteWithChildren; LoginRoute:typeof LoginRoute; AcompanharTokenRoute:typeof AcompanharTokenRoute; ServicosSlugRoute:typeof ServicosSlugRoute }

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': { id:'/'; path:'/'; fullPath:'/'; preLoaderRoute:typeof IndexRouteImport; parentRoute:typeof rootRouteImport }
    '/_authenticated': { id:'/_authenticated'; path:''; fullPath:'/'; preLoaderRoute:typeof AuthenticatedRouteRouteImport; parentRoute:typeof rootRouteImport }
    '/login': { id:'/login'; path:'/login'; fullPath:'/login'; preLoaderRoute:typeof LoginRouteImport; parentRoute:typeof rootRouteImport }
    '/_authenticated/admin': { id:'/_authenticated/admin'; path:'/admin'; fullPath:'/admin'; preLoaderRoute:typeof AuthenticatedAdminRouteImport; parentRoute:typeof AuthenticatedRouteRoute }
    '/acompanhar/$token': { id:'/acompanhar/$token'; path:'/acompanhar/$token'; fullPath:'/acompanhar/$token'; preLoaderRoute:typeof AcompanharTokenRouteImport; parentRoute:typeof rootRouteImport }
    '/servicos/$slug': { id:'/servicos/$slug'; path:'/servicos/$slug'; fullPath:'/servicos/$slug'; preLoaderRoute:typeof ServicosSlugRouteImport; parentRoute:typeof rootRouteImport }
  }
}
interface AuthenticatedRouteRouteChildren { AuthenticatedAdminRoute:typeof AuthenticatedAdminRoute }
const AuthenticatedRouteRouteChildren:AuthenticatedRouteRouteChildren={AuthenticatedAdminRoute}
const AuthenticatedRouteRouteWithChildren=AuthenticatedRouteRoute._addFileChildren(AuthenticatedRouteRouteChildren)
const rootRouteChildren:RootRouteChildren={IndexRoute,AuthenticatedRouteRoute:AuthenticatedRouteRouteWithChildren,LoginRoute,AcompanharTokenRoute,ServicosSlugRoute}
export const routeTree=rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()

import type { getRouter } from './router.tsx'
declare module '@tanstack/react-router' { interface Register { router:ReturnType<typeof getRouter> } }
