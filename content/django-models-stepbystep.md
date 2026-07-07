# Моделі крок за кроком: від класу до бази

Модель — це серце Django-застосунку: один Python-клас, з якого фреймворк виводить таблицю в БД, форми та інтерфейс адмінки. У цьому уроці ти пройдеш увесь шлях від порожнього `models.py` до працюючої таблиці, навчишся описувати різні за характером сутності — блог-статтю, книгу в бібліотеці, рецензію на фільм, замовлення в магазині, підписку — і нарешті розберешся з поширеною плутаниною «де ж реєструвати модель». Приклади навмисно з **різних доменів**, щоб ти бачила: моделі — це універсальний механізм, а не щось прив'язане до одного проєкту.

## Як думати про модель: від предметної області до класу

Перш ніж писати `class`, корисно на хвилину відірватися від коду. Модель — це не «файл, який просить Django», а **опис сутності з реального світу**, перекладений мовою Python.

**Як це працює.** Роби це в три кроки:

1. **Назви іменники своєї предметної області.** Блог — це *статті*, *автори*, *теги*, *коментарі*. Бібліотека — це *книги*, *автори*, *читачі*, *видачі*. Кінотека — це *фільми*, *рецензії*, *жанри*. Кожен такий іменник — кандидат у модель.
2. **Опиши властивості кожної сутності.** Книга має *назву*, *ISBN*, *рік*. Рецензія має *текст*, *оцінку*, *дату*. Ці властивості стануть **полями**.
3. **Знайди зв'язки між сутностями.** Коментар *належить* статті. Рецензію *написав* користувач *про* фільм. Ці «належить», «написав», «про» стануть **зв'язками** (`ForeignKey`, `ManyToManyField`).

> 💡 Правило-орієнтир: **іменник → модель, властивість → поле, дієслово-зв'язок → `ForeignKey`/`ManyToManyField`**. Якщо сутність починає «роздуватися» від різнорідних властивостей — це сигнал розбити її на дві.

🧠 Аналогія: ти не малюєш будинок «як вийде», а спершу складаєш перелік кімнат і того, які двері їх з'єднують. Моделі — це кімнати, зв'язки — двері між ними.

Паралель зі SQLAlchemy: там ти теж описуєш клас, успадкований від `Base`, з `Column(...)` та `relationship(...)`. Django-моделі — це та сама ідея «клас = таблиця», але з батарейками: міграції, адмінка й форми виводяться з опису автоматично.

## Робочий процес: крок за кроком

Візьмемо для наскрізного прикладу блог-статтю `Post`, а далі покажемо ще кілька сутностей з інших доменів.

### 1. Де писати — `<app>/models.py`

**Визначення.** Моделі живуть у файлі `models.py` всередині свого застосунку (наприклад, `blog/models.py`), а не в теці проєкту.

**Як це працює.** Django за конвенцією шукає моделі саме тут. Файл створюється автоматично командою `startapp` — тобі лишається наповнити його класами.

**Навіщо.** Кожен app самодостатній: його моделі, view й адмінка лежать поруч, тож застосунок легко переносити в інший проєкт.

### 2. Оголосити клас

**Визначення.** Модель — це клас, що успадковується від `models.Model`.

```python
class Post(models.Model):
    ...
```

**Як це працює.** Назва класу пишеться в **однині** й у **CamelCase**: `Post`, а не `Posts` чи `post`. З цієї назви Django сам утворить назву таблиці — `<app>_post`.

> 💡 Чому однина? Клас описує **одну сутність** — одну статтю. Множинність з'являється сама, коли об'єктів у таблиці стає багато. 🧠 Думай про клас як про креслення однієї деталі, а не про цілий склад деталей.

### 3. Додати поля

**Визначення.** Поле — атрибут класу, тип якого визначає, який стовпець з'явиться в таблиці.

```python
title = models.CharField(max_length=200)
views = models.PositiveIntegerField(default=0)
```

**Як це працює.** Кожне поле — це екземпляр класу-поля (`CharField`, `IntegerField`, `ForeignKey` тощо). Django перекладає їх у типи стовпців БД.

Ось трохи ширший набір типів, які знадобляться вже в цьому уроці:

```python
slug = models.SlugField(unique=True)                 # частина URL: "django-z-nulya"
body = models.TextField()                            # довгий текст без обмеження
created_at = models.DateTimeField(auto_now_add=True) # ставиться раз при створенні
updated_at = models.DateTimeField(auto_now=True)     # оновлюється при кожному save()
is_published = models.BooleanField(default=False)    # True/False
rating = models.PositiveSmallIntegerField()          # ціле число 1..5 тощо
```

> 📖 Тут ми навмисно коротко: повний перелік типів полів та їхні аргументи розібрано в уроці **«Поля моделей і зв'язки»**. Далі в цьому уроці ми детальніше пройдемося по зв'язках, бо без них моделі — просто ізольовані таблиці.

### 4. `def __str__(self):` — обов'язково

**Визначення.** Метод `__str__` повертає рядок, яким об'єкт показується людині — в адмінці, у shell, у логах.

```python
def __str__(self):
    return self.title
```

**Як це працює.** Без нього Django виводить технічну заглушку `Post object (1)`, з якої неможливо зрозуміти, що це за запис.

**Навіщо.** Це різниця між списком «Post object (1), Post object (2)» і зрозумілим «Django з нуля, Асинхронність у Python». Формально метод не обов'язковий для роботи БД, але на практиці — **обов'язковий** для адекватної розробки.

### 5. `class Meta:` — метаналаштування

**Визначення.** Вкладений клас `Meta` описує поведінку моделі, що не є її полем: сортування, читабельні назви, обмеження.

```python
class Meta:
    ordering = ["-created_at"]           # найновіші статті зверху
    verbose_name = "Стаття"
    verbose_name_plural = "Статті"
```

**Як це працює.** `ordering` задає порядок за замовчуванням для всіх запитів. `verbose_name` / `verbose_name_plural` — це людські назви, які Django покаже в адмінці (інакше він просто «розклеїть» назву класу).

**Навіщо.** Без `ordering` порядок записів непередбачуваний. Без `verbose_name_plural` Django механічно додасть `s` і напише «Posts» замість «Статті».

> 📖 `Meta` уміє більше — обмеження на рівні БД (`constraints`, `unique_together`). До них повернемося окремим розділом нижче, бо вони стосуються цілісності даних.

### 6. Методи моделі — «товсті моделі» (best practice)

**Визначення.** Бізнес-логіку, пов'язану з однією сутністю, кладуть у методи самої моделі, а не розмазують по view.

```python
def is_draft(self):
    return not self.is_published
```

**Навіщо.** «Товста модель, тонкий view» — логіка живе поруч із даними, її легко перевикористати й протестувати.

> 📖 Де саме має жити яка логіка — докладно в уроці **«Де живе логіка»**.

### 7. Застосувати до БД: `makemigrations` → `migrate`

**Визначення.** Міграції — це контрольований переклад змін у класах на зміни в структурі БД.

```bash
python manage.py makemigrations   # згенерувати план змін
python manage.py migrate          # застосувати його до бази
```

**Як це працює.** `makemigrations` дивиться на твої моделі, порівнює з попереднім станом і створює файл-міграцію (звичайний Python). `migrate` виконує ці міграції — і лише тоді таблиця реально з'являється в БД.

**Навіщо.** Два кроки розділені навмисно: спершу ти бачиш, **що** зміниться, і лише потім застосовуєш. Історія міграцій дає змогу відтворити структуру БД на будь-якій машині.

### 8. Зареєструвати в `admin.py`

**Визначення.** Реєстрація в адмінці підключає модель до готової панелі керування.

```python
from django.contrib import admin
from .models import Post

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    pass
```

**Як це працює.** Після цього модель з'являється в `/admin/`, і ти можеш створювати, редагувати й видаляти записи через браузер.

**Навіщо.** Це найшвидший спосіб керувати даними, не пишучи жодної форми. Але — і це ключове — крок **опційний** (див. наступний розділ).

## «Де зареєструвати модель?» — прояснюємо плутанину

Новачки часто плутають два зовсім різні поняття, бо в обох звучить слово «зареєструвати». Розкладімо по поличках.

**Модель НЕ треба окремо реєструвати для БД.** Django знаходить її автоматично — за умови, що **застосунок** прописаний у `INSTALLED_APPS` (у `settings.py`). Реєструється один раз сам **app**, а не кожна модель усередині нього.

**Слово «register» стосовно моделі означає реєстрацію в АДМІНЦІ.** `admin.site.register(Post)` або декоратор `@admin.register(Post)` — це підключення до адмін-панелі. Крок **опційний**: він потрібен, лише якщо ти хочеш керувати цією моделлю через `/admin/`.

Отже, три різні дії, які легко сплутати:

| Дія | Що робить | Обов'язковість |
|---|---|---|
| App у `INSTALLED_APPS` | Django починає «бачити» всі моделі застосунку | **обов'язково**, інакше моделі не існує для фреймворку |
| `makemigrations` + `migrate` | створює/змінює **таблицю** в БД | **обов'язково** для роботи з даними |
| `admin.register(...)` | малює для моделі **інтерфейс** в `/admin/` | **опційно** |

> ⚠️ Найпоширеніша пастка: думати, що `admin.site.register(Post)` «підключає модель до бази даних». Це не так. До БД модель вносять **`makemigrations` + `migrate`**. Реєстрація в адмінці лише малює для неї інтерфейс — на саму таблицю вона не впливає взагалі.

🧠 Аналогія: `INSTALLED_APPS` — це прописка застосунку в місті (Django тепер знає про всіх його мешканців-моделі). `migrate` — це побудова для моделі власного будинку (таблиці). А реєстрація в адмінці — це встановлення дверного дзвінка, щоб до моделі можна було зайти через парадний вхід `/admin/`. Будинок стоїть і без дзвінка.

## Спільні поля через абстрактну базову модель

Помітила, що `created_at` і `updated_at` хочеться майже в кожній моделі — і в статті, і в книзі, і в замовленні? Копіювати їх у кожен клас — це порушення DRY. Django дає елегантний вихід: **абстрактну базову модель**.

**Визначення.** Абстрактна модель (`abstract = True` у `Meta`) не створює власної таблиці — її поля «вливаються» в кожну модель, що від неї успадковується.

```python
class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True   # ← ключове: таблиці TimeStampedModel не буде


class Book(TimeStampedModel):
    title = models.CharField(max_length=200)
    # created_at та updated_at успадковані — писати їх тут не треба
```

**Як це працює.** При `makemigrations` Django не створює таблицю для `TimeStampedModel`. Натомість стовпці `created_at` і `updated_at` з'являються **у таблиці `Book`** (і в кожному іншому нащадку — `Post`, `Order`, `Review`).

**Навіщо.** Одне джерело правди для спільних полів. Змінив логіку часових міток в одному місці — вона підхопилась усюди.

> 💡 Паралель зі SQLAlchemy: це аналог міксинів (`class TimeStamped: created_at = Column(...)`), від яких успадковуються моделі. Ідея та сама — винести повторюване в базовий клас.

## Різні моделі на практиці

Одного `Post` замало, щоб відчути моделі. Розберемо ще кілька типових сутностей з **різних доменів**, кожна з яких показує нову грань.

### Блог-стаття `Post` — slug, статуси, автор, дати

```python
from django.conf import settings
from django.db import models


class Post(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Чернетка"
        PUBLISHED = "published", "Опубліковано"

    title = models.CharField("Заголовок", max_length=200)
    slug = models.SlugField(unique=True)
    body = models.TextField("Текст")
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    published_at = models.DateTimeField(null=True, blank=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="posts",
    )

    class Meta:
        ordering = ["-created_at"]      # найновіші зверху
        verbose_name = "Стаття"
        verbose_name_plural = "Статті"

    def __str__(self):
        return self.title
```

**Розбір нового:**

- **`SlugField(unique=True)`** — «slug» це чиста, придатна для URL версія заголовка: `django-z-nulya`. `unique=True` гарантує, що двох однакових не буде, бо slug стане частиною посилання.
- **`status` через `TextChoices`** — замість «магічного» рядка `"draft"` ти маєш іменований перелік. У коді пишеш `Post.Status.PUBLISHED`, а в БД зберігається `"published"`; в адмінці користувач бачить «Опубліковано». Три речі — один опис.
- **`published_at` з `null=True, blank=True`** — чернетка ще не опублікована, тож дата може бути порожньою. `null=True` дозволяє порожнє значення в БД, `blank=True` — у формах.
- **`author = ForeignKey(settings.AUTH_USER_MODEL, ...)`** — зв'язок «стаття належить користувачу».

> ⚠️ Для зв'язку з користувачем посилайся на **`settings.AUTH_USER_MODEL`**, а не імпортуй `User` напряму. Це конвенція Django: проєкт може підмінити стандартну модель користувача власною, і твій код лишиться сумісним.

> 💡 `auto_now_add=True` (у `created_at`) ставить час **лише раз** — при створенні. `auto_now=True` (у `updated_at`) оновлює час **при кожному** `save()`. Не плутай: перше — «коли народилось», друге — «коли востаннє змінювалось».

### Книга `Book` у бібліотеці — унікальний ISBN, жанри, категорія

```python
class Genre(models.Model):
    name = models.CharField(max_length=60, unique=True)

    def __str__(self):
        return self.name


class Book(TimeStampedModel):
    title = models.CharField("Назва", max_length=200)
    isbn = models.CharField("ISBN", max_length=13, unique=True)
    published_year = models.PositiveSmallIntegerField("Рік видання")
    pages = models.PositiveIntegerField("Сторінок", null=True, blank=True)
    genres = models.ManyToManyField(Genre, related_name="books")

    class Meta:
        ordering = ["title"]
        verbose_name = "Книга"
        verbose_name_plural = "Книги"

    def __str__(self):
        return f"{self.title} ({self.published_year})"
```

**Розбір нового:**

- **`isbn = CharField(unique=True)`** — ISBN унікальний у природі, тож `unique=True` переносить це правило в БД: двох книг з однаковим кодом не буде.
- **`genres = ManyToManyField(Genre)`** — одна книга має **багато** жанрів, і один жанр охоплює **багато** книг. Це «голий» зв'язок без власних даних, тож простого `ManyToManyField` достатньо — Django сам створить проміжну таблицю. Порівняй із `through`-моделлю нижче, де на зв'язку є дані.

> 💡 Коли зв'язок «багато-до-багатьох» **без додаткових полів** (книга↔жанр, стаття↔тег), бери простий `ManyToManyField`. Django сам зробить сховану проміжну таблицю — тобі нема про що дбати.

### Рецензія `Review` на фільм — два зв'язки і валідація рейтингу

```python
from django.core.validators import MaxValueValidator, MinValueValidator


class Review(TimeStampedModel):
    movie = models.ForeignKey(
        "Movie",
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
    )
    text = models.TextField("Рецензія", blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["movie", "user"],
                name="unique_review_per_user_movie",
            )
        ]
        verbose_name = "Рецензія"
        verbose_name_plural = "Рецензії"

    def __str__(self):
        return f"{self.user} про {self.movie}: {self.rating}/10"
```

**Розбір нового:**

- **Два `ForeignKey` в одній моделі** — рецензія пов'язує фільм *і* користувача. `Review` — це «місток» між ними: він має власні дані (`rating`, `text`), тому це повноцінна модель, а не просто зв'язок.
- **`MinValueValidator(1)` / `MaxValueValidator(10)`** — рейтинг має бути від 1 до 10. Валідатори перевіряють це на рівні форм і `full_clean()`.

> ⚠️ Валідатори працюють при валідації форм і виклику `full_clean()`, але **не** при «сирому» `Review.objects.create(rating=99)`. Для жорсткої гарантії на рівні БД використовуй `constraints` із `CheckConstraint`. Валідатор — це ввічливе прохання, `constraint` — залізне правило БД.

### Позиція замовлення `OrderItem` — many-to-many через проміжну модель

У магазині замовлення `Order` містить багато товарів `Product`, а один товар потрапляє в багато замовлень — це класичний **many-to-many**. Але нам треба зберегти ще й *кількість* та *ціну на момент купівлі*. Простий `ManyToManyField` не має куди покласти ці додаткові поля — тож потрібна **проміжна (through) модель**.

```python
class Product(TimeStampedModel):
    name = models.CharField("Назва", max_length=200)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return self.name


class OrderItem(models.Model):
    order = models.ForeignKey(
        "Order",
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="order_items",
    )
    quantity = models.PositiveIntegerField(default=1)
    price_at_purchase = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["order", "product"],
                name="unique_product_per_order",
            )
        ]
        verbose_name = "Позиція замовлення"
        verbose_name_plural = "Позиції замовлення"

    def __str__(self):
        return f"{self.product} ×{self.quantity}"
```

Тепер під'єднаємо цю проміжну модель до `Order` як m2m-зв'язок через `through`:

```python
class Order(TimeStampedModel):
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="orders",
    )
    products = models.ManyToManyField(
        Product,
        through="OrderItem",
        related_name="orders",
    )

    def __str__(self):
        return f"Замовлення #{self.pk} від {self.customer}"
```

**Розбір нового:**

- **`ManyToManyField(through="OrderItem")`** каже Django: «зв'язок замовлення↔товар реалізуй не автоматичною таблицею, а моєю моделлю `OrderItem`». Так ми отримуємо місце для `quantity` і `price_at_purchase`.
- **`price_at_purchase`** зберігає ціну на момент купівлі окремо від `Product.price` — бо ціна товару згодом зміниться, а в замовленні має лишитися історична.
- **`on_delete=models.PROTECT`** на `product` — не дати видалити товар, який фігурує в чиємусь замовленні.

> 💡 Правило вибору: **простий `ManyToManyField`** — коли зв'язок «голий» (книга↔жанр). **`through`-модель** — коли на самому зв'язку є дані (скільки штук, за якою ціною). Щойно з'явилося запитання «а де зберегти властивість *зв'язку*?» — тобі потрібна проміжна модель.

> 📖 `products = ManyToManyField(..., through="OrderItem")` і пара `ForeignKey` всередині `OrderItem` — це **той самий зв'язок**, описаний з двох боків. `through` дає зручний доступ `order.products.all()`, а сама `OrderItem` — доступ до полів зв'язку.

## `related_name` і зворотний доступ у запитах

**Визначення.** `related_name` задає ім'я, під яким із «батьківського» об'єкта видно всі пов'язані з ним записи.

**Як це працює.** Ти оголошуєш `ForeignKey` на «дочірньому» боці, але Django автоматично створює й **зворотний** доступ на «батьківському»:

```python
movie = Movie.objects.get(pk=1)

movie.reviews.all()       # усі рецензії на цей фільм   (related_name="reviews")

book = Book.objects.get(pk=1)
book.genres.all()         # усі жанри цієї книги         (m2m)

order = Order.objects.get(pk=1)
order.items.all()         # усі позиції цього замовлення (related_name="items")
order.products.all()      # усі товари (через through)

user = request.user
user.posts.all()          # усі статті цього автора
user.reviews.all()        # усі рецензії цього користувача
user.orders.all()         # усі замовлення цього користувача
```

**Навіщо.** Без `related_name` Django згенерує назву за замовчуванням — `movie.review_set.all()`. Працює, але читається гірше. Явна назва (`reviews`, `items`, `orders`) робить запити самодокументованими.

> ⚠️ Якщо дві `ForeignKey` з різних моделей вказують на ту саму «батьківську» (на `User` посилаються `Post`, `Review` і `Order`), `related_name` мусить бути **унікальним у межах цільової моделі**. Інакше отримаєш помилку `reverse accessor clashes`. У нашому прикладі різні моделі дають `user.posts`, `user.reviews`, `user.orders` — конфлікту немає, бо імена різні.

🧠 Аналогія: `ForeignKey` — це стрілка «я вказую на фільм». `related_name` — це підпис на зворотному боці стрілки: «а мене можна знайти у фільмі під іменем `reviews`».

## `on_delete` на реальних сценаріях

Коли видаляють об'єкт, на який хтось посилається через `ForeignKey`, Django мусить знати, **що робити з посиланням**. Це задає обов'язковий аргумент `on_delete`.

| Варіант | Що відбувається при видаленні «батька» | Коли доречно |
|---|---|---|
| `CASCADE` | видаляються й усі «діти» | коментар без статті не має сенсу |
| `PROTECT` | видалення **забороняється**, поки є діти | не дати видалити товар, який є в замовленнях |
| `SET_NULL` | у дітей зв'язок стає `NULL` (потрібен `null=True`) | стаття лишається, навіть якщо автора видалили |
| `SET_DEFAULT` | у дітей ставиться значення за замовчуванням | є «дефолтна» категорія |

**Реальні сценарії з різних доменів:**

```python
# 1. Коментар без статті безглуздий → видаляємо разом зі статтею.
post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")

# 2. Товар, який є в чиємусь замовленні, видаляти не можна — історія має лишитися.
product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")

# 3. Автора видалили, але стаття цінна → хай лишиться "без автора".
author = models.ForeignKey(
    settings.AUTH_USER_MODEL,
    on_delete=models.SET_NULL,
    null=True, blank=True,
    related_name="posts",
)
```

> ⚠️ `SET_NULL` **вимагає** `null=True` на полі — інакше Django не зможе записати `NULL` і кине помилку ще на етапі `makemigrations`. Ці два завжди йдуть у парі.

> 💡 Немає «правильного за замовчуванням» `on_delete`. Питання завжди одне: **чи має сенс дитина без батька?** Якщо ні — `CASCADE`. Якщо дитину треба вберегти — `SET_NULL`. Якщо видалення батька — це помилка бізнес-логіки — `PROTECT`.

## Обмеження цілісності: `constraints` і `unique_together` (коротко)

`Meta` уміє задавати правила на рівні **самої бази даних** — надійніше за будь-яку перевірку в Python, бо БД не пропустить порушення навіть при прямому `create()`.

```python
class Meta:
    constraints = [
        # один користувач — одна рецензія на фільм
        models.UniqueConstraint(fields=["movie", "user"], name="unique_review"),
        # рейтинг строго 1..10 на рівні БД
        models.CheckConstraint(
            condition=models.Q(rating__gte=1) & models.Q(rating__lte=10),
            name="rating_range",
        ),
    ]
```

- **`UniqueConstraint`** — сучасний спосіб заборонити дублі за набором полів.
- **`unique_together = [["movie", "user"]]`** — старіший синтаксис для того самого; у новому коді Django рекомендує `UniqueConstraint`.
- **`CheckConstraint`** — правило-умова (наприклад, діапазон рейтингу), яке гарантує сама БД.

> 💡 Різниця з валідаторами: валідатор перевіряє у формах/`full_clean()`, а `constraint` — це залізне правило в самій БД. Для критичних інваріантів (унікальність, діапазон) став `constraint` — його не обійти.

## Best practices

- **`__str__` — завжди.** Один рядок коду, який рятує тебе від «object (1)» всюди.
- **`Meta.ordering`** — задавай передбачуваний порядок, не покладайся на випадковий (`["-created_at"]` — найновіші зверху).
- **`related_name` у `ForeignKey`** — зрозуміла назва для зворотного зв'язку: `movie.reviews.all()` замість `movie.review_set.all()`.
- **`choices` через `TextChoices`** — замість «магічних» рядків використовуй іменований клас-перелік.
- **Абстрактна база для спільних полів** — `created_at`/`updated_at` виноси в `TimeStampedModel(abstract=True)`, не копіюй.
- **Зв'язок із користувачем — через `settings.AUTH_USER_MODEL`**, а не прямий імпорт `User`.
- **`verbose_name`** — читабельні українські назви в адмінці замість автозгенерованих англійських.
- **Критичні інваріанти — у `constraints`**, а не лише у валідаторах: БД надійніша за Python-перевірку.
- **Міграції не редагуй руками** — генеруй їх через `makemigrations`; ручне втручання ламає історію.
- **Одна модель = одна сутність** — не змішуй книгу і жанр в одному класі.

## Типові помилки / Нюанси

- **Забув `makemigrations` / `migrate` після зміни.** Ти правиш модель, а в БД нічого не змінюється — бо зміни лишились у Python-класі й не доїхали до бази. Правило: змінив модель → зроби обидві команди.
- **Забув `__str__`.** Об'єкти всюди показуються як `Book object (1)` — технічно працює, але користуватися неможливо.
- **App не в `INSTALLED_APPS`.** `makemigrations` спокійно каже **«No changes detected»**, хоча ти щойно написав цілу модель. Django просто не бачить застосунку. Перевір `settings.py`.
- **Змінив поле, але не зробив міграцію.** Клас каже одне, таблиця — інше; запити падають із помилками про неіснуючий стовпець. Будь-яка зміна поля потребує нової міграції.
- **`SET_NULL` без `null=True`.** `makemigrations` одразу поскаржиться: `SET_NULL` не має куди записати порожнечу. Додай `null=True`.
- **Конфлікт `related_name`.** Дві `ForeignKey` на ту саму модель з однаковим (або відсутнім) `related_name` → `reverse accessor clashes`. Дай кожному унікальне ім'я.
- **`ManyToManyField(through=...)` і `.add()`.** Через `through`-модель не можна користуватися `order.products.add(product)` — Django змусить створювати `OrderItem` явно (бо треба вказати `quantity`, `price_at_purchase`). Це навмисно: зв'язок має дані, їх не можна пропустити.
- **`null` vs `blank`.** `null=True` — про БД (дозволено `NULL`), `blank=True` — про форми (поле можна лишити порожнім). Для `CharField`/`TextField` уникай `null=True` — Django радить порожній рядок `""`, тож достатньо `blank=True`.

> ⚠️ Якщо `makemigrations` каже «No changes detected», а ти впевнений, що зміни є — у 9 з 10 випадків винен не Django, а забутий рядок у `INSTALLED_APPS`.

## Підсумок

- Спершу думай **іменниками предметної області**: іменник → модель, властивість → поле, зв'язок-дієслово → `ForeignKey`/`ManyToManyField`.
- Шлях моделі: клас у `models.py` → поля → `__str__` → `Meta` → `makemigrations` → `migrate` → (опційно) реєстрація в адмінці.
- Назва класу — в **однині** й **CamelCase**; `__str__` вважай обов'язковим, а `Meta.ordering` і `verbose_name` — гарним тоном.
- Спільні поля (`created_at`/`updated_at`) виноси в **абстрактну базову модель** (`abstract = True`).
- `related_name` дає читабельний зворотний доступ (`movie.reviews.all()`, `user.orders.all()`); `on_delete` обирай питанням «чи має сенс дитина без батька?» (`CASCADE`/`PROTECT`/`SET_NULL`).
- **M2M без даних на зв'язку** (книга↔жанр) — простий `ManyToManyField`; **M2M із даними на зв'язку** (замовлення↔товар із кількістю й ціною) — через `through`-модель; критичні інваріанти — у `constraints`.
- Модель потрапляє до БД через **`makemigrations` + `migrate`**, а не через реєстрацію; для БД достатньо, щоб **app** був у `INSTALLED_APPS`.
- `register` стосовно моделі = підключення до **адмінки**, крок опційний і на таблицю не впливає.
- «No changes detected» при явних змінах — майже завжди сигнал, що застосунок забули додати в `INSTALLED_APPS`.

> 📖 Першоджерело — розділи «Models», «Model field reference» і «The Django admin site» в офіційній документації Django (docs.djangoproject.com), де описано повний життєвий цикл моделі від класу до таблиці, а також усі типи полів, `on_delete`-стратегії та обмеження.
