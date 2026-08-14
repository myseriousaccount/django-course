# Оптимізація запитів

Повільна сторінка-список у Django майже завжди означає зайві запити до бази, а не брак ресурсів сервера. Урок про проблему N+1, про два інструменти проти неї — `select_related` і `prefetch_related` — і про те, як побачити реальну кількість запитів.

## Проблема N+1

> **N+1** — це коли для показу списку з N об'єктів Django робить **1 запит** на сам список і ще **N окремих запитів** — по одному на кожен пов'язаний об'єкт. Замість 2 запитів виходить 101.

Звідки вона береться? ORM лінивий: пов'язаний об'єкт тягнеться з БД лише тоді, коли ти до нього звертаєшся. У циклі це стає пасткою:

```python
# blog/views.py — «поганий» приклад
posts = Post.objects.all()                 # 1 запит: дістали список статей
for post in posts:
    print(post.author.name)                # + ще 1 запит НА КОЖНУ статтю
```

Якщо статей 100, це **1 + 100 = 101 запит**. У шаблоні те саме — цикл `{% for post in posts %}{{ post.author.name }}{% endfor %}` мовчки робить сотні звернень до бази.

Найгірше, що на маленькій базі (5 записів) сторінка «літає» — проблему видно лише коли записів стане багато. Тому N+1 треба ловити свідомо, а не «коли гальмуватиме».

## `select_related` — для ForeignKey і OneToOne

> **`select_related`** каже ORM: «одразу підтягни пов'язаний об'єкт **тим самим запитом**, через SQL JOIN». Працює для **ForeignKey** і **OneToOne** — тобто там, де у кожного об'єкта **один** пов'язаний.

Django будує один SQL-запит із `JOIN` і заповнює `.author` наперед. Цикл більше не ходить у базу:

```python
# blog/views.py — той самий цикл, але 1 запит замість 101
posts = Post.objects.select_related('author')
for post in posts:
    print(post.author.name)                # даних уже вистачає — БД не турбуємо
```

```python
# shop/views.py
# замовлення та його клієнт (ForeignKey)
orders = Order.objects.select_related('customer')

# бібліотека — книга та її автор (ForeignKey)
books = Book.objects.select_related('author')
```

Один JOIN-запит майже завжди швидший за сотні дрібних. Можна йти й «углиб» через подвійне підкреслення:

```python
# shop/views.py — замовлення → клієнт → місто клієнта, усе одним запитом
orders = Order.objects.select_related('customer__city')
```

## `prefetch_related` — для ManyToMany і зворотних зв'язків

> **`prefetch_related`** робить **окремий** запит на пов'язані об'єкти й «склеює» їх з основними вже в Python. Потрібен там, де у кожного об'єкта **багато** пов'язаних: **ManyToMany** і **зворотні** зв'язки (`related_name`).

Чому не JOIN? Бо для «багатьох» JOIN розмножив би рядки: стаття з 5 тегами перетворилась би на 5 рядків результату. Тому Django робить два запити й зшиває їх сам:

```python
# blog/views.py — теги (ManyToMany) і коментарі (зворотний FK)
posts = Post.objects.prefetch_related('tags', 'comments')
for post in posts:
    print(post.title, post.tags.count(), post.comments.count())  # без нових запитів
```

Два запити: `SELECT ... FROM post` і `SELECT ... FROM tag WHERE post_id IN (...)`. Django бере другий результат і розкладає теги по відповідних статтях у пам'яті.

```python
# library/views.py
# книга та її зворотні відгуки (related_name='reviews')
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

## Розбір реального списку

Список новин, у якому враховані обидва види зв'язків:

```python
# news/views.py
news_list = (News.objects
    .all()
    .order_by('-created_at')
    .select_related('category')          # у новини ОДНА категорія (ForeignKey) → JOIN
    .prefetch_related('tags', 'images')) # тегів і фото БАГАТО → окремі запити
```

Чому саме так, видно з моделі:

- `category = ForeignKey(...)` — у кожної новини **одна** категорія → `select_related('category')` тягне її JOIN-ом у тому ж запиті.
- `tags = ManyToManyField(...)` — тегів у новини **багато** → `prefetch_related('tags')`.
- `images` — це зворотний зв'язок від `NewsImage` (`ForeignKey(..., related_name='images')`), фото теж **багато** → `prefetch_related('images')`.

Без цих рядків шаблон на кожну новину звертався б до бази окремо за категорією, тегами й зображеннями — N+1 у трьох місцях одночасно.

## Дрібніші оптимізації

Крім N+1 є ще кілька звичок, які економлять базу.

**`only()` / `defer()`** — тягнути не всі поля.

```python
# python manage.py shell
# only: дістати ЛИШЕ ці поля (решта підвантажиться при зверненні)
Book.objects.only('title', 'price')

# defer: дістати все, КРІМ важких полів (наприклад, довгий текст)
Post.objects.defer('content')
```

**`count()` замість `len(qs)`** — коли треба лише кількість:

```python
# python manage.py shell
Product.objects.filter(in_stock=True).count()   # SQL COUNT — база рахує сама
len(Product.objects.filter(in_stock=True))        # тягне ВСІ об'єкти в пам'ять, тоді рахує
```

**`exists()` замість `if qs`** — коли треба лише перевірити наявність:

```python
# shop/views.py
if Order.objects.filter(customer=user).exists():  # SQL EXISTS — швидко
    ...
```

> <i class="bi bi-info-circle"></i> `count()` і `exists()` виграють, **поки самі об'єкти тобі не потрібні**. Якщо ти все одно зараз пройдешся циклом по цьому ж queryset, то `len(qs)` бере кількість із уже завантаженого списку без нового запиту — тоді зайвий `count()` навпаки додасть звернення.

## Як побачити кількість запитів

Оптимізувати наосліп не варто — спершу поміряй.

**`django.db.connection.queries`** — швидко в shell чи у view (працює лише при `DEBUG=True`):

```python
# python manage.py shell
from django.db import connection

posts = list(Post.objects.select_related('author'))
print(len(connection.queries))   # скільки запитів реально пішло
```

**django-debug-toolbar** — панель збоку сторінки в браузері зі списком усіх SQL-запитів, їхнім часом і дублями. Найзручніший спосіб побачити N+1 наочно:

```bash
pip install django-debug-toolbar
```

Порядок роботи: відкрити сторінку з панеллю, побачити фактичну кількість запитів, додати `select_related` чи `prefetch_related`, оновити й порівняти. Оптимізація без вимірювання здебільшого міняє читабельний код на складніший без виграшу.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| `select_related` на ManyToMany чи зворотному зв'язку | Помилка `Invalid field name(s) given in select_related`; для «багатьох» — `prefetch_related` |
| Оптимізація без вимірювання | Код ускладнюється, кількість запитів не змінюється. Спершу панель або `connection.queries` |
| `prefetch_related` там, де достатньо `select_related` | Замість одного JOIN виконуються два запити |
| Фільтрація пов'язаних об'єктів у шаблоні | Кожен виклик `post.comments.filter(...)` — новий запит попри `prefetch_related`. Потрібен об'єкт `Prefetch` із готовим queryset |
| `count()` після того, як набір уже завантажено | Додатковий запит; якщо об'єкти вже в пам'яті, `len(qs)` дешевший |
| `only()` з подальшим зверненням до пропущеного поля | Кожне звернення викликає окремий дозапит — виходить той самий N+1 |

> <i class="bi bi-info-circle"></i> Коли пов'язані записи треба ще й відфільтрувати або відсортувати, використовують клас `Prefetch`:
>
> ```python
> # blog/views.py
> from django.db.models import Prefetch
>
> posts = Post.objects.prefetch_related(
>     Prefetch('comments', queryset=Comment.objects.filter(is_approved=True))
> )
> ```

## Підсумок

- **N+1** — 1 запит на список + по одному на кожен пов'язаний об'єкт; головна причина повільних сторінок-списків.
- **`select_related('author')`** — для ForeignKey/OneToOne: один SQL-запит із JOIN («один пов'язаний»).
- **`prefetch_related('tags', 'comments')`** — для ManyToMany і зворотних зв'язків: окремий запит + склеювання в Python («багато пов'язаних»).
- Правило вибору: **один → `select_related`, багато → `prefetch_related`**; їх поєднують в одному ланцюжку.
- Дрібніше: `only()`/`defer()` (менше полів), `count()` замість `len(qs)`, `exists()` замість `if qs`.
- Міряй запити через django-debug-toolbar або `connection.queries` — оптимізуй за фактом, а не наосліп.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/db/optimization/" target="_blank" rel="noopener">Database access optimization <i class="bi bi-box-arrow-up-right"></i></a></div></div>
