# Форми

Форма — клас, який описує набір полів, виводить їх у HTML, перевіряє надіслані дані й повертає їх приведеними до потрібних типів. Вона стоїть між сирим `request.POST` і логікою застосунку: без неї кожне значення довелося б діставати, перевіряти й перетворювати вручну.

## Form проти ModelForm: коли який

Django має два класи форм, і вибір між ними — перше рішення в кожній задачі.

> **`forms.Form`** — форма, поля якої ти описуєш **вручну**. Вона не прив'язана до жодної моделі.
> **`forms.ModelForm`** — форма, поля якої Django **виводить із моделі** автоматично й дає метод `save()`.

**`forms.Form` — поля вручну (контактна форма):**

```python
# pages/forms.py
from django import forms


class ContactForm(forms.Form):
    name = forms.CharField(max_length=100, label='Ваше ім\'я')
    email = forms.EmailField(label='Email для відповіді')
    subject = forms.CharField(max_length=150, label='Тема')
    message = forms.CharField(widget=forms.Textarea, label='Повідомлення')
```

Бери її, коли **немає моделі** для збереження: контактна форма (лист іде на пошту), пошук, фільтр каталогу, форма зворотного зв'язку.

**`forms.ModelForm` — форма з моделі (стаття блогу):**

```python
# blog/forms.py
from django import forms

from .models import Article


class ArticleForm(forms.ModelForm):
    class Meta:
        model = Article
        fields = ['title', 'slug', 'body', 'is_published']
        # або fields = '__all__' — усі поля моделі
        # або exclude = ['author'] — усі, крім перелічених
```

Бери її, коли форма **створює чи редагує об'єкт моделі**: стаття блогу, товар у магазині, профіль. `ModelForm` сама зчитає типи полів із моделі й отримає метод `save()`, що пише в БД.

> <i class="bi bi-info-circle"></i> Правило вибору просте: **зберігаєш у модель — `ModelForm`; не зберігаєш — `Form`**. `ModelForm` — це DRY у дії: не дублюєш опис полів, які вже є в моделі.

## Поля форми

Поле (`Field`) описує **один рядок введення**: його тип, чи обов'язкове воно, які обмеження і як валідується. Тип поля визначає, як значення буде перевірено й перетворено.

Кожне поле — окремий клас із модуля `forms`:

| Поле | Приймає | Приклад застосування |
|---|---|---|
| `CharField` | текст | ім'я, заголовок, тема |
| `EmailField` | коректний email | адреса для відповіді |
| `IntegerField` | ціле число | кількість, вік |
| `DecimalField` | число з крапкою | ціна, сума замовлення |
| `BooleanField` | галочка (`True`/`False`) | «погоджуюсь з умовами» |
| `ChoiceField` | вибір із варіантів | оцінка, категорія, місто |
| `DateField` | дата | дата події, народження |
| `FileField` / `ImageField` | файл / зображення | документ, обкладинка, аватар |
| `URLField` | коректне посилання | сайт, посилання на профіль |

Форма-відгук про фільм показує кілька типів одразу:

```python
# cinema/forms.py
class ReviewForm(forms.Form):
    RATINGS = [(i, f'{i} ★') for i in range(1, 6)]   # 5 варіантів оцінки

    author = forms.CharField(max_length=60, label='Ваше ім\'я')
    rating = forms.ChoiceField(choices=RATINGS, label='Оцінка')
    text = forms.CharField(widget=forms.Textarea, label='Ваш відгук')
    watched_on = forms.DateField(required=False, label='Коли дивилися')
    spoiler = forms.BooleanField(required=False, label='Містить спойлери')
```

**Спільні аргументи полів** (працюють для будь-якого типу):

| Аргумент | Що робить |
|---|---|
| `required=False` | поле не обов'язкове (за замовчуванням усі обов'язкові) |
| `label='...'` | підпис поля в HTML |
| `initial=...` | початкове значення |
| `help_text='...'` | підказка під полем |
| `max_length` / `min_length` | обмеження довжини (для тексту) |
| `widget=...` | як поле малюється (див. далі) |

Тип поля — це **валідація безкоштовно**: `EmailField` сам відхилить `не-email`, `IntegerField` — літери, `DateField` — «31 лютого». Тобі не треба писати ці перевірки руками.

## Віджети: як поле виглядає

> **Віджет** — це те, **як** поле малюється в HTML. Одне й те саме поле можна показати як однорядковий `<input>`, велике `<textarea>`, випадний список чи набір радіокнопок. Тип поля відповідає за **дані**, віджет — за **вигляд**.

Віджет задають аргументом `widget`:

```python
# shop/forms.py
class OrderForm(forms.Form):
    # багаторядкове поле замість однорядкового
    comment = forms.CharField(widget=forms.Textarea, required=False)

    # пароль (символи ховаються)
    password = forms.CharField(widget=forms.PasswordInput)

    # випадний список
    city = forms.ChoiceField(
        choices=[('kyiv', 'Київ'), ('lviv', 'Львів'), ('odesa', 'Одеса')],
    )

    # радіокнопки замість списку
    delivery = forms.ChoiceField(
        choices=[('post', 'Нова пошта'), ('courier', 'Курʼєр')],
        widget=forms.RadioSelect,
    )

    # додати CSS-атрибути (напр., клас Bootstrap)
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'you@mail.com'}),
    )
```

Найчастіші віджети:

| Віджет | Малює |
|---|---|
| `TextInput` | звичайний `<input type="text">` (дефолт для `CharField`) |
| `Textarea` | велике `<textarea>` |
| `PasswordInput` | поле пароля (символи приховані) |
| `EmailInput` / `NumberInput` / `DateInput` | спеціалізовані `<input>` |
| `Select` | випадний список (дефолт для `ChoiceField`) |
| `RadioSelect` | набір радіокнопок |
| `CheckboxInput` | галочка (дефолт для `BooleanField`) |

Розділення «поле / віджет» дає гнучкість: логіку валідації (email є email) описуєш один раз, а вигляд змінюєш під дизайн — випадний список чи радіокнопки, з класом Bootstrap чи без.

> <i class="bi bi-info-circle"></i> У `ModelForm` віджети перевизначають у `Meta.widgets`:
> ```python
> # blog/forms.py
> class ArticleForm(forms.ModelForm):
>     class Meta:
>         model = Article
>         fields = ['title', 'body']
>         widgets = {'body': forms.Textarea(attrs={'rows': 10})}
> ```

## Валідація: is_valid(), cleaned_data

Сира форма з запиту не є довіреною — її треба **перевірити**.

1. `form.is_valid()` — запускає всю валідацію й повертає `True`/`False`.
2. `form.cleaned_data` — словник з **очищеними, приведеними до типів** значеннями. З'являється лише **після** успішного `is_valid()`.

```python
# pages/views.py
form = ContactForm(request.POST)
if form.is_valid():
    name = form.cleaned_data['name']       # вже str, обрізані пробіли
    email = form.cleaned_data['email']     # вже перевірений формат
    send_mail(...)                         # робимо щось із чистими даними
```

Важливо розуміти різницю між **сирими** й **очищеними** даними:

- `request.POST['rating']` → рядок `'5'` (усе з форми приходить рядком).
- `form.cleaned_data['rating']` → значення потрібного типу, уже перевірене.

> <i class="bi bi-exclamation-triangle"></i> Не звертайся до `cleaned_data` до виклику `is_valid()` — до валідації цього словника ще не існує, буде помилка. Спершу `is_valid()`, потім `cleaned_data`.

## Власна валідація одного поля: clean_\<field>()

Вбудованих перевірок (тип, обов'язковість, довжина) часто мало — потрібні **свої правила**. Для одного поля опиши метод `clean_` + ім'я поля:

```python
# accounts/forms.py
class RegisterForm(forms.Form):
    username = forms.CharField(max_length=30)
    email = forms.EmailField()

    def clean_username(self):
        username = self.cleaned_data['username']
        if User.objects.filter(username=username).exists():
            raise forms.ValidationError('Це ім\'я вже зайняте.')
        if ' ' in username:
            raise forms.ValidationError('Пробіли в імені заборонені.')
        return username        # ОБОВ'ЯЗКОВО повернути значення
```

Django викликає `clean_username()` автоматично під час `is_valid()`. Якщо піднімеш `ValidationError`, форма стане невалідною, а текст помилки покажеться біля потрібного поля.

> <i class="bi bi-info-circle"></i> Метод `clean_<field>()` **мусить повернути** значення поля (навіть якщо не змінював його) — інакше воно зникне з `cleaned_data`.

Ще приклад — відгук про фільм не має бути занадто коротким:

```python
# cinema/forms.py
class ReviewForm(forms.Form):
    text = forms.CharField(widget=forms.Textarea)

    def clean_text(self):
        text = self.cleaned_data['text']
        if len(text) < 10:
            raise forms.ValidationError('Відгук закороткий — напишіть хоча б речення.')
        return text
```

## Валідація кількох полів разом: clean()

Коли правило зачіпає **два й більше поля** одразу (паролі збігаються, дата «до» не пізніша за «після»), одного `clean_<field>()` замало — потрібен загальний метод `clean(self)`:

```python
# accounts/forms.py
class RegisterForm(forms.Form):
    password1 = forms.CharField(widget=forms.PasswordInput, label='Пароль')
    password2 = forms.CharField(widget=forms.PasswordInput, label='Повторіть пароль')

    def clean(self):
        cleaned = super().clean()          # беремо вже очищені поля
        p1 = cleaned.get('password1')
        p2 = cleaned.get('password2')
        if p1 and p2 and p1 != p2:
            raise forms.ValidationError('Паролі не збігаються.')
        return cleaned                     # повертаємо весь словник
```

**Різниця.** `clean_<field>()` бачить **одне** поле й повертає його значення; `clean()` бачить **усі** поля (через `cleaned_data`/`super().clean()`) і повертає весь словник. Помилка з `clean()` за замовчуванням показується вгорі форми (не біля конкретного поля).

## Рендер у шаблоні

Форму не збирають вручну з `<input>` — Django генерує HTML сам.

```django
{# templates/blog/create.html #}
<form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Надіслати</button>
</form>
```

Способи рендеру всіх полів одразу:

| Виклик | Обгортає кожне поле в |
|---|---|
| `{{ form.as_div }}` | `<div>` — **сучасний дефолт** Django |
| `{{ form.as_p }}` | `<p>` |
| `{{ form.as_ul }}` | `<li>` |
| `{{ form.as_table }}` | рядки `<tr>` (усередині `<table>`) |

**`{% csrf_token %}`** — **обов'язковий** для будь-якої форми з `method="post"`.

> **CSRF-токен** — прихований токен захисту від атаки «підробка міжсайтового запиту» (Cross-Site Request Forgery). Django вимагає його на кожній POST-формі.

> <i class="bi bi-exclamation-triangle"></i> Забудеш `{% csrf_token %}` — отримаєш помилку **403 Forbidden** при надсиланні. Це найчастіша причина, чому форма мовчки не зберігає дані.

**Рендер поля поокремо** — коли треба гнучке верстання (наприклад, картка замовлення з власним HTML):

```django
{# templates/pages/contact.html #}
<div class="field">
  {{ form.email.label_tag }}      {# <label> #}
  {{ form.email }}                {# сам <input> #}
  {{ form.email.errors }}         {# помилки цього поля #}
  <small>{{ form.email.help_text }}</small>
</div>
```

## Обробка у view: повний цикл

Одна view-функція обробляє **обидва випадки**: показ порожньої форми (GET) і прийом заповненої (POST). Це стандартний патерн Django.

```python
# blog/views.py
from django.shortcuts import redirect, render

from .forms import ArticleForm


def create_article(request):
    if request.method == 'POST':
        form = ArticleForm(request.POST, request.FILES)  # зв'язуємо з даними
        if form.is_valid():
            form.save()                 # ModelForm: створює й пише об'єкт у БД
            return redirect('article_list')
        # якщо НЕ валідна — просто падаємо нижче й показуємо форму з помилками
    else:
        form = ArticleForm()            # GET: порожня форма

    return render(request, 'blog/create.html', {'form': form})
```

Розбір кроків:

1. **GET** (перший захід) → `ArticleForm()` без даних → порожня форма.
2. **POST** (надіслали) → `ArticleForm(request.POST)` → форма, зв'язана з даними.
3. `is_valid()` → перевірка.
4. Валідна → `form.save()` (для `ModelForm`) → `redirect`.
5. Невалідна → той самий `render`, але форма вже містить введені дані **й тексти помилок**.

**А для `forms.Form` без моделі** (контактна форма) кроки ті самі, але замість `save()` ти сама вирішуєш, що робити з `cleaned_data`:

```python
# pages/views.py
from django.core.mail import send_mail


def contact(request):
    if request.method == 'POST':
        form = ContactForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            send_mail(data['subject'], data['message'],
                      data['email'], ['support@site.ua'])
            return redirect('contact_thanks')
    else:
        form = ContactForm()
    return render(request, 'pages/contact.html', {'form': form})
```

> <i class="bi bi-info-circle"></i> `request.FILES` додають другим аргументом, лише якщо у формі є `FileField`/`ImageField` (наприклад, обкладинка статті). Для звичайних форм досить `request.POST`.

## Про form.save() у ModelForm

- Метод є **тільки в `ModelForm`** (у `forms.Form` його немає).
- `form.save()` створює й зберігає об'єкт, повертаючи його.
- `form.save(commit=False)` — створює об'єкт, але **не пише в БД**. Потрібно, коли треба доповнити об'єкт перед збереженням:

  ```python
  # blog/views.py
  article = form.save(commit=False)
  article.author = request.user     # проставляємо автора вручну (його немає у формі)
  article.save()                    # тепер пишемо в БД
  ```

Той самий прийом — для замовлення в магазині: `order = form.save(commit=False)`, `order.customer = request.user`, `order.save()`.

> <i class="bi bi-pin-angle"></i> Патерн «POST → обробка → **redirect**» (а не просто рендер після успіху) називають **Post/Redirect/Get**. Він рятує від повторного надсилання форми при оновленні сторінки (F5).

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Немає `{% csrf_token %}` у формі | 403 при надсиланні; токен обов'язковий для кожного POST |
| Звернення до `cleaned_data` до `is_valid()` | Атрибута ще не існує: спершу валідація, потім дані |
| `clean_<field>()` без `return` | Поле зникає з `cleaned_data` і далі виявляється порожнім |
| `clean_<field>()` для правила між двома полями | Метод бачить лише своє поле; порівняння паролів чи дат робиться в `clean()` |
| Форма з файлом без `request.FILES` | Файл не доходить до форми навіть за наявності `enctype` |
| `form.save()` у `forms.Form` | Методу немає: він існує лише у `ModelForm`, для звичайної форми дані беруть із `cleaned_data` |
| Поле, якого немає у формі, заповнюють після `save()` | Об'єкт уже записаний без нього; автора чи покупця проставляють через `save(commit=False)` |
| `render` замість `redirect` після успіху | Оновлення сторінки повторно надсилає форму |
| Невалідну форму рендерять заново порожньою | Користувач втрачає введене; у шаблон повертають ту саму `form` з помилками |

## Підсумок

- **`forms.Form`** — поля вручну, коли нема моделі (контакти, пошук, відгук). **`forms.ModelForm`** — поля з моделі + метод `save()`, коли створюєш/редагуєш об'єкт (стаття, товар). Правило: зберігаєш у БД — `ModelForm`.
- **Поле** відповідає за дані й тип (`CharField`, `EmailField`, `ChoiceField`, `DecimalField`…), **віджет** — за вигляд (`Textarea`, `PasswordInput`, `RadioSelect`, `Select`). Тип валідує безкоштовно.
- Валідація: спершу **`is_valid()`**, лише потім **`cleaned_data`** (очищені, типізовані значення). Одне поле — **`clean_<field>()`** (повертає значення); кілька полів разом — **`clean()`** (повертає словник).
- У шаблоні: `{{ form.as_div }}` (сучасний дефолт) + **обов'язковий `{% csrf_token %}`** (без нього — 403); поля можна рендерити й поокремо.
- У view один патерн на GET і POST: `if request.method == 'POST'` → `form = MyForm(request.POST)` → `is_valid()` → `form.save()` або обробка `cleaned_data` → `redirect` (Post/Redirect/Get). `save(commit=False)` — коли треба доповнити об'єкт (автор, покупець) перед записом.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/forms/" target="_blank" rel="noopener">Working with forms <i class="bi bi-box-arrow-up-right"></i></a></div></div>
