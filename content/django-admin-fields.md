# Адмінка: зручні поля й віджети

Вбудована адмінка зручна «з коробки» для простих полів. Але щойно з'являються **зв'язки** (ManyToMany, великі ForeignKey), **зображення**, **довгий текст** чи **статуси** — стандартний вигляд стає незручним: величезні випадні списки, `<select multiple>`, де без `Ctrl` губиться вибір. Цей урок — набір рецептів, як зробити редагування таких полів зручним. Усе задається в класі `ModelAdmin`.

> <i class="bi bi-info-circle"></i> Нагадування: базові опції списку (`list_display`, `list_filter`, `search_fields`, `fieldsets`, `inlines`, `actions`) — в уроці «Адмін-панель». Тут — саме про **форму редагування** одного об'єкта та його «складні» поля.

## Зв'язки: як зручно обирати пов'язані об'єкти

Це найчастіший біль. Django має **чотири** способи показати FK/M2M — від найпростішого до найпотужнішого.

### 1. Стандартний `<select>` — за замовчуванням

Для `ForeignKey` це випадний список, для `ManyToMany` — `<select multiple>` (де треба тримати `Ctrl`/`Cmd`, щоб вибрати кілька). Нормально, поки записів **мало**.

### 2. `filter_horizontal` — двоколонковий віджет для ManyToMany

Саме твій випадок із тегами. Замість незручного `<select multiple>` Django покаже **дві колонки**: доступні ліворуч, вибрані праворуч, з пошуком і кнопками «додати/прибрати».

```python
from django.contrib import admin
from .models import News

@admin.register(News)
class NewsAdmin(admin.ModelAdmin):
    filter_horizontal = ('tags',)      # tags — ManyToManyField
```

Є й вертикальний варіант — `filter_vertical` (колонки одна над одною). Обидва — **лише для ManyToMany**, коли пов'язаних об'єктів помірна кількість (десятки).

### 3. `autocomplete_fields` — пошук з підказками (для багатьох записів)

Коли пов'язаних об'єктів **сотні/тисячі** (наприклад автор із-поміж 10 000 користувачів), навіть двоколонковий віджет громіздкий. `autocomplete_fields` дає поле пошуку з AJAX-підказками:

```python
@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    autocomplete_fields = ('author', 'tags')   # працює і для FK, і для M2M
```

> <i class="bi bi-exclamation-triangle"></i> Обов'язкова умова: у **admin-класі пов'язаної моделі** має бути `search_fields`. Інакше Django не знатиме, за чим шукати, і кине помилку. Тобто для `author` потрібно, щоб `UserAdmin` мав `search_fields = ('username',)`.

### 4. `raw_id_fields` — просто ID з лупою (для величезних таблиць)

Найлегший варіант: показує лише **число-ID** й іконку-лупу, що відкриває вікно пошуку. Не вантажить список узагалі — добре для дуже великих таблиць.

```python
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    raw_id_fields = ('customer',)
```

### Що коли обирати

| Спосіб | Тип поля | Коли |
|---|---|---|
| стандартний `<select>` | FK / M2M | мало записів (до ~20) |
| `filter_horizontal` | **M2M** | десятки записів (теги, категорії) |
| `autocomplete_fields` | FK / M2M | сотні+ (є `search_fields` у цільового admin) |
| `raw_id_fields` | FK / M2M | тисячі+ записів |

## Поля з `choices`: `radio_fields`

Якщо поле має кілька варіантів (`status`, `priority`), випадний список можна замінити на **радіо-кнопки** — вибір видно одразу:

```python
@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    radio_fields = {'status': admin.VERTICAL}   # або admin.HORIZONTAL
```

## Автозаповнення slug: `prepopulated_fields`

Щоб `slug` сам заповнювався з `title` під час набору (транслітерація + дефіси):

```python
@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    prepopulated_fields = {'slug': ('title',)}
```

> <i class="bi bi-info-circle"></i> `prepopulated_fields` **не працює** з `ForeignKey`, `ManyToManyField` і полями «тільки для читання» — лише з простими текстовими джерелами.

## Тільки для читання й обчислені поля: `readonly_fields`

Показати в формі те, що не можна редагувати (дати створення, лічильники) або **обчислене** значення:

```python
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    readonly_fields = ('created_at', 'total_display')

    @admin.display(description='Сума замовлення')
    def total_display(self, obj):
        return f'{obj.total()} грн'
```

## Прев'ю зображення в адмінці

`ImageField` за замовчуванням показує лише посилання на файл. Щоб бачити **саму картинку**, додають обчислене readonly-поле, що повертає HTML:

```python
from django.contrib import admin
from django.utils.html import format_html
from .models import Product

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    readonly_fields = ('preview',)

    @admin.display(description='Прев\'ю')
    def preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" height="80">', obj.image.url)
        return '—'
```

> <i class="bi bi-exclamation-triangle"></i> Використовуй `format_html`, а **не** звичайний рядок чи `mark_safe` без екранування. `format_html` безпечно підставляє значення (захист від XSS), як `.format()`, але для HTML.

## Перевизначити віджет поля: `formfield_overrides`

Наприклад, зробити всі `TextField` більшими за розміром прямо в адмінці:

```python
from django.db import models
from django import forms

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    formfield_overrides = {
        models.TextField: {'widget': forms.Textarea(attrs={'rows': 20, 'cols': 100})},
    }
```

Так змінюється віджет **для всіх полів цього типу** в цьому admin. Точково для одного поля використовують власну `ModelForm` через `form = ...`.

## Дати: календар і навігація за датами

- `DateField` / `DateTimeField` Django **автоматично** показує з віджетом-календарем і годинником — нічого налаштовувати не треба.
- Для списку додай `date_hierarchy`, щоб згори з'явилась навігація «рік → місяць → день»:

```python
@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    date_hierarchy = 'published_at'
```

## Підказки під полями

Текст-пояснення під полем задають у **моделі** через `help_text` — і адмінка його показує:

```python
class Product(models.Model):
    sku = models.CharField(max_length=20, help_text='Унікальний артикул, напр. ABC-123')
```

## Сторінні віджети (коли треба більше)

Для зовсім особливих полів беруть готові пакети (підключаються як apps):

| Пакет | Для чого |
|---|---|
| `django-ckeditor` / `django-tinymce` | багатий текстовий редактор замість `Textarea` |
| `django-json-widget` | зручний редактор для `JSONField` |
| `django-image-cropping` | обрізання зображень |

Принцип той самий: `pip install` → додати в `INSTALLED_APPS` → вказати віджет у формі admin.

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> `autocomplete_fields` без `search_fields` у цільового admin → помилка `must define search_fields`. Спершу додай пошук у той admin.

> <i class="bi bi-exclamation-triangle"></i> `filter_horizontal` на `ForeignKey` не спрацює — він **лише для ManyToMany**. Для FK бери `autocomplete_fields` або `raw_id_fields`.

> <i class="bi bi-info-circle"></i> Обчислене поле в `readonly_fields` має бути **методом** admin-класу (або моделі) з `@admin.display(description=...)`, інакше в заголовку буде технічна назва.

## Підсумок

- Зв'язки обирай за розміром таблиці: `<select>` (мало) → `filter_horizontal` (M2M, десятки) → `autocomplete_fields` (сотні, з `search_fields`) → `raw_id_fields` (тисячі).
- `radio_fields` — радіо замість списку для `choices`; `prepopulated_fields` — slug із title.
- `readonly_fields` + `@admin.display` — обчислені/незмінні поля, зокрема **прев'ю зображень** через `format_html`.
- `formfield_overrides` — змінити віджет для типу поля (напр. більший `Textarea`); дати вже мають календар, `date_hierarchy` — навігація за датами.
- Для особливих полів (rich text, JSON) — сторонні пакети-віджети.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/contrib/admin/" target="_blank" rel="noopener">The Django admin site <i class="bi bi-box-arrow-up-right"></i></a></div></div>
