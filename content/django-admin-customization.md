# Налаштування адмінки

Адмінка Django — це готова панель керування даними, яку ти отримуєш безкоштовно. Але «з коробки» вона показує лише голі назви об'єктів; цей урок про те, як перетворити її на зручний робочий інструмент для контент-менеджера, редактора чи бібліотекаря — за допомогою класу `ModelAdmin`. Приклади навмисно з **різних доменів** (блог, каталог книг, фільмотека), щоб ти бачила: налаштування ті самі, хоч дані різні.

> <i class="bi bi-info-circle"></i> Щоб узагалі увійти на `/admin`, потрібен користувач із доступом. Команда `python manage.py createsuperuser` (запитає логін, email, пароль) — в уроці «Команди manage.py».

## Спершу — реєстрація моделі

> **Реєстрація** — це дія, якою ти повідомляєш адмінці: «цю модель треба показувати й дозволити нею керувати». Незареєстрована модель в адмінці **не з'являється взагалі**.

Пам'ятаєш урок про `django.contrib.admin`? Адмінка — це вбудований app зі списку `INSTALLED_APPS`, а не окрема бібліотека. Але сам факт, що app увімкнено, ще нічого не показує: кожну модель треба зареєструвати явно — це той самий принцип **явності**, який ти вже бачила у Django.

Реєстрація живе у файлі `admin.py` всередині застосунку. Найпростіший варіант — одна лінійка:

```python
# blog/admin.py
from django.contrib import admin
from .models import Post

admin.site.register(Post)
```

Тепер `Post` видно в адмінці. Але список статей виглядатиме як монотонний перелік `Post object (1)`, `Post object (2)` — некорисно. Щоб керувати відображенням, потрібен окремий клас налаштувань.

> <i class="bi bi-info-circle"></i> Щоб об'єкти показувалися людською назвою, а не `Post object (1)`, у **моделі** додай `__str__`:
> ```python
> def __str__(self):
>     return self.title
> ```
> `list_display` (нижче) — це вже про **колонки в списку**, а `__str__` — про те, як об'єкт зветься всюди (у зв'язаних полях, у логах адмінки тощо).

## `ModelAdmin` і декоратор `@admin.register`

`ModelAdmin` — це клас, що описує, **як саме** конкретна модель поводиться в адмінці: які колонки показувати, за чим фільтрувати, що дозволено редагувати.

Ти створюєш підклас `admin.ModelAdmin` і прив'язуєш його до моделі. Сучасніша **конвенція** — робити це декоратором `@admin.register`:

```python
# blog/admin.py
from django.contrib import admin
from .models import Post

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "is_published")
```

Це повний еквівалент старішого запису:

```python
admin.site.register(Post, PostAdmin)
```

> <i class="bi bi-info-circle"></i> Обидва способи працюють однаково — результат ідентичний. Декоратор `@admin.register` лаконічніший і тримає налаштування та реєстрацію в одному місці, тож у новому коді обирай саме його.

`ModelAdmin` — це єдина точка, де ти описуєш поведінку моделі в адмінці. Змінюєш один клас — змінюється вся сторінка. Це знайомий тобі **DRY** у дії.

## Опції списку об'єктів (list view)

Це сторінка з переліком усіх об'єктів. кожна опція вмикає окрему зручність. Розберемо на моделі книги в каталозі:

```python
# library/admin.py
@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "genre", "year", "in_stock")
    list_display_links = ("title",)
    list_filter = ("genre", "in_stock", "year")
    search_fields = ("title", "author__name", "isbn")
    ordering = ("title",)
    list_editable = ("in_stock",)
    list_per_page = 25
    date_hierarchy = "added_at"
    list_select_related = ("author",)
    empty_value_display = "—"
```

Що робить кожен рядок:

| Опція | Що дає |
|---|---|
| **`list_display`** | які колонки видно в списку (замість `Book object (1)`) |
| **`list_display_links`** | які колонки є посиланням на сторінку об'єкта (за замовчуванням — перша) |
| **`list_filter`** | панель фільтрів збоку — швидко відсіяти за жанром, наявністю, роком |
| **`search_fields`** | рядок пошуку зверху; `author__name` шукає по зв'язаній моделі через `__` |
| **`ordering`** | порядок сортування списку (`-` = за спаданням) |
| **`list_editable`** | поля, які можна редагувати **прямо у списку**, не відкриваючи об'єкт |
| **`list_per_page`** | скільки об'єктів на одну сторінку списку (за замовчуванням 100) |
| **`date_hierarchy`** | навігація по датах угорі (рік → місяць → день) за вказаним полем-датою |
| **`list_select_related`** | оптимізація: підвантажити зв'язані об'єкти одним запитом (менше SQL) |
| **`empty_value_display`** | що показувати замість порожнього значення (`None`) |

Кожна опція економить час людині, яка щодня працює з даними. `list_filter` + `search_fields` перетворюють список на 5000 книг із «стіни тексту» на кероване середовище за секунди.

### Обчислювані колонки в `list_display`

У `list_display` можна класти не лише поля моделі, а й **метод** `ModelAdmin` — так виводять похідні значення:

```python
# blog/admin.py
@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "short_body", "is_published")

    @admin.display(description="Уривок")
    def short_body(self, obj):
        return obj.body[:60] + "…"
```

Декоратор `@admin.display` дає колонці людський заголовок; для булевих значень є `@admin.display(boolean=True)` — тоді Django показує зелену/сіру галочку замість `True`/`False`.

## Опції форми (сторінка окремого об'єкта)

Коли відкриваєш один об'єкт — це форма. Її теж налаштовують. Приклад для фільму:

```python
# cinema/admin.py
@admin.register(Movie)
class MovieAdmin(admin.ModelAdmin):
    fields = ("title", "director", "year", "genres", "rating")   # які поля й у якому порядку
    readonly_fields = ("created_at", "updated_at")               # лише перегляд
    prepopulated_fields = {"slug": ("title",)}                   # автозаповнення
    filter_horizontal = ("genres",)                              # зручний віджет для M2M
    autocomplete_fields = ("director",)                          # пошук замість довгого списку
    save_on_top = True                                           # кнопки збереження ще й угорі
```

| Опція | Що дає |
|---|---|
| **`fields`** | перелік і порядок полів у формі (протилежність — `exclude`, що ховає вказані) |
| **`readonly_fields`** | поля лише для перегляду — видно, але не змінити |
| **`prepopulated_fields`** | автозаповнення одного поля з іншого під час набору (напр. slug із title) |
| **`filter_horizontal`** / **`filter_vertical`** | зручний двоколонковий віджет для `ManyToManyField` замість громіздкого списку |
| **`autocomplete_fields`** | для `ForeignKey`/M2M — поле з живим пошуком замість випадного списку на тисячі записів |
| **`radio_fields`** | показати вибір як радіокнопки, а не випадний список |
| **`save_on_top`** / **`save_as`** | кнопки збереження вгорі; «Зберегти як новий» (клонувати об'єкт) |

> <i class="bi bi-exclamation-triangle"></i> Щоб `autocomplete_fields = ("director",)` працювало, у `ModelAdmin` **зв'язаної** моделі (`DirectorAdmin`) мають бути задані `search_fields` — саме по них іде пошук.

### `fieldsets`: групування полів у формі

Коли полів багато, їх групують у секції з заголовками через `fieldsets`. Це заміна простому `fields`:

```python
# cinema/admin.py
@admin.register(Movie)
class MovieAdmin(admin.ModelAdmin):
    fieldsets = (
        ("Основне", {
            "fields": ("title", "slug", "director", "year"),
        }),
        ("Деталі", {
            "fields": ("genres", "rating", "description"),
            "classes": ("collapse",),        # секція згорнута за замовчуванням
        }),
        ("Службове", {
            "fields": ("created_at", "updated_at"),
            "description": "Заповнюється автоматично",
        }),
    )
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("created_at", "updated_at")
```

Кожен елемент — пара `(назва_секції, {опції})`. `"classes": ("collapse",)` робить секцію згортуваною — зручно ховати рідковживані поля.

### `UserAdmin`: `fieldsets` і `add_fieldsets` — два різних набори

Стосується проєктів із власною моделлю користувача (`AbstractUser` + `AUTH_USER_MODEL`). Щойно до `User` додають своє поле, стандартний `UserAdmin` теж розширюють — інакше нове поле в панелі просто не з'явиться:

```python
# accounts/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    phone = models.CharField('Телефон', max_length=20, blank=True)
```

```python
# accounts/forms.py
from django.contrib.auth.forms import UserCreationForm as BaseUserCreationForm

from .models import User


class UserCreationForm(BaseUserCreationForm):
    class Meta(BaseUserCreationForm.Meta):
        model = User
        fields = BaseUserCreationForm.Meta.fields + ('phone',)
```

```python
# accounts/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .forms import UserCreationForm
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    add_form = UserCreationForm
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Додатково', {'fields': ('phone',)}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Додатково', {'fields': ('phone',)}),
    )
```

`UserAdmin` показує не одну форму, а дві, і в кожної свій набір полів:

- **`fieldsets`** — сторінка **редагування** наявного користувача. Форма за замовчуванням (`UserChangeForm`) бере всі поля моделі сама, тому нове поле в `fieldsets` побачить одразу — власної форми не треба.
- **`add_fieldsets`** — сторінка **створення** нового користувача. Форма за замовчуванням (`UserCreationForm`) обмежує поля списком (`username` плюс `password1`/`password2`, бо хеша ще не існує), тому нове поле тут з'явиться, лише якщо дописати його в **обидва** місця: у `add_fieldsets` і в `Meta.fields` власної форми, призначеної `add_form`.

Django не виводить один набір з іншого — це дві незалежні структури, і саме про друге місце найчастіше забувають.

> <i class="bi bi-exclamation-triangle"></i> Поле, дописане лише в `add_fieldsets`, ламає сторінку «Додати користувача» помилкою `FieldError: 'UserAdmin.add_fieldsets' refers to field 'phone' that is missing from the form` — форма (`UserCreationForm`) про нього не знає, доки його немає в її `Meta.fields`.

### Окремо про `prepopulated_fields`

`prepopulated_fields` автоматично формує значення одного поля з іншого прямо в браузері, поки ти друкуєш.

Найпоширеніший випадок — **slug із title**. Коли редактор вводить назву статті «Огляд Django 6.0», поле `slug` саме заповнюється як `oglyad-django-6-0`, без ручної роботи:

```python
prepopulated_fields = {"slug": ("title",)}
```

> <i class="bi bi-info-circle"></i> Значення дописується лише **під час створення** об'єкта — якщо потім змінити `title`, наявний `slug` не перезапишеться. Це навмисно: slug часто вже потрапив у посилання, і мовчазна його зміна ламала б URL.

## `inlines`: пов'язані об'єкти на одній сторінці

`inlines` дають змогу редагувати **пов'язані** об'єкти прямо на сторінці батьківського об'єкта — не переходячи на окрему сторінку кожного разу.

Візьмемо книгу і її розділи. Модель `Chapter` має зовнішній ключ на `Book`:

```python
# library/models.py
class Book(models.Model):
    title = models.CharField(max_length=200)

class Chapter(models.Model):
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="chapters")
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)
```

Щоб редагувати розділи просто зі сторінки книги, описуєш inline-клас і додаєш його в `BookAdmin`:

```python
# library/admin.py
class ChapterInline(admin.TabularInline):
    model = Chapter
    extra = 1                    # скільки порожніх рядків для нових розділів показати
    fields = ("order", "title")
    ordering = ("order",)

@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "author")
    inlines = [ChapterInline]
```

Тепер, відкривши книгу, бібліотекар одразу бачить її розділи і може додавати чи правити їх на тій самій сторінці.

Є два типи inline-класів:

| Клас | Вигляд |
|---|---|
| **`TabularInline`** | компактна таблиця — рядок на об'єкт (добре для коротких записів) |
| **`StackedInline`** | кожен об'єкт розгорнутий у повну форму (добре, коли полів багато) |

Корисні опції inline: `extra` (порожні рядки), `max_num` (максимум записів), `min_num` (мінімум), `can_delete` (чи дозволити видалення), `show_change_link` (посилання на повну сторінку об'єкта).

Пов'язані дані редагують разом. Без цього кожен дочірній запис довелося б створювати окремою сторінкою, щоразу обираючи батьківський об'єкт зі списку.

### Inline на чужій моделі: `Profile` на сторінці `User`

На відміну від `fieldsets`/`add_fieldsets` вище (де мова про власну модель користувача), тут `User` лишається стандартним — просто на його сторінці з'являється пов'язаний `Profile` (`OneToOneField`, як в уроці «Наскрізний приклад: реєстрація»). Оскільки `UserAdmin` уже зареєстрований самим Django, свій варіант підключають через `unregister()` і повторну реєстрацію:

```python
# accounts/admin.py
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Profile

User = get_user_model()


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False              # профіль не існує окремо від користувача
    verbose_name_plural = "Профіль"


class UserAdmin(BaseUserAdmin):
    inlines = [ProfileInline]


admin.site.unregister(User)         # спершу прибрати вбудований UserAdmin
admin.site.register(User, UserAdmin)
```

Порядок важливий: `unregister()` мусить виконатись **до** `register()`, інакше Django кине помилку «модель уже зареєстрована».

## Дії над списком (`actions`)

`actions` — це операції, які застосовують **одразу до кількох** позначених об'єктів через випадне меню над списком.

Класика — «опублікувати позначені». У блозі це виглядає так:

```python
# blog/admin.py
@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "is_published")
    actions = ["make_published", "make_draft"]

    @admin.action(description="Опублікувати позначені")
    def make_published(self, request, queryset):
        updated = queryset.update(is_published=True)
        self.message_user(request, f"Опубліковано: {updated}")

    @admin.action(description="Зняти з публікації")
    def make_draft(self, request, queryset):
        queryset.update(is_published=False)
```

Метод дії отримує `queryset` — усі позначені об'єкти — і робить із ними що треба (тут `update`). `message_user` показує повідомлення користувачу. Видалення позначених є вбудованою дією з коробки.

### Дія, що повертає файл: експорт у CSV

Дії вище змінювали дані й лишалися на тій самій сторінці. Дія може й **повернути відповідь** — саме так у адмінці роблять експорт позначених рядків у CSV:

```python
# shop/admin.py
import csv

from django.http import HttpResponse


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "price", "count")
    actions = ["export_as_csv"]

    @admin.action(description="Експортувати позначене у CSV")
    def export_as_csv(self, request, queryset):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="products.csv"'

        writer = csv.writer(response)
        writer.writerow(["Назва", "Ціна", "Залишок"])          # заголовок таблиці
        for product in queryset:
            writer.writerow([product.name, product.price, product.count])

        return response
```

Різниця з попередніми двома діями — у `return`. Коли метод дії повертає `HttpResponse`, Django віддає **цю відповідь** замість оновлення сторінки списку, і браузер починає завантаження файлу. `Content-Disposition: attachment` — саме той заголовок, що каже браузеру зберегти файл, а не показати вміст як текст.

## Свій код у ModelAdmin

Опції вище — декларативні: список атрибутів, і Django сам будує сторінку. Чотири методи нижче — це вже код, який втручається в те, що адмін показує, зберігає чи дозволяє.

### `get_queryset()`: що бачить адмін

За замовчуванням адмін показує **всі** об'єкти моделі. Щоб звузити список — наприклад, менеджер бачить лише свої замовлення, а суперкористувач усі — перевизначають `get_queryset()`:

```python
# shop/models.py
class Order(models.Model):
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="orders")
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="managed_orders",
    )
    status = models.CharField(max_length=20, default="new")
```

```python
# shop/admin.py
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "customer", "status")

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(manager=request.user)
```

`super().get_queryset(request)` дає базовий набір — той самий, що показав би `ModelAdmin` без змін. Фільтр накладають зверху, а не пишуть запит наново.

> <i class="bi bi-info-circle"></i> Тут же підключають і `select_related`/`prefetch_related` для важких списків — той самий принцип, що й у view, розібраний в уроці «Оптимізація запитів».

### `save_model()`: підставити дані при збереженні

Хук, що спрацьовує щоразу, коли об'єкт зберігають **саме з адмінки** — зручно проставити поле, яке не показують у формі:

```python
# library/models.py
class Book(models.Model):
    title = models.CharField(max_length=200)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="added_books",
    )
```

```python
# library/admin.py
@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "added_by")
    readonly_fields = ("added_by",)

    def save_model(self, request, obj, form, change):
        if not change:                       # лише при створенні, не при кожному редагуванні
            obj.added_by = request.user
        super().save_model(request, obj, form, change)
```

`change` — `False` при створенні нового об'єкта, `True` при редагуванні наявного. Без цієї перевірки поле переписувалося б іменем того, хто останнім зберіг форму, а не того, хто справді додав книгу.

### `has_add_permission` / `has_change_permission` / `has_delete_permission`: заборонити дію

Три методи визначають, чи бачить користувач кнопку «Додати», «Зберегти» чи «Видалити» — незалежно від загальних прав Django. Типовий випадок — фінансовий запис, який ніхто, крім суперкористувача, не повинен видаляти:

```python
# shop/admin.py
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "customer", "status")

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(manager=request.user)

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
```

`obj` — конкретний об'єкт (є значення на сторінці одного запису) або `None` (на сторінці списку, де перевіряють право загалом). Той самий прийом — заборонити зміну вже опублікованої статті: `has_change_permission` повертає `False`, якщо `obj and obj.is_published`.

### Власний `SimpleListFilter`: фільтр не за полем

`list_filter` (урок вище) фільтрує за значенням поля напряму. Коли умова обчислюється — «є в наявності» замість конкретного числа `count` — пишуть клас-фільтр:

```python
# shop/admin.py
class InStockFilter(admin.SimpleListFilter):
    title = "наявність"
    parameter_name = "in_stock"

    def lookups(self, request, model_admin):
        return (
            ("yes", "Є в наявності"),
            ("no", "Немає в наявності"),
        )

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(count__gt=0)
        if self.value() == "no":
            return queryset.filter(count=0)
        return queryset


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_filter = (InStockFilter,)
```

`lookups()` задає варіанти в боковій панелі, `queryset()` застосовує обраний. `self.value()` — рядок обраного варіанта (`"yes"`, `"no"` або `None`, якщо фільтр не активний).

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Модель не зареєстрована в `admin.py` | Її просто немає в панелі, і жодної помилки при цьому не виникає |
| Поле в `list_editable`, але не в `list_display` | Помилка перевірки при старті: редагувати можна лише показані колонки |
| Перше поле `list_display` у `list_editable` | Воно працює як посилання на об'єкт, тому редагованим бути не може |
| `autocomplete_fields` без `search_fields` у цільовому admin | Помилка `must define search_fields`; пошук додають у admin пов'язаної моделі |
| Числове або булеве поле в `search_fields` | Пошук працює лише за текстовими полями; для решти є `list_filter` |
| Список без `list_select_related` | Колонки зі зв'язаних моделей дають N+1 запитів на кожен рядок |
| Обчислена колонка без `@admin.display` | У заголовку з'являється технічна назва методу |
| Дія над списком без перевірки прав | `actions` виконуються масово; права перевіряють у самому методі дії |
| Нове поле лише в `UserAdmin.add_fieldsets`, без власного `add_form` | `FieldError: refers to field ... that is missing from the form` на сторінці «Додати користувача» |
| `register()` для `User` без попереднього `unregister()` | `AlreadyRegistered`: Django вже зареєстрував цю модель сам |
| `get_queryset()` без `super().get_queryset(request)` | Втрачаються сортування й оптимізації `ModelAdmin` за замовчуванням — запит пишуть наново замість фільтра поверх базового |
| `save_model()` без перевірки `change` | Поле на кшталт `added_by` переписується при кожному редагуванні, а не лише при створенні |

## Підсумок

- Модель треба **зареєструвати** в `admin.py`, інакше її в адмінці не видно; людську назву дає `__str__` у моделі.
- Поведінку моделі описує клас **`ModelAdmin`**; сучасна конвенція реєстрації — декоратор **`@admin.register(Model)`** (еквівалент `admin.site.register`).
- **Список:** `list_display` (колонки, зокрема методи через `@admin.display`), `list_filter`, `search_fields` (можна `__`), `ordering`, `list_editable`, `list_per_page`, `date_hierarchy`, `list_select_related`.
- **Форма:** `fields`/`exclude`, `fieldsets` (групування з `collapse`), `readonly_fields`, `prepopulated_fields` (slug із title), `filter_horizontal` (M2M), `autocomplete_fields` (потребує `search_fields` у зв'язаної моделі), `save_on_top`/`save_as`.
- **`UserAdmin`** для власної моделі користувача розширюють через `fieldsets` (редагування) **і** `add_fieldsets` (створення) — це два незалежних набори; нове поле в `add_fieldsets` вимагає ще й свого `add_form` з тим полем у `Meta.fields`.
- **`inlines`** (`TabularInline` / `StackedInline`) редагують пов'язані об'єкти на одній сторінці — наприклад, `Chapter` усередині `Book`; опції `extra`, `max_num`, `show_change_link`. Для чужої моделі (`User`) — спершу `admin.site.unregister()`, потім реєстрація свого `UserAdmin` з `inlines`.
- **`actions`** (`@admin.action`) — масові операції над позначеними об'єктами (напр. «Опублікувати позначені»); якщо метод дії повертає `HttpResponse` (напр. CSV), Django віддає її замість оновлення сторінки.
- Код замість атрибутів: **`get_queryset()`** звужує список (свої записи, `select_related`), **`save_model()`** підставляє дані при збереженні (перевіряй `change`, щоб не переписувати при кожному редагуванні), **`has_*_permission()`** забороняє додавання/зміну/видалення для конкретного користувача чи об'єкта, **`SimpleListFilter`** — фільтр за обчислюваною умовою, якої немає серед полів моделі.
- Головна цінність: готове керування даними для не-програмістів **без написання власних CRUD-сторінок**.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/contrib/admin/" target="_blank" rel="noopener">The Django admin site <i class="bi bi-box-arrow-up-right"></i></a></div></div>
