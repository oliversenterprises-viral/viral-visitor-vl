import { escapeHtml } from '../content';
import {
  TalkAdminError,
  invokeRacerTalk,
  loadTalkPeople,
  loadTalkThread,
  type TalkMessage,
  type TalkPerson,
} from '../lib/racer-talk-admin';

export const TALK_TITLE = 'Message verified racers';
export const TALK_LEAD =
  'Anyone with a credited friend Get-link. They see it when they open ViralRefer — email is optional. You can also type any VIRAL- code.';

function formatTalkTime(value: string | undefined): string {
  const ms = Date.parse(String(value || ''));
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : '';
}

export function renderTalkView(
  content: HTMLElement,
  people: TalkPerson[],
  code: string,
  messages: TalkMessage[],
  status: string,
): void {
  const peopleHtml = people
    .map((person) => {
      const on = person.code === code ? ' ring-1 ring-emerald-400/60 bg-white/10' : '';
      const unread =
        person.unread > 0
          ? `<span class="ml-auto text-[10px] rounded-full bg-emerald-500/20 text-emerald-200 px-2 py-0.5">${person.unread}</span>`
          : '';
      return `<button type="button" class="w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl hover:bg-white/5${on}" data-talk-code="${escapeHtml(person.code)}">
        <span class="font-mono text-sm">${escapeHtml(person.code)}</span>
        <span class="text-xs text-zinc-500">${person.friends} verified friend${person.friends === 1 ? '' : 's'}</span>
        ${unread}
      </button>`;
    })
    .join('');

  const threadHtml = messages
    .map((msg) => {
      const mine = msg.from_role === 'owner';
      return `<article class="rounded-xl px-3 py-2 ${mine ? 'bg-emerald-500/10' : 'bg-white/5'}">
        <p class="text-[11px] text-zinc-500">${mine ? 'You' : escapeHtml(code)}</p>
        <p class="text-sm text-zinc-100 whitespace-pre-wrap">${escapeHtml(String(msg.body || ''))}</p>
        <p class="text-[10px] text-zinc-600">${escapeHtml(formatTalkTime(msg.created_at))}</p>
      </article>`;
    })
    .join('');

  content.innerHTML = `
    <div class="space-y-4" data-owner-talk="1">
      <header>
        <p class="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Talk</p>
        <h2 class="text-2xl font-bold text-white mt-1">${escapeHtml(TALK_TITLE)}</h2>
        <p class="text-sm text-zinc-400 mt-1 max-w-2xl">${escapeHtml(TALK_LEAD)}</p>
      </header>
      <div class="grid md:grid-cols-[16rem_1fr] gap-4">
        <aside class="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
          <label class="block text-xs text-zinc-500 mb-2">Open a code
            <input id="hq-talk-code" type="text" class="mt-1 w-full min-h-[44px] rounded-xl bg-white/5 border border-white/10 px-3 font-mono" placeholder="VIRAL-…" value="${escapeHtml(code)}" />
          </label>
          <div class="space-y-1" role="list">${peopleHtml || '<p class="text-sm text-zinc-500">No verified racers yet.</p>'}</div>
        </aside>
        <section class="rounded-2xl border border-white/10 bg-zinc-900/40 p-4 flex flex-col min-h-[28rem]">
          <p class="text-sm text-zinc-400 mb-2">${code ? `Thread · <span class="font-mono text-white">${escapeHtml(code)}</span>` : 'Pick a racer to talk.'}</p>
          <div id="hq-talk-thread" class="flex-1 space-y-2">${threadHtml || '<p class="text-sm text-zinc-500">No messages yet.</p>'}</div>
          <form id="hq-talk-form" class="mt-3 flex flex-col gap-2">
            <label class="sr-only" for="hq-talk-body">Message</label>
            <textarea id="hq-talk-body" required maxlength="2000" rows="3" class="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm" placeholder="Write to this racer…" ${code ? '' : 'disabled'}></textarea>
            <div class="flex items-center gap-3">
              <button type="submit" class="min-h-[44px] px-4 rounded-xl bg-emerald-500/20 text-emerald-100 font-semibold" ${code ? '' : 'disabled'}>Send</button>
              <p id="hq-talk-status" class="text-sm text-zinc-400" role="status">${escapeHtml(status)}</p>
            </div>
          </form>
        </section>
      </div>
    </div>
  `;
}

export async function renderRacerTalkTab(content: HTMLElement): Promise<void> {
  let people: TalkPerson[] = [];
  let code = '';
  let messages: TalkMessage[] = [];
  let status = '';

  const paint = () => renderTalkView(content, people, code, messages, status);

  const openCode = async (next: string) => {
    code = next.trim().toUpperCase();
    if (!code) {
      messages = [];
      paint();
      bind();
      return;
    }
    try {
      messages = await loadTalkThread(code);
      status = '';
    } catch (err) {
      messages = [];
      status = err instanceof Error ? err.message : String(err);
    }
    paint();
    bind();
  };

  const bind = () => {
    content.querySelectorAll<HTMLElement>('[data-talk-code]').forEach((btn) => {
      btn.addEventListener('click', () => {
        void openCode(btn.dataset.talkCode || '');
      });
    });
    const input = content.querySelector<HTMLInputElement>('#hq-talk-code');
    input?.addEventListener('change', () => {
      void openCode(input.value);
    });
    content.querySelector<HTMLFormElement>('#hq-talk-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const body = content.querySelector<HTMLTextAreaElement>('#hq-talk-body')?.value || '';
      if (!code || !body.trim()) return;
      void invokeRacerTalk('owner_send', { code, body }).then((result) => {
        status = result.success ? 'Sent.' : String(result.error || 'Could not send.');
        void openCode(code);
      });
    });
  };

  try {
    people = await loadTalkPeople();
    code = people[0]?.code || '';
    paint();
    bind();
    if (code) await openCode(code);
  } catch (err) {
    const message =
      err instanceof TalkAdminError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Could not load Talk. Try again.';
    content.innerHTML = `
      <div class="p-6 text-amber-400 border border-amber-500/30 rounded-2xl" data-owner-talk="1">
        <div class="font-semibold mb-1">Unable to load Talk</div>
        <div class="text-sm text-zinc-400">${escapeHtml(message)}</div>
      </div>
    `;
  }
}
