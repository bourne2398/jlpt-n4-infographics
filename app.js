(() => {
  "use strict";

  const DATA = window.LESSON_DATA_1_78 || {};
  const allCards = Object.entries(DATA).flatMap(([lesson, words]) =>
    (Array.isArray(words) ? words : []).map((word, index) => ({
      ...word,
      lesson: Number(lesson),
      id: `${lesson}-${index}-${word.jp}`
    }))
  );

  const stack = document.getElementById("stack");
  const emptyState = document.getElementById("emptyState");
  const lessonSelect = document.getElementById("lessonSelect");
  const restartBtn = document.getElementById("restartBtn");
  const knewReviewBtn = document.getElementById("knewReviewBtn");
  const dontReviewBtn = document.getElementById("dontReviewBtn");
  const reviewPanel = document.getElementById("reviewPanel");
  const reviewTitle = document.getElementById("reviewTitle");
  const reviewCards = document.getElementById("reviewCards");
  const reviewEmpty = document.getElementById("reviewEmpty");
  const closeReviewBtn = document.getElementById("closeReviewBtn");
  const knewCount = document.getElementById("knewCount");
  const dontCount = document.getElementById("dontCount");
  const remainingText = document.getElementById("remainingText");
  const counterText = document.getElementById("counterText");
  const progressBar = document.getElementById("progressBar");

  let sourceCards = allCards.slice();
  let cards = sourceCards.slice();
  let currentIndex = 0;
  let answered = 0;
  let drag = null;
  const saved = {
    knew: new Set(JSON.parse(localStorage.getItem("flashcards-knew") || "[]")),
    dont: new Set(JSON.parse(localStorage.getItem("flashcards-dont") || "[]"))
  };

  for (let lesson = 1; lesson <= 78; lesson++) {
    const option = document.createElement("option");
    option.value = String(lesson);
    option.textContent = `Lesson ${lesson}`;
    lessonSelect.appendChild(option);
  }

  function resetList() {
    cards = sourceCards.filter(card => !saved.knew.has(card.id) && !saved.dont.has(card.id));
    currentIndex = 0;
    answered = 0;
    render();
  }

  function chooseLesson(value) {
    sourceCards = value === "all"
      ? allCards.slice()
      : allCards.filter(card => String(card.lesson) === value);
    resetList();
  }

  function render() {
    stack.innerHTML = "";
    const remaining = cards.length - currentIndex;

    remainingText.textContent = `${remaining} remaining`;
    counterText.textContent = `${Math.min(currentIndex + 1, cards.length)} / ${cards.length}`;
    progressBar.style.width = cards.length ? `${Math.min((currentIndex / cards.length) * 100, 100)}%` : "0%";
    knewCount.textContent = saved.knew.size;
    dontCount.textContent = saved.dont.size;

    if (!remaining) {
      stack.classList.add("hidden");
      emptyState.classList.remove("hidden");
      return;
    }

    stack.classList.remove("hidden");
    emptyState.classList.add("hidden");

    const current = cards[currentIndex];
    const next = cards[currentIndex + 1];

    if (next) stack.appendChild(makeCard(next, false));
    stack.appendChild(makeCard(current, true));
  }

  function makeCard(card, front) {
    const el = document.createElement("article");
    el.className = `flashcard ${front ? "front" : "behind"}`;
    el.dataset.id = card.id;

    const kanji = card.kanji ? escapeHtml(card.kanji) : "";
    const jp = escapeHtml(card.jp || "");
    const furi = escapeHtml(card.furi || "");
    const en = escapeHtml(card.en || "");

    el.innerHTML = `
      <span class="card-lesson">LESSON ${card.lesson}</span>
      <span class="swipe-label left">DON'T KNOW</span>
      <span class="swipe-label right">KNEW</span>
      <div class="card-face card-front-face">
        ${kanji ? `<div class="card-kanji">${kanji}</div>` : ""}
        <div class="card-jp">${jp}</div>
        ${furi && furi !== card.jp ? `<div class="card-reading">${furi}</div>` : ""}
        <div class="flip-hint">Tap to see English</div>
      </div>
      <div class="card-face card-back-face">
        <div class="back-label">ENGLISH</div>
        <div class="card-en">${en}</div>
        <div class="flip-hint">Tap to return</div>
      </div>
    `;

    el.addEventListener("click", (event) => {
      if (drag || event.target.closest(".swipe-label")) return;
      el.classList.toggle("flipped");
    });

    if (front) attachDrag(el);
    return el;
  }

  function attachDrag(el) {
    el.addEventListener("pointerdown", startDrag);
  }

  function startDrag(event) {
    if (drag || event.button === 2) return;
    event.preventDefault();
    this.setPointerCapture?.(event.pointerId);
    drag = {
      el: this,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };
    this.classList.add("dragging");
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const rotation = dx * 0.055;
    const opacity = Math.max(.55, 1 - Math.abs(dx) / 700);
    drag.el.style.transform = `translate3d(${dx}px,${dy * .18}px,0) rotate(${rotation}deg)`;
    drag.el.style.opacity = opacity;

    const left = drag.el.querySelector(".swipe-label.left");
    const right = drag.el.querySelector(".swipe-label.right");
    left.style.opacity = dx < 0 ? Math.min(Math.abs(dx) / 90, 1) : 0;
    right.style.opacity = dx > 0 ? Math.min(dx / 90, 1) : 0;
  }

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const active = drag.el;
    const dx = event.clientX - drag.startX;
    drag = null;
    active.classList.remove("dragging");

    const threshold = Math.max(70, Math.min(130, active.offsetWidth * .28));
    if (Math.abs(dx) >= threshold) {
      finishCard(dx > 0 ? "knew" : "dont", dx > 0 ? 1 : -1);
    } else {
      active.style.transform = "";
      active.style.opacity = "";
      active.querySelector(".swipe-label.left").style.opacity = 0;
      active.querySelector(".swipe-label.right").style.opacity = 0;
    }
  }

  function finishCard(result, direction) {
    const active = stack.querySelector(".flashcard.front");
    if (!active) return;

    active.style.transition = "transform .28s cubic-bezier(.2,.8,.25,1), opacity .24s ease";
    active.style.transform = `translate3d(${direction * 120}vw,0,0) rotate(${direction * 22}deg)`;
    active.style.opacity = "0";

    window.setTimeout(() => {
      const card = cards[currentIndex];
      saved[result].add(card.id);
      localStorage.setItem(`flashcards-${result}`, JSON.stringify([...saved[result]]));
      currentIndex++;
      answered++;
      render();
    }, 250);
  }

  restartBtn.addEventListener("click", resetList);
  function openReview(type) {
    reviewTitle.textContent = type === "knew" ? "Knew" : "Don't Know";
    const ids = saved[type];
    const items = allCards.filter(card => ids.has(card.id));
    reviewCards.innerHTML = items.map(card => {
      const kanji = card.kanji ? `<div class="review-kanji">${escapeHtml(card.kanji)}</div>` : "";
      const jp = escapeHtml(card.jp || "");
      const furi = escapeHtml(card.furi || "");
      const en = escapeHtml(card.en || "");
      return `<article class="review-card"><small>LESSON ${card.lesson}</small>${kanji}<div class="review-jp">${jp}</div>${furi && furi !== card.jp ? `<div class="review-reading">${furi}</div>` : ""}<div class="review-en">${en}</div></article>`;
    }).join("");
    reviewEmpty.classList.toggle("hidden", items.length > 0);
    reviewPanel.classList.remove("hidden");
  }
  knewReviewBtn.addEventListener("click", () => openReview("knew"));
  dontReviewBtn.addEventListener("click", () => openReview("dont"));
  closeReviewBtn.addEventListener("click", () => reviewPanel.classList.add("hidden"));
  lessonSelect.addEventListener("change", e => chooseLesson(e.target.value));

  document.addEventListener("pointermove", moveDrag, { passive: false });
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&#92;","'":"&#39;"
    }[char]));
  }

  render();
})();
