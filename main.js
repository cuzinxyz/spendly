class Formatter {
	static currency(value) {
		return new Intl.NumberFormat('vi-VN').format(Number(value) || 0) + ' ₫';
	}

	static shortCurrency(value) {
		const n = Number(value) || 0;
		if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.0', '') + 'B ₫';
		if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M ₫';
		if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K ₫';
		return Formatter.currency(n);
	}

	static escape(value) {
		return String(value ?? '').replace(/[&<>"']/g, char => ({
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;'
		}[char]));
	}

	static todayISO() {
		return new Date().toISOString().slice(0, 10);
	}

	static nowHM() {
		return new Date().toTimeString().slice(0, 5);
	}

	static dateLabel(iso) {
		const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
		const date = new Date((iso || Formatter.todayISO()) + 'T00:00:00');
		const today = new Date();
		const yesterday = new Date();

		yesterday.setDate(yesterday.getDate() - 1);

		if (date.toDateString() === today.toDateString()) return 'Hôm nay';
		if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua';

		return days[date.getDay()] + ' ' + date.getDate() + '/' + String(date.getMonth() + 1).padStart(2, '0');
	}

	static amountInput(rawValue) {
		return String(rawValue ?? '').replace(/\D/g, '');
	}
}

class ExpenseStore {
	constructor(key) {
		this.key = key;
		this.items = this.load();
	}

	load() {
		try {
			const parsed = JSON.parse(localStorage.getItem(this.key));
			return Array.isArray(parsed) ? parsed.map(item => this.normalize(item)) : [];
		} catch {
			return [];
		}
	}

	normalize(item = {}) {
		return {
			id: item.id || this.createId(),
			amount: Number(item.amount) || 0,
			note: String(item.note || ''),
			debt: String(item.debt || ''),
			date: item.date || Formatter.todayISO(),
			time: item.time || Formatter.nowHM(),
			paid: Boolean(item.paid),
			ts: Number(item.ts) || Date.now()
		};
	}

	createId() {
		return Date.now().toString(36) + Math.random().toString(36).slice(2);
	}

	persist() {
		localStorage.setItem(this.key, JSON.stringify(this.items));
	}

	all() {
		return [...this.items].sort((a, b) => b.ts - a.ts);
	}

	add(payload) {
		const item = this.normalize({
			...payload,
			id: this.createId(),
			paid: false,
			ts: Date.now()
		});

		this.items.unshift(item);
		this.persist();
		return item;
	}

	togglePaid(id) {
		let updated = null;

		this.items = this.items.map(item => {
			if (item.id !== id) return item;
			updated = { ...item, paid: !item.paid };
			return updated;
		});

		this.persist();
		return updated;
	}

	remove(id) {
		const before = this.items.length;
		this.items = this.items.filter(item => item.id !== id);

		if (this.items.length !== before) {
			this.persist();
			return true;
		}

		return false;
	}

	totals() {
		return this.items.reduce((acc, item) => {
			if (item.paid) acc.paid += item.amount;
			else acc.unpaid += item.amount;
			return acc;
		}, { paid: 0, unpaid: 0 });
	}

	groupedByDate() {
		return this.all().reduce((groups, item) => {
			if (!groups[item.date]) groups[item.date] = [];
			groups[item.date].push(item);
			return groups;
		}, {});
	}
}

class CanvasBackground {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d', { alpha: true });
		this.width = 0;
		this.height = 0;
		this.dpr = 1;
		this.tick = 0;

		this.stars = Array.from({ length: 135 }, () => ({
			x: Math.random(),
			y: Math.random(),
			r: Math.random() * .85 + .15,
			base: Math.random() * .28 + .08,
			phase: Math.random() * Math.PI * 2,
			spd: .00055 + Math.random() * .00115
		}));

		this.rings = [
			{ cy: .43, rx: 260, ry: 74, spd: .00025, ph: 0, o: .12 },
			{ cy: .43, rx: 410, ry: 118, spd: .00014, ph: 1.8, o: .075 },
			{ cy: .43, rx: 560, ry: 162, spd: .00008, ph: 3.5, o: .045 },
		];

		this.resize = this.resize.bind(this);
		this.draw = this.draw.bind(this);
	}

	start() {
		this.resize();
		addEventListener('resize', this.resize, { passive: true });
		requestAnimationFrame(this.draw);
	}

	resize() {
		this.dpr = Math.min(window.devicePixelRatio || 1, 2);
		this.width = window.innerWidth;
		this.height = window.innerHeight;

		this.canvas.style.width = this.width + 'px';
		this.canvas.style.height = this.height + 'px';
		this.canvas.width = Math.floor(this.width * this.dpr);
		this.canvas.height = Math.floor(this.height * this.dpr);

		this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
	}

	drawGrid() {
		const step = 40;
		const { ctx, width, height } = this;

		ctx.save();
		ctx.globalAlpha = .18;
		ctx.strokeStyle = 'rgba(148, 163, 184, .16)';
		ctx.lineWidth = 1;

		for (let x = width % step; x < width; x += step) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
			ctx.stroke();
		}

		for (let y = height % step; y < height; y += step) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(width, y);
			ctx.stroke();
		}

		ctx.restore();
	}

	drawBase() {
		const { ctx, width, height } = this;
		const base = ctx.createLinearGradient(0, 0, 0, height);

		base.addColorStop(0, '#171a28');
		base.addColorStop(.56, '#11131d');
		base.addColorStop(1, '#0e1018');

		ctx.fillStyle = base;
		ctx.fillRect(0, 0, width, height);
	}

	drawGlow() {
		const { ctx, width, height } = this;
		let glow = ctx.createRadialGradient(width * .5, height * .42, 0, width * .5, height * .42, Math.max(width, height) * .48);

		glow.addColorStop(0, 'rgba(124,109,255,.18)');
		glow.addColorStop(.42, 'rgba(124,109,255,.065)');
		glow.addColorStop(1, 'rgba(0,0,0,0)');

		ctx.fillStyle = glow;
		ctx.fillRect(0, 0, width, height);

		glow = ctx.createRadialGradient(width * .15, height * .2, 0, width * .15, height * .2, Math.max(width, height) * .32);
		glow.addColorStop(0, 'rgba(53,208,139,.10)');
		glow.addColorStop(1, 'rgba(0,0,0,0)');

		ctx.fillStyle = glow;
		ctx.fillRect(0, 0, width, height);
	}

	drawStars() {
		const { ctx, width, height } = this;

		this.stars.forEach(star => {
			star.phase += star.spd;

			const opacity = star.base * (0.5 + 0.5 * Math.sin(star.phase));

			ctx.beginPath();
			ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(220,224,255,${opacity})`;
			ctx.fill();
		});
	}

	drawRings() {
		const { ctx, width, height, tick } = this;
		const cx = width / 2;

		this.rings.forEach(ring => {
			const cy = ring.cy * height;
			const angle = ring.ph + tick * ring.spd;

			ctx.save();
			ctx.translate(cx, cy);
			ctx.scale(1, ring.ry / ring.rx);
			ctx.beginPath();
			ctx.arc(0, 0, ring.rx, 0, Math.PI * 2);
			ctx.strokeStyle = `rgba(167,156,255,${ring.o})`;
			ctx.lineWidth = 1;
			ctx.stroke();
			ctx.restore();

			ctx.save();
			ctx.translate(cx, cy);

			const dotX = ring.rx * Math.cos(angle);
			const dotY = ring.ry * Math.sin(angle);
			const dotGlow = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 12);

			dotGlow.addColorStop(0, `rgba(167,156,255,${Math.min(ring.o * 4.8, .75)})`);
			dotGlow.addColorStop(1, 'rgba(167,156,255,0)');

			ctx.fillStyle = dotGlow;
			ctx.fillRect(dotX - 12, dotY - 12, 24, 24);

			ctx.beginPath();
			ctx.arc(dotX, dotY, 1.8, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(242,245,255,${Math.min(ring.o * 5, .7)})`;
			ctx.fill();

			ctx.restore();
		});
	}

	drawVignette() {
		const { ctx, width, height } = this;
		const vignette = ctx.createRadialGradient(width / 2, height * .43, height * .1, width / 2, height * .43, Math.max(width, height) * .78);

		vignette.addColorStop(0, 'rgba(0,0,0,0)');
		vignette.addColorStop(1, 'rgba(5,7,12,.42)');

		ctx.fillStyle = vignette;
		ctx.fillRect(0, 0, width, height);
	}

	draw() {
		this.tick += 1;
		this.ctx.clearRect(0, 0, this.width, this.height);

		this.drawBase();
		this.drawGrid();
		this.drawGlow();
		this.drawStars();
		this.drawRings();
		this.drawVignette();

		requestAnimationFrame(this.draw);
	}
}

class ExpenseUI {
	constructor(store) {
		this.store = store;
		this.view = 'add';
		this.toastTimer = null;
		this.$ = id => document.getElementById(id);

		this.el = {
			addView: this.$('va'),
			listView: this.$('vl'),
			amount: this.$('amt'),
			note: this.$('note'),
			debt: this.$('debt'),
			preview: this.$('prev'),
			symbol: this.$('sym'),
			dateInput: this.$('din'),
			timeInput: this.$('tin'),
			dateLabel: this.$('ld'),
			timeLabel: this.$('lt'),
			list: this.$('list'),
			empty: this.$('empty'),
			flash: this.$('flash'),
			toast: this.$('toast'),
			topUnpaid: this.$('ts-u'),
			topPaid: this.$('ts-p'),
			listUnpaid: this.$('ls-u'),
			listPaid: this.$('ls-p')
		};
	}

	init() {
		this.initDateTime();
		this.bindEvents();
		this.renderStats();
		this.focusAmount(150);
	}

	bindEvents() {
		this.el.amount.addEventListener('input', () => this.handleAmountInput());
		this.el.dateInput.addEventListener('change', () => this.syncDateLabel());
		this.el.timeInput.addEventListener('change', () => this.syncTimeLabel());

		document.addEventListener('keydown', event => this.handleShortcut(event));
		this.el.list.addEventListener('click', event => this.handleListClick(event));
	}

	handleAmountInput() {
		const raw = Formatter.amountInput(this.el.amount.value);
		const amount = Number(raw) || 0;

		this.el.amount.value = raw;
		this.el.symbol.classList.toggle('lit', raw.length > 0);
		this.el.preview.textContent = amount > 0 ? Formatter.currency(amount) : '';
		this.el.preview.classList.toggle('show', amount > 0);
	}

	handleShortcut(event) {
		const isTyping = document.activeElement?.tagName === 'INPUT';

		if (this.view === 'add') {
			if (event.key === 'Enter') {
				event.preventDefault();
				this.submit();
				return;
			}

			if (event.key === 'Escape') {
				event.preventDefault();
				this.clearForm();
				return;
			}

			if ((event.key === 'l' || event.key === 'L') && !isTyping) {
				event.preventDefault();
				this.showList();
			}

			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			this.showAdd();
		}
	}

	handleListClick(event) {
		const toggleButton = event.target.closest('[data-id]');
		const deleteButton = event.target.closest('[data-del]');

		if (toggleButton) {
			this.togglePaid(toggleButton.dataset.id);
			return;
		}

		if (deleteButton) {
			this.remove(deleteButton.dataset.del);
		}
	}

	initDateTime() {
		this.el.dateInput.value = Formatter.todayISO();
		this.el.timeInput.value = Formatter.nowHM();
		this.el.dateLabel.textContent = 'hôm nay';
		this.el.timeLabel.textContent = this.el.timeInput.value;
	}

	syncDateLabel() {
		this.el.dateLabel.textContent = this.el.dateInput.value ? Formatter.dateLabel(this.el.dateInput.value) : 'hôm nay';
	}

	syncTimeLabel() {
		this.el.timeLabel.textContent = this.el.timeInput.value || Formatter.nowHM();
	}

	readForm() {
		return {
			amount: Number(Formatter.amountInput(this.el.amount.value)) || 0,
			note: this.el.note.value.trim(),
			debt: this.el.debt.value.trim(),
			date: this.el.dateInput.value || Formatter.todayISO(),
			time: this.el.timeInput.value || Formatter.nowHM()
		};
	}

	submit() {
		const payload = this.readForm();

		if (!payload.amount) {
			this.shakeAmount();
			return;
		}

		const item = this.store.add(payload);

		this.flash();
		this.resetForm();
		this.renderStats();
		this.toast('✓ ' + Formatter.currency(item.amount));
	}

	resetForm() {
		this.el.amount.value = '';
		this.el.note.value = '';
		this.el.debt.value = '';
		this.el.preview.textContent = '';
		this.el.preview.classList.remove('show');
		this.el.symbol.classList.remove('lit');

		this.initDateTime();
		this.focusAmount();
	}

	clearForm() {
		const hasValue = this.el.amount.value || this.el.note.value || this.el.debt.value;

		if (!hasValue) return;

		this.resetForm();
	}

	shakeAmount() {
		this.el.amount.classList.add('shake');
		setTimeout(() => this.el.amount.classList.remove('shake'), 300);
		this.focusAmount();
	}

	focusAmount(delay = 0) {
		setTimeout(() => this.el.amount.focus(), delay);
	}

	showList() {
		this.renderList();
		this.el.addView.classList.add('off');
		this.el.listView.classList.remove('off');
		this.view = 'list';
	}

	showAdd() {
		this.el.listView.classList.add('off');
		this.el.addView.classList.remove('off');
		this.view = 'add';
		this.focusAmount(60);
	}

	renderStats() {
		const { unpaid, paid } = this.store.totals();
		const hasData = this.store.items.length > 0;

		this.el.topUnpaid.textContent = hasData ? Formatter.shortCurrency(unpaid) : '—';
		this.el.topPaid.textContent = hasData ? Formatter.shortCurrency(paid) : '—';
		this.el.listUnpaid.textContent = Formatter.currency(unpaid);
		this.el.listPaid.textContent = Formatter.currency(paid);
	}

	renderList() {
		this.renderStats();

		if (!this.store.items.length) {
			this.el.empty.style.display = 'flex';
			this.el.list.innerHTML = '';
			return;
		}

		this.el.empty.style.display = 'none';
		this.el.list.innerHTML = Object.entries(this.store.groupedByDate())
			.sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
			.map(([date, items]) => this.renderDateGroup(date, items))
			.join('');
	}

	renderDateGroup(date, items) {
		const total = items.reduce((sum, item) => sum + item.amount, 0);
		const renderedItems = items
			.sort((a, b) => b.ts - a.ts)
			.map(item => this.renderItem(item))
			.join('');

		return `
                    <div class="dg">
                        <div class="dhd">
                            <span>${Formatter.dateLabel(date)}</span>
                            <span class="dtot">${Formatter.shortCurrency(total)}</span>
                        </div>
                        ${renderedItems}
                    </div>
                `;
	}

	renderItem(item) {
		const safeNote = Formatter.escape(item.note) || '—';
		const safeDebt = Formatter.escape(item.debt);
		const debtHtml = safeDebt
			? `<div class="idb" title="Nợ ${safeDebt}">Nợ ${safeDebt}</div>`
			: '';

		return `
                    <div class="item ${item.paid ? 'pi' : ''}">
                        <div>
                            <div class="in">${safeNote}</div>
                            <div class="im">${item.time ? item.time + ' · ' : ''}${Formatter.dateLabel(item.date)}</div>
                            ${debtHtml}
                        </div>
                        <div class="ir">
                            <div class="ia">${Formatter.currency(item.amount)}</div>
                            <div class="ib ${item.paid ? 'pa' : 'un'}" data-id="${item.id}">
                                ${item.paid ? '✓ trả rồi' : 'chưa trả'}
                            </div>
                        </div>
                        <button class="dx" data-del="${item.id}" aria-label="Xoá khoản chi">×</button>
                    </div>
                `;
	}

	togglePaid(id) {
		const item = this.store.togglePaid(id);

		if (!item) return;

		this.renderList();
		this.toast(item.paid ? '✓ Đã trả' : '↩ Chưa trả');
	}

	remove(id) {
		if (!this.store.remove(id)) return;

		this.renderList();
		this.toast('Đã xoá');
	}

	flash() {
		this.el.flash.classList.add('on');
		setTimeout(() => this.el.flash.classList.remove('on'), 120);
	}

	toast(message) {
		this.el.toast.textContent = message;
		this.el.toast.classList.add('on');

		clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(() => this.el.toast.classList.remove('on'), 1600);
	}
}

class ExpenseApp {
	constructor() {
		this.store = new ExpenseStore('ct3');
		this.ui = new ExpenseUI(this.store);
		this.background = new CanvasBackground(document.getElementById('bg'));
	}

	start() {
		this.background.start();
		this.ui.init();
		this.exposeDebugApi();
	}

	exposeDebugApi() {
		window.expenseApp = {
			store: this.store,
			ui: this.ui,
			exportJSON: () => JSON.stringify(this.store.items, null, 2)
		};
	}
}

document.addEventListener('DOMContentLoaded', () => {
	new ExpenseApp().start();
});
