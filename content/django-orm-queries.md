# Запити до бази (ORM)

Модель описує структуру даних, `QuerySet` API — спосіб їх читати й змінювати без SQL. Будь-який запит починається з менеджера `objects`. Урок — довідник основних операцій; приклади зручно перевіряти в оболонці `python manage.py shell`.

## Дістати дані: all, filter, exclude, get

Це чотири базові способи вибрати рядки з таблиці через менеджер `Model.objects`.

```python
# python manage.py shell
Book.objects.all()                     # усі книги
Book.objects.filter(is_available=True) # усі, що відповідають умові
Book.objects.exclude(pages=0)          # усі, КРІМ тих, що відповідають
Book.objects.get(isbn='978-0000')      # РІВНО один об'єкт
```

- `.all()`, `.filter()` / `.exclude()` повертають **QuerySet** — колекцію (можливо порожню, можливо з тисячами об'єктів);
- `.get()` повертає **один** об'єкт — і саме тому він примхливий щодо кількості.

Розділення чітке: `filter/exclude` — коли очікуєш багато (або нуль) результатів; `get` — коли очікуєш рівно один (наприклад, за унікальним `pk`, `isbn`, `email`).

> <i class="bi bi-exclamation-triangle"></i> `.get()` кидає винятки, якщо кількість не дорівнює одиниці:
> - **`Model.DoesNotExist`** — якщо не знайдено жодного об'єкта (`Book.DoesNotExist`);
> - **`Model.MultipleObjectsReturned`** — якщо знайдено більше одного.
>
> Тому для detail-сторінок замість голого `.get()` зазвичай беруть `get_object_or_404` (див. урок про shortcuts).

## Досліджувати результат: order_by, count, exists, first, last

Методи, що впорядковують QuerySet або дістають про нього коротку інформацію.

```python
# python manage.py shell
Post.objects.order_by('created_at')           # за зростанням дати
Post.objects.order_by('-created_at')          # мінус = за спаданням (новіші вгорі)
Post.objects.order_by('author', '-views')     # спершу за автором, потім за переглядами ↓
Post.objects.count()                          # скільки об'єктів (SELECT COUNT)
Post.objects.filter(is_published=True).exists()  # True/False — чи є хоч один
Post.objects.first()                          # перший об'єкт або None
Post.objects.last()                           # останній об'єкт або None
```

- `order_by` приймає кілька полів (сортування за пріоритетом), а `'?'` дає випадковий порядок: `Movie.objects.order_by('?').first()` — випадковий фільм;
- `.first()` / `.last()` повертають `None`, якщо набір порожній, — тому їх зручно перевіряти без винятків.

`.exists()` і `.count()` не тягнуть об'єкти в пам'ять — вони питають БД напряму, тому набагато дешевші, ніж `len(qs)` чи `if qs:`, коли тобі потрібне лише «чи є» або «скільки».

> <i class="bi bi-info-circle"></i> Хочеш перевірити наявність — пиши `if qs.exists():`, а не `if qs:`. Обидва працюють, але `.exists()` виконує легкий запит замість завантаження всього набору.

## Field lookups: фільтрація за умовами

Field lookups — це «модифікатори» полів через подвійне підкреслення `__`, що задають **як саме** порівнювати значення.

Різні lookups на різних моделях:

```python
# python manage.py shell
Product.objects.filter(price__gte=100)          # ціна >= 100
Product.objects.filter(price__lte=500)          # ціна <= 500
Product.objects.filter(price__range=(100, 500)) # ціна від 100 до 500 включно
Movie.objects.filter(title__icontains='dune')   # назва містить 'dune' (БЕЗ регістру)
Book.objects.filter(pk__in=[1, 2, 3])           # pk серед перелічених
User.objects.filter(email__endswith='@ukr.net') # email закінчується на...
Order.objects.filter(shipped_at__isnull=True)   # ще не відправлені (поле = NULL)
Post.objects.filter(created_at__year=2026)      # опубліковані 2026 року
```

| Lookup | Значення |
|---|---|
| `__gte` / `__lte` | більше-дорівнює / менше-дорівнює |
| `__gt` / `__lt` | суворо більше / менше |
| `__range=(a, b)` | значення в діапазоні `[a, b]` включно |
| `__contains` / `__icontains` | містить підрядок (з регістром / без, `i` = insensitive) |
| `__startswith` / `__endswith` | починається / закінчується підрядком |
| `__in` | значення в переліку/списку |
| `__isnull=True/False` | поле дорівнює / не дорівнює `NULL` |
| `__year` / `__month` / `__date` | частини дати |

**Проходження по зв'язках.** Через `__` можна фільтрувати ще й **по полях пов'язаної моделі**:

```python
# python manage.py shell
# усі книги, автор яких з України (Book → author → country)
Book.objects.filter(author__country='UA')

# усі замовлення користувачів із заблокованим акаунтом (Order → user)
Order.objects.filter(user__is_active=False)
```

Lookups покривають типові SQL-умови (`>=`, `LIKE`, `IN`, `IS NULL`) декларативно, без ручного SQL. Кілька умов у межах одного `.filter()` поєднуються через **І (AND)**.

## Ланцюжки й лінивість QuerySet

QuerySet **лінивий**: запит до БД **не виконується** в момент його створення. Він відкладається до того, коли ти реально звернешся до даних.

Фільтри можна нанизувати ланцюжком — це не робить кількох запитів:

```python
# python manage.py shell
qs = Movie.objects.filter(is_released=True)   # SQL ще НЕ виконано
qs = qs.filter(rating__gte=8)                 # досі НЕ виконано
qs = qs.exclude(genre='horror')               # досі НЕ виконано
qs = qs.order_by('-rating')                    # досі НЕ виконано

for movie in qs:   # ← ОСЬ ТУТ виконується один SELECT
    print(movie.title)
```

Запит спрацьовує лише при **зверненні**: цикл `for`, `list(qs)`, зріз `qs[:10]`, `len()`, друк у шаблоні. До того моменту Django просто «накопичує» умови й збирає з них один оптимальний SQL.

Лінивість дає дві переваги: можна будувати запит поступово (наприклад, додавати фільтри залежно від параметрів URL), і Django робить **один** ефективний запит замість багатьох проміжних.

> <i class="bi bi-exclamation-triangle"></i> Зворотний бік — кешування. Якщо звернутися до одного QuerySet двічі в різних місцях, він може виконати запит повторно. Коли результат потрібен кілька разів, збережи його в список: `movies = list(qs)`.

## Створення: create, save, bulk_create

Три способи додати нові рядки в таблицю.

```python
# python manage.py shell
# 1) create() — INSERT одразу, повертає готовий об'єкт
post = Post.objects.create(title='Новий пост', author=user)

# 2) конструктор + save() — коли треба щось зробити перед збереженням
book = Book(title='1984', pages=328)
book.slug = slugify(book.title)
book.save()

# 3) bulk_create() — багато об'єктів ОДНИМ запитом
Product.objects.bulk_create([
    Product(name='Мишка', price=300),
    Product(name='Клавіатура', price=800),
    Product(name='Килимок', price=150),
])
```

`.create()` економить рядок порівняно з конструктором + `.save()`. А `bulk_create()` виконує **один** `INSERT` на весь список — незрівнянно швидше, ніж викликати `.save()` у циклі (там був би окремий запит на кожен об'єкт).

> <i class="bi bi-exclamation-triangle"></i> `bulk_create()` **не викликає** метод `save()` моделі й сигнали `pre_save`/`post_save` — якщо в моделі є логіка в `save()`, масове створення її омине.

## get_or_create: створити, лише якщо ще немає

`get_or_create()` шукає об'єкт за заданими полями, і якщо не знаходить — створює його. Повертає **кортеж із двох значень**: сам об'єкт і прапорець `created` (`True`, якщо щойно створили).

```python
# cinema/views.py
# кінотека: користувач додає фільм у список "до перегляду"
item, created = Watchlist.objects.get_or_create(user=request.user, movie=movie)

if created:
    message = 'Фільм додано до списку'
else:
    message = 'Цей фільм уже у вашому списку'
```

**Чому зліва дві змінні через кому.** Це звичайне розпакування кортежу в Python — те саме, що в `for key, value in my_dict.items()`. Метод повертає пару значень, і ти одразу розкладаєш її по іменах:

```python
# python manage.py shell
item, created = Watchlist.objects.get_or_create(...)
#  │      └── True, якщо рядок щойно створено; False, якщо знайдено наявний
#  └── сам об'єкт Watchlist

# те саме довшим записом
pair = Watchlist.objects.get_or_create(...)   # (<Watchlist: ...>, True)
item = pair[0]
created = pair[1]
```

Порівняй із `create()`: той повертає **один** об'єкт, тому й ім'я зліва одне — або взагалі жодного, якщо об'єкт далі не потрібен.

```python
# python manage.py shell
product = Product.objects.create(name='Мишка', price=300)    # одне значення
Product.objects.create(name='Килимок', price=150)            # результат просто відкинуто
```

Кортеж повертається завжди, тож розпакувати доведеться в будь-якому разі — але зайве значення прийнято класти в підкреслення, щоб було видно, що воно свідомо ігнорується:

```python
# python manage.py shell
item, created = ...get_or_create(...)   # потрібні обидва
item, _       = ...get_or_create(...)   # потрібен лише об'єкт
_, created    = ...get_or_create(...)   # потрібен лише прапорець (наприклад, для повідомлення)
...get_or_create(...)                   # не потрібне нічого — рядок усе одно створиться
```

`_` — не спецсимвол, а звичайне ім'я змінної; це лише домовленість, зрозуміла всім, хто читає код.

Без нього довелося б писати руками те саме в три рядки — і при кожному повторному натисканні кнопки з'являвся б дублікат:

```python
# cinema/views.py
# ❌ так з'являються дублікати
Watchlist.objects.create(user=request.user, movie=movie)

# ❌ багатослівний ручний варіант того самого
try:
    item = Watchlist.objects.get(user=request.user, movie=movie)
except Watchlist.DoesNotExist:
    item = Watchlist.objects.create(user=request.user, movie=movie)
```

**`defaults` — поля лише для створення.** Аргументи `get_or_create()` використовуються і для пошуку, і для створення. Якщо якесь поле не має брати участі в пошуку (бо тоді нічого не знайдеться), клади його в `defaults`:

```python
# python manage.py shell
# школа: журнал відвідуваності — шукаємо за учнем і датою,
# а статус лише проставляємо при створенні запису
record, created = Attendance.objects.get_or_create(
    student=student,
    date=today,
    defaults={'status': 'present'},      # ← тільки для створення, у пошуку не бере участі
)
```

**Лічильник замість дубліката.** Класичний випадок — «додати ще один такий самий»: замість нового рядка збільшуємо кількість у наявному.

```python
# carts/views.py
# магазин: повторне "додати в кошик" — не другий рядок, а +1 до кількості
item, created = CartItem.objects.get_or_create(
    user=request.user,
    product=product,
    defaults={'quantity': 1},
)
if not created:
    item.quantity += 1
    item.save()
```

**`update_or_create()`** — брат-близнюк: якщо об'єкт знайдено, оновлює його полями з `defaults`, якщо ні — створює.

```python
# library/views.py
# бібліотека: оцінка книжки — одна на користувача, повторна перезаписує стару
rating, created = Rating.objects.update_or_create(
    user=request.user,
    book=book,
    defaults={'score': score},           # ← тут defaults ще й оновлює
)
```

| Метод | Знайшов | Не знайшов |
|---|---|---|
| `get()` | повертає об'єкт | помилка `DoesNotExist` |
| `create()` | (не шукає) | створює завжди — звідси дублікати |
| `get_or_create()` | повертає знайдений, `created=False` | створює, `created=True` |
| `update_or_create()` | оновлює полями `defaults` | створює |

> <i class="bi bi-exclamation-triangle"></i> Забути, що повертається **кортеж**, — помилка номер один: `item = Model.objects.get_or_create(...)` покладе в `item` пару `(об'єкт, True)`, і наступний `item.quantity` впаде. Завжди розпаковуй: `item, created = ...`.

> <i class="bi bi-exclamation-triangle"></i> Підступніший варіант тієї самої помилки — `created = Model.objects.get_or_create(...)`. Тут нічого не впаде: у `created` опиниться цілий кортеж, а непорожній кортеж завжди істинний, тож `if created:` спрацьовуватиме **щоразу**, навіть коли об'єкт лише знайдено. Правильно — `_, created = ...`.

> <i class="bi bi-info-circle"></i> `get_or_create()` не замінює обмеження в базі. Якщо два запити прийдуть одночасно, обидва можуть не знайти запис і створити по одному. Надійний захист — `unique_together` (або `UniqueConstraint`) у `class Meta` моделі: тоді сама база не дозволить дублікат.

> <i class="bi bi-exclamation-triangle"></i> Якщо за умовами пошуку знайдеться **кілька** об'єктів, `get_or_create()` підніме `MultipleObjectsReturned` — так само, як `get()`. Це ознака, що бракує унікального обмеження.

## Зміна: save, update

Змінити один об'єкт або цілий набір.

```python
# python manage.py shell
# Один об'єкт: змінити атрибут і зберегти
product = Product.objects.get(pk=5)
product.price = 999
product.save()

# Цілий QuerySet — один UPDATE на всі рядки
Order.objects.filter(status='new').update(status='processing')
Movie.objects.filter(is_released=False).update(rating=None)
```

`queryset.update()` виконує **одну** SQL-команду на весь набір — набагато швидше, ніж цикл із `.save()` по кожному об'єкту.

> <i class="bi bi-exclamation-triangle"></i> `queryset.update()`, як і `bulk_create`, НЕ викликає `save()` моделі й сигнали. Якщо в моделі є кастомна логіка в `save()`, масовий `update()` її омине — враховуй це.

## Видалення: delete

```python
# python manage.py shell
# один об'єкт
post = Post.objects.get(pk=10)
post.delete()

# масово — один DELETE на весь набір
Order.objects.filter(status='cancelled').delete()
```

> <i class="bi bi-exclamation-triangle"></i> Видалення каскадне: якщо в об'єкта є пов'язані записи через `ForeignKey(on_delete=CASCADE)`, вони теж зникнуть. Наприклад, видалення `Post` забере й усі його коментарі.

## Q і F: складніші умови

`Q` дозволяє будувати умови з **АБО (OR)**, а `F` — посилатися на **інше поле** того самого рядка прямо в запиті.

```python
# python manage.py shell
from django.db.models import Q, F

# Q: назва містить 'Django' АБО ціна менша за 500
Book.objects.filter(Q(title__icontains='django') | Q(price__lt=500))

# Q: НЕ (~) — усі пости, крім чернеток
Post.objects.filter(~Q(status='draft'))

# F: товари, де ціна зі знижкою менша за звичайну ціну (поле проти поля)
Product.objects.filter(sale_price__lt=F('price'))

# F: підняти ціну всім на 100 — на рівні БД, без завантаження об'єктів
Product.objects.update(price=F('price') + 100)
```

Звичайний `.filter(a=1, b=2)` — це завжди **І**. Для **АБО** потрібен `Q` (`|` — або, `&` — і, `~` — не). А `F` дозволяє порівнювати чи змінювати поле відносно іншого поля прямо в базі, без зайвого циклу в Python.

## Агрегація й анотація: aggregate, annotate

`aggregate` рахує **одне** підсумкове число по всьому набору; `annotate` додає обчислене поле **до кожного** об'єкта.

```python
# python manage.py shell
from django.db.models import Count, Avg, Sum, Max

# aggregate → словник з одним підсумком
Product.objects.aggregate(Avg('price'))      # {'price__avg': 512.4}
Order.objects.aggregate(total=Sum('amount')) # {'total': 18400}

# annotate → у кожного автора з'являється .book_count
from django.db.models import Count
authors = Author.objects.annotate(book_count=Count('books'))
for a in authors:
    print(a.name, a.book_count)              # кількість книг кожного автора
```

Ці підрахунки робить **база**, а не Python-цикл, — тому вони швидкі навіть на великих таблицях. `Count`, `Sum`, `Avg`, `Max`, `Min` — найчастіші функції.

## values і values_list: без повних об'єктів

Замість повноцінних об'єктів моделі повернути лише окремі поля — як словники (`values`) або кортежі/плоский список (`values_list`).

```python
# python manage.py shell
# словники з обраними полями
Book.objects.values('title', 'price')
# <QuerySet [{'title': '1984', 'price': 250}, ...]>

# кортежі
Product.objects.values_list('name', 'price')
# <QuerySet [('Мишка', 300), ('Клавіатура', 800), ...]>

# flat=True — плоский список одного поля
User.objects.values_list('email', flat=True)
# <QuerySet ['a@ex.com', 'b@ex.com', ...]>
```

Коли потрібні лише кілька полів (наприклад, список email для розсилки), `values_list(..., flat=True)` дешевший за завантаження цілих об'єктів — менше даних із БД і менше пам'яті.

## Лінивість на практиці

Типовий приклад — список із необов'язковим пошуком: фільтр додається лише за потреби, а запит виконується один раз.

```python
# blog/views.py
def post_feed(request):
    posts = Post.objects.filter(is_published=True).order_by('-created_at')

    query = request.GET.get('q')
    if query:                                   # фільтр додається ЛІНИВО
        posts = posts.filter(
            Q(title__icontains=query) | Q(body__icontains=query)
        )

    context = {
        'posts': posts,                         # SQL виконається в шаблоні
        'total': posts.count(),
    }
    return render(request, 'blog/feed.html', context)
```

Тут добре видно лінивість: фільтр за пошуком додається лише за потреби, а реальний запит іде один раз — коли шаблон почне ітерувати `posts`.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| `.get()` за неунікальним полем | `MultipleObjectsReturned` і помилка 500. Для «одного зі списку» — `.filter(...).first()` |
| `if qs:` замість `if qs.exists()` | Завантажує весь набір заради перевірки наявності |
| `len(qs)` замість `.count()` | Тягне об'єкти в пам'ять; рахувати має база |
| `update()` і `bulk_create()` там, де потрібна логіка `save()` | Власний `save()` і сигнали не виконуються. Коли логіка потрібна — цикл із `.save()` |
| Повторне звернення до того самого QuerySet | Запит виконується вдруге; результат зберігають у `list(qs)` |
| Запит усередині циклу по об'єктах | Проблема N+1: сто об'єктів дають сто запитів. Розв'язується `select_related` і `prefetch_related` — урок «Оптимізація запитів» |
| Немає `order_by` при пагінації | Порядок рядків не гарантований, тому сторінки можуть повторювати записи. Порядок задають у запиті або в `Meta.ordering` |

## Підсумок

- `objects.all() / .filter() / .exclude()` повертають **QuerySet** (багато); `.get()` — рівно **один** об'єкт і кидає `DoesNotExist` / `MultipleObjectsReturned`.
- `.order_by()` (кілька полів, `-` для спадання), `.count()`, `.exists()`, `.first()/.last()` досліджують набір; `.exists()` і `.count()` дешевші за завантаження всіх об'єктів.
- **Field lookups** через `__` (`gte`, `lte`, `range`, `contains`, `icontains`, `in`, `isnull`, дати) задають умову; у межах `.filter()` вони поєднуються через **І**; через `__` можна йти й по зв'язках (`author__country`).
- QuerySet **лінивий**: ланцюжок фільтрів збирається в один SQL, що виконується лише при зверненні до даних.
- Запис: `.create()`, конструктор + `.save()`, `bulk_create()`; зміна `obj.save()` / масовий `queryset.update()`; видалення `.delete()` (масові операції — одна SQL-команда, але без сигналів).
- `get_or_create()` створює, лише якщо об'єкта ще немає, і повертає **кортеж** `(об'єкт, created)`; поля, що не мають брати участі в пошуку, кладуть у `defaults`. `update_or_create()` — те саме, але знайдений об'єкт ще й оновлює. Від дублікатів у базі захищає `unique_together`, а не сам метод.
- `Q` — умови **АБО** (`|`, `&`, `~`); `F` — посилання на поле в самій БД; `aggregate`/`annotate` — підрахунки на боці бази; `values`/`values_list` — лише потрібні поля.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/db/queries/" target="_blank" rel="noopener">Making queries <i class="bi bi-box-arrow-up-right"></i></a></div></div>
