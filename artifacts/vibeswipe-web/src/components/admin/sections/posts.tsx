import { useEffect, useState } from 'react';
import { useSearch } from 'wouter';
import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import {
  getGetAdminPostMediaQueryKey, getGetAdminPostsQueryKey, useGetAdminPostMedia, useGetAdminPosts,
  useRemoveAdminPost,
} from '@workspace/api-client-react';
import { Eye, Film, Image as ImageIcon, Trash2 } from 'lucide-react';
import { invalidateAdmin, useAdminToast, useDebounced } from '../admin-hooks';
import { ConfirmDialog, type ConfirmRequest } from '../confirm-dialog';
import { adminError, EmptyState, ErrorBox, Pager, Pill, Skeleton, UserMark, utc } from '../admin-ui';
import { SearchField, SectionHeader, useDrawers } from '../section-kit';

export function useAdminPosts(params: { page: number; q?: string; userId?: string; kind?: 'all' | 'reel' | 'story' }) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== '')) as typeof params;
  return useGetAdminPosts(clean, {
    query: {
      queryKey: getGetAdminPostsQueryKey(clean),
      placeholderData: keepPreviousData,
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
      retry: 1,
    },
  });
}

type Post = NonNullable<ReturnType<typeof useAdminPosts>['data']>['posts'][number];

function statusTone(status: Post['status']): 'mute' | 'mint' | 'amber' | 'red' {
  if (status === 'published') return 'mint';
  if (status === 'processing') return 'amber';
  if (status === 'blocked' || status === 'deleted') return 'red';
  return 'mute';
}

function PostMedia({ post, inspect }: { post: Post; inspect: boolean }) {
  const mediaId = post.mediaUrl?.startsWith('media:') ? post.mediaUrl.slice(6) : '';
  const media = useGetAdminPostMedia(mediaId, {
    query: {
      queryKey: getGetAdminPostMediaQueryKey(mediaId), enabled: inspect && !!mediaId, retry: 1,
      staleTime: 0, refetchOnMount: 'always',
    },
  });
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!media.data) return;
    const objectUrl = URL.createObjectURL(media.data);
    setUrl(objectUrl);
    return () => { URL.revokeObjectURL(objectUrl); setUrl(''); };
  }, [media.data]);
  if (!inspect) return null;
  return <div className="mt-3 overflow-hidden rounded-xl border border-[var(--a-line)] bg-black/20">
    {!mediaId ? <div className="p-3 text-xs text-[var(--a-mute)]">Media is not available for inspection.</div>
      : media.isError ? <div role="alert" className="p-3 text-xs text-[#ff9aa3]">Private media could not be loaded.</div>
      : !url ? <div className="a-skel aspect-video" aria-label="Loading private media" />
      : post.mediaType === 'video'
        ? <video src={url} controls playsInline preload="metadata" className="max-h-[420px] w-full bg-black" aria-label={`Inspect ${post.kind} by ${post.authorName}`} />
        : <img src={url} alt={`Inspect ${post.kind} by ${post.authorName}`} className="max-h-[420px] w-full object-contain" />}
  </div>;
}

function PostRow({ post, onRemove }: { post: Post; onRemove: (post: Post) => void }) {
  const { openUser } = useDrawers();
  const [inspect, setInspect] = useState(false);
  return <li className="a-fade grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start" data-testid={`row-admin-post-${post.kind}-${post.id}`}>
    <div className="min-w-0">
      <div className="flex items-start gap-3">
        <UserMark name={post.authorName} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => openUser(post.authorId)} className="truncate text-left font-bold hover:text-[#ff8cc0]" data-testid={`button-post-author-${post.id}`}>{post.authorName}</button>
            <Pill tone="mute">{post.kind === 'reel' ? <><Film size={11} />Reel</> : <><ImageIcon size={11} />Story</>}</Pill>
            <Pill tone={statusTone(post.status)}>{post.status}</Pill>
          </div>
          <div className="mono mt-1 break-all text-[10px] text-[var(--a-mute)]">Owner {post.authorId}</div>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{post.caption || <span className="italic text-[var(--a-mute)]">No caption</span>}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--a-mute)]">
        <span>Posted <time title={utc(post.createdAt)}>{utc(post.createdAt)}</time></span>
        {post.expiresAt && <span>Expires <time title={utc(post.expiresAt)}>{utc(post.expiresAt)}</time></span>}
      </div>
      <PostMedia post={post} inspect={inspect} />
    </div>
    <div className="flex gap-2 md:justify-end">
      <button type="button" onClick={() => setInspect(value => !value)} disabled={!post.mediaUrl} data-testid={`button-inspect-post-${post.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--a-line)] px-3 text-xs font-bold hover:bg-white/5 disabled:opacity-40">
        <Eye size={13} />{inspect ? 'Hide media' : 'Inspect'}
      </button>
      <button type="button" onClick={() => onRemove(post)} data-testid={`button-remove-post-${post.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#f06b76]/30 px-3 text-xs font-bold text-[#ff9aa3] hover:bg-[#f06b76]/10">
        <Trash2 size={13} />Remove
      </button>
    </div>
  </li>;
}

export function PostsSection() {
  const search = useSearch();
  const qc = useQueryClient();
  const toast = useAdminToast();
  const [q, setQ] = useState(() => new URLSearchParams(search).get('q') ?? '');
  const [userId, setUserId] = useState(() => new URLSearchParams(search).get('userId') ?? '');
  const [kind, setKind] = useState<'all' | 'reel' | 'story'>('all');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(search);
    setQ(params.get('q') ?? '');
    setUserId(params.get('userId') ?? '');
    setPage(1);
  }, [search]);
  const dq = useDebounced(q.trim());
  const du = useDebounced(userId.trim());
  useEffect(() => setPage(1), [dq, du, kind]);
  const result = useAdminPosts({ page, q: dq || undefined, userId: du || undefined, kind });
  const data = result.data;
  const remove = useRemoveAdminPost();

  function requestRemoval(post: Post) {
    setConfirm({
      title: `Remove this ${post.kind}?`,
      detail: `This permanently removes the ${post.kind} from VibeSwipes. The action is written to the administrator audit log. Type REMOVE to confirm.`,
      confirmLabel: `Remove ${post.kind}`,
      word: 'REMOVE',
      onConfirm: async confirmation => {
        if (confirmation !== 'REMOVE') return false;
        try {
          const response = await remove.mutateAsync({ kind: post.kind, id: post.id, data: { confirmation } });
          toast('ok', response.message || 'Post removed and audited.');
          await invalidateAdmin(qc);
          return true;
        } catch (error) {
          toast('err', adminError(error, 'The post was not removed.'));
          return false;
        }
      },
    });
  }

  return <div>
    <SectionHeader eyebrow="Content" title="Posts oversight" detail="Review published, processing, blocked, expired, and unavailable Reels and Stories. Media loads only after you choose Inspect." />
    <div className="a-panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--a-line)] p-3">
        <SearchField value={q} onChange={setQ} placeholder="Search caption, author, post ID" testId="input-search-admin-posts" />
        <input value={userId} onChange={event => setUserId(event.target.value)} placeholder="Filter by owner ID" aria-label="Filter posts by owner ID" data-testid="input-filter-post-owner" className="h-10 min-w-[190px] flex-1 rounded-xl border border-[var(--a-line)] bg-[var(--a-bg)] px-3 text-sm outline-none focus:border-[#f34e9a]/50" />
        <label className="sr-only" htmlFor="admin-post-kind">Post type</label>
        <select id="admin-post-kind" value={kind} onChange={event => { setKind(event.target.value as typeof kind); setPage(1); }} data-testid="select-admin-post-kind" className="h-10 rounded-xl border border-[var(--a-line)] bg-[var(--a-bg)] px-3 text-sm">
          <option value="all">All posts</option><option value="reel">Reels</option><option value="story">Stories</option>
        </select>
        {data && <span className="mono text-xs text-[var(--a-mute)]" data-testid="text-admin-posts-total">{data.total.toLocaleString()} found</span>}
      </div>
      {result.isError && !data ? <ErrorBox error={result.error} onRetry={() => void result.refetch()} text="Posts could not load." />
        : !data ? <Skeleton rows={6} />
        : data.posts.length === 0 ? <EmptyState title="No posts found" detail={dq || du ? 'Try a different caption, post or owner ID.' : 'Published and expired posts appear here when they exist.'} />
        : <>
          <ul className={`divide-y divide-[var(--a-line)] transition-opacity ${result.isPlaceholderData || result.isFetching ? 'opacity-70' : ''}`}>
            {data.posts.map(post => <PostRow key={`${post.kind}-${post.id}`} post={post} onRemove={requestRemoval} />)}
          </ul>
          <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} testId="pager-admin-posts" />
        </>}
    </div>
    <ConfirmDialog req={confirm} onClose={() => setConfirm(null)} />
  </div>;
}
