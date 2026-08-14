# Створення моделі

Модель — Python-клас, з якого Django виводить таблицю в базі, форми й інтерфейс адмін-панелі. Урок проходить повний шлях: від опису предметної області до застосованої міграції, з розбором типових сутностей і практик, які варто закласти одразу.

## Від предметної області до класу

Перш ніж писати код, предметну область розкладають на три категорії:

| У житті | У Django |
|---|---|
| іменник (стаття, книга, замовлення) | модель |
| властивість (назва, ціна, дата) | поле |
| зв'язок (коментар *належить* статті) | `ForeignKey`, `ManyToManyField`, `OneToOneField` |

Якщо сутність накопичує різнорідні властивості — це сигнал розділити її на дві. Якщо для «моделі» не знаходиться жодного власного поля, крім зв'язку, — можливо, це не модель, а поле іншої.

## Робочий процес

### 1. Файл

Моделі живуть у `models.py` свого застосунку. Django шукає їх саме там, тому інші розташування вимагають додаткових налаштувань.

### 2. Клас і поля

```python
# blog/models.py
from django.db import models


class Post(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    body = models.TextField()
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

Клас називають в однині та CamelCase: з `Post` Django утворить таблицю `blog_post`. Кожне поле — екземпляр класу-поля, який визначає тип стовпця й базову валідацію.

`auto_now_add=True` заповнює значення один раз при створенні, `auto_now=True` оновлює його при кожному `save()`.

### 3. `__str__`

```python
# blog/models.py
    def __str__(self):
        return self.title
```

Без цього методу об'єкти показуються як `Post object (1)` — в адмін-панелі, в оболонці, у логах і у випадаючих списках форм. Формально він необов'язковий, практично потрібен завжди.

### 4. `class Meta`

```python
# blog/models.py
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Стаття'
        verbose_name_plural = 'Статті'
```

`ordering` задає порядок за замовчуванням для всіх запитів до моделі: без нього база може повертати рядки в довільному порядку, і пагінація почне «перемішувати» сторінки. `verbose_name` замінює автоматично згенеровану англійську назву в адмін-панелі.

### 5. Методи моделі

```python
# blog/models.py
    def is_draft(self):
        return not self.is_published
```

Логіку, що стосується однієї сутності, тримають у самій моделі: її можна викликати з view, з команди `manage.py`, з тесту й з адмінки, не дублюючи.

### 6. Міграції

```bash
python manage.py makemigrations
python manage.py migrate
```

`makemigrations` порівнює поточні моделі з попереднім станом і створює файл із описом змін; `migrate` виконує його в базі. До другої команди таблиці не існує.

Ситуації, коли міграція не проходить (нове обов'язкове поле, обмеження на таблиці з дублікатами), відкат і зміна самих даних — в уроці «Міграції».

### 7. Реєстрація в адмін-панелі

```python
# blog/admin.py
from django.contrib import admin

from .models import Post


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('title', 'is_published', 'created_at')
```

Крок необов'язковий: він впливає лише на інтерфейс `/admin`, а не на таблицю.

## Три різні «реєстрації»

Слово «зареєструвати» в Django означає три різні дії, і їх часто плутають:

| Дія | Що дає | Обов'язковість |
|---|---|---|
| застосунок в `INSTALLED_APPS` | Django бачить усі моделі застосунку | обов'язково — без цього моделі для фреймворку не існує |
| `makemigrations` + `migrate` | створює або змінює таблицю в базі | обов'язково для роботи з даними |
| `admin.site.register()` або `@admin.register()` | інтерфейс керування в `/admin` | опційно |

> <i class="bi bi-exclamation-triangle"></i> Реєстрація в адмін-панелі не створює таблицю. Якщо після `admin.register(Post)` запити падають із `no such table`, бракує саме міграцій.

## Спільні поля: абстрактна базова модель

Поля `created_at` і `updated_at` потрібні майже всім сутностям. Замість копіювання їх виносять у модель із `abstract = True`, яка не створює власної таблиці:

```python
# core/models.py
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
```

```python
# library/models.py
from core.models import TimeStampedModel


class Book(TimeStampedModel):
    title = models.CharField(max_length=200)
```

Стовпці `created_at` і `updated_at` з'являться в таблиці `library_book`; окремої таблиці для `TimeStampedModel` не буде.

## Приклади сутностей

### Стаття: статуси, slug, автор

```python
# blog/models.py
from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class Post(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Чернетка'
        PUBLISHED = 'published', 'Опубліковано'

    title = models.CharField('Заголовок', max_length=200)
    slug = models.SlugField(unique=True)
    body = models.TextField('Текст')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='posts',
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Стаття'
        verbose_name_plural = 'Статті'

    def __str__(self):
        return self.title
```

- `SlugField(unique=True)` зберігає придатну для адреси форму заголовка (`django-z-nulya`); унікальність потрібна, бо slug стає частиною URL.
- `TextChoices` описує три речі одним оголошенням: значення в базі (`'draft'`), константу в коді (`Post.Status.DRAFT`) і підпис в інтерфейсі («Чернетка»).
- `null=True, blank=True` у `published_at`: чернетка ще не має дати публікації. `null` дозволяє порожнє значення в базі, `blank` — у формах.
- Зв'язок із користувачем описують через `settings.AUTH_USER_MODEL`: прямий імпорт `User` ламається, якщо проєкт перейде на власну модель користувача.

### Книга: унікальне поле й «голий» many-to-many

```python
# library/models.py
class Genre(models.Model):
    name = models.CharField(max_length=60, unique=True)

    def __str__(self):
        return self.name


class Book(TimeStampedModel):
    title = models.CharField('Назва', max_length=200)
    isbn = models.CharField('ISBN', max_length=13, unique=True)
    published_year = models.PositiveSmallIntegerField('Рік видання')
    pages = models.PositiveIntegerField('Сторінок', null=True, blank=True)
    genres = models.ManyToManyField(Genre, related_name='books')

    class Meta:
        ordering = ['title']

    def __str__(self):
        return f'{self.title} ({self.published_year})'
```

Зв'язок «книга — жанр» не має власних даних, тому достатньо `ManyToManyField`: проміжну таблицю Django створить і обслуговуватиме сам.

### Рецензія: два зв'язки, валідатори, унікальність пари

```python
# cinema/models.py
from django.core.validators import MaxValueValidator, MinValueValidator


class Review(TimeStampedModel):
    movie = models.ForeignKey('Movie', on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews',
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
    )
    text = models.TextField('Рецензія', blank=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['movie', 'user'], name='unique_review_per_user_movie'),
        ]

    def __str__(self):
        return f'{self.user} про {self.movie}: {self.rating}/10'
```

Модель із двома зовнішніми ключами і власними полями — не просто зв'язок, а самостійна сутність. `UniqueConstraint` гарантує на рівні бази, що користувач не залишить дві рецензії на один фільм.

> <i class="bi bi-exclamation-triangle"></i> Валідатори працюють у формах і при `full_clean()`, але не спрацьовують на `Review.objects.create(rating=99)`. Якщо правило критичне, дублюй його `CheckConstraint` — його перевіряє сама база.

### Замовлення: many-to-many з даними на зв'язку

Коли на самому зв'язку є атрибути (кількість, ціна на момент купівлі), простого `ManyToManyField` не вистачає — потрібна проміжна модель:

```python
# shop/models.py
class OrderItem(models.Model):
    order = models.ForeignKey('Order', on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='order_items')
    quantity = models.PositiveIntegerField(default=1)
    price_at_purchase = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['order', 'product'], name='unique_product_per_order'),
        ]

    def __str__(self):
        return f'{self.product} ×{self.quantity}'


class Order(TimeStampedModel):
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='orders',
    )
    products = models.ManyToManyField(Product, through='OrderItem', related_name='orders')

    def __str__(self):
        return f'Замовлення #{self.pk}'
```

- `price_at_purchase` зберігає ціну окремо від `Product.price`, бо ціна товару згодом зміниться, а сума замовлення має лишитися історичною.
- `on_delete=models.PROTECT` не дає видалити товар, який фігурує в замовленнях.
- Критерій вибору: зв'язок без власних даних — `ManyToManyField`; щойно виникає питання «а де зберегти властивість самого зв'язку» — потрібна `through`-модель.

## related_name

`ForeignKey` оголошують на дочірньому боці, а зворотний доступ Django створює автоматично:

```python
# оболонка manage.py shell
movie.reviews.all()      # усі рецензії фільму    (related_name='reviews')
order.items.all()        # позиції замовлення     (related_name='items')
user.posts.all()         # статті автора          (related_name='posts')
```

Без `related_name` доступ називався б `movie.review_set.all()`. Явне ім'я робить запити читабельними, а в разі кількох зв'язків на ту саму модель — необхідним: два `ForeignKey` на `User` без різних `related_name` дають помилку `reverse accessor clashes` ще на `makemigrations`.

## on_delete

Аргумент обов'язковий: Django не обирає поведінку за тебе.

| Значення | Що станеться з дочірніми записами | Типовий випадок |
|---|---|---|
| `CASCADE` | видаляються разом із батьківським | коментар без статті не має сенсу |
| `PROTECT` | видалення батьківського забороняється | товар, що фігурує в замовленні |
| `SET_NULL` | зв'язок стає `NULL` (потрібен `null=True`) | стаття лишається після видалення автора |
| `SET_DEFAULT` | підставляється значення за замовчуванням | категорія «Без категорії» |
| `DO_NOTHING` | нічого; цілісність лишається на базі | майже ніколи, лише з власними обмеженнями БД |

```python
# blog/models.py
post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')

# shop/models.py
product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='order_items')

# blog/models.py
author = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.SET_NULL,
    null=True, blank=True,
    related_name='posts',
)
```

Питання, яке допомагає обрати: чи має дочірній запис сенс без батьківського? Якщо ні — `CASCADE`; якщо запис цінний сам по собі — `SET_NULL`; якщо видалення батьківського є помилкою — `PROTECT`.

## Обмеження на рівні бази

Обмеження описують у `Meta.constraints`. На відміну від валідаторів, вони перетворюються на правила самої бази, тому діють навіть при прямому `objects.create()` і при паралельних запитах.

```python
# cinema/models.py
class Review(models.Model):
    movie = models.ForeignKey('Movie', on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['movie', 'user'], name='unique_review_per_user_movie'),
            models.CheckConstraint(
                condition=models.Q(rating__gte=1) & models.Q(rating__lte=10),
                name='review_rating_range',
            ),
        ]
```

- **`UniqueConstraint`** забороняє повтор комбінації полів. Для одного поля достатньо `unique=True`, для пари й більше — саме цей клас.
- **`CheckConstraint`** описує умову, якій мусить відповідати рядок. Умову задають об'єктом `Q` в аргументі `condition`.
- **`name`** має бути унікальним у межах усієї бази, а не лише моделі. Тому в ім'я включають модель або поля: `unique_cart_item`, `review_rating_range`.

Обмеження — частина схеми, тому після їх додавання потрібна міграція:

```bash
python manage.py makemigrations
python manage.py migrate
```

### Що відбувається при порушенні

Спроба записати дублікат піднімає `IntegrityError` — це виняток рівня бази, і сторінка впаде з помилкою 500, якщо його не передбачити. Тому в коді або уникають ситуації, або обробляють виняток:

```python
# carts/views.py — штатний шлях: не створювати дублікат узагалі
item, created = CartItem.objects.get_or_create(user=request.user, product=product)
if not created:
    item.quantity += 1
    item.save(update_fields=['quantity'])
```

```python
# carts/views.py — якщо дублікат усе ж можливий (паралельні запити)
from django.db import IntegrityError

try:
    CartItem.objects.create(user=request.user, product=product)
except IntegrityError:
    ...  # рядок уже існує — просто оновлюємо кількість
```

Форми ловлять порушення раніше: `full_clean()` перевіряє й обмеження теж, тому `ModelForm` покаже зрозумілу помилку поля замість 500. Текст можна задати самому:

```python
# cinema/models.py
models.UniqueConstraint(
    fields=['movie', 'user'],
    name='unique_review_per_user_movie',
    violation_error_message='Ви вже залишали рецензію на цей фільм.',
)
```

### Умовна унікальність

Обмеження може діяти не на всі рядки, а лише на ті, що відповідають умові. Типовий випадок — «активним може бути лише один запис»:

```python
# shop/models.py
class Discount(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    percent = models.PositiveSmallIntegerField()
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['product'],
                condition=models.Q(is_active=True),
                name='one_active_discount_per_product',
            ),
        ]
```

Тепер у товару може бути скільки завгодно старих знижок і лише одна активна.

> <i class="bi bi-info-circle"></i> `unique_together` — старіший запис того самого, що робить `UniqueConstraint`. У новому коді документація радить `constraints`, бо вони підтримують умови, власні повідомлення й перевірку виразів.

## Практики, які варто закласти одразу

- `__str__` — у кожній моделі.
- `Meta.ordering` — щоб порядок записів був передбачуваним.
- `related_name` — для кожного `ForeignKey` і `ManyToManyField`.
- `TextChoices` замість рядкових констант у `choices`.
- Спільні поля — в абстрактну базову модель.
- Зв'язок із користувачем — через `settings.AUTH_USER_MODEL`.
- Критичні правила (унікальність, діапазон) — у `constraints`, а не лише у валідаторах.
- Гроші — `DecimalField`, а не `FloatField`: двійкові дроби дають похибку округлення.
- Міграції генерувати командою, не редагувати руками, і комітити разом із моделями.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Змінено модель без `makemigrations` і `migrate` | Клас описує одне, таблиця містить інше: запити падають із `no such column` |
| Застосунку немає в `INSTALLED_APPS` | `makemigrations` відповідає `No changes detected`, хоча модель написана |
| Немає `__str__` | Списки в адмінці й у формах складаються з `Book object (1)` |
| `SET_NULL` без `null=True` | Помилка ще на `makemigrations`: полю немає куди записати порожнечу |
| Однакові або відсутні `related_name` для двох зв'язків на одну модель | `reverse accessor clashes` — Django не може створити два однойменні зворотні доступи |
| `null=True` на `CharField` чи `TextField` | З'являються два способи означати порожнечу (`''` і `NULL`); для рядків достатньо `blank=True` |
| `.add()` для m2m із `through` | `Cannot use add() on a ManyToManyField which specifies an intermediary model` — записи створюють через проміжну модель явно |
| `FloatField` для цін | Похибки на кшталт `0.1 + 0.2`; для грошей завжди `DecimalField` |
| Валідатор замість обмеження бази | Пряме `objects.create()` обходить валідатор; для критичних правил — `constraints` |

## Підсумок

- Іменник предметної області стає моделлю, властивість — полем, зв'язок — `ForeignKey` або `ManyToManyField`.
- Шлях моделі: клас у `models.py` → поля → `__str__` → `Meta` → `makemigrations` → `migrate` → за потреби реєстрація в адмінці.
- Таблиця з'являється від міграцій, а не від реєстрації в адмін-панелі; сама модель стає видимою лише через `INSTALLED_APPS`.
- Спільні поля виносять в абстрактну модель (`abstract = True`) — вона не створює власної таблиці.
- `related_name` дає читабельний зворотний доступ і рятує від конфлікту кількох зв'язків на одну модель.
- `on_delete` обирають за питанням «чи має сенс дочірній запис без батьківського»; `SET_NULL` завжди в парі з `null=True`.
- M2M без даних — `ManyToManyField`, з даними на зв'язку — `through`-модель.
- Валідатори працюють у формах, `constraints` — у базі; критичні інваріанти описують обмеженнями.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/db/models/" target="_blank" rel="noopener">Models <i class="bi bi-box-arrow-up-right"></i></a></div></div>
