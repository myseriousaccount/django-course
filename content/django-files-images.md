# Файли та зображення

Завантажені користувачем файли зберігаються на диску, а в базі лишається лише шлях до них. Урок про повний цикл: поле моделі, налаштування медіа, приймання файлу з форми й виведення в шаблоні.

## `FileField` і `ImageField` у моделі

> **`FileField`** — поле моделі для будь-якого файлу. **`ImageField`** — його різновид **саме для картинок** (додатково перевіряє, що це справді зображення, і дає доступ до `.width`/`.height`).

Обидва приймають параметр `upload_to` — підпапку всередині media, куди складати завантажене:

```python
# accounts/models.py
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
# config/settings.py
MEDIA_URL = 'media/'                  # URL-префікс: файли доступні як /media/...
MEDIA_ROOT = BASE_DIR / 'media'       # папка НА ДИСКУ, куди фізично лягають завантаження
```

Але в режимі розробки цього мало — Django сам media не роздає, поки ти не додаси рядок у **головний** `urls.py`:

```python
# config/urls.py
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
{# templates/catalog/product_form.html #}
<form method="post" enctype="multipart/form-data">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Завантажити</button>
</form>
```

**2. У view передати у форму обидва словники** — `request.POST` **і** `request.FILES`:

```python
# catalog/views.py
form = ProductForm(request.POST, request.FILES)   # FILES обов'язково
```

**3. `form.save()`** сам збереже файл у `MEDIA_ROOT` і запише шлях у поле моделі.

> <i class="bi bi-exclamation-triangle"></i> Найчастіша помилка: забути `enctype="multipart/form-data"` або не передати `request.FILES`. Результат однаковий — файл «не приходить», поле лишається порожнім, а помилки немає. Перевіряй ці два місця першими.

## Повний цикл: модель → форма → view → шаблон

Зберемо все докупи на прикладі товару в магазині.

```python
# catalog/models.py
class Product(models.Model):
    name = models.CharField(max_length=100)
    photo = models.ImageField(upload_to='products/')
```

```python
# catalog/forms.py
from django import forms

from .models import Product

class ProductForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = ['name', 'photo']
```

```python
# catalog/views.py
from django.shortcuts import redirect, render

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

Шаблон форми — той самий, що вище, з обов'язковим `enctype`. Збережене зображення виводять так:

```html
{# templates/catalog/product_detail.html #}
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
# catalog/models.py
class Product(models.Model):
    name = models.CharField(max_length=100)


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='products/gallery/')
    caption = models.CharField(max_length=200, blank=True)
```

Тепер у шаблоні `related_name='images'` дає зручний доступ до всіх фото товару:

```html
{# templates/catalog/product_detail.html #}
{% for img in product.images.all %}
    <figure>
        <img src="{{ img.image.url }}" alt="{{ img.caption }}">
        {% if img.caption %}<figcaption>{{ img.caption }}</figcaption>{% endif %}
    </figure>
{% endfor %}
```

> <i class="bi bi-exclamation-triangle"></i> Цикл `product.images.all` у списку товарів — типове джерело N+1: кожна картка робить окремий запит за своїми зображеннями. У view списку додають `.prefetch_related('images')`.

## Два рівні одного механізму

Одне поле-зображення (`Product.photo`, `News.main_photo`) і галерея через окрему модель зі зв'язком `ForeignKey(..., related_name='images')` — це не альтернативи, а різні задачі. Перше описує головне зображення об'єкта, друге — довільну їх кількість із власними підписами й порядком.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Форма без `enctype="multipart/form-data"` | Браузер надішле лише ім'я файлу; поле лишиться порожнім, помилки не буде |
| `MyForm(request.POST)` без `request.FILES` | Той самий результат: файл не доходить до форми |
| `{{ product.photo }}` замість `{{ product.photo.url }}` | У `src` потрапить шлях у базі, а не адреса; картинка не завантажиться |
| Виведення `.url` без перевірки `{% if %}` | Порожнє поле дає `ValueError: The 'photo' attribute has no file associated with it` |
| `ImageField` без Pillow | Міграція падає: `Cannot use ImageField because Pillow is not installed` |
| Розрахунок на те, що `ImageField` усе перевірить | Він гарантує лише те, що файл — зображення. Розмір і формат обмежують валідацією у формі |
| Медіа роздають через `static()` на продакшні | Цей рядок працює лише при `DEBUG=True`; на сервері медіа віддає вебсервер |
| Файл видалено з бази, але лишився на диску | Django не видаляє файли при `delete()` моделі — це роблять окремо, сигналом або періодичною командою |

## Підсумок

- **`ImageField`** (потрібен **Pillow**) — для картинок, **`FileField`** — для будь-яких файлів; обидва з `upload_to='...'`. У БД зберігається шлях, файл — на диску.
- **`MEDIA_URL`/`MEDIA_ROOT`** у settings + рядок `static(settings.MEDIA_URL, ...)` в головному `urls.py` — щоб Django роздавав media в dev.
- Форма з файлом: `enctype="multipart/form-data"` + `MyForm(request.POST, request.FILES)` + `form.save()`.
- Показ у шаблоні: `{% if product.photo %}<img src="{{ product.photo.url }}">{% endif %}` — саме **`.url`**.
- Повний цикл однаковий для будь-якого домену: модель → форма → view → шаблон.
- Галерея — окрема модель з **ForeignKey + `related_name`**; на списках додавай `prefetch_related`.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/files/" target="_blank" rel="noopener">Managing files <i class="bi bi-box-arrow-up-right"></i></a></div></div>
