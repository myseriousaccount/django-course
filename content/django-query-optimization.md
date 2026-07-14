# Оптимізація запитів: N+1, select_related, prefetch_related

Найпоширеніша причина повільної сторінки в Django — не «слабкий сервер», а зайві запити до бази. Цей урок про проблему N+1 і два інструменти проти неї — `select_related` і `prefetch_related`. Приклади навмисно з **різних доменів** (блог, магазин, бібліотека), щоб ти бачила: це універсальний прийом, а не трюк для одного проєкту.

## Проблема N+1

> **N+1** — це коли для показу списку з N об'єктів Django робить **1 запит** на сам список і ще **N окремих запитів** — по одному на кожен пов'язаний об'єкт. Замість 2 запитів виходить 101.

Звідки вона береться? ORM лінивий: пов'язаний об'єкт тягнеться з БД лише тоді, коли ти до нього звертаєшся. У циклі це стає пасткою:

```python
# блог — «поганий» приклад
posts = Post.objects.all()                 # 1 запит: дістали список статей
for post in posts:
    print(post.author.name)                # + ще 1 запит НА КОЖНУ статтю
```

Якщо статей 100, це **1 + 100 = 101 запит**. У шаблоні те саме — цикл `{% for post in posts %}{{ post.author.name }}{% endfor %}` мовчки робить сотні звернень до бази.

> <i class="bi bi-lightbulb"></i> Уяви, що ти пишеш список замовлень і для кожного біжиш у сусідню кімнату спитати ім'я клієнта. Сто замовлень — сто пробіжок. Логічніше один раз узяти табличку з усіма іменами й звірятися з нею. Саме це роблять `select_related` і `prefetch_related`.

Найгірше, що на маленькій базі (5 записів) сторінка «літає» — проблему видно лише коли записів стане багато. Тому N+1 треба ловити свідомо, а не «коли гальмуватиме».

## `select_related` — для ForeignKey і OneToOne

> **`select_related`** каже ORM: «одразу підтягни пов'язаний об'єкт **тим самим запитом**, через SQL JOIN». Працює для **ForeignKey** і **OneToOne** — тобто там, де у кожного об'єкта **один** пов'язаний.

**Як це працює.** Django будує один SQL-запит із `JOIN` і заповнює `.author` наперед. Цикл більше не ходить у базу:

```python
# блог — той самий цикл, але 1 запит замість 101
posts = Post.objects.select_related('author')
for post in posts:
    print(post.author.name)                # даних уже вистачає — БД не турбуємо
```

```python
# магазин — замовлення та його клієнт (ForeignKey)
orders = Order.objects.select_related('customer')

# бібліотека — книга та її автор (ForeignKey)
books = Book.objects.select_related('author')
```

**Навіщо.** Один JOIN-запит майже завжди швидший за сотні дрібних. Можна йти й «углиб» через подвійне підкреслення:

```python
# замовлення → клієнт → місто клієнта, усе одним запитом
orders = Order.objects.select_related('customer__city')
```

## `prefetch_related` — для ManyToMany і зворотних зв'язків

> **`prefetch_related`** робить **окремий** запит на пов'язані об'єкти й «склеює» їх з основними вже в Python. Потрібен там, де у кожного об'єкта **багато** пов'язаних: **ManyToMany** і **зворотні** зв'язки (`related_name`).

Чому не JOIN? Бо для «багатьох» JOIN розмножив би рядки: стаття з 5 тегами перетворилась би на 5 рядків результату. Тому Django робить два запити й зшиває їх сам:

```python
# блог — теги (ManyToMany) і коментарі (зворотний FK)
posts = Post.objects.prefetch_related('tags', 'comments')
for post in posts:
    print(post.title, post.tags.count(), post.comments.count())  # без нових запитів
```

**Як це працює.** Два запити: `SELECT ... FROM post` і `SELECT ... FROM tag WHERE post_id IN (...)`. Django бере другий результат і розкладає теги по відповідних статтях у пам'яті.

```python
# бібліотека — книга та її зворотні відгуки (related_name='reviews')
books = Book.objects.prefetch_related('reviews')

# магазин — замовлення та його позиції (related_name='items')
orders = Order.objects.prefetch_related('items')
```

> <i class="bi bi-info-circle"></i> Обидва методи можна поєднувати в одному ланцюжку — так і роблять на реальних списках: `Post.objects.select_related('author').prefetch_related('tags', 'comments')`.

## select_related чи prefetch_related — коли який

Правило просте й тримається на одному питанні: **скільки пов'язаних об'єктів у одного**?

| | `select_related` | `prefetch_related` |
|---|---|---|
| Для яких зв'язків | ForeignKey, OneToOne (**один**) | ManyToMany, зворотний FK (**багато**) |
| Скільки запитів | 1 (JOIN) | 2 (окремий запит + склеювання) |
| Де відбувається | у базі (SQL JOIN) | частково в Python |
| Приклад | `Post → author` | `Post → tags`, `Post → comments` |

Мнемоніка: **«один → `select_related` (JOIN), багато → `prefetch_related` (окремий запит)»**.

> <i class="bi bi-exclamation-triangle"></i> Не переплутай напрямок: до `.author` (у статті один автор) — `select_related`; до `.comments` (у статті багато коментарів) — `prefetch_related`. Спробуєш `select_related('comments')` — отримаєш помилку, бо для «багатьох» JOIN не годиться.

## Місток: чому в shop-app це вже правильно

У навчальному проєкті shop-app у `news/views.py` список новин уже написаний оптимально:

```python
news_list = (News.objects
    .all()
    .order_by('-created_at')
    .select_related('category')          # у новини ОДНА категорія (ForeignKey) → JOIN
    .prefetch_related('tags', 'images')) # тегів і фото БАГАТО → окремі запити
```

Розберемо, **чому** саме так, зазирнувши в модель `News`:

- `category = ForeignKey(...)` — у кожної новини **одна** категорія → `select_related('category')` тягне її JOIN-ом у тому ж запиті.
- `tags = ManyToManyField(...)` — тегів у новини **багато** → `prefetch_related('tags')`.
- `images` — це зворотний зв'язок від `NewsImage` (`ForeignKey(..., related_name='images')`), фото теж **багато** → `prefetch_related('images')`.

Без цих рядків шаблон списку на кожну новину смикав би базу за категорією, тегами й фото окремо — класичний N+1 на сторінці, яка ще й розбита на сторінки пагінацією.

## Дрібніші оптимізації

Крім N+1 є ще кілька звичок, які економлять базу.

**`only()` / `defer()`** — тягнути не всі поля.

```python
# only: дістати ЛИШЕ ці поля (решта підвантажиться при зверненні)
Book.objects.only('title', 'price')

# defer: дістати все, КРІМ важких полів (наприклад, довгий текст)
Post.objects.defer('content')
```

**`count()` замість `len(qs)`** — коли треба лише кількість:

```python
Product.objects.filter(in_stock=True).count()   # SQL COUNT — база рахує сама
len(Product.objects.filter(in_stock=True))        # тягне ВСІ об'єкти в пам'ять, тоді рахує
```

**`exists()` замість `if qs`** — коли треба лише перевірити наявність:

```python
if Order.objects.filter(customer=user).exists():  # SQL EXISTS — швидко
    ...
```

> <i class="bi bi-info-circle"></i> `count()` і `exists()` виграють, **поки самі об'єкти тобі не потрібні**. Якщо ти все одно зараз пройдешся циклом по цьому ж queryset, то `len(qs)` бере кількість із уже завантаженого списку без нового запиту — тоді зайвий `count()` навпаки додасть звернення.

## Як побачити кількість запитів

Оптимізувати наосліп не варто — спершу поміряй.

**`django.db.connection.queries`** — швидко в shell чи у view (працює лише при `DEBUG=True`):

```python
from django.db import connection

posts = list(Post.objects.select_related('author'))
print(len(connection.queries))   # скільки запитів реально пішло
```

**django-debug-toolbar** — панель збоку сторінки в браузері зі списком усіх SQL-запитів, їхнім часом і дублями. Найзручніший спосіб побачити N+1 наочно:

```bash
pip install django-debug-toolbar
```

> <i class="bi bi-lightbulb"></i> Робочий цикл: відкрий сторінку з debug-toolbar → побачила «120 queries» → додала `select_related`/`prefetch_related` → оновила → «3 queries». Оце і є оптимізація, а не вгадування.

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> `select_related` на ManyToMany або зворотному зв'язку → помилка. Для «багатьох» — тільки `prefetch_related`.

> <i class="bi bi-exclamation-triangle"></i> Оптимізувати ще до того, як з'явилася проблема. На 5 записах різниці немає; спершу поміряй запити, потім прибирай зайве.

> <i class="bi bi-info-circle"></i> `select_related`/`prefetch_related` не фільтрують і не сортують — вони лише **як** тягнути пов'язане. Фільтри (`filter`, `order_by`) працюють як завжди.

> <i class="bi bi-pin-angle"></i> Ці методи повертають queryset, тож їх ланцюжать із рештою: `.filter(...).select_related(...).prefetch_related(...).order_by(...)`.

## Підсумок

- **N+1** — 1 запит на список + по одному на кожен пов'язаний об'єкт; головна причина повільних сторінок-списків.
- **`select_related('author')`** — для ForeignKey/OneToOne: один SQL-запит із JOIN («один пов'язаний»).
- **`prefetch_related('tags', 'comments')`** — для ManyToMany і зворотних зв'язків: окремий запит + склеювання в Python («багато пов'язаних»).
- Правило вибору: **один → `select_related`, багато → `prefetch_related`**; їх поєднують в одному ланцюжку.
- Дрібніше: `only()`/`defer()` (менше полів), `count()` замість `len(qs)`, `exists()` замість `if qs`.
- Міряй запити через django-debug-toolbar або `connection.queries` — оптимізуй за фактом, а не наосліп.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/db/optimization/" target="_blank" rel="noopener">Database access optimization <i class="bi bi-box-arrow-up-right"></i></a></div></div>
