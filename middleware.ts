import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function middleware(request:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 // Local preview can run without project credentials. Real deployment always uses Supabase auth.
 if(!url||!key)return NextResponse.next();
 let response=NextResponse.next({request});
 const supabase=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll(cookies:{name:string;value:string;options:CookieOptions}[]){cookies.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});cookies.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 const {data:{user}}=await supabase.auth.getUser();
 if(!user&&!['/login','/forgot-password','/auth/callback'].some(p=>request.nextUrl.pathname.startsWith(p))&&!request.nextUrl.pathname.startsWith('/verify/')){const target=request.nextUrl.clone();target.pathname='/login';target.searchParams.set('next',request.nextUrl.pathname);return NextResponse.redirect(target);}
 if(user){const {data:profile}=await supabase.from('profiles').select('role,status').eq('id',user.id).maybeSingle();
  if(!profile){await supabase.auth.signOut();const target=request.nextUrl.clone();target.pathname='/login';target.searchParams.set('error','unprovisioned');return NextResponse.redirect(target);}
  if(profile.status==='inactive'){await supabase.auth.signOut();const target=request.nextUrl.clone();target.pathname='/login';target.searchParams.set('error','inactive');return NextResponse.redirect(target);}
  if(request.nextUrl.pathname.startsWith('/admin')&&profile?.role!=='admin'){const target=request.nextUrl.clone();target.pathname='/handler';return NextResponse.redirect(target);}
  if(request.nextUrl.pathname.startsWith('/handler')&&profile?.role==='admin'){const target=request.nextUrl.clone();target.pathname='/admin';return NextResponse.redirect(target);}
  if(request.nextUrl.pathname==='/'){const target=request.nextUrl.clone();target.pathname=profile.role==='admin'?'/admin':'/handler';return NextResponse.redirect(target);}
 }
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']};
