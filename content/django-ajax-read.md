# AJAX-рецепти: читання даних

Запити, які нічого не змінюють: підказки під час набору, пошук, довантаження списку, залежні поля. Усі вони йдуть методом GET, тому CSRF-токен їм не потрібен. Урок — набір готових рецептів за однаковою схемою.

## Спільний каркас

Кожен рецепт складається з п'яти частин, і вони однакові для всіх випадків:

| Частина | Питання |
|---|---|
| Тригер | що запускає запит |
| Запит | куди й з якими параметрами |
| View | що робить на сервері |
| Відповідь | які дані повертає |
| Оновлення | які елементи сторінки змінюються |

Далі змінюється лише наповнення цих п'яти рядків.

## Рецепт 1: стан при завантаженні сторінки

**Коли.** На кожній сторінці треба показати дані, яких немає в поточному шаблоні: лічильник кошика в шапці, кількість непрочитаних повідомлень, статус синхронізації.

```html
{# templates/_layouts/header.html #}
<a href="{% url 'cart' %}">Кошик <span id="cart-qty">0</span></a>
```

```js
// static/js/header.js
$(function () {
    $.ajax({
        url: '/carts/count/',
        success: function (response) {
            $('#cart-qty').text(response.count);
        },
    });
});
```

```python
# carts/views.py
def cart_indicator(request):
    if not request.user.is_authenticated:
        return JsonResponse({'count': 0})

    items = CartItem.objects.filter(user=request.user)
    return JsonResponse({'count': sum(item.quantity for item in items)})
```

Метод не вказаний, тож `$.ajax` шле GET; токена не треба.

> <i class="bi bi-exclamation-triangle"></i> Такий запит виконується на **кожній** сторінці сайту, тому view має бути дешевою. Якщо для лічильника потрібен складний підрахунок, розумніше передати число прямо в шаблон через context processor і не робити запит узагалі.

## Рецепт 2: жива перевірка поля

**Коли.** Значення може перевірити лише сервер, а відповідь потрібна до відправлення форми: вільний логін, чинність промокоду, наявність такого email.

```html
{# templates/accounts/register.html #}
<input type="text" id="username" name="username">
<span id="username-hint"></span>
```

```js
// static/js/register.js
$('#username').on('blur', function () {
    const value = $(this).val().trim();
    if (value.length < 3) {
        return;                                  // не смикаємо сервер на порожньому полі
    }

    $.ajax({
        url: '/accounts/check-username/',
        data: { 'username': value },
        success: function (response) {
            $('#username-hint').text(response.taken ? 'Логін зайнятий' : 'Логін вільний');
        },
    });
});
```

```python
# accounts/views.py
def check_username(request):
    username = request.GET.get('username', '').strip()
    taken = User.objects.filter(username__iexact=username).exists()
    return JsonResponse({'taken': taken})
```

> <i class="bi bi-exclamation-triangle"></i> Ця перевірка нічого не гарантує: між нею й натисканням «Зареєструватися» логін може зайняти інший користувач. Остаточне рішення ухвалює валідація форми на сервері — урок «Валідація».

**Подія має значення.** `blur` шле один запит, коли користувач пішов з поля. `input` дає миттєвий фідбек, але спрацьовує на кожен символ — тоді потрібна затримка (рецепт 3).

## Рецепт 3: живий пошук

**Коли.** Список фільтрується під час набору: пошук книг, фільмів, товарів.

```html
{# templates/library/book_list.html #}
<input type="text" id="search" placeholder="Пошук книг">
<ul id="results"></ul>
```

```js
// static/js/library.js
let timer = null;

$('#search').on('input', function () {
    const query = $(this).val().trim();

    clearTimeout(timer);                          // скасувати попередній відкладений запит
    timer = setTimeout(function () {
        $.ajax({
            url: '/library/search/',
            data: { 'q': query },
            success: function (response) {
                $('#results').empty();
                response.results.forEach(function (book) {
                    $('#results').append($('<li>').text(book.title));
                });
            },
        });
    }, 300);                                      // чекаємо 300 мс після останнього символу
});
```

```python
# library/views.py
def book_search(request):
    query = request.GET.get('q', '').strip()
    books = Book.objects.filter(title__icontains=query)[:10] if query else []
    return JsonResponse({'results': [{'id': b.id, 'title': b.title} for b in books]})
```

**Затримка обов'язкова.** Без `setTimeout` слово «Тигролови» дасть дев'ять запитів замість одного. Прийом називають debounce: таймер щоразу скидається, і запит іде лише коли користувач зупинився.

> <i class="bi bi-info-circle"></i> Обмеження `[:10]` у view не косметичне: без нього порожній запит поверне всю таблицю.

## Рецепт 4: завантажити ще

**Коли.** Довгий список показують порціями замість пагінації з перезавантаженням.

```html
{# templates/blog/post_list.html #}
<div id="posts">…перші 10 статей із шаблону…</div>
<button id="load-more" data-page="2">Показати ще</button>
```

```js
// static/js/blog.js
$('#load-more').on('click', function () {
    const button = $(this);
    const page = button.data('page');

    $.ajax({
        url: '/blog/load/',
        data: { 'page': page },
        success: function (response) {
            response.posts.forEach(function (post) {
                $('#posts').append(`<article><h2>${post.title}</h2></article>`);
            });

            button.data('page', page + 1);        // наступний клік візьме наступну сторінку
            if (!response.has_next) {
                button.remove();                  // сторінки скінчились
            }
        },
    });
});
```

```python
# blog/views.py
def load_posts(request):
    page_number = request.GET.get('page', 1)
    paginator = Paginator(Post.objects.filter(is_published=True).order_by('-created_at'), 10)
    page = paginator.get_page(page_number)

    return JsonResponse({
        'posts': [{'title': p.title} for p in page],
        'has_next': page.has_next(),
    })
```

Номер наступної сторінки зберігається в `data-page` самої кнопки — так скрипт не тримає стан у глобальній змінній.

> <i class="bi bi-exclamation-triangle"></i> Без `order_by` у запиті порядок рядків не гарантований, і одна й та сама стаття може приїхати двічі на різних сторінках.

## Рецепт 5: залежні списки

**Коли.** Вміст другого поля залежить від вибору в першому: країна → місто, категорія → підкатегорія, жанр → фільм.

```html
{# templates/shop/product_form.html #}
<select id="category" name="category">…</select>
<select id="subcategory" name="subcategory"></select>
```

```js
// static/js/shop.js
$('#category').on('change', function () {
    $.ajax({
        url: '/catalog/subcategories/',
        data: { 'category': $(this).val() },
        success: function (response) {
            const select = $('#subcategory').empty();
            response.items.forEach(function (item) {
                select.append($('<option>').val(item.id).text(item.name));
            });
        },
    });
});
```

```python
# catalog/views.py
def subcategories(request):
    category_id = request.GET.get('category')
    items = Subcategory.objects.filter(category_id=category_id).values('id', 'name')
    return JsonResponse({'items': list(items)})
```

Подія тут саме `change`, а не `click`: вона спрацьовує при виборі значення й не залежить від того, як його обрали — мишею, клавіатурою чи автозаповненням.

> <i class="bi bi-exclamation-triangle"></i> Другий список треба очищати перед наповненням, інакше після кількох перемикань у ньому накопичаться варіанти з усіх категорій.

## Що спільного в усіх п'яти

- Метод — GET, бо жоден запит нічого не змінює; CSRF-токен не потрібен.
- View повертає `JsonResponse` зі значеннями, які потрібні саме для оновлення екрана, — не цілі об'єкти.
- Скрипт завжди робить одне й те саме: бере значення з елемента, надсилає, отримує відповідь, оновлює конкретні елементи.
- Різниця лише в тригері (`blur`, `input`, `change`, `click`, завантаження сторінки) і в тому, звідки береться параметр.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| Запит на кожен символ без затримки | Десятки запитів на одне слово; потрібен debounce через `setTimeout` |
| Немає обмеження кількості у view | Порожній запит повертає всю таблицю |
| Список не очищається перед наповненням | Результати накопичуються поверх попередніх |
| Живу перевірку вважають захистом | Між перевіркою й відправленням форми стан міг змінитися; істину визначає валідація на сервері |
| `click` замість `change` для `<select>` | Обробник не спрацює при виборі з клавіатури |
| Дані пагінації в глобальній змінній | Стан губиться при повторному рендері; надійніше тримати його в `data-` атрибуті елемента |
| GET-запит із CSRF-токеном | Не помилка, але зайве: токен потрібен лише для запитів, що змінюють дані |

## Підсумок

- Читання даних завжди GET: токен не потрібен, view лише вибирає й повертає.
- П'ять частин будь-якого рецепта: тригер, запит, view, відповідь, оновлення DOM.
- Набір під час друку потребує затримки (debounce), інакше кожен символ дає запит.
- Стан на кшталт номера наступної сторінки зручно тримати в `data-` атрибуті елемента.
- Для `<select>` тригером є `change`, для текстових полів — `input` або `blur`.
- Перевірка «на льоту» покращує досвід, але не замінює серверної валідації при відправленні форми.

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/ref/request-response/#jsonresponse-objects" target="_blank" rel="noopener">JsonResponse <i class="bi bi-box-arrow-up-right"></i></a></div></div>
