# Файли та зображення: завантаження й показ

Досі дані в моделях були текст і числа. Але користувачі часто хочуть завантажити **файл** — аватар, фото товару, скан обкладинки книги. Цей урок про повний цикл роботи із завантаженнями: як описати поле в моделі, налаштувати media, прийняти файл із форми й показати його в шаблоні. Приклади навмисно з **різних доменів** (профіль, магазин, бібліотека).

## `FileField` і `ImageField` у моделі

> **`FileField`** — поле моделі для будь-якого файлу. **`ImageField`** — його різновид **саме для картинок** (додатково перевіряє, що це справді зображення, і дає доступ до `.width`/`.height`).

**Як це працює.** Обидва мають обов'язковий-за-звичкою параметр `upload_to` — підпапку всередині media, куди складати завантажене:

```python
from django.db import models

class Profile(models.Model):
    avatar = models.ImageField(upload_to='avatars/')          # профіль

class Product(models.Model):
    photo = models.ImageField(upload_to='products/')          # магазин

class Book(models.Model):
    cover = models.ImageField(upload_to='books/covers/')      # бібліотека
    manual = models.FileField(upload_to='books/files/')       # будь-який файл (PDF тощо)
```

У базі зберігається **не сам файл, а шлях-рядок** до нього (наприклад, `avatars/olena.jpg`). Сам файл лягає на диск у папку media.

> <i class="bi bi-exclamation-triangle"></i> Для `ImageField` потрібна бібліотека **Pillow** — без неї міграція впаде з підказкою `Cannot use ImageField because Pillow is not installed`. Постав її в активоване віртуальне середовище: `pip install Pillow`.

## `MEDIA_URL` / `MEDIA_ROOT` і роздача в dev

Куди Django кладе завантаження й за якою адресою їх віддавати — задають два параметри в `settings.py` (згадай урок «Статичні файли», де ми відрізняли **static** — файли розробника — від **media** — файли користувачів):

```python
# settings.py
MEDIA_URL = 'media/'                  # URL-префікс: файли доступні як /media/...
MEDIA_ROOT = BASE_DIR / 'media'       # папка НА ДИСКУ, куди фізично лягають завантаження
```

Але в режимі розробки цього мало — Django сам media не роздає, поки ти не додаси рядок у **головний** `urls.py`:

```python
# root/urls.py
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # ... твої маршрути ...
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

> <i class="bi bi-info-circle"></i> Той самий принцип «шлях на диску ≠ URL», що й зі static. Файл лежить у `media/avatars/olena.jpg`, а браузер бачить його за `/media/avatars/olena.jpg`. `MEDIA_ROOT` — це «де на диску», `MEDIA_URL` — це «за якою адресою».

## Форма з файлом

Файли надходять не через звичайний `request.POST`, а через окремий `request.FILES`. Щоб вони туди потрапили, потрібні три речі.

**1. Тег форми з `enctype`.** Без цього браузер надішле лише ім'я файлу, а не сам файл:

```html
<form method="post" enctype="multipart/form-data">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Завантажити</button>
</form>
```

**2. У view передати у форму обидва словники** — `request.POST` **і** `request.FILES`:

```python
form = ProductForm(request.POST, request.FILES)   # ← FILES обов'язково
```

**3. `form.save()`** сам збереже файл у `MEDIA_ROOT` і запише шлях у поле моделі.

> <i class="bi bi-exclamation-triangle"></i> Найчастіша помилка: забути `enctype="multipart/form-data"` або не передати `request.FILES`. Результат однаковий — файл «не приходить», поле лишається порожнім, а помилки немає. Перевіряй ці два місця першими.

## Повний цикл: модель → форма → view → шаблон

Зберемо все докупи на прикладі товару в магазині.

**Модель** (`catalog/models.py`):

```python
class Product(models.Model):
    name = models.CharField(max_length=100)
    photo = models.ImageField(upload_to='products/')
```

**Форма** (`catalog/forms.py`):

```python
from django import forms
from .models import Product

class ProductForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = ['name', 'photo']
```

**View** (`catalog/views.py`):

```python
from django.shortcuts import render, redirect
from .forms import ProductForm

def product_create(request):
    if request.method == 'POST':
        form = ProductForm(request.POST, request.FILES)   # POST + FILES
        if form.is_valid():
            form.save()                                    # файл ляже в media, шлях — у БД
            return redirect('catalog:list')                # Post/Redirect/Get
    else:
        form = ProductForm()
    return render(request, 'catalog/product_form.html', {'form': form})
```

**Шаблон** (`product_form.html`) — та сама форма з `enctype`, що вище. А показати збережене фото так:

```html
{% if product.photo %}
    <img src="{{ product.photo.url }}" alt="{{ product.name }}">
{% else %}
    <img src="{% static 'img/no-photo.svg' %}" alt="Без фото">
{% endif %}
```

Зверни увагу на `{{ product.photo.url }}` — **`.url`**, а не саме поле. І перевірка `{% if product.photo %}` — щоб не отримати биту картинку, коли фото не завантажили.

## Галерея: кілька фото через FK з `related_name`

Одне поле `ImageField` — це одне фото. Щоб фото було **багато** (галерея товару, добірка обкладинок), роблять окрему модель, пов'язану **ForeignKey** з `related_name`:

```python
class Product(models.Model):
    name = models.CharField(max_length=100)

class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='products/gallery/')
    caption = models.CharField(max_length=200, blank=True)
```

Тепер у шаблоні `related_name='images'` дає зручний доступ до всіх фото товару:

```html
{% for img in product.images.all %}
    <figure>
        <img src="{{ img.image.url }}" alt="{{ img.caption }}">
        {% if img.caption %}<figcaption>{{ img.caption }}</figcaption>{% endif %}
    </figure>
{% endfor %}
```

> <i class="bi bi-lightbulb"></i> Цей цикл по `product.images.all` — саме той випадок, де на списку товарів чигає N+1. У списку додай `.prefetch_related('images')` (урок «Оптимізація запитів»), щоб галереї не смикали базу окремо для кожного товару.

## Місток: як це в shop-app

У навчальному проєкті shop-app усі три патерни вже задіяні:

- `Product.photo = ImageField(upload_to='media/products/')` — **одне** фото товару.
- `News.main_photo = ImageField(upload_to='media/news/')` — **головне** фото новини.
- `NewsImage` — окрема модель галереї: `image = ImageField(...)` + `news = ForeignKey('News', related_name='images')`. Саме тому в шаблоні працює `news.images.all`, а у view списку стоїть `prefetch_related('images')`.

Тобто shop-app показує обидва рівні: одне поле-картинка (`photo`, `main_photo`) і повноцінна галерея через FK з `related_name` (`NewsImage`).

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> `.url` vs `.path`. У шаблоні бери **`.url`** (`/media/products/x.jpg`) — це адреса для браузера. **`.path`** (`/home/.../media/products/x.jpg`) — абсолютний шлях на диску, потрібен у Python-коді, а не в `<img src>`.

> <i class="bi bi-exclamation-triangle"></i> `ImageField` перевіряє лише, що файл — картинка. Обмежити **тип** (тільки PNG/JPG) чи **розмір** треба окремо — через власну валідацію у формі (урок «Валідація»). Не покладайся на те, що поле відсіє все саме.

> <i class="bi bi-info-circle"></i> Рядок `static(settings.MEDIA_URL, ...)` в `urls.py` працює **тільки при `DEBUG=True`**. На проді media роздає вебсервер (Nginx), а не Django — так само, як зі static-файлами.

> <i class="bi bi-pin-angle"></i> `upload_to` можна зробити функцією, щоб розкладати файли по датах чи ID користувача — але для навчального проєкту вистачає простого рядка-підпапки.

## Підсумок

- **`ImageField`** (потрібен **Pillow**) — для картинок, **`FileField`** — для будь-яких файлів; обидва з `upload_to='...'`. У БД зберігається шлях, файл — на диску.
- **`MEDIA_URL`/`MEDIA_ROOT`** у settings + рядок `static(settings.MEDIA_URL, ...)` в головному `urls.py` — щоб Django роздавав media в dev.
- Форма з файлом: `enctype="multipart/form-data"` + `MyForm(request.POST, request.FILES)` + `form.save()`.
- Показ у шаблоні: `{% if product.photo %}<img src="{{ product.photo.url }}">{% endif %}` — саме **`.url`**.
- Повний цикл однаковий для будь-якого домену: модель → форма → view → шаблон.
- Галерея — окрема модель з **ForeignKey + `related_name`**; на списках додавай `prefetch_related`.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/files/" target="_blank" rel="noopener">Managing files <i class="bi bi-box-arrow-up-right"></i></a></div></div>
