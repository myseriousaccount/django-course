# jQuery: як нею користуватися

Цей урок — практичний. Не «чи потрібна сьогодні jQuery», а як нею реально працювати: знаходити елементи, читати й змінювати їх, ходити по дереву сторінки, надсилати запити до Django і показувати відповідь користувачу. Наприкінці — короткий огляд готових інструментів, які підключають поруч із нею.

## Що таке jQuery і як вона потрапляє на сторінку

> **jQuery** — це JavaScript-бібліотека, яка дає одну функцію `$()` для роботи з елементами сторінки, подіями та AJAX. Це не окрема мова: усередині — той самий JavaScript, лише коротший запис.

Підключається одним рядком — через CDN або з власної статики:

```html
<!-- CDN -->
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>

<!-- або своя копія в static/js/ -->
{% load static %}
<script src="{% static 'js/jquery.min.js' %}"></script>
```

Далі весь твій код загортають у «коли сторінка готова»:

```js
$(document).ready(function () {
    // тут DOM уже побудований, елементи можна шукати
});

// коротший запис того самого
$(function () {
    ...
});
```

**Навіщо ця обгортка.** Якщо скрипт виконається раніше, ніж браузер побудує HTML, `$('#cart')` просто нічого не знайде — і код мовчки не спрацює.

> <i class="bi bi-pin-angle"></i> `$('#id')` повертає **не DOM-елемент, а jQuery-обгортку** (колекцію знайдених елементів). Тому в неї свої методи: `.text()`, `.val()`, `.on()`. Звичні `element.textContent` чи `element.value` на ній не працюють — і навпаки.

## Головне: де jQuery, а де Django

Це те місце, де плутанина виникає найчастіше, тож розберемо повільно.

**Django виконується на сервері й лише один раз — до того, як сторінка потрапила в браузер.** View відпрацювала, зібрала HTML, віддала його — і на цьому Django «пішов». Він не бачить, як користувач наводить мишу, клікає кнопку чи друкує в полі. Саме тому написати реакцію на клік «у views» неможливо: у момент кліку жодна view не виконується.

**jQuery виконується в браузері й живе стільки, скільки відкрита сторінка.** Вона бачить кліки й введення, може змінити будь-що на екрані — але **не має доступу ні до бази, ні до моделей, ні до `request.user`**. Усе це є тільки на сервері.

<i class="bi bi-lightbulb"></i> Уяви магазин. **Склад** із товаром і журналом замовлень — це база даних, туди пускають лише працівників (Django). **Вітрина в залі** — це сторінка в браузері. jQuery — продавець у залі: може перевісити цінник, прибрати картку з вітрини, підсвітити кнопку. Але щоб дізнатися залишок на складі або записати замовлення — мусить **зателефонувати на склад**. Цей дзвінок і є AJAX-запит.

Тому будь-яка дія, що змінює дані, має один і той самий ланцюжок:

```
клік у браузері
   ↓  jQuery ловить подію
HTTP-запит на URL (наприклад /library/shelf/add/)
   ↓  Django: urls.py → view
view перевіряє права, працює з ORM, повертає JsonResponse
   ↓  відповідь приходить назад у браузер
success: jQuery отримує дані й оновлює потрібний шматок сторінки
```

Зверни увагу: **бекенд і фронтенд тут не змішуються** — у ланцюжку чітко видно, де чия зона. jQuery відповідає за перший і останній крок (подія та оновлення екрана), Django — за середину (перевірки, база, відповідь). AJAX — це лише «телефонна лінія» між ними: у браузері вона виглядає як `$.ajax(...)`, а на сервері — як звичайна view, що повертає не HTML-сторінку, а дані.

> <i class="bi bi-info-circle"></i> Через це jQuery **ніколи не вирішує, чи можна виконати дію**. Чи залогінений користувач, чи має він право видаляти цю книгу, чи є товар у наявності — вирішує тільки view. Код у браузері відкритий кожному, його можна змінити з консолі за секунду.

## Селектори: як знайти елемент

Синтаксис такий самий, як у CSS:

```js
$('#cart-qty')                   // за id
$('.add-to-cart-btn')            // за класом (усі такі елементи)
$('button')                      // за тегом
$('[data-role="row"]')           // за атрибутом
$('.book-card .title')           // вкладеність
$('.book-card:first')            // перший зі знайдених
```

Якщо селектор нічого не знайшов, помилки **не буде** — просто порожня колекція, і всі подальші виклики нічого не зроблять. Перевірити можна через `.length`:

```js
if ($('#results').length === 0) {
    console.log('елемента немає на цій сторінці');
}
```

> <i class="bi bi-exclamation-triangle"></i> «Код не працює, помилок немає» — у 9 випадках із 10 це порожній селектор: одрук в id, елемент є лише на іншій сторінці або скрипт підключений вище за розмітку. Перше, що варто зробити, — `console.log($('#мій-селектор').length)`.

## Читати й змінювати елементи

Ключове правило: **той самий метод без аргументу читає, з аргументом — записує**.

```js
const title = $('#book-title').text();      // прочитати
$('#book-title').text('Нова назва');        // записати
```

Найуживаніші методи:

| Що треба | Метод | Приклад |
|---|---|---|
| Текст усередині | `.text()` | `$('#count').text('Книг: 5')` |
| HTML усередині | `.html()` | `$('#list').html('<li>Порожньо</li>')` |
| Значення поля вводу | `.val()` | `$('#qty').val()` |
| Атрибут | `.attr()` | `$('#photo').attr('src', url)` |
| Стан чекбокса чи кнопки | `.prop()` | `$('#agree').prop('checked')` |
| `data-`атрибут | `.data()` | `$(this).data('book-id')` |
| CSS-властивість | `.css()` | `$('#box').css('color', 'red')` |
| Класи | `.addClass()` / `.removeClass()` / `.toggleClass()` | `$('#menu').toggleClass('open')` |
| Показати або сховати | `.show()` / `.hide()` / `.fadeOut()` / `.slideToggle()` | `$('#spinner').show()` |
| Увімкнути або вимкнути кнопку | `.prop('disabled', ...)` | `$('#save').prop('disabled', true)` |

**`data-`атрибути — найважливіший місток від Django до JS.** У шаблоні ти кладеш дані з бази прямо в розмітку, а jQuery їх звідти читає:

```html
<!-- library/shelf.html -->
<button class="borrow-btn"
        data-book-id="{{ book.id }}"
        data-book-title="{{ book.title }}">Позичити</button>
```

```js
const bookId = $(this).data('book-id');      // 42
const title = $(this).data('book-title');    // "Тигролови"
```

> <i class="bi bi-info-circle"></i> `data-book-id` у HTML пишемо через дефіс, а читати можна і `.data('book-id')`, і `.data('bookId')` — jQuery розуміє обидва варіанти.

**Ланцюжок викликів.** Майже кожен метод повертає ту саму колекцію, тож виклики зчіплюються:

```js
$('#save-btn').prop('disabled', true).text('Збереження…').addClass('is-loading');
```

## Ходити по дереву: від кнопки до її картки

Найчастіша задача: клікнули кнопку — треба змінити або прибрати **той блок, у якому вона лежить**. Для цього є методи переміщення по DOM:

| Метод | Куди йде |
|---|---|
| `.closest('.card')` | вгору, до найближчого предка з таким селектором |
| `.find('.price')` | вниз, серед нащадків |
| `.parent()` | на один рівень вгору |
| `.siblings()` | сусіди того самого рівня |
| `.next()` / `.prev()` | наступний або попередній сусід |
| `.remove()` | видалити елемент зі сторінки |

```js
// кінотека: прибрати картку фільму зі списку "до перегляду"
$('#watchlist').on('click', '.remove-btn', function () {
    const card = $(this).closest('.movie-card');    // від кнопки — до її картки
    const title = card.find('.movie-title').text(); // усередині картки — назва

    card.fadeOut(200, function () {
        $(this).remove();                           // прибрати після анімації
    });
    console.log(`прибрано: ${title}`);
});
```

<i class="bi bi-lightbulb"></i> `.closest()` — це «піднімись від мене вгору, поки не знайдеш такий блок». Незамінне, коли на сторінці десятки однакових карток: селектор `.movie-card` знайшов би всі, а `$(this).closest('.movie-card')` — саме ту, де натиснули.

## Створювати й вставляти елементи

```js
// школа: додати учня в список без перезавантаження
const li = $('<li>').addClass('student').text('Марія Коваль');

$('#students').append(li);        // в кінець списку
$('#students').prepend(li);       // на початок
li.after('<li>Наступний</li>');   // після конкретного елемента
```

Той самий результат можна отримати рядком розмітки — коротше, але обережно з даними від користувача:

```js
$('#students').append(`<li class="student">${name}</li>`);
```

> <i class="bi bi-exclamation-triangle"></i> Не вставляй через `.html()` чи шаблонний рядок текст, який ввів користувач, без обробки: у ньому може бути `<script>`. Якщо це просто текст — надійніше `.text()`, воно екранує все автоматично.

## Події — коротко

Події (клік, наведення, введення, прокрутка) — тема окремого уроку «Події DOM», тут лише те, без чого не обійтись у прикладах:

```js
// прямий обробник — елемент уже є на сторінці
$('#load-more').on('click', function () { ... });

// делегування — елементи з'являються пізніше (наприклад, після AJAX)
$('#catalog').on('click', '.add-to-cart-btn', function () {
    // this — та кнопка, на яку натиснули
    const id = $(this).data('product-id');
});
```

**Чому делегування.** Обробник вішається на батьківський блок, який існує завжди (`#catalog`), а той уже роздає події своїм дітям — навіть тим, які з'являться пізніше. Без цього кнопки, домальовані AJAX-ом, «не клікаються».

## Форми через jQuery

```js
$('#review-form').on('submit', function (e) {
    e.preventDefault();                    // не даємо браузеру перезавантажити сторінку

    const rating = $('#rating').val();
    if (!rating) {
        $('#error').text('Оберіть оцінку').show();
        return;                            // далі не йдемо
    }

    const data = $(this).serialize();      // усі поля форми одним рядком
    // ... відправка через $.ajax (нижче)
});
```

`serialize()` збирає всі поля форми у вигляді `title=Дюна&rating=9&csrfmiddlewaretoken=...` — зручно, коли полів багато й перелічувати їх вручну ліньки.

> <i class="bi bi-info-circle"></i> `e.preventDefault()` потрібен саме тому, що звичайна форма за замовчуванням **перезавантажує сторінку**. Якщо тобі це підходить — не пиши JS узагалі: хай форма працює як форма. jQuery тут потрібна лише коли перезавантаження заважає.

## AJAX: анатомія `$.ajax`

Ось повний виклик із підписами, що кожен рядок означає:

```js
$.ajax({
    url: '/library/shelf/add/',      // (1) КУДИ — цей шлях має бути в urls.py
    method: 'POST',                  // (2) ЯК — GET читає, POST змінює
    data: {                          // (3) ЩО НЕСЕМО — прийде у view як request.POST
        'book_id': bookId,
        csrfmiddlewaretoken: token
    },
    success: function (response) {   // (4) ЩО РОБИМО З ВІДПОВІДДЮ
        $('#shelf-count').text(response.count);   // це вже дані з JsonResponse
    },
    error: function (xhr) {          // (5) ЯКЩО СЕРВЕР ВІДПОВІВ ПОМИЛКОЮ
        alert(xhr.responseJSON?.message || 'Щось пішло не так');
    }
});
```

І відповідна view — звичайнісінька, просто повертає дані замість сторінки:

```python
# library/views.py
from django.http import JsonResponse
from django.views.decorators.http import require_POST

@require_POST
def shelf_add(request):
    book_id = request.POST.get('book_id')       # ← те саме, що в data
    ShelfItem.objects.get_or_create(user=request.user, book_id=book_id)
    count = ShelfItem.objects.filter(user=request.user).count()
    return JsonResponse({'count': count, 'message': 'Книгу додано на полицю'})
```

Тепер видно всю відповідність — ліворуч браузер, праворуч сервер:

| У браузері (`$.ajax`) | На сервері (view) |
|---|---|
| `url: '/library/shelf/add/'` | маршрут у `urls.py`, що веде на `shelf_add` |
| `method: 'POST'` | `request.method`, декоратор `@require_POST` |
| `data: {'book_id': 42}` | `request.POST.get('book_id')` |
| `success: function (response)` | те, що повернув `JsonResponse({...})` |
| `error: function (xhr)` | відповідь зі статусом 4xx або 5xx |

`$.get()` і `$.post()` — це просто скорочення для найпростіших випадків:

```js
$.get('/library/search/', { q: 'Кобзар' }, function (response) {
    $('#results').html(response.html);
});
```

### Обробляй `error`, не тільки `success`

Дуже поширена помилка — написати лише `success`. Тоді при 403 чи 500 користувач бачить… нічого: він клікнув, і не сталося нічого. Мінімум, який варто мати:

```js
error: function (xhr) {
    if (xhr.status === 401 || xhr.status === 403) {
        alert('Спершу увійдіть в акаунт');
    } else {
        alert('Помилка сервера, спробуйте пізніше');
    }
}
```

> <i class="bi bi-exclamation-triangle"></i> Особливий випадок у Django: якщо view закрита `@login_required`, а користувач не залогінений, сервер відповідає **редіректом на сторінку входу** (302), а не помилкою. AJAX слухняно піде за редіректом, і в `success` прилетить HTML сторінки логіна замість очікуваного JSON. Тому для AJAX-в'юх краще перевіряти вручну й повертати чесний статус:
>
> ```python
> if not request.user.is_authenticated:
>     return JsonResponse({'message': 'Увійдіть в акаунт'}, status=401)
> ```
>
> Тоді спрацює гілка `error`, і ти покажеш зрозуміле повідомлення.

### CSRF: два робочі способи

Django відхилить будь-який POST без CSRF-токена (403). Токен можна взяти двома шляхами.

**Спосіб 1 — з прихованого поля в шаблоні.** Ставиш `{% csrf_token %}` будь-де на сторінці, а jQuery читає його значення:

```html
{% csrf_token %}   <!-- створює <input type="hidden" name="csrfmiddlewaretoken" value="..."> -->
```

```js
data: {
    'book_id': bookId,
    csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val()
}
```

**Спосіб 2 — з cookie, один раз для всіх запитів.** Зручно, коли AJAX-викликів на сторінці багато:

```js
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

$.ajaxSetup({ headers: { 'X-CSRFToken': getCookie('csrftoken') } });
// далі всі $.ajax і $.post уже йдуть із токеном
```

| | Спосіб 1: приховане поле | Спосіб 2: `$.ajaxSetup` |
|---|---|---|
| Де береться токен | з `{% csrf_token %}` у шаблоні | з cookie `csrftoken` |
| Треба писати | у кожному `data` | один раз на сторінку |
| Коли зручніше | один-два запити | багато запитів |

> <i class="bi bi-info-circle"></i> GET-запити токена не потребують — вони лише читають. Правило просте: **читаєш — без токена, змінюєш — з токеном**.

## Наскрізний приклад: «Прочитано» в бібліотеці

Зберемо все разом. Задача: у списку книжок біля кожної є кнопка «Прочитано». Після кліку книжка позначається в базі, кнопка змінює вигляд, а лічильник у шапці оновлюється — без перезавантаження.

**1. Модель і view:**

```python
# library/models.py
class ReadingLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    book = models.ForeignKey(Book, on_delete=models.CASCADE)
    finished_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'book')     # та сама книга не додасться двічі
```

```python
# library/views.py
@require_POST
def mark_read(request):
    if not request.user.is_authenticated:
        return JsonResponse({'message': 'Увійдіть, щоб вести список прочитаного'}, status=401)

    book = get_object_or_404(Book, pk=request.POST.get('book_id'))
    log, created = ReadingLog.objects.get_or_create(user=request.user, book=book)

    return JsonResponse({
        'created': created,                                             # вперше чи вже було
        'total': ReadingLog.objects.filter(user=request.user).count(),  # для лічильника
        'message': 'Додано до прочитаного' if created else 'Ця книга вже позначена',
    })
```

**2. Маршрут:**

```python
# library/urls.py
path('books/read/', views.mark_read, name='mark_read'),
```

**3. Шаблон** — дані з бази йдуть у `data-`атрибути:

```html
{% csrf_token %}
<ul id="book-list">
  {% for book in books %}
    <li class="book-card">
      <h3>{{ book.title }}</h3>
      <button class="read-btn" data-book-id="{{ book.id }}">Прочитано</button>
    </li>
  {% endfor %}
</ul>
```

**4. jQuery:**

```js
$(function () {
    $('#book-list').on('click', '.read-btn', function () {
        const button = $(this);                      // саме ця кнопка
        const bookId = button.data('book-id');

        button.prop('disabled', true);               // захист від подвійного кліку

        $.ajax({
            url: '/library/books/read/',
            method: 'POST',
            data: {
                'book_id': bookId,
                csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val()
            },
            success: function (response) {
                button.text('✓ Прочитано').addClass('done');
                $('#read-count').text(response.total);           // лічильник у шапці
                button.closest('.book-card').addClass('is-read'); // підсвітити картку
            },
            error: function (xhr) {
                button.prop('disabled', false);       // повертаємо кнопку в робочий стан
                alert(xhr.responseJSON?.message || 'Не вдалося зберегти');
            }
        });
    });
});
```

Пройди очима ще раз по ланцюжку: `data-book-id` у шаблоні → `.data('book-id')` у JS → `data` у запиті → `request.POST` у view → ORM → `JsonResponse` → `response` у `success` → новий текст кнопки. Це і є весь flow, і він однаковий для будь-якої дії: лайк, підписка, оцінка, кошик.

## Що зазвичай підключають поруч

Готові інструменти, які беруть замість власного коду — через CDN або з `static/`:

| Інструмент | Для чого | Потребує jQuery? |
|---|---|---|
| **Bootstrap** | CSS-фреймворк: сітка, кнопки, форми, модалки | ні (v5), так (v3–4) |
| **Select2** | випадні списки з пошуком | так |
| **DataTables** | таблиці із сортуванням, пошуком, пагінацією | так |
| **Chart.js** | графіки й діаграми | ні |
| **Flatpickr** | вибір дати (календар) | ні |
| **SweetAlert2** | модалки й підтвердження замість `confirm` | ні |
| **Font Awesome / Bootstrap Icons** | іконки | ні |

> <i class="bi bi-exclamation-triangle"></i> Порядок підключення: спершу jQuery, потім плагіни, потім твій код. Плагін, підключений вище за jQuery, впаде з помилкою `$ is not defined`.

> <i class="bi bi-info-circle"></i> У новий проєкт jQuery тягнуть уже не завжди: те саме роблять чистим JS, **Alpine.js** або **htmx**. Але вона стоїть у безлічі наявних проєктів і потрібна плагінам вище — тож вміти нею користуватись однаково варто.

## Типові помилки / Нюанси

> <i class="bi bi-exclamation-triangle"></i> **Обробник на елементах, яких ще немає.** Кнопки, домальовані AJAX-ом, не реагують на `$('.btn').on('click')`. Рішення — делегування: `$('#контейнер').on('click', '.btn', ...)`.

> <i class="bi bi-exclamation-triangle"></i> **Забутий CSRF-токен у POST** → 403. Найчастіша помилка при першому AJAX-запиті в Django.

> <i class="bi bi-exclamation-triangle"></i> **Тільки `success`, без `error`.** Користувач клікає — нічого не відбувається, і незрозуміло чому. Завжди пиши `error` бодай з одним повідомленням.

> <i class="bi bi-exclamation-triangle"></i> **Змішування jQuery-обгортки й DOM-елемента.** `$('#x').value` — `undefined`, треба `$('#x').val()`. І навпаки: `document.getElementById('x').val()` — помилка.

> <i class="bi bi-info-circle"></i> **Подвійний клік.** Якщо запит триває секунду, користувач устигне клікнути двічі й створити два записи. Вимикай кнопку на час запиту (`.prop('disabled', true)`) і вмикай назад у `error`.

> <i class="bi bi-info-circle"></i> **`console.log` — головний інструмент.** Логуй значення на кожному кроці: що прочитала з `data`, що надіслала, що прийшло в `success`. Вкладка Network у DevTools покаже сам запит: URL, тіло, статус і відповідь сервера.

## Підсумок

- jQuery — обгортка над JS: `$()` знаходить елементи, її методи їх читають і змінюють; код загортають у `$(function () { ... })`.
- **Межа відповідальності:** jQuery живе в браузері й не має доступу до бази — вона лише надсилає HTTP-запит на URL, а всю роботу з даними й перевірку прав робить view.
- Селектори — як у CSS; порожній селектор не дає помилки, перевіряй `.length`.
- Той самий метод без аргументу читає, з аргументом записує: `.text()`, `.val()`, `.attr()`, `.data()`, `.prop()`.
- `data-`атрибути — місток від Django-шаблону до JS: `data-book-id="{{ book.id }}"` → `.data('book-id')`.
- `.closest()` і `.find()` — щоб від кнопки дістатися саме її картки, а не всіх на сторінці.
- Динамічні елементи — тільки через **делегування** `.on('click', '.selector', ...)`.
- `$.ajax` = `url` (куди) + `method` (як) + `data` (що несемо) + `success` (що робимо з відповіддю) + `error` (якщо не вийшло). У view це `request.POST` → ORM → `JsonResponse`.
- POST потребує **CSRF-токена**: або з `{% csrf_token %}` через `$('[name=csrfmiddlewaretoken]').val()`, або один раз через `$.ajaxSetup` з cookie.
- Для AJAX краще повертати чесний статус (401 або 403) замість `@login_required`, інакше в `success` прилетить HTML сторінки входу.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Документація</span><a href="https://api.jquery.com/" target="_blank" rel="noopener">jQuery API <i class="bi bi-box-arrow-up-right"></i></a></div></div>
