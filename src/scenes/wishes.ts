import { gsap } from 'gsap';
import { config } from '../config';
import { wishIcons } from '../art/wish-icons';
import { audio } from '../lib/audio';
import { el, escapeHtml } from '../lib/util';

const copy = config.wishes;
const API = `${import.meta.env.BASE_URL}api/wishes`;
type Wish = { id: string; name: string; message: string; created_at: number };

export class Wishes {
  private root = el('div', 'wishes-overlay');
  private panel = el('section', 'wishes-panel');
  private content = el('div', 'wishes-content');
  private closeButton = el('button', 'wish-round wish-close', wishIcons.close);
  private status = el('p', 'wish-status');
  private form = el('form', 'wish-form');
  private nameInput = el('input', 'wish-name-input');
  private nameText = el('strong', 'wish-name-text');
  private editButton = el('button', 'wish-round wish-edit', wishIcons.edit);
  private message = el('textarea', 'wish-message');
  private submit = el('button', 'wish-primary');
  private sender = '';
  private opened = false;
  private sending = false;
  private previousFocus: HTMLElement | null = null;
  private background: { node: HTMLElement; aria: string | null; inert: boolean }[] = [];
  private pending: { signature: string; id: string } | null = null;
  private listRun = 0;
  private request: AbortController | null = null;
  private viewportFrame = 0;
  private openingHeight = 0;
  private viewport = () => {
    cancelAnimationFrame(this.viewportFrame);
    this.viewportFrame = requestAnimationFrame(() => {
      if (!this.opened) return;
      const v = window.visualViewport;
      const height = v?.height ?? window.innerHeight;
      const active = document.activeElement;
      const editing = active === this.message || active === this.nameInput;
      this.root.classList.toggle('wish-keyboard', this.openingHeight - height > 120 || (editing && height < 500));
      this.root.style.height = `${height}px`;
      this.root.style.top = `${v?.offsetTop ?? 0}px`;
      this.root.style.setProperty('--wish-visible-height', `${height}px`);
      // Cuộn riêng nội dung panel, không kéo cả trang theo ô nhập trên Safari.
      if (editing) {
        const field = (active as HTMLElement).getBoundingClientRect();
        const area = this.content.getBoundingClientRect();
        if (field.bottom > area.bottom - 8) this.content.scrollTop += field.bottom - area.bottom + 8;
        else if (field.top < area.top + 8) this.content.scrollTop -= area.top + 8 - field.top;
      }
    });
  };

  constructor(guest: string, private reduced: boolean, private onOpen: () => void, private onClose: () => void, private onSent: (name: string) => Promise<void>) {
    this.sender = guest.slice(0, 60);
    this.root.hidden = true;
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'true');
    this.panel.setAttribute('aria-labelledby', 'wishes-title');
    this.panel.tabIndex = -1;
    this.closeButton.type = 'button';
    this.closeButton.setAttribute('aria-label', copy.close);
    this.closeButton.addEventListener('click', () => this.close());
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.close(); });
    this.root.addEventListener('focusin', this.viewport);
    this.root.addEventListener('focusout', this.viewport);
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      if (e.key !== 'Tab') return;
      const items = [...this.panel.querySelectorAll<HTMLElement>('button, input, textarea, [tabindex="0"]')]
        .filter((item) => item.getClientRects().length && !item.hasAttribute('disabled'));
      const first = items[0], last = items[items.length - 1];
      if (!first) { e.preventDefault(); this.panel.focus(); return; }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === this.panel)) {
        e.preventDefault(); last!.focus();
      } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === this.panel)) {
        e.preventDefault(); first.focus();
      }
    });
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.panel.append(this.closeButton, this.content, this.status);
    this.root.append(this.panel);
    document.body.append(this.root);
    this.buildForm();
  }

  get isOpen() { return this.opened; }

  private heading(title: string) {
    return `<div class="wish-badge">${wishIcons.mail}<span>✦</span></div><h2 id="wishes-title">${escapeHtml(title)}</h2>`;
  }

  private buildForm() {
    const from = el('div', 'wish-from');
    const label = el('label');
    label.textContent = copy.from;
    label.htmlFor = 'wish-name';
    Object.assign(this.nameInput, { id: 'wish-name', name: 'name', maxLength: 60, required: true, autocomplete: 'name', placeholder: copy.name });
    this.nameInput.setAttribute('aria-label', copy.name);
    this.editButton.type = 'button';
    this.editButton.setAttribute('aria-label', copy.editName);
    this.editButton.addEventListener('click', () => { this.editName(true); this.nameInput.focus(); this.nameInput.select(); });
    this.nameInput.addEventListener('input', () => this.nameInput.setCustomValidity(''));
    this.nameInput.addEventListener('blur', () => {
      this.sender = this.nameInput.value.trim();
      if (this.sender) this.editName(false);
    });
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.message.focus(); }
    });
    from.append(label, this.nameText, this.nameInput, this.editButton);
    Object.assign(this.message, { name: 'message', rows: 3, maxLength: 600, required: true, placeholder: copy.placeholder });
    this.message.setAttribute('aria-label', copy.message);
    this.message.addEventListener('input', () => this.message.setCustomValidity(''));
    const note = el('p', 'wish-note');
    note.id = 'wish-privacy';
    note.textContent = copy.privacy;
    this.message.setAttribute('aria-describedby', note.id);
    this.submit.type = 'submit';
    this.submit.innerHTML = `${wishIcons.send}<span>${escapeHtml(copy.submit)}</span>`;
    this.form.append(from, this.message, note, this.submit);
    this.form.addEventListener('submit', (e) => { e.preventDefault(); void this.send(); });
  }

  private editName(edit: boolean) {
    this.nameInput.hidden = !edit;
    this.nameText.hidden = edit;
    this.editButton.hidden = edit;
    this.nameInput.value = this.sender;
    this.nameText.textContent = this.sender;
  }

  private open() {
    if (this.sending) return false;
    this.listRun++;
    this.request?.abort();
    this.status.textContent = '';
    if (!this.opened) {
      this.previousFocus = document.activeElement as HTMLElement;
      this.opened = true;
      this.openingHeight = window.visualViewport?.height ?? window.innerHeight;
      this.root.hidden = false;
      this.background = [...document.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== this.root && !['SCRIPT', 'STYLE'].includes(node.tagName))
        .map((node) => ({ node, aria: node.getAttribute('aria-hidden'), inert: node.hasAttribute('inert') }));
      this.panel.focus();
      for (const { node } of this.background) { node.setAttribute('aria-hidden', 'true'); node.setAttribute('inert', ''); }
      this.viewport();
      window.visualViewport?.addEventListener('resize', this.viewport);
      window.visualViewport?.addEventListener('scroll', this.viewport);
      window.addEventListener('resize', this.viewport);
      audio.start();
      audio.play('pop', { volume: 0.4 });
      this.onOpen();
      gsap.fromTo(this.panel, { opacity: 0, y: this.reduced ? 0 : 24, scale: this.reduced ? 1 : 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'back.out(1.5)' });
    }
    return true;
  }

  compose() {
    if (!this.open()) return;
    this.panel.classList.remove('wishes-inbox');
    this.content.innerHTML = this.heading(copy.title);
    this.editName(!this.sender);
    this.content.append(this.form);
    this.panel.focus();
  }

  inbox() {
    if (!this.open()) return;
    this.panel.classList.add('wishes-inbox');
    this.content.innerHTML = this.heading(copy.inbox);
    const list = el('div', 'wish-list');
    const more = el('button', 'wish-secondary');
    more.type = 'button';
    const write = el('button', 'wish-primary', `${wishIcons.send}<span>${escapeHtml(copy.send)}</span>`);
    write.type = 'button';
    write.addEventListener('click', () => this.compose());
    this.content.append(list, more, write);
    this.panel.focus();
    let cursor: number | null = null;
    const run = this.listRun;
    const load = async () => {
      more.disabled = true;
      more.textContent = copy.loading;
      this.status.textContent = '';
      const controller = new AbortController();
      this.request = controller;
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(API + (cursor ? `?before=${cursor}` : ''), { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('load');
        const data = await response.json() as { wishes: Wish[]; next: number | null };
        if (run !== this.listRun || !this.opened) return;
        if (!Array.isArray(data.wishes)) throw new Error('response');
        for (const wish of data.wishes) {
          const card = el('article', 'wish-card');
          const name = el('h3');
          name.textContent = wish.name;
          const message = el('p');
          message.textContent = wish.message;
          card.append(name, message);
          list.append(card);
        }
        if (!list.children.length) {
          const empty = el('p', 'wish-empty');
          empty.textContent = copy.empty;
          list.append(empty);
        }
        cursor = data.next;
        more.hidden = !cursor;
        more.textContent = copy.more;
      } catch {
        if (run !== this.listRun || !this.opened) return;
        this.status.textContent = copy.loadError;
        more.textContent = copy.retry;
      } finally { clearTimeout(timeout); more.disabled = false; }
    };
    more.addEventListener('click', () => void load());
    void load();
  }

  close(force = false) {
    if (!this.opened || (this.sending && !force)) return;
    this.opened = false;
    cancelAnimationFrame(this.viewportFrame);
    this.listRun++;
    this.request?.abort();
    gsap.killTweensOf(this.panel);
    this.root.hidden = true;
    for (const { node, aria, inert } of this.background) {
      if (aria === null) node.removeAttribute('aria-hidden'); else node.setAttribute('aria-hidden', aria);
      if (!inert) node.removeAttribute('inert');
    }
    this.background = [];
    window.visualViewport?.removeEventListener('resize', this.viewport);
    window.visualViewport?.removeEventListener('scroll', this.viewport);
    window.removeEventListener('resize', this.viewport);
    this.previousFocus?.focus({ preventScroll: true });
    this.onClose();
  }

  private async send() {
    if (this.sending) return;
    const name = this.nameInput.value.trim();
    const message = this.message.value.trim();
    if (!name) { this.editName(true); this.nameInput.setCustomValidity(copy.nameRequired); this.nameInput.reportValidity(); return; }
    if (!message) { this.message.setCustomValidity(copy.messageRequired); this.message.reportValidity(); return; }
    this.sender = name;
    const signature = JSON.stringify({ name, message });
    if (this.pending?.signature !== signature) {
      const id = [...crypto.getRandomValues(new Uint8Array(16))].map((n) => n.toString(16).padStart(2, '0')).join('');
      this.pending = { signature, id };
    }
    this.sending = true;
    this.submit.disabled = this.closeButton.disabled = this.editButton.disabled = true;
    this.nameInput.readOnly = this.message.readOnly = true;
    this.panel.setAttribute('aria-busy', 'true');
    this.status.textContent = copy.sending;
    audio.start();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    let sent = false;
    try {
      const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: this.pending!.id, name, message }), signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 429 ? 'slow' : 'send');
      const data = await response.json() as { ok?: boolean };
      if (data.ok !== true) throw new Error('response');
      sent = true;
    } catch (error) {
      this.status.textContent = error instanceof Error && error.message === 'slow' ? copy.slowDown : copy.sendError;
    } finally { clearTimeout(timeout); }
    if (sent) {
      this.pending = null;
      this.message.value = '';
      await this.flyLetter();
      this.close(true);
    }
    this.sending = false;
    this.submit.disabled = this.closeButton.disabled = this.editButton.disabled = false;
    this.nameInput.readOnly = this.message.readOnly = false;
    this.panel.removeAttribute('aria-busy');
    if (sent) await this.onSent(name);
  }

  private async flyLetter() {
    const flight = el('div', 'wish-flight', '<div class="wish-letter"><div class="wish-letter-paper"><span>♥</span><i></i><i></i><i></i></div><div class="wish-envelope-front"></div><div class="wish-envelope-flap"></div><div class="wish-seal">♥</div></div><p></p>');
    flight.setAttribute('aria-hidden', 'true');
    this.root.append(flight);
    const letter = flight.querySelector('.wish-letter')!;
    const paper = flight.querySelector('.wish-letter-paper')!;
    const flap = flight.querySelector('.wish-envelope-flap')!;
    const seal = flight.querySelector('.wish-seal')!;
    flight.querySelector('p')!.textContent = copy.packing;
    this.status.textContent = copy.packing;
    gsap.killTweensOf(this.panel);
    audio.play('rustle', { volume: 0.6 });
    const tl = gsap.timeline();
    tl.to(this.panel, { opacity: 0, scale: this.reduced ? 1 : 0.85, duration: 0.22 });
    tl.fromTo(letter, { opacity: 0, scale: this.reduced ? 1 : 0.65 }, { opacity: 1, scale: 1, duration: 0.3 });
    tl.to(paper, { y: 70, scale: 0.85, duration: this.reduced ? 0.15 : 0.6, ease: 'power2.inOut' });
    tl.fromTo(flap, { scaleY: 0 }, { scaleY: 1, duration: 0.3, transformOrigin: '50% 0%' });
    tl.fromTo(seal, { scale: 0 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' });
    tl.call(() => { audio.play('pop', { volume: 0.5 }); this.status.textContent = copy.sent; flight.querySelector('p')!.textContent = copy.sent; });
    if (!this.reduced) {
      tl.to(letter, { rotation: 720, y: -24, scale: 0.8, duration: 0.85, ease: 'power2.inOut' });
      tl.call(() => audio.play('whoosh', { volume: 0.65 }));
      tl.to(letter, { x: window.innerWidth * 0.65, y: -window.innerHeight * 0.7, rotation: 750, scale: 0.2, opacity: 0, duration: 0.7, ease: 'power2.in' });
    } else tl.to(letter, { opacity: 0, duration: 0.3, delay: 0.3 });
    tl.to(flight.querySelector('p'), { opacity: 0, duration: 0.15 });
    await tl;
    flight.remove();
  }
}
