/**
 * Django Навчальна платформа — головний скрипт.
 * Працює на Alpine.js (декларативність) + vanilla helpers.
 *
 * Структура даних:
 *   topics.json  — список усіх тем (метадані)
 *   content/*.md — теорія в Markdown
 *   quizzes/*.json  — тести
 *   exercises/*.json — завдання з кодом
 */

function app() {
    return {
        // ========== СТАН ==========
        topics: [],
        sections: [],
        currentTopic: null,        // id поточної теми (з URL hash)
        currentTopicMeta: null,    // метадані поточної теми
        renderedContent: '',       // зрендерена теорія (HTML з Markdown)

        activeTab: 'theory',       // theory | quiz | exercise

        // Quiz
        quiz: null,
        userAnswers: [],
        quizSubmitted: false,
        quizScore: null,
        correctAnswers: 0,

        // Exercise
        exercises: [],                  // масив завдань поточної теми
        currentExerciseIndex: 0,        // індекс активного завдання
        userCode: '',                   // код у редакторі активного завдання
        userCodes: {},                  // { exerciseKey: code } — збережений код кожного завдання
        renderedExerciseDescription: '',
        checkResults: [],

        // UI
        sidebarOpen: false,
        windowWidth: window.innerWidth,
        theme: 'light',

        // Progress
        completed: {},  // { topicId: true }

        // Persistence guard — true while loading topic so $watch не перезаписує saved state
        _skipSave: false,

        // ========== INIT ==========
        async init() {
            // Theme
            this.theme = localStorage.getItem('django-theme') ||
                (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

            // Progress from localStorage
            try { this.completed = JSON.parse(localStorage.getItem('django-progress') || '{}'); }
            catch { this.completed = {}; }

            // Window resize
            window.addEventListener('resize', () => this.windowWidth = window.innerWidth);

            // Hash routing
            window.addEventListener('hashchange', () => this.handleHash());

            // Load topic list
            try {
                const resp = await fetch('content/topics.json');
                const data = await resp.json();
                this.sections = data.sections;
                this.topics = data.topics;
            } catch (e) {
                console.error('Не вдалось завантажити topics.json', e);
            }

            // Initial route
            this.handleHash();

            // Watchers — автозбереження стану при будь-якій зміні
            this.$watch('userAnswers', () => this.saveTopicState());
            this.$watch('quizSubmitted', () => this.saveTopicState());
            this.$watch('quizScore', () => this.saveTopicState());
            this.$watch('correctAnswers', () => this.saveTopicState());
            this.$watch('userCode', () => {
                if (this._skipSave) return;
                if (this.currentTopic && this.exercises.length > 0) {
                    const key = this.exerciseKey(this.currentExerciseIndex);
                    this.userCodes[key] = this.userCode;
                }
                this.saveTopicState();
            });
            this.$watch('currentExerciseIndex', () => this.saveTopicState());
            this.$watch('activeTab', () => this.saveTopicState());

            // Register service worker (PWA)
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('service-worker.js').catch(() => {});
            }
        },

        // ========== ROUTING ==========
        handleHash() {
            const hash = window.location.hash.slice(1);  // remove #
            if (hash) {
                this.loadTopic(hash, false);
            } else {
                this.currentTopic = null;
            }
        },

        goHome() {
            this.currentTopic = null;
            this.currentTopicMeta = null;
            history.pushState(null, '', '#');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        async loadTopic(topicId, updateHash = true) {
            const meta = this.topics.find(t => t.id === topicId);
            if (!meta) return;

            // Guard: не зберігати "очищений" стан під час reset+load
            this._skipSave = true;

            this.currentTopic = topicId;
            this.currentTopicMeta = meta;
            this.activeTab = 'theory';
            this.sidebarOpen = false;
            this.renderedContent = '<p class="text-slate-500">Завантаження...</p>';
            this.quiz = null;
            this.exercises = [];
            this.currentExerciseIndex = 0;
            this.userCodes = {};
            this.resetQuiz();
            this.checkResults = [];

            if (updateHash) history.pushState(null, '', '#' + topicId);
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Load content (markdown)
            try {
                const resp = await fetch(`content/${topicId}.md`);
                if (resp.ok) {
                    const md = await resp.text();
                    this.renderedContent = marked.parse(md);
                    // syntax highlight after Alpine renders
                    this.$nextTick(() => {
                        document.querySelectorAll('#theory-content pre code').forEach(b => hljs.highlightElement(b));
                    });
                } else {
                    this.renderedContent = '<p class="text-amber-600">Контент для цієї теми ще не готовий.</p>';
                }
            } catch (e) {
                this.renderedContent = '<p class="text-rose-600">Помилка завантаження.</p>';
            }

            // Load quiz
            try {
                const resp = await fetch(`quizzes/${topicId}.json`);
                if (resp.ok) {
                    this.quiz = await resp.json();
                    this.userAnswers = this.quiz.questions.map(q =>
                        q.type === 'text' ? '' : []
                    );
                }
            } catch {}

            // Load exercise(s) — підтримує і одне завдання, і масив
            try {
                const resp = await fetch(`exercises/${topicId}.json`);
                if (resp.ok) {
                    const data = await resp.json();
                    // Новий формат — масив { exercises: [...] }
                    // Старий формат — одне завдання { title, description, ... }
                    this.exercises = Array.isArray(data.exercises)
                        ? data.exercises
                        : [data];
                    this.currentExerciseIndex = 0;
                    this.loadExerciseAtIndex(0);
                }
            } catch {}

            // Restore збережений стан (відповіді, код, активна вкладка)
            this.restoreTopicState(topicId);
            this._skipSave = false;
        },

        // Завантажити завдання за індексом
        loadExerciseAtIndex(idx) {
            if (idx < 0 || idx >= this.exercises.length) return;
            this.currentExerciseIndex = idx;
            const ex = this.exercises[idx];
            const key = this.exerciseKey(idx);
            this.userCode = this.userCodes[key] ?? (ex.starterCode || '');
            this.renderedExerciseDescription = marked.parse(ex.description || '');
            this.checkResults = (ex.checks || []).map(c => ({ label: c.label, passed: false }));
        },

        // Унікальний ключ для збереження коду
        exerciseKey(idx) {
            return `${this.currentTopic}-${idx}`;
        },

        // Перемкнути на інше завдання — спочатку зберегти поточний код
        switchExercise(idx) {
            const oldKey = this.exerciseKey(this.currentExerciseIndex);
            this.userCodes[oldKey] = this.userCode;
            this.loadExerciseAtIndex(idx);
        },

        // Емодзі складності
        difficultyLabel(diff) {
            const map = { easy: '🟢 Легко', medium: '🟡 Середньо', hard: '🔴 Складно' };
            return map[diff] || '';
        },

        // ========== HELPERS ==========
        topicsBySection(sectionId) {
            return this.topics.filter(t => t.section === sectionId);
        },

        get currentSection() {
            if (!this.currentTopicMeta) return null;
            return this.sections.find(s => s.id === this.currentTopicMeta.section);
        },

        get currentTopicIndex() {
            return this.topics.findIndex(t => t.id === this.currentTopic);
        },

        get prevTopic() {
            const i = this.currentTopicIndex;
            return i > 0 ? this.topics[i - 1] : null;
        },

        get nextTopic() {
            const i = this.currentTopicIndex;
            return i >= 0 && i < this.topics.length - 1 ? this.topics[i + 1] : null;
        },

        goPrevTopic() {
            if (this.prevTopic) this.loadTopic(this.prevTopic.id);
        },

        goNextTopic() {
            if (this.nextTopic) this.loadTopic(this.nextTopic.id);
            else { this.goHome(); }
        },

        // ========== THEME ==========
        toggleTheme() {
            this.theme = this.theme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('django-theme', this.theme);
        },

        // ========== QUIZ ==========
        toggleAnswer(qi, oi, type) {
            if (this.quizSubmitted) return;
            if (!Array.isArray(this.userAnswers[qi])) this.userAnswers[qi] = [];
            if (type === 'single') {
                this.userAnswers[qi] = [oi];
            } else {
                const arr = this.userAnswers[qi];
                const idx = arr.indexOf(oi);
                if (idx >= 0) arr.splice(idx, 1); else arr.push(oi);
            }
        },

        checkText(qi) {
            const q = this.quiz.questions[qi];
            const ans = (this.userAnswers[qi] || '').toString().trim().toLowerCase();
            return q.correct.some(c => c.toLowerCase() === ans);
        },

        submitQuiz() {
            this.quizSubmitted = true;
            let correct = 0;
            this.quiz.questions.forEach((q, qi) => {
                if (q.type === 'text') {
                    if (this.checkText(qi)) correct++;
                } else {
                    const user = (this.userAnswers[qi] || []).slice().sort();
                    const ans = q.correct.slice().sort();
                    if (user.length === ans.length && user.every((v, i) => v === ans[i])) correct++;
                }
            });
            this.correctAnswers = correct;
            this.quizScore = Math.round((correct / this.quiz.questions.length) * 100);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        resetQuiz() {
            this.quizSubmitted = false;
            this.quizScore = null;
            this.correctAnswers = 0;
            if (this.quiz) {
                this.userAnswers = this.quiz.questions.map(q =>
                    q.type === 'text' ? '' : []
                );
            }
        },

        // ========== PROGRESS ==========
        markCompleted() {
            if (this.currentTopic) {
                this.completed[this.currentTopic] = true;
                localStorage.setItem('django-progress', JSON.stringify(this.completed));
            }
        },

        isCompleted(topicId) {
            return !!this.completed[topicId];
        },

        // ========== STATE PERSISTENCE ==========
        // Зберігає поточний стан теми (відповіді, код, активну вкладку) у localStorage
        saveTopicState() {
            if (this._skipSave || !this.currentTopic) return;
            try {
                const all = JSON.parse(localStorage.getItem('django-state') || '{}');
                all[this.currentTopic] = {
                    quiz: this.quiz ? {
                        userAnswers: this.userAnswers,
                        submitted: this.quizSubmitted,
                        score: this.quizScore,
                        correctAnswers: this.correctAnswers
                    } : null,
                    exercise: this.exercises.length > 0 ? {
                        currentIndex: this.currentExerciseIndex,
                        codes: this.userCodes
                    } : null,
                    activeTab: this.activeTab
                };
                localStorage.setItem('django-state', JSON.stringify(all));
            } catch (e) {
                console.warn('Не вдалось зберегти стан', e);
            }
        },

        loadTopicState(topicId) {
            try {
                const all = JSON.parse(localStorage.getItem('django-state') || '{}');
                return all[topicId] || null;
            } catch {
                return null;
            }
        },

        restoreTopicState(topicId) {
            const saved = this.loadTopicState(topicId);
            if (!saved) return;

            // Quiz state
            if (saved.quiz && this.quiz) {
                if (Array.isArray(saved.quiz.userAnswers) &&
                    saved.quiz.userAnswers.length === this.quiz.questions.length) {
                    this.userAnswers = saved.quiz.userAnswers;
                }
                this.quizSubmitted = !!saved.quiz.submitted;
                this.quizScore = saved.quiz.score ?? null;
                this.correctAnswers = saved.quiz.correctAnswers || 0;
            }

            // Exercise state
            if (saved.exercise && this.exercises.length > 0) {
                this.userCodes = saved.exercise.codes || {};
                const savedIdx = saved.exercise.currentIndex || 0;
                if (savedIdx >= 0 && savedIdx < this.exercises.length) {
                    this.loadExerciseAtIndex(savedIdx);
                }
            }

            // Active tab
            if (saved.activeTab) {
                this.activeTab = saved.activeTab;
            }
        },

        // Скинути збережений стан поточної теми (опційно для UI-кнопки)
        clearTopicState() {
            if (!this.currentTopic) return;
            try {
                const all = JSON.parse(localStorage.getItem('django-state') || '{}');
                delete all[this.currentTopic];
                localStorage.setItem('django-state', JSON.stringify(all));
            } catch {}
        },

        get completedCount() {
            return Object.keys(this.completed).filter(k => this.completed[k]).length;
        },

        get progressPercent() {
            if (!this.topics.length) return 0;
            return Math.round((this.completedCount / this.topics.length) * 100);
        },

        // ========== EXERCISE ==========
        // Поточне завдання
        get exercise() {
            return this.exercises[this.currentExerciseIndex] || null;
        },

        resetExerciseCode() {
            const ex = this.exercise;
            if (ex) {
                this.userCode = ex.starterCode || '';
                this.checkResults = (ex.checks || []).map(c => ({ label: c.label, passed: false }));
            }
        },

        runChecks() {
            const ex = this.exercise;
            if (!ex || !ex.checks) return;
            this.checkResults = ex.checks.map(c => {
                let passed = false;
                if (c.type === 'contains') {
                    passed = this.userCode.includes(c.value);
                } else if (c.type === 'regex') {
                    try { passed = new RegExp(c.value).test(this.userCode); }
                    catch { passed = false; }
                } else if (c.type === 'notContains') {
                    passed = !this.userCode.includes(c.value);
                }
                return { label: c.label, passed };
            });
        },

        // Скільки завдань пройдено (всі чеки зелені)
        exerciseProgress(idx) {
            const ex = this.exercises[idx];
            if (!ex) return null;
            const key = this.exerciseKey(idx);
            // Якщо це поточне — беремо з checkResults; інакше — невідомо
            if (idx === this.currentExerciseIndex && this.checkResults.length > 0) {
                const passed = this.checkResults.filter(c => c.passed).length;
                return { passed, total: this.checkResults.length };
            }
            return null;
        },
    };
}
