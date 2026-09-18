# Поля моделі

Поле моделі описує стовпець таблиці: тип даних, обмеження й базову валідацію. Урок — довідник типів полів, їхніх спільних опцій, унікальності та індексів.

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

## Поля-зв'язки — де про них читати

`ForeignKey`, `ManyToManyField` і `OneToOneField` — теж поля, але вони не зберігають власне значення, а вказують на рядок іншої таблиці:

| Зв'язок | Приклад | Де оголошують поле |
|---|---|---|
| `ForeignKey` | багато коментарів — одна стаття | на боці «багато» |
| `ManyToManyField` | фільми й жанри | на будь-якому боці |
| `OneToOneField` | користувач і профіль | на боці розширення |

Критерій вибору між ними, обов'язковий `on_delete`, `related_name` і проміжна `through`-модель розібрані в уроці «Створення моделі», розділ «Зв'язки між моделями».

## Унікальність

### Одне поле: `unique=True`

`unique=True` робить унікальним **одне** поле:

```python
# library/models.py
isbn = models.CharField(max_length=13, unique=True)
```

### Комбінація полів: `UniqueConstraint`

Коли унікальною має бути **комбінація** полів (один відгук на товар від одного користувача, один рядок кошика на пару «користувач + товар»), використовують `UniqueConstraint` у `Meta`:

```python
# carts/models.py
class CartItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'product'], name='unique_cart_item'),
        ]
```

Обидва варіанти перетворюються на обмеження в базі, тому діють і при прямому `create()`. Детальніше про `UniqueConstraint`, `CheckConstraint`, умовну унікальність і обробку `IntegrityError` — в уроці «Створення моделі», розділ «Обмеження на рівні бази».

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

## Підсумок

- Тип поля задає стовпець у базі й безкоштовну валідацію: спершу шукають спеціалізований тип, `CharField` лишається для довільних рядків.
- Гроші — `DecimalField`, кількість — `PositiveIntegerField`, адреси — `EmailField` і `URLField`.
- `auto_now_add` заповнює поле при створенні, `auto_now` — при кожному збереженні.
- `choices` описують через `TextChoices`: код у базі, підпис в інтерфейсі, константа в коді.
- `null` — про базу, `blank` — про форми; для рядкових полів `null=True` не ставлять.
- Поля-зв'язки (`ForeignKey`, `ManyToManyField`, `OneToOneField`) розібрані в уроці «Створення моделі».
- Унікальність одного поля — `unique=True`, комбінації полів — `UniqueConstraint` у `Meta`.
- Індекси пришвидшують читання ціною запису, тому їх додають за фактичними запитами.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/models/fields/" target="_blank" rel="noopener">Model field reference <i class="bi bi-box-arrow-up-right"></i></a></div></div>
