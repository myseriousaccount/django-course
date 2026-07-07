# Пагінація (Paginator)

Коли список стає довгим — сотні статей блог-стрічки, тисячі книг у каталозі, вся фільмотека, — вивалювати все на одну сторінку недоцільно: повільно й незручно. Django дає готовий інструмент `Paginator`, який ріже список на сторінки за тебе. Цей урок — як ним користуватися у view і в шаблоні. Приклади навмисно з **різних доменів** (блог, каталог книг, список фільмів), щоб ти бачила: механізм універсальний.

## Що таке Paginator

> **Paginator** — вбудований клас Django, який ділить список об'єктів на сторінки заданого розміру й дає зручний доступ до кожної з них. Це реалізація конвенції «не показуй усе одразу» без ручних обчислень зі зсувами й лімітами.

**Визначення.** Ти передаєш йому весь список і кількість елементів на сторінку — а він рахує, скільки вийде сторінок і що на кожній.

**Як це працює.** Імпорт і створення:

```python
from django.core.paginator import Paginator

paginator = Paginator(object_list, per_page)
```

- `object_list` — що ділимо: список або (найчастіше) QuerySet, наприклад `Book.objects.all()`.
- `per_page` — скільки елементів на одній сторінці, наприклад `10`.

Клас приймає ще кілька необов'язкових аргументів, які корисно знати:

| Аргумент | Що робить |
|---|---|
| `per_page` | скільки об'єктів на сторінці (обов'язковий) |
| `orphans` | скільки «залишкових» об'єктів на останній сторінці дозволити, щоб не робити окрему коротку сторінку. `orphans=2`: якщо на останній сторінці лишається ≤2 об'єкти, вони приліплюються до попередньої |
| `allow_empty_first_page` | чи дозволяти першу порожню сторінку, коли список зовсім порожній (за замовчуванням `True`) |

**Навіщо.** Замість того щоб самому рахувати `OFFSET`/`LIMIT` і межі сторінок, ти делегуєш це фреймворку. Менше коду — менше помилок «на межі» (типу пропущеного чи задвоєного елемента).

> <i class="bi bi-lightbulb"></i> Уяви товсту книгу без сторінок — суцільний сувій тексту. `Paginator` — це палітурник, що ріже сувій на пронумеровані аркуші. Ти просиш «дай мені аркуш №2» — і отримуєш саме його, не гортаючи весь сувій.

## Атрибути самого Paginator

Об'єкт `paginator` (ще до того, як ти взяла конкретну сторінку) уже знає загальні числа про весь список:

| Вираз | Що дає |
|---|---|
| `paginator.count` | скільки об'єктів усього (в усіх сторінках разом) |
| `paginator.num_pages` | скільки сторінок вийшло |
| `paginator.page_range` | діапазон номерів сторінок (`range(1, N+1)`) — зручно для циклу з номерами |
| `paginator.per_page` | скільки об'єктів на сторінку (те, що ти задала) |

`paginator.page_range` особливо корисний, коли треба вивести всі номери сторінок як список посилань «1 2 3 … N».

## Отримання потрібної сторінки

**Визначення.** Номер сторінки приходить із запиту як GET-параметр `?page=2`. Метод `get_page()` бере цей номер і повертає відповідну сторінку.

**Як це працює.**

```python
page_number = request.GET.get('page')      # рядок '2' або None
page = paginator.get_page(page_number)      # об'єкт сторінки
```

**Навіщо.** `get_page()` — безпечний метод: він **не падає** на некоректному вводі. Якщо `page` порожній чи не число — повертає першу сторінку; якщо номер завеликий — останню. Тобі не треба ловити винятки вручну.

> <i class="bi bi-info-circle"></i> Є ще суворіший метод `page(number)` — він кидає винятки на поганому вводі:
> - `PageNotAnInteger` — коли номер не число (`?page=abc`);
> - `EmptyPage` — коли номер поза діапазоном (`?page=999`).
>
> Ним користуються, коли треба **власна** обробка (наприклад, кинути 404 на неіснуючу сторінку). Для звичайних списків обирай `get_page()` — він уже все обробляє за тебе.

## Атрибути сторінки

**Визначення.** Об'єкт сторінки (`page`), який повертає `get_page()`, — це не просто список: він знає свій номер, чи є сусідні сторінки й скільки сторінок усього.

**Як це працює.**

| Вираз | Що дає |
|---|---|
| `page.object_list` | елементи саме цієї сторінки |
| `page.number` | номер поточної сторінки (з 1) |
| `page.has_next` | `True`, якщо є наступна |
| `page.has_previous` | `True`, якщо є попередня |
| `page.has_other_pages` | `True`, якщо є хоч якась інша сторінка (наступна або попередня) |
| `page.next_page_number` | номер наступної сторінки |
| `page.previous_page_number` | номер попередньої сторінки |
| `page.start_index` | порядковий номер першого об'єкта сторінки в усьому списку (з 1) |
| `page.end_index` | порядковий номер останнього об'єкта сторінки |
| `page.paginator` | сам paginator — звідси `page.paginator.num_pages`, `page.paginator.count` |

> <i class="bi bi-exclamation-triangle"></i> `page.next_page_number` і `page.previous_page_number` кидають виняток, якщо сусідньої сторінки немає. Тому в шаблоні завжди перевіряй їх через `{% if page.has_next %}` перед тим, як звертатися до номера.

**Навіщо.** З цих атрибутів будується блок навігації: кнопки «‹ Назад» / «Далі ›», напис «сторінка 2 з 7» і навіть «показано 11–20 із 143» (через `start_index`/`end_index`). Усе потрібне вже пораховано.

> <i class="bi bi-info-circle"></i> `page` **ітерується** й підтримує `len(page)` — тобто в шаблоні можна писати `{% for item in page %}` замість `page.object_list`. Обидва варіанти дають ті самі елементи.

## Приклад у view

Каталог книг із розбиттям по 12:

```python
from django.core.paginator import Paginator
from django.shortcuts import render
from .models import Book

def book_list(request):
    books = Book.objects.all().order_by('title')

    paginator = Paginator(books, 12)                # 12 книг на сторінку
    page = paginator.get_page(request.GET.get('page'))

    return render(request, 'library/book_list.html', {'page': page})
```

Той самий патерн для блог-стрічки — змінюється лише модель і розмір сторінки:

```python
from .models import Post

def post_list(request):
    posts = Post.objects.filter(is_published=True).order_by('-created')

    paginator = Paginator(posts, 5)                 # 5 статей на сторінку, найновіші згори
    page = paginator.get_page(request.GET.get('page'))

    return render(request, 'blog/post_list.html', {'page': page})
```

І для списку фільмів — знов той самий кістяк:

```python
from .models import Movie

def movie_list(request):
    movies = Movie.objects.all().order_by('-rating')

    paginator = Paginator(movies, 20)               # 20 фільмів на сторінку
    page = paginator.get_page(request.GET.get('page'))

    return render(request, 'cinema/movie_list.html', {'page': page})
```

Бачиш: код пагінації **однаковий** незалежно від домену. Міняється тільки QuerySet, розмір сторінки й шаблон.

> <i class="bi bi-exclamation-triangle"></i> Список під пагінацію майже завжди варто **впорядковувати** (`order_by`). Без стабільного порядку СУБД може повертати рядки в різній послідовності, і той самий об'єкт «стрибатиме» між сторінками.

## Приклад у шаблоні

У циклі перебираємо `page` (об'єкт сторінки ітерується як список її елементів), а нижче — навігація. Приклад для каталогу книг:

```django
{% for book in page %}
  <article>
    <h2>{{ book.title }}</h2>
    <p>{{ book.author }} — {{ book.year }}</p>
  </article>
{% empty %}
  <p>Книг немає.</p>
{% endfor %}

<nav class="pagination">
  {% if page.has_previous %}
    <a href="?page={{ page.previous_page_number }}">‹ Назад</a>
  {% endif %}

  <span>Сторінка {{ page.number }} з {{ page.paginator.num_pages }}</span>

  {% if page.has_next %}
    <a href="?page={{ page.next_page_number }}">Далі ›</a>
  {% endif %}
</nav>
```

Зверни увагу: `?page={{ page.next_page_number }}` — це і є той GET-параметр, який view прочитає наступного разу через `request.GET.get('page')`. Коло замкнулося.

### Повна навігація з номерами сторінок

Якщо треба не лише «Назад/Далі», а й перелік номерів (1 2 3 …), скористайся `page.paginator.page_range`:

```django
<nav class="pagination">
  {% for num in page.paginator.page_range %}
    {% if num == page.number %}
      <span class="current">{{ num }}</span>
    {% else %}
      <a href="?page={{ num }}">{{ num }}</a>
    {% endif %}
  {% endfor %}
</nav>
```

А напис «показано 11–20 із 143» будується з `start_index`/`end_index`/`count`:

```django
<p>Показано {{ page.start_index }}–{{ page.end_index }} із {{ page.paginator.count }}</p>
```

### Збереження інших GET-параметрів

Якщо на сторінці є ще й пошук чи фільтр (`?q=django`), то `href="?page=2"` **затре** їх — залишиться лише `page`. Щоб зберегти інші параметри, додавай їх поряд:

```django
<a href="?page={{ page.next_page_number }}&q={{ request.GET.q }}">Далі ›</a>
```

> <i class="bi bi-info-circle"></i> Для складніших випадків (кілька фільтрів одночасно) роблять окремий шаблонний тег, що переносить **усі** поточні GET-параметри й підмінює лише `page`:
>
> ```python
> # library/templatetags/url_tools.py
> from django import template
> register = template.Library()
>
> @register.simple_tag(takes_context=True)
> def page_url(context, page_number):
>     query = context['request'].GET.copy()   # копія всіх поточних параметрів
>     query['page'] = page_number             # підмінюємо лише page
>     return '?' + query.urlencode()
> ```
>
> Тоді в шаблоні: `<a href="{% page_url page.next_page_number %}">Далі ›</a>` — і всі фільтри збережуться самі. Але для одного-двох параметрів достатньо дописати їх вручну, як вище.

## Де це в проєкті

Пагінація потрібна там, де списки ростуть із часом:

- **Блог-стрічка**: по 5–10 статей, найновіші зверху (`order_by('-created')`).
- **Каталог книг**: по 12–24 позиції на сторінку, за назвою чи датою.
- **Фільмотека**: по 20 фільмів, за рейтингом.

Короткі списки (меню, категорії з кількох пунктів) пагінувати не треба — це зайве ускладнення. Правило просте: додавай пагінацію, коли список **може вирости** до десятків елементів.

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> **Звернення до `next_page_number` без перевірки** → виняток `EmptyPage` на останній сторінці. Завжди огортай у `{% if page.has_next %}`.

> <i class="bi bi-exclamation-triangle"></i> **Немає `order_by`** → об'єкти «стрибають» між сторінками. Впорядковуй QuerySet перед пагінацією.

> <i class="bi bi-exclamation-triangle"></i> **`?page=2` затирає фільтри** → втрачається `?q=` чи інші параметри. Дописуй їх у посилання (вручну або шаблонним тегом).

> <i class="bi bi-info-circle"></i> Не плутай `page.paginator.num_pages` (усього сторінок) із `page.number` (поточна). Напис «сторінка X з Y» — це саме `page.number` з `page.paginator.num_pages`.

## Підсумок

- **Paginator** ділить `object_list` на сторінки по `per_page`: `paginator = Paginator(books, 12)`; необов'язкові `orphans`, `allow_empty_first_page`.
- Paginator знає загальні числа: `count`, `num_pages`, `page_range`.
- Номер сторінки бери з запиту й передавай у `get_page()`: `page = paginator.get_page(request.GET.get('page'))` — цей метод не падає на поганому вводі (суворіший `page()` кидає `PageNotAnInteger`/`EmptyPage`).
- Об'єкт сторінки знає все для навігації: `page.number`, `page.has_next`/`has_previous`, `page.next_page_number`, `page.start_index`/`end_index`, `page.paginator.num_pages`; сам `page` ітерується як список.
- У шаблоні ітеруй `page`, будуй посилання через `?page={{ page.next_page_number }}` з перевіркою `has_next`/`has_previous`; повний перелік номерів — через `page.paginator.page_range`.
- Список під пагінацію **впорядковуй** (`order_by`), а інші GET-параметри (`?q=`) при потребі зберігай у посиланні.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/pagination/" target="_blank" rel="noopener">Pagination <i class="bi bi-box-arrow-up-right"></i></a></div></div>
