# Поля та зв'язки

Поле моделі описує стовпець таблиці: тип даних, обмеження й базову валідацію. Урок — довідник типів, спільних опцій і трьох видів зв'язків між моделями.

## Типи полів

```python
# library/models.py
from django.db import models


class Book(models.Model):
    title = models.CharField(max_length=200)
    summary = models.TextField(blank=True)
    pages = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=8, decimal_places=2)
    is_available = models.BooleanField(default=True)
    slug = models.SlugField(unique=True)
    cover = models.ImageField(upload_to='covers/', blank=True)
    published_on = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

| Поле | Для чого | Ключове |
|---|---|---|
| `CharField` | короткі рядки: назви, заголовки | `max_length` обов'язковий |
| `TextField` | великі тексти | без обмеження довжини |
| `IntegerField` | цілі числа | — |
| `PositiveIntegerField` | кількість, сторінки | не приймає від'ємних |
| `DecimalField` | гроші, точні дроби | `max_digits`, `decimal_places` |
| `FloatField` | вимірювання, рейтинг | наближене значення, не для грошей |
| `BooleanField` | так або ні | зазвичай із `default` |
| `DateField`, `DateTimeField` | дата, дата з часом | `auto_now`, `auto_now_add` |
| `DurationField` | проміжок часу (`timedelta`) | тривалість фільму, час читання |
| `EmailField` | адреса пошти | перевіряє формат |
| `URLField` | посилання | перевіряє формат |
| `SlugField` | частина адреси: `my-post` | літери, цифри, дефіси |
| `UUIDField` | зовнішній ідентифікатор | номер замовлення, публічний ключ |
| `JSONField` | словник або список | зберігається як JSON у базі |
| `FileField`, `ImageField` | файли й зображення | `upload_to`, для картинок потрібен Pillow |

Тип поля — це не формальність, а безкоштовна валідація: `EmailField` відхилить рядок без адреси, `PositiveIntegerField` — від'ємну кількість, `DecimalField` збереже ціну без похибки округлення.

> <i class="bi bi-exclamation-triangle"></i> `FloatField` для грошей дає класичні артефакти двійкових дробів: сума `0.1 + 0.2` перетворюється на `0.30000000000000004`, а після кількох операцій розбіжність стає видимою в підсумках. Для валюти завжди `DecimalField`.

`auto_now_add=True` заповнює поле один раз при створенні, `auto_now=True` — при кожному `save()`. Обидва роблять поле нередагованим у формах.

## Спільні опції

| Опція | Що робить |
|---|---|
| `null=True` | дозволяє `NULL` у базі |
| `blank=True` | дозволяє порожнє значення у формі |
| `default=…` | значення за замовчуванням |
| `choices=…` | обмежує вибір переліком |
| `unique=True` | значення унікальне в межах таблиці |
| `db_index=True` | створює індекс для пошуку за цим полем |
| `verbose_name='…'` | підпис поля в адмінці й формах |
| `help_text='…'` | підказка під полем |
| `editable=False` | приховує поле з форм |

### choices через TextChoices

```python
# shop/models.py
class Order(models.Model):
    class Status(models.TextChoices):
        NEW = 'new', 'Нове'
        PAID = 'paid', 'Оплачене'
        SHIPPED = 'shipped', 'Відправлене'

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW)
```

У базі зберігається код (`'new'`), в інтерфейсі показується підпис («Нове»), у коді використовується константа `Order.Status.NEW`. Django додає метод `order.get_status_display()`, що повертає підпис.

### null і blank

`null` стосується бази: чи може стовпець містити `NULL`. `blank` стосується валідації: чи можна лишити поле порожнім у формі. Це різні рівні, і саме тому їх часто плутають.

```python
# blog/models.py
summary = models.TextField(blank=True)                 # ✅ порожній рядок
summary = models.TextField(null=True, blank=True)      # ❌ два способи означати «порожньо»

shipped_at = models.DateField(null=True, blank=True)   # ✅ дата справді може бути невідома
```

Правило: `blank=True` — коли поле необов'язкове у формі; `null=True` додають лише для нерядкових полів. Для `CharField` і `TextField` порожнечу позначає порожній рядок, тому `null=True` створює два різні «порожньо» і ускладнює запити.

## Зв'язки

### ForeignKey — багато до одного

```python
# blog/models.py
class Post(models.Model):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='posts',
    )
    title = models.CharField(max_length=200)
```

```python
# python manage.py shell
post.author          # прямий доступ: автор цього поста
user.posts.all()     # зворотний доступ завдяки related_name
```

`on_delete` обов'язковий і визначає долю дочірніх записів при видаленні батьківського; варіанти й критерій вибору розібрані в уроці «Створення моделі».

### ManyToManyField — багато до багатьох

```python
# cinema/models.py
class Movie(models.Model):
    title = models.CharField(max_length=200)
    genres = models.ManyToManyField(Genre, blank=True, related_name='movies')
```

```python
# python manage.py shell
movie.genres.add(sci_fi)
movie.genres.remove(sci_fi)
movie.genres.all()
sci_fi.movies.all()
```

Проміжну таблицю Django створює й обслуговує сам. Якщо на зв'язку потрібні власні дані (кількість, ціна, дата), використовують `through`-модель.

Поле `blank=True` тут стосується лише форм: у базі many-to-many не буває обов'язковим, бо зв'язки зберігаються в окремій таблиці й записуються після створення об'єкта.

### OneToOneField — один до одного

```python
# accounts/models.py
class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bio = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True)
```

Основний випадок — розширення чужої моделі власними полями без її зміни: `user.profile` і `profile.user`.

| Зв'язок | Приклад | Де оголошується поле |
|---|---|---|
| `ForeignKey` | багато постів — один автор | на боці «багато» |
| `ManyToManyField` | фільми й жанри | на будь-якому боці, зазвичай на «головному» |
| `OneToOneField` | користувач і профіль | на боці розширення |

> <i class="bi bi-info-circle"></i> Для будь-якого зв'язку з користувачем використовують `settings.AUTH_USER_MODEL`, а не прямий імпорт `User`: проєкт може перейти на власну модель користувача, і код лишиться робочим.

## Індекси

```python
# shop/models.py
class Product(models.Model):
    name = models.CharField(max_length=200, db_index=True)
    sku = models.CharField(max_length=32, unique=True)

    class Meta:
        indexes = [
            models.Index(fields=['name', 'price']),
        ]
```

Індекс пришвидшує пошук і сортування за полем, але сповільнює запис і займає місце, тому його ставлять на поля, за якими справді фільтрують. `unique=True` створює індекс автоматично. Первинний ключ індексується завжди.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| `CharField` без `max_length` | Помилка перевірки моделі; для необмеженого тексту використовують `TextField` |
| `CharField` там, де є спеціальний тип | `email = CharField(...)` збереже будь-який рядок. `EmailField`, `URLField`, `SlugField`, `DecimalField` дають валідацію без коду |
| `FloatField` для цін | Похибки округлення в підсумках; для грошей — `DecimalField` |
| `null=True` на `CharField` чи `TextField` | Два різні «порожньо» (`''` і `NULL`) і складніші запити; для рядків достатньо `blank=True` |
| `blank=True` замість `null=True` для дати чи числа | Форма приймає порожнє значення, а база відхиляє його з `NOT NULL constraint failed` |
| `ImageField` без Pillow | Міграція падає з помилкою; потрібен `pip install Pillow` |
| `db_index=True` на всіх полях підряд | Кожен індекс сповільнює запис; індексують поля, за якими фільтрують і сортують |
| Немає `related_name` | Зворотний доступ називається `post_set`, а при двох зв'язках на одну модель виникає `reverse accessor clashes` |

## Підсумок

- Тип поля задає стовпець у базі й безкоштовну валідацію: спершу шукають спеціалізований тип, `CharField` лишається для довільних рядків.
- Гроші — `DecimalField`, кількість — `PositiveIntegerField`, адреси — `EmailField` і `URLField`.
- `auto_now_add` заповнює поле при створенні, `auto_now` — при кожному збереженні.
- `choices` описують через `TextChoices`: код у базі, підпис в інтерфейсі, константа в коді.
- `null` — про базу, `blank` — про форми; для рядкових полів `null=True` не ставлять.
- Три зв'язки: `ForeignKey` (багато до одного), `ManyToManyField` (багато до багатьох), `OneToOneField` (розширення моделі); зв'язок із користувачем — через `settings.AUTH_USER_MODEL`.
- `related_name` задає читабельний зворотний доступ і потрібен, коли на одну модель посилається кілька зв'язків.
- Індекси пришвидшують читання ціною запису, тому їх додають за фактичними запитами.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/models/fields/" target="_blank" rel="noopener">Model field reference <i class="bi bi-box-arrow-up-right"></i></a></div></div>
