# Валідація у формах

Форма перевіряє дані чотирма механізмами, які спрацьовують у визначеному порядку. Урок розбирає кожен і показує, як помилки потрапляють на сторінку. Принцип «клієнт проти сервера» — в уроці «Валідація: клієнт і сервер».

## Чотири механізми

Вони виконуються послідовно: валідатори полів, потім `clean_<field>()` кожного поля, потім спільний `clean()`. Помилка на будь-якому кроці робить форму невалідною.

### 1. Валідатори полів (`validators=[...]`)

Валідатор — це готова функція-перевірка, яку ти чіпляєш прямо до поля. Django має набір вбудованих валідаторів у `django.core.validators`.

Найпоширеніші:

| Валідатор | Що перевіряє |
|---|---|
| `MinValueValidator(x)` / `MaxValueValidator(x)` | число не менше / не більше за `x` |
| `MinLengthValidator(n)` / `MaxLengthValidator(n)` | довжину тексту |
| `RegexValidator(pattern)` | відповідність регулярному виразу |
| `EmailValidator()` | коректність email |

```python
# library/forms.py
from django import forms
from django.core.validators import MinValueValidator, RegexValidator

class BookForm(forms.Form):
    title = forms.CharField(
        max_length=200,
        validators=[
            RegexValidator(
                r"^[\w\s\-.,:]+$",
                message="Назва містить недопустимі символи.",
            )
        ],
    )
    isbn = forms.CharField(
        max_length=13,
        validators=[
            RegexValidator(r"^\d{13}$", message="ISBN має складатися з 13 цифр.")
        ],
    )
    published_year = forms.IntegerField(
        validators=[MinValueValidator(1450, message="Рік видання виглядає нереальним.")],
    )
```

Валідатор — це перевірка «одним рядком», яку легко перевикористати на багатьох полях. Не пиши те, що вже є у фреймворку.

### 2. `clean_<field>()` — валідація одного поля

Метод `clean_<назва_поля>()` описує **власне** правило для конкретного поля — те, чого немає серед готових валідаторів (звернення до бази, заборонені слова, складна логіка).

Django викликає його автоматично під час `is_valid()`. Ти читаєш значення з `self.cleaned_data`, перевіряєш і **обовʼязково повертаєш** його назад:

```python
# blog/forms.py
class PostForm(forms.Form):
    title = forms.CharField(max_length=200)

    FORBIDDEN = {"тест", "asdf", "123"}

    def clean_title(self):
        title = self.cleaned_data["title"].strip()
        if title.lower() in self.FORBIDDEN:
            raise forms.ValidationError("Це не схоже на справжній заголовок статті.")
        if len(title) < 5:
            raise forms.ValidationError("Заголовок має містити щонайменше 5 символів.")
        return title
```

Один метод — одне поле, одне правило. Помилка, кинута через `raise forms.ValidationError(...)`, автоматично прикріпиться саме до цього поля й покажеться користувачу поряд із ним.

> <i class="bi bi-exclamation-triangle"></i> Не забувай `return` наприкінці `clean_<field>()`. Якщо нічого не повернути, поле стане `None` — це поширена помилка новачків.

### 3. `clean()` — міжпольова (крос-полева) валідація

Метод `clean()` перевіряє **звʼязки між кількома полями** одразу — коли правильність одного поля залежить від іншого.

Класичні приклади: пароль має збігатися з підтвердженням; дата початку сеансу — бути раніше за дату завершення. Тут `clean_<field>()` не підходить, бо він бачить лише одне поле. Використовуй `clean()` і кидай помилку або на конкретне поле (`add_error`), або на форму загалом:

```python
# cinema/forms.py
class ScreeningForm(forms.Form):        # сеанс у кінотеатрі
    starts_at = forms.DateTimeField()
    ends_at = forms.DateTimeField()

    def clean(self):
        cleaned = super().clean()
        start = cleaned.get("starts_at")
        end = cleaned.get("ends_at")
        if start and end and start >= end:
            self.add_error("ends_at", "Кінець сеансу має бути пізніше за початок.")
        return cleaned
```

А ось той самий механізм для пари «пароль + підтвердження» у реєстрації:

```python
# accounts/forms.py
def clean(self):
    cleaned = super().clean()
    p1 = cleaned.get("password")
    p2 = cleaned.get("password_confirm")
    if p1 and p2 and p1 != p2:
        raise forms.ValidationError("Паролі не збігаються.")
    return cleaned
```

`clean()` — єдине місце, де видно всю форму цілком. Саме сюди виноситься логіка «поле A має узгоджуватися з полем B».

> <i class="bi bi-info-circle"></i> Порядок такий: спершу валідатори полів → потім усі `clean_<field>()` → наприкінці один `clean()`. У `clean()` потрапляють лише ті поля, що вже пройшли свою індивідуальну перевірку.

### 4. Валідація файлів і зображень (коротко)

Завантажені файли — теж введення користувача, і його теж треба перевіряти: розмір, розширення, тип.

Для розширень є готовий `FileExtensionValidator`; розмір перевіряєш у `clean_<field>()`:

```python
# library/forms.py
from django.core.validators import FileExtensionValidator

class CoverForm(forms.Form):            # обкладинка книги/фільму
    cover = forms.ImageField(
        validators=[FileExtensionValidator(["jpg", "jpeg", "png", "webp"])]
    )

    def clean_cover(self):
        img = self.cleaned_data["cover"]
        if img.size > 2 * 1024 * 1024:            # 2 МБ
            raise forms.ValidationError("Файл завеликий (максимум 2 МБ).")
        return img
```

Без перевірки хтось завантажить 500-мегабайтний файл чи виконуваний скрипт замість обкладинки. Розмір і розширення — мінімальний захист будь-якого поля з файлом.

---

## Приклади: форми є всюди

Механізми вище застосовні до будь-якої форми. Нижче — по одному прикладу на кожен характерний випадок.

### Публікація статті (`ModelForm`)

`ModelForm` бере поля з моделі, тож частина правил (типи, `max_length`) успадковується автоматично. Додаєш лише те, чого моделі бракує:

```python
# blog/forms.py
from django import forms

from blog.models import Post

class PostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ["title", "slug", "body"]

    def clean_body(self):
        body = self.cleaned_data["body"].strip()
        if len(body) < 50:
            raise forms.ValidationError("Текст статті замалий — напиши хоча б абзац.")
        return body

    def clean_slug(self):
        slug = self.cleaned_data["slug"]
        qs = Post.objects.filter(slug=slug).exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError("Стаття з таким slug уже існує.")
        return slug
```

Тут працюють одразу три речі: успадкована з моделі перевірка довжини `title`, власна перевірка обсягу `body` та унікальності `slug`.

### Контактна форма (`forms.Form`)

Проста форма без моделі — бо їй нема що зберігати в БД, вона лише надсилає лист:

```python
# pages/forms.py
class ContactForm(forms.Form):
    name = forms.CharField(max_length=80)
    email = forms.EmailField()                      # EmailField сам перевіряє формат
    message = forms.CharField(widget=forms.Textarea, min_length=10)

    def clean_message(self):
        msg = self.cleaned_data["message"].strip()
        if "http://" in msg or "https://" in msg:
            raise forms.ValidationError("Посилання у повідомленні заборонені (спам).")
        return msg
```

> <i class="bi bi-info-circle"></i> `forms.Form` беруть, коли даним не потрібна модель (контакт, пошук, фільтр). `forms.ModelForm` — коли форма напряму створює/редагує обʼєкт у БД (стаття, книга, профіль). Правило вибору просте: *є модель для збереження — бери `ModelForm`.*

### Оформлення замовлення (`forms.Form`, кількість)

```python
# shop/forms.py
class OrderItemForm(forms.Form):
    product_id = forms.IntegerField(widget=forms.HiddenInput)
    quantity = forms.IntegerField(min_value=1)

    def clean_quantity(self):
        quantity = self.cleaned_data["quantity"]
        if quantity > 99:
            raise forms.ValidationError("За раз можна замовити не більше 99 штук.")
        return quantity
```

> <i class="bi bi-info-circle"></i> `min_value=1` у полі вже вбудовує `MinValueValidator` — тобі не треба писати його руками. Власний `clean_quantity` додаємо лише для правила, якого немає «з коробки» (верхня межа з бізнес-причин).

### Редагування профілю (унікальність, крім себе)

Тонкий, але дуже частий випадок. При редагуванні email має лишатися унікальним — але **не конфліктувати із самим користувачем**, якого ти зараз редагуєш. Тому в запиті виключаємо поточний обʼєкт через `.exclude(pk=...)`:

```python
# accounts/forms.py
from django.contrib.auth import get_user_model

User = get_user_model()


class ProfileForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ["username", "email"]

    def clean_email(self):
        email = self.cleaned_data["email"]
        qs = User.objects.filter(email=email).exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError("Ця пошта вже зайнята іншим користувачем.")
        return email
```

> <i class="bi bi-exclamation-triangle"></i> Без `.exclude(pk=self.instance.pk)` користувач не зможе зберегти профіль, навіть не змінюючи пошту: форма знайде «дубль» — і це буде він сам.

## Як помилки повертаються користувачу

Коли `is_valid()` повертає `False`, усі помилки складаються у `form.errors`, і Django сам домальовує їх у шаблоні поряд із відповідними полями.

У view нічого спеціального робити не треба — просто повертаєш ту саму форму назад у шаблон, і вона «памʼятає» свої помилки та введені значення:

```python
# blog/views.py
def create_post(request):
    if request.method == "POST":
        form = PostForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect("post_list")
        # якщо НЕ valid — form уже містить .errors, просто рендеримо її знову
    else:
        form = PostForm()
    return render(request, "blog/create.html", {"form": form})
```

У шаблоні виводиш помилки поля поряд із самим полем. `{{ form.non_field_errors }}` показує помилки з `clean()`, що не привʼязані до конкретного поля:

```html
{# templates/blog/create.html #}
<form method="post">
  {% csrf_token %}

  {{ form.non_field_errors }}

  {% for field in form %}
    <p>
      {{ field.label_tag }} {{ field }}
      {% for error in field.errors %}
        <span class="error">{{ error }}</span>
      {% endfor %}
    </p>
  {% endfor %}

  <button type="submit">Зберегти</button>
</form>
```

Користувач одразу бачить, *що саме* не так і *біля якого поля*, — а не порожню сторінку. Помилки з `clean_<field>()` лягають до поля, помилки з `clean()` — у `non_field_errors`.

> <i class="bi bi-info-circle"></i> Не хочеш вручну перебирати поля — Django вміє відрендерити всю форму одним викликом: `{{ form.as_p }}`, `{{ form.as_div }}` (рекомендований у Django 6.0) або `{{ form.as_table }}`. Помилки він додасть автоматично.

Як усі чотири механізми виглядають разом в одній формі — в уроці «Наскрізний приклад: реєстрація».

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Немає `return` у `clean_<field>()` | Поле стає `None` і дані «зникають» без явної помилки |
| `clean_<field>()` там, де потрібен `clean()` | Метод бачить лише своє поле; пароль і підтвердження порівнюють у `clean()` |
| Перевірка унікальності при редагуванні без `.exclude(pk=…)` | Користувач не може зберегти власний профіль: форма вважає його ж дублікатом |
| Форма відхилила дані, а сторінка нічого не показує | Потрібно виводити `field.errors` і `non_field_errors` |
| Невалідну форму рендерять заново порожньою | Користувач втрачає введене; у шаблон повертають ту саму форму |
| Файл приймають без перевірки розміру й типу | `ImageField` гарантує лише те, що це зображення |

## Підсумок

- Чотири механізми спрацьовують по черзі: валідатори полів, `clean_<field>()`, `clean()`, а для паролів — `AUTH_PASSWORD_VALIDATORS` через `validate_password()`.
- `clean_<field>()` бачить одне поле й мусить повернути значення; `clean()` бачить усі поля й повертає словник.
- Помилки з `clean_<field>()` показуються біля поля, з `clean()` — у `non_field_errors`.
- Невалідну форму повертають у шаблон тією ж змінною: вона зберігає введені значення й тексти помилок.
- Файли перевіряють окремо: розширення через `FileExtensionValidator`, розмір — у `clean_<field>()`.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/forms/validation/" target="_blank" rel="noopener">Form and field validation <i class="bi bi-box-arrow-up-right"></i></a></div></div>
