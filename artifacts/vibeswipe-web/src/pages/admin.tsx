import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useClerk, useUser } from '@clerk/react';
import { getGetAdminSessionQueryKey, useGetAdminSession } from '@workspace/api-client-react';
import { Lock, RotateCw, ServerCrash, ShieldX } from 'lucide-react';
import '@/components/admin/admin.css';
import { AdminShell, AdminWordmark, ADMIN_NAV, type AdminSectionKey } from '@/components/admin/admin-shell';
import { AdminToastProvider, clearAdmin } from '@/components/admin/admin-hooks';
import { adminError, errorStatus } from '@/components/admin/admin-ui';
import { DrawerCtx, type DrawerApi } from '@/components/admin/section-kit';
import { UserDrawer } from '@/components/admin/user-drawer';
import { ChatDrawer } from '@/components/admin/chat-drawer';
import { OverviewSection } from '@/components/admin/sections/overview';
import { UsersSection } from '@/components/admin/sections/users';
import { ChatsSection } from '@/components/admin/sections/chats';
import { PostsSection } from '@/components/admin/sections/posts';
import { ConnectionsSection } from '@/components/admin/sections/connections';
import { OnlineSection } from '@/components/admin/sections/online';
import { VerificationsSection } from '@/components/admin/sections/verifications';
import { SettingsSection } from '@/components/admin/sections/settings';
import NotFound from '@/pages/not-found';

function GateScreen({ icon, title, detail, children, testId }: { icon: ReactNode; title: string; detail: string; children?: ReactNode; testId: string }) {
  return <div className="vs-admin grid min-h-[100dvh] place-items-center px-5 py-10" data-testid={testId}>
    <div className="a-fade w-full max-w-[420px]">
      <AdminWordmark />
      <div className="a-panel mt-8 p-7">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#f34e9a]/10 text-[var(--a-rose)]">{icon}</div>
        <h1 className="brand mt-5 text-2xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--a-mute)]">{detail}</p>
        {children && <div className="mt-6 flex flex-wrap gap-2">{children}</div>}
      </div>
    </div>
  </div>;
}
const primaryBtn = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--a-rose)] px-5 text-sm font-extrabold text-[#24111b]';
const ghostBtn = 'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-bold hover:bg-white/5';

function AdminLoading() {
  return <div className="vs-admin lg:pl-[240px]" aria-label="Loading admin console" data-testid="status-admin-loading">
    <div className="fixed inset-y-0 left-0 hidden w-[240px] border-r border-[var(--a-line)] bg-[var(--a-panel)] p-5 lg:block"><div className="a-skel h-8 w-32" /><div className="mt-10 space-y-2">{ADMIN_NAV.map(n => <div key={n.key} className="a-skel h-9" />)}</div></div>
    <div className="h-16 border-b border-[var(--a-line)]" />
    <div className="mx-auto max-w-[1240px] p-6"><div className="a-skel h-10 w-64" /><div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="a-skel h-28" />)}</div></div>
  </div>;
}

export default function AdminPage() {
  const params = useParams<{ section?: string }>();
  const section = (params.section ?? 'overview') as AdminSectionKey;
  const valid = ADMIN_NAV.some(n => n.key === section);
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const qc = useQueryClient();
  const session = useGetAdminSession({ query: { queryKey: [...getGetAdminSessionQueryKey(), user?.id ?? 'signed-out'], enabled: Boolean(isLoaded && isSignedIn), retry: false, staleTime: 60_000 } });
  const [userId, setUserId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const drawers = useMemo<DrawerApi>(() => ({
    openUser: id => { setChatId(null); setUserId(id); },
    openChat: id => { setUserId(null); setChatId(id); },
    closeAll: () => { setUserId(null); setChatId(null); },
  }), []);
  // Close detail drawers when switching sections.
  useEffect(() => { setUserId(null); setChatId(null); }, [section]);
  // Purge admin data the moment the Clerk session ends.
  const wasSignedIn = useRef(false);
  useEffect(() => { if (isSignedIn) wasSignedIn.current = true; else if (wasSignedIn.current) { clearAdmin(qc); setUserId(null); setChatId(null); } }, [isSignedIn, qc]);
  const previousAccount = useRef(user?.id);
  useEffect(() => {
    if (previousAccount.current && previousAccount.current !== user?.id) {
      clearAdmin(qc);
      setUserId(null);
      setChatId(null);
    }
    previousAccount.current = user?.id;
  }, [user?.id, qc]);

  const doSignOut = useCallback(async () => {
    setUserId(null); setChatId(null);
    clearAdmin(qc);
    await signOut({ redirectUrl: `${import.meta.env.BASE_URL.replace(/\/$/, '')}/admin` });
  }, [qc, signOut]);

  if (!isLoaded) return <AdminLoading />;
  if (!isSignedIn) return <GateScreen testId="screen-admin-signin" icon={<Lock size={20} />} title="Sign in to the console" detail="This area is for Myage administrators. Sign in with the account that has admin access. A dating profile is not required.">
    <Link href={`/sign-in?redirect_url=${encodeURIComponent(`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/admin`)}`} data-testid="link-admin-signin" className={primaryBtn}>Sign in</Link>
    <Link href="/" data-testid="link-admin-home" className={ghostBtn}>Back to Myage</Link>
  </GateScreen>;
  if (session.isLoading) return <AdminLoading />;
  if (session.isError || !session.data) {
    const st = errorStatus(session.error);
    if (st === 401) return <GateScreen testId="screen-admin-expired" icon={<Lock size={20} />} title="Session expired" detail="Your sign-in is no longer valid. Sign in again to continue."><button type="button" onClick={() => void doSignOut()} data-testid="button-admin-resignin" className={primaryBtn}>Sign in again</button></GateScreen>;
    if (st === 403) return <GateScreen testId="screen-admin-denied" icon={<ShieldX size={20} />} title="No admin access" detail="You are signed in, but this account is not an administrator. Access is granted on the server, not from this screen.">
      <Link href="/" data-testid="link-admin-denied-home" className={ghostBtn}>Back to Myage</Link>
      <button type="button" onClick={() => void doSignOut()} data-testid="button-admin-denied-signout" className={primaryBtn}>Use another account</button>
    </GateScreen>;
    return <GateScreen testId="screen-admin-config-error" icon={<ServerCrash size={20} />} title={st === 503 || st === 500 ? 'Admin is not configured' : 'Console unavailable'} detail={st === 503 || st === 500 ? 'The server could not verify admin access. The admin allow-list may be missing on the server. Nothing has been changed.' : adminError(session.error, 'The admin service could not be reached.')}>
      <button type="button" onClick={() => void session.refetch()} data-testid="button-admin-session-retry" className={primaryBtn}><RotateCw size={15} />Retry</button>
    </GateScreen>;
  }

  const content = !valid ? <NotFound /> :
    section === 'overview' ? <OverviewSection /> :
    section === 'users' ? <UsersSection /> :
    section === 'chats' ? <ChatsSection /> :
    section === 'posts' ? <PostsSection /> :
    section === 'connections' ? <ConnectionsSection /> :
    section === 'verifications' ? <VerificationsSection /> :
    section === 'online' ? <OnlineSection /> :
    <SettingsSection session={session.data} onSignOut={doSignOut} />;

  return <div className="vs-admin">
    <AdminToastProvider>
      <DrawerCtx.Provider value={drawers}>
        <AdminShell active={valid ? section : 'overview'} session={session.data} onSignOut={() => void doSignOut()}>
          <div key={section} className="a-fade">{content}</div>
        </AdminShell>
        {userId && <UserDrawer key={userId} userId={userId} onClose={() => setUserId(null)} />}
        {chatId && <ChatDrawer key={chatId} chatId={chatId} onClose={() => setChatId(null)} />}
      </DrawerCtx.Provider>
    </AdminToastProvider>
  </div>;
}
