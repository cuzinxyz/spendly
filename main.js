class Formatter {
  static currency(value) {
    return new Intl.NumberFormat("vi-VN").format(Number(value) || 0) + " ₫";
  }

  static shortCurrency(value) {
    const n = Number(value) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(".0", "") + "B ₫";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".0", "") + "M ₫";
    if (n >= 1e3) return (n / 1e3).toFixed(0) + "K ₫";
    return Formatter.currency(n);
  }

  static escape(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  }

  static todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  static nowHM() {
    return new Date().toTimeString().slice(0, 5);
  }

  static dateLabel(iso) {
    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const date = new Date((iso || Formatter.todayISO()) + "T00:00:00");
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Hôm nay";
    if (date.toDateString() === yesterday.toDateString()) return "Hôm qua";

    return (
      days[date.getDay()] +
      " " +
      date.getDate() +
      "/" +
      String(date.getMonth() + 1).padStart(2, "0")
    );
  }

  static amountInput(rawValue) {
    return String(rawValue ?? "").replace(/\D/g, "");
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
      return Array.isArray(parsed)
        ? parsed.map((item) => this.normalize(item))
        : [];
    } catch {
      return [];
    }
  }

  normalize(item = {}) {
    return {
      id: item.id || this.createId(),
      amount: Number(item.amount) || 0,
      note: String(item.note || ""),
      debt: String(item.debt || ""),
      date: item.date || Formatter.todayISO(),
      time: item.time || Formatter.nowHM(),
      paid: Boolean(item.paid),
      ts: Number(item.ts) || Date.now(),
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
      ts: Date.now(),
    });

    this.items.unshift(item);
    this.persist();
    return item;
  }

  togglePaid(id) {
    let updated = null;

    this.items = this.items.map((item) => {
      if (item.id !== id) return item;
      updated = { ...item, paid: !item.paid };
      return updated;
    });

    this.persist();
    return updated;
  }

  remove(id) {
    const before = this.items.length;
    this.items = this.items.filter((item) => item.id !== id);

    if (this.items.length !== before) {
      this.persist();
      return true;
    }

    return false;
  }

  totals() {
    return this.items.reduce(
      (acc, item) => {
        if (item.paid) acc.paid += item.amount;
        else acc.unpaid += item.amount;
        return acc;
      },
      { paid: 0, unpaid: 0 },
    );
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
  constructor(canvas, options = {}) {
    if (!canvas) throw new Error("CanvasBackground: canvas is required");

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });

    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.frame = 0;
    this.raf = null;
    this.lastTime = 0;

    this.options = {
      particleCount: options.particleCount ?? 150,
      accent: options.accent ?? "124, 109, 255",
      accent2: options.accent2 ?? "53, 208, 139",
      accent3: options.accent3 ?? "56, 189, 248",
      maxDpr: options.maxDpr ?? 2,
      interactive: options.interactive ?? true,
      ...options,
    };

    this.pointer = {
      x: 0.5,
      y: 0.5,
      tx: 0.5,
      ty: 0.5,
      active: false,
    };

    this.reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    this.particles = Array.from({ length: this.options.particleCount }, () =>
      this.createParticle(),
    );

    this.orbs = [
      {
        x: 0.18,
        y: 0.22,
        r: 0.34,
        c: this.options.accent2,
        a: 0.11,
        sx: 0.00007,
        sy: 0.00004,
      },
      {
        x: 0.74,
        y: 0.28,
        r: 0.42,
        c: this.options.accent,
        a: 0.16,
        sx: -0.00005,
        sy: 0.00006,
      },
      {
        x: 0.55,
        y: 0.82,
        r: 0.52,
        c: this.options.accent3,
        a: 0.08,
        sx: 0.00004,
        sy: -0.00003,
      },
    ];

    this.rings = [
      {
        y: 0.48,
        rx: 250,
        ry: 72,
        speed: 0.00055,
        phase: 0,
        alpha: 0.18,
        color: this.options.accent,
      },
      {
        y: 0.48,
        rx: 390,
        ry: 112,
        speed: -0.00034,
        phase: 1.8,
        alpha: 0.12,
        color: this.options.accent3,
      },
      {
        y: 0.48,
        rx: 560,
        ry: 158,
        speed: 0.0002,
        phase: 3.7,
        alpha: 0.075,
        color: this.options.accent,
      },
    ];

    this.resize = this.resize.bind(this);
    this.draw = this.draw.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
  }

  createParticle() {
    return {
      x: Math.random(),
      y: Math.random(),
      z: Math.random() * 0.8 + 0.2,
      r: Math.random() * 1.25 + 0.18,
      a: Math.random() * 0.34 + 0.08,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.0009 + 0.00035,
      drift: (Math.random() - 0.5) * 0.00018,
    };
  }

  start() {
    this.resize();
    window.addEventListener("resize", this.resize, { passive: true });

    if (this.options.interactive) {
      window.addEventListener("pointermove", this.onPointerMove, {
        passive: true,
      });
      window.addEventListener("pointerleave", this.onPointerLeave, {
        passive: true,
      });
    }

    this.raf = requestAnimationFrame(this.draw);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerleave", this.onPointerLeave);
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, this.options.maxDpr);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  onPointerMove(event) {
    this.pointer.tx = event.clientX / Math.max(this.width, 1);
    this.pointer.ty = event.clientY / Math.max(this.height, 1);
    this.pointer.active = true;
  }

  onPointerLeave() {
    this.pointer.tx = 0.5;
    this.pointer.ty = 0.5;
    this.pointer.active = false;
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  drawBase() {
    const { ctx, width, height } = this;
    const g = ctx.createLinearGradient(0, 0, width, height);

    g.addColorStop(0, "#171a2d");
    g.addColorStop(0.42, "#0d1020");
    g.addColorStop(1, "#070913");

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  drawNoise() {
    const { ctx, width, height } = this;

    ctx.save();
    ctx.globalAlpha = 0.045;

    for (let i = 0; i < 1200; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#94a3b8";
      ctx.fillRect(x, y, 1, 1);
    }

    ctx.restore();
  }

  drawAurora(time) {
    const { ctx, width, height, pointer, options } = this;
    const px = (pointer.x - 0.5) * 80;
    const py = (pointer.y - 0.5) * 50;

    this.orbs.forEach((orb, index) => {
      const ox =
        width * (orb.x + Math.sin(time * orb.sx + index) * 0.04) +
        px * (index + 1) * 0.25;
      const oy =
        height * (orb.y + Math.cos(time * orb.sy + index) * 0.04) +
        py * (index + 1) * 0.2;
      const radius = Math.max(width, height) * orb.r;

      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, radius);
      g.addColorStop(0, `rgba(${orb.c}, ${orb.a})`);
      g.addColorStop(0.42, `rgba(${orb.c}, ${orb.a * 0.34})`);
      g.addColorStop(1, `rgba(${orb.c}, 0)`);

      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    });

    const beam = ctx.createLinearGradient(width * 0.1, 0, width * 0.9, height);
    beam.addColorStop(0, `rgba(${options.accent3}, 0)`);
    beam.addColorStop(0.5, `rgba(${options.accent3}, 0.075)`);
    beam.addColorStop(1, `rgba(${options.accent}, 0)`);

    ctx.save();
    ctx.translate(width * 0.5, height * 0.45);
    ctx.rotate(-0.18 + (pointer.x - 0.5) * 0.05);
    ctx.fillStyle = beam;
    ctx.fillRect(-width, -height * 0.18, width * 2, height * 0.36);
    ctx.restore();
  }

  drawPerspectiveGrid(time) {
    const { ctx, width, height, pointer, options } = this;
    const horizon = height * 0.61 + (pointer.y - 0.5) * 14;
    const centerX = width * 0.5 + (pointer.x - 0.5) * 38;
    const bottom = height + 40;
    const lineCount = 18;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${options.accent3}, 0.105)`;

    for (let i = -lineCount; i <= lineCount; i += 1) {
      const x = centerX + i * (width / lineCount) * 0.46;
      ctx.beginPath();
      ctx.moveTo(centerX, horizon);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }

    for (let i = 0; i < 22; i += 1) {
      const p = i / 22;
      const y = this.lerp(horizon, bottom, p * p);
      const alpha = this.lerp(0.02, 0.18, p);

      ctx.strokeStyle = `rgba(${options.accent}, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin(time * 0.001 + i) * 2);
      ctx.lineTo(width, y + Math.sin(time * 0.001 + i) * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawParticles(time) {
    const { ctx, width, height, pointer, reducedMotion } = this;
    const parallaxX = (pointer.x - 0.5) * 28;
    const parallaxY = (pointer.y - 0.5) * 18;

    this.particles.forEach((p) => {
      if (!reducedMotion) {
        p.phase += p.speed * 16;
        p.y -= p.speed * 0.08;
        p.x += p.drift;

        if (p.y < -0.02) p.y = 1.02;
        if (p.x < -0.02) p.x = 1.02;
        if (p.x > 1.02) p.x = -0.02;
      }

      const twinkle = 0.55 + 0.45 * Math.sin(p.phase + time * p.speed);
      const x = p.x * width + parallaxX * p.z;
      const y = p.y * height + parallaxY * p.z;
      const radius = p.r * p.z;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(230, 235, 255, ${p.a * twinkle})`;
      ctx.fill();
    });
  }

  drawRings(time) {
    const { ctx, width, height, pointer } = this;
    const cx = width * 0.5 + (pointer.x - 0.5) * 22;
    const cyOffset = (pointer.y - 0.5) * 18;

    this.rings.forEach((ring, index) => {
      const cy = height * ring.y + cyOffset;
      const rx = ring.rx * Math.min(width / 980, 1.18);
      const ry = ring.ry * Math.min(width / 980, 1.18);
      const angle = ring.phase + time * ring.speed;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((pointer.x - 0.5) * 0.045);
      ctx.scale(1, ry / rx);
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${ring.color}, ${ring.alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      const dotX = cx + Math.cos(angle) * rx;
      const dotY = cy + Math.sin(angle) * ry;
      const glow = ctx.createRadialGradient(
        dotX,
        dotY,
        0,
        dotX,
        dotY,
        22 + index * 5,
      );
      glow.addColorStop(
        0,
        `rgba(${ring.color}, ${Math.min(ring.alpha * 5, 0.78)})`,
      );
      glow.addColorStop(1, `rgba(${ring.color}, 0)`);

      ctx.fillStyle = glow;
      ctx.fillRect(dotX - 32, dotY - 32, 64, 64);

      ctx.beginPath();
      ctx.arc(dotX, dotY, 2.1, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(248, 250, 252, 0.82)";
      ctx.fill();
    });
  }

  drawGlassPlate(time) {
    const { ctx, width, height, pointer, options } = this;
    const cx = width * 0.5 + (pointer.x - 0.5) * 18;
    const cy = height * 0.48 + (pointer.y - 0.5) * 12;
    const radius = Math.min(width, height) * 0.18;

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.6);
    g.addColorStop(0, `rgba(${options.accent}, 0.16)`);
    g.addColorStop(0.58, `rgba(${options.accent3}, 0.035)`);
    g.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(time * 0.00035) * 0.05);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(
      -radius * 1.12,
      -radius * 0.54,
      radius * 2.24,
      radius * 1.08,
      28,
    );
    ctx.stroke();
    ctx.restore();
  }

  drawVignette() {
    const { ctx, width, height } = this;
    const g = ctx.createRadialGradient(
      width * 0.5,
      height * 0.42,
      Math.min(width, height) * 0.2,
      width * 0.5,
      height * 0.42,
      Math.max(width, height) * 0.78,
    );

    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.72, "rgba(2,6,23,0.08)");
    g.addColorStop(1, "rgba(2,6,23,0.68)");

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  draw(now = 0) {
    const { ctx, width, height, pointer } = this;

    this.lastTime = now;
    this.frame += 1;

    pointer.x = this.lerp(pointer.x, pointer.tx, 0.055);
    pointer.y = this.lerp(pointer.y, pointer.ty, 0.055);

    ctx.clearRect(0, 0, width, height);

    this.drawBase();
    this.drawAurora(now);
    this.drawPerspectiveGrid(now);
    this.drawParticles(now);
    this.drawRings(now);
    this.drawGlassPlate(now);
    this.drawVignette();

    if (this.frame % 3 === 0) this.drawNoise();

    this.raf = requestAnimationFrame(this.draw);
  }
}

class ExpenseUI {
  constructor(store) {
    this.store = store;
    this.view = "add";
    this.toastTimer = null;
    this.$ = (id) => document.getElementById(id);

    this.el = {
      addView: this.$("va"),
      listView: this.$("vl"),
      amount: this.$("amt"),
      note: this.$("note"),
      debt: this.$("debt"),
      preview: this.$("prev"),
      symbol: this.$("sym"),
      dateInput: this.$("din"),
      timeInput: this.$("tin"),
      dateLabel: this.$("ld"),
      timeLabel: this.$("lt"),
      list: this.$("list"),
      empty: this.$("empty"),
      flash: this.$("flash"),
      toast: this.$("toast"),
      topUnpaid: this.$("ts-u"),
      topPaid: this.$("ts-p"),
      listUnpaid: this.$("ls-u"),
      listPaid: this.$("ls-p"),
    };
  }

  init() {
    this.initDateTime();
    this.bindEvents();
    this.renderStats();
    this.focusAmount(150);
  }

  bindEvents() {
    this.el.amount.addEventListener("input", () => this.handleAmountInput());
    this.el.dateInput.addEventListener("change", () => this.syncDateLabel());
    this.el.timeInput.addEventListener("change", () => this.syncTimeLabel());

    document.addEventListener("keydown", (event) => this.handleShortcut(event));
    this.el.list.addEventListener("click", (event) =>
      this.handleListClick(event),
    );
    document
      .querySelectorAll('[data-action="show-list"]')
      .forEach((el) => el.addEventListener("click", () => this.showList()));
    this.el.list.addEventListener("dblclick", (event) =>
      this.handleItemDoubleClick(event),
    );
  }

  handleAmountInput() {
    const raw = Formatter.amountInput(this.el.amount.value);
    const amount = Number(raw) || 0;

    this.el.amount.value = raw;
    this.el.symbol.classList.toggle("lit", raw.length > 0);
    this.el.preview.textContent = amount > 0 ? Formatter.currency(amount) : "";
    this.el.preview.classList.toggle("show", amount > 0);
  }

  handleShortcut(event) {
    const activeEl = document.activeElement;
    const isToggleListKey = event.key === "l" || event.key === "L";
    const canToggleList =
      isToggleListKey &&
      (!activeEl ||
        activeEl.tagName !== "INPUT" ||
        activeEl === this.el.amount);

    if (canToggleList) {
      event.preventDefault();
      this.toggleList();
      return;
    }

    if (this.view === "add") {
      if (event.key === "Enter") {
        event.preventDefault();
        this.submit();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        this.clearForm();
      }

      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.showAdd();
    }
  }

  handleListClick(event) {
    const toggleButton = event.target.closest("[data-id]");
    const deleteButton = event.target.closest("[data-del]");

    if (toggleButton) {
      this.togglePaid(toggleButton.dataset.id);
      return;
    }

    if (deleteButton) {
      this.remove(deleteButton.dataset.del);
    }
  }

  handleItemDoubleClick(event) {
    const itemEl = event.target.closest("[data-item-id]");

    if (!itemEl) return;
    if (event.target.closest("[data-id], [data-del]")) return;

    this.removeWithAnimation(itemEl.dataset.itemId, itemEl);
  }

  removeWithAnimation(id, itemEl) {
    itemEl.classList.add("removing");

    setTimeout(() => {
      if (!this.store.remove(id)) return;

      this.renderList();
      this.toast("Đã xoá");
    }, 220);
  }

  initDateTime() {
    this.el.dateInput.value = Formatter.todayISO();
    this.el.timeInput.value = Formatter.nowHM();
    this.el.dateLabel.textContent = "hôm nay";
    this.el.timeLabel.textContent = this.el.timeInput.value;
  }

  syncDateLabel() {
    this.el.dateLabel.textContent = this.el.dateInput.value
      ? Formatter.dateLabel(this.el.dateInput.value)
      : "hôm nay";
  }

  syncTimeLabel() {
    this.el.timeLabel.textContent =
      this.el.timeInput.value || Formatter.nowHM();
  }

  readForm() {
    return {
      amount: Number(Formatter.amountInput(this.el.amount.value)) || 0,
      note: this.el.note.value.trim(),
      debt: this.el.debt.value.trim(),
      date: this.el.dateInput.value || Formatter.todayISO(),
      time: this.el.timeInput.value || Formatter.nowHM(),
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
    this.toast("✓ " + Formatter.currency(item.amount));
  }

  resetForm() {
    this.el.amount.value = "";
    this.el.note.value = "";
    this.el.debt.value = "";
    this.el.preview.textContent = "";
    this.el.preview.classList.remove("show");
    this.el.symbol.classList.remove("lit");

    this.initDateTime();
    this.focusAmount();
  }

  clearForm() {
    const hasValue =
      this.el.amount.value || this.el.note.value || this.el.debt.value;

    if (!hasValue) return;

    this.resetForm();
  }

  shakeAmount() {
    this.el.amount.classList.add("shake");
    setTimeout(() => this.el.amount.classList.remove("shake"), 300);
    this.focusAmount();
  }

  focusAmount(delay = 0) {
    setTimeout(() => this.el.amount.focus(), delay);
  }

  showList() {
    this.renderList();
    this.el.addView.classList.add("off");
    this.el.listView.classList.remove("off");
    this.view = "list";
  }

  toggleList() {
    if (this.view === "list") {
      this.showAdd();
      return;
    }

    this.showList();
  }

  showAdd() {
    this.el.listView.classList.add("off");
    this.el.addView.classList.remove("off");
    this.view = "add";
    this.focusAmount(60);
  }

  renderStats() {
    const { unpaid, paid } = this.store.totals();
    const hasData = this.store.items.length > 0;

    this.el.topUnpaid.textContent = hasData
      ? Formatter.shortCurrency(unpaid)
      : "—";
    this.el.topPaid.textContent = hasData ? Formatter.shortCurrency(paid) : "—";
    this.el.listUnpaid.textContent = Formatter.currency(unpaid);
    this.el.listPaid.textContent = Formatter.currency(paid);
  }

  renderList() {
    this.renderStats();

    if (!this.store.items.length) {
      this.el.empty.style.display = "flex";
      this.el.list.innerHTML = "";
      return;
    }

    this.el.empty.style.display = "none";
    this.el.list.innerHTML = Object.entries(this.store.groupedByDate())
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([date, items]) => this.renderDateGroup(date, items))
      .join("");
  }

  renderDateGroup(date, items) {
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const renderedItems = items
      .sort((a, b) => b.ts - a.ts)
      .map((item) => this.renderItem(item))
      .join("");

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
    const safeNote = Formatter.escape(item.note) || "—";
    const safeDebt = Formatter.escape(item.debt);
    const debtHtml = safeDebt
      ? `<div class="idb" title="Nợ ${safeDebt}">Nợ ${safeDebt}</div>`
      : "";

    return `
      <div class="item ${item.paid ? "pi" : ""}" data-item-id="${item.id}">
          <div>
              <div class="in">${safeNote}</div>
              <div class="im">${item.time ? item.time + " · " : ""}${Formatter.dateLabel(item.date)}</div>
              ${debtHtml}
          </div>
          <div class="ir">
              <div class="ia">${Formatter.currency(item.amount)}</div>
              <div class="ib ${item.paid ? "pa" : "un"}" data-id="${item.id}">
                  ${item.paid ? "✓ trả rồi" : "chưa trả"}
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
    this.toast(item.paid ? "✓ Đã trả" : "↩ Chưa trả");
  }

  remove(id) {
    if (!this.store.remove(id)) return;

    this.renderList();
    this.toast("Đã xoá");
  }

  flash() {
    this.el.flash.classList.add("on");
    setTimeout(() => this.el.flash.classList.remove("on"), 120);
  }

  toast(message) {
    this.el.toast.textContent = message;
    this.el.toast.classList.add("on");

    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(
      () => this.el.toast.classList.remove("on"),
      1600,
    );
  }
}

class ExpenseApp {
  constructor() {
    this.store = new ExpenseStore("ct3");
    this.ui = new ExpenseUI(this.store);
    this.background = new CanvasBackground(document.getElementById("bg"));
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
      exportJSON: () => JSON.stringify(this.store.items, null, 2),
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ExpenseApp().start();
});
