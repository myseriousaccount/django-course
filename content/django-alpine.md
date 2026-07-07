# Alpine.js: реактивність прямо в HTML

Коли на сторінці треба **трохи** інтерактиву — показати/сховати меню, перемкнути вкладку, відкрити модалку — писати купу `addEventListener` чи тягнути важку jQuery шкода. Для таких випадків є **Alpine.js**. До речі, ця навчальна платформа, яку ти зараз читаєш, зроблена саме на ньому.

## Що таке Alpine.js

> **Alpine.js** — мінімалістична JavaScript-бібліотека, що додає інтерактивність **прямо в HTML через атрибути** (`x-data`, `x-show`, `@click`…). Її часто називають «**Tailwind для JavaScript**»: як Tailwind описує стилі в атрибутах, так Alpine описує поведінку.

**Як це працює.** Уся логіка живе в розмітці — без окремого `.js`-файлу, без `getElementById`. Ось повноцінний лічильник:

```html
<div x-data="{ count: 0 }">
    <button @click="count++">+</button>
    <span x-text="count"></span>
</div>
```

`x-data` оголошує стан (`count`), `@click` змінює його, `x-text` показує. Alpine сам стежить за змінами й оновлює сторінку — це й є **реактивність**.

## Навіщо це в Django-проєкті

**Навіщо.** Django рендерить HTML на сервері, а Alpine «оживляє» дрібниці в браузері без перезавантаження. Він займає нішу **між «нічого» і «fetch/jQuery»**: коли повноцінний AJAX — забагато, а голий vanilla — задовго.

Типові задачі для Alpine:
- показати/сховати (бургер-меню, FAQ, дропдаун);
- вкладки, акордеон;
- модальні вікна;
- лічильники, перемикачі, живі підсумки форми.

> <i class="bi bi-lightbulb"></i> Аналогія: Alpine — це як теги `{% if %}` / `{% for %}` у шаблоні, але виконуються **в браузері** й **реагують на дії** користувача. Django-теги вирішують, який HTML віддати; Alpine-атрибути вирішують, як він поводиться після відкриття.

## Підключення

Один рядок із CDN — і готово:

```html
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
```

> <i class="bi bi-exclamation-triangle"></i> Атрибут `defer` **обов'язковий** — щоб Alpine запустився після побудови HTML.

## Основні директиви

| Директива | Що робить |
|---|---|
| `x-data="{...}"` | оголошує компонент і його **стан** (об'єкт) |
| `x-show="умова"` | показати/сховати (через CSS `display`) |
| `x-if` | вставити/прибрати з DOM (лише в `<template>`) |
| `@click` (=`x-on:click`) | обробник події |
| `x-text` | вставити текст |
| `x-model` | двостороннє зв'язування з полем вводу |
| `x-for` | цикл (лише в `<template>`) |
| `:class` (=`x-bind:class`) | динамічні класи/атрибути |
| `x-init` | код при ініціалізації компонента |

Область дії стану — елемент з `x-data` і **все всередині** нього.

## Приклади (реальні патерни)

### 1. Показати/сховати — бургер-меню

```html
<div x-data="{ open: false }">
    <button @click="open = !open">☰ Меню</button>
    <nav x-show="open">
        <a href="/">Home</a> ...
    </nav>
</div>
```

### 2. Вкладки

```html
<div x-data="{ tab: 'theory' }">
    <button @click="tab = 'theory'" :class="tab === 'theory' && 'active'">Теорія</button>
    <button @click="tab = 'quiz'"   :class="tab === 'quiz' && 'active'">Тест</button>

    <div x-show="tab === 'theory'">...теорія...</div>
    <div x-show="tab === 'quiz'">...тест...</div>
</div>
```

> <i class="bi bi-info-circle"></i> Саме так зроблені вкладки на цій платформі: у коді `index.html` є `x-data="app()"` зі станом `activeTab`, а кнопки роблять `@click="activeTab = 'theory'"` — той самий патерн, тільки стан винесено в окрему функцію.

### 3. Модальне вікно

```html
<div x-data="{ open: false }">
    <button @click="open = true">Відкрити</button>

    <div x-show="open" @click.away="open = false">
        <p>Вміст модалки</p>
        <button @click="open = false">Закрити</button>
    </div>
</div>
```

`@click.away` — зручний модифікатор: закрити, коли клікнули **поза** елементом.

### 4. Список із даних

```html
<ul x-data="{ genres: ['Драма', 'Комедія', 'Трилер'] }">
    <template x-for="genre in genres">
        <li x-text="genre"></li>
    </template>
</ul>
```

## Alpine + Django: звідки беруться дані

Alpine працює **в браузері**, а дані спершу готує Django. Є два шляхи:

**1. Маленькі дані — прямо з шаблону в `x-data`:**

```html
<div x-data="{ likes: {{ post.likes_count }} }">
    <button @click="likes++">👍</button>
    <span x-text="likes"></span>
</div>
```
Тут Django підставляє число `{{ post.likes_count }}` на сервері (лайки статті блогу), а далі ним керує Alpine.

**2. Динамічні дані — `fetch` до Django всередині Alpine** (той самий підхід і CSRF, що в уроці про JavaScript). Приклад — «додати книгу в список для читання»:

```html
<div x-data="{ saved: false, toggle() {
        fetch('{% url 'toggle_reading_list' book.id %}', {
            method: 'POST',
            headers: { 'X-CSRFToken': '{{ csrf_token }}' }
        }).then(r => r.json()).then(d => this.saved = d.saved);
    } }">
    <button @click="toggle()" x-text="saved ? '★ У списку' : '☆ Додати'"></button>
</div>
```

> <i class="bi bi-info-circle"></i> Приємний бонус: Alpine керує текстом через `x-text`, а **не** через `{{ }}`, тож він **не конфліктує** з шаблонними тегами Django `{{ }}`. Обидва спокійно живуть в одному файлі.

## Коли Alpine, а коли інше

| Інструмент | Коли доречний |
|---|---|
| **vanilla JS** | зовсім разова дрібниця або складна кастомна логіка |
| **Alpine.js** | дрібний інтерактив у розмітці: показати/сховати, вкладки, модалки |
| **htmx** | коли треба підвантажувати **HTML з сервера** через атрибути (Django віддає шматки) |
| **jQuery** | наявний код або потрібен плагін на jQuery |
| **React / Vue** | повноцінний окремий SPA (для звичайного Django-сайту — overkill) |

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> Забути `defer` у `<script>` Alpine — тоді він спробує запуститись раніше за HTML і нічого не «оживить».

> <i class="bi bi-exclamation-triangle"></i> `x-show` лишає елемент у DOM (лише ховає через CSS), а `x-if` **прибирає** його зовсім. `x-if` і `x-for` працюють **тільки** всередині `<template>`.

> <i class="bi bi-info-circle"></i> Alpine — про зручність у браузері, а не про безпеку. Валідацію й перевірку прав **завжди** роби на сервері (Django), бо будь-який Alpine-код відкритий у браузері.

## Підсумок

- **Alpine.js** — мінімалістична реактивність через HTML-атрибути («Tailwind для JS»); логіка живе в розмітці, без окремих JS-файлів.
- Ніша — **дрібний інтерактив**: показати/сховати, вкладки, модалки, лічильники (між vanilla і fetch/jQuery).
- Ключові директиви: `x-data` (стан), `x-show`/`x-if`, `@click`, `x-text`, `x-model`, `x-for`, `:class`.
- Підключення — один `<script defer>` із CDN.
- Дані з Django: маленькі — прямо в `x-data`; динамічні — `fetch` → `JsonResponse` (з CSRF). Не конфліктує з `{{ }}` Django.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">ÐÑÑÑÑÐ¹Ð½Ð° Ð´Ð¾ÐºÑÐ¼ÐµÐ½ÑÐ°ÑÑÑ</span><a href="https://alpinejs.dev/" target="_blank" rel="noopener">alpinejs.dev <i class="bi bi-box-arrow-up-right"></i></a></div></div>
