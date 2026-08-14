# Цикл запиту й middleware

Запит не потрапляє у view напряму: спершу він проходить ланцюг middleware, а відповідь повертається через них у зворотному порядку. Саме тому у view вже готові `request.user` і `request.session`.

## Повний шлях запиту

```
Браузер
   │  GET /blog/django-6/          (або /shop/catalog/, /library/books/)
   ▼
WSGI/ASGI (вхідна точка)
   ▼
┌──────────────────────────────────────────────┐
│  MIDDLEWARE (зверху вниз)                      │  ← обробка ДО view
│   security → sessions → common → csrf →        │
│   auth → messages → clickjacking               │
└──────────────────────────────────────────────┘
   ▼
URLconf  (root/urls.py → app/urls.py)            ← який маршрут підходить
   ▼
VIEW  (твоя функція)                              ← логіка + дані з Model
   ▼
TEMPLATE (рендер HTML)
   ▼
┌──────────────────────────────────────────────┐
│  MIDDLEWARE (знизу вгору)                      │  ← обробка ПІСЛЯ view
└──────────────────────────────────────────────┘
   ▼
Браузер ← HttpResponse (готовий HTML)
```

Ключова ідея: запит **не йде прямо у view**. Спершу він проходить крізь шар **middleware**, а відповідь на зворотному шляху знову проходить middleware — але вже у зворотному порядку.

## Що таке middleware

> **Middleware** — це «прошарки», крізь які проходить *кожен* запит і *кожна* відповідь. Кожен прошарок може щось перевірити, додати або змінити, перш ніж пустити запит далі (або відповідь назад).

Запит послідовно проходить усі прошарки згори вниз, потрапляє у view, а відповідь повертається крізь ті самі прошарки знизу вгору. View не дбає про ці перевірки — ними займається конвеєр навколо неї.

Спільну для всіх запитів логіку (безпека, сесії, автентифікація) виносять в один шар, замість того щоб дублювати її в кожному view. Один раз налаштував — працює для всього сайту: і для блогу, і для магазину, і для бібліотеки.

## Стандартний список MIDDLEWARE

Ось повний список, який Django кладе у `settings.py` за замовчуванням. Розберемо **кожен** прошарок — що він робить:

```python
# config/settings.py
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
```

| # | Middleware | Що робить |
|---|---|---|
| 1 | **SecurityMiddleware** | HTTPS-редіректи, заголовки безпеки (`Strict-Transport-Security`, `X-Content-Type-Options`), налаштування SSL. Стоїть **першим**, щоб перевірки безпеки спрацювали найраніше. |
| 2 | **SessionMiddleware** | Читає cookie сесії, підключає `request.session`. Завдяки йому у view працює `request.session['cart']` (кошик у магазині) чи будь-яке збереження між запитами. |
| 3 | **CommonMiddleware** | Дрібні нормалізації: додає/прибирає слеш у кінці URL (`APPEND_SLASH`), блокує ботів із `DISALLOWED_USER_AGENTS`, ставить `Content-Length`. |
| 4 | **CsrfViewMiddleware** | Захист від CSRF: перевіряє csrf-токен у POST-формах. Саме він вимагає `{% csrf_token %}` у формах (коментар до посту в блозі, форма замовлення). |
| 5 | **AuthenticationMiddleware** | Підключає `request.user` (читає користувача із сесії). Без нього не було б `request.user.is_authenticated`. **Залежить від SessionMiddleware** — тому стоїть нижче. |
| 6 | **MessageMiddleware** | Flash-повідомлення (`messages.success(request, 'Книгу додано')`) — одноразові сповіщення, що показуються на наступній сторінці. |
| 7 | **XFrameOptionsMiddleware** | Ставить заголовок `X-Frame-Options` → захист від clickjacking (щоб твій сайт не вбудували в чужий `<iframe>`). |

Саме завдяки цим прошаркам у view «магічно» працюють `request.user` (його кладе `AuthenticationMiddleware`) і `request.session` (його кладе `SessionMiddleware`). Без відповідних middleware тих атрибутів просто не було б.

## Порядок запиту та відповіді

Middleware не просто «список» — це двобічний конвеєр:

- **Для запиту** (до view) прошарки виконуються **згори вниз**: 1 → 2 → 3 → … → 7 → view.
- **Для відповіді** (після view) — **знизу вгору**: view → 7 → … → 3 → 2 → 1 → браузер.

```
запит  →  1  2  3  4  5  6  7  →  VIEW
                                     │
браузер ←  1  2  3  4  5  6  7  ←  VIEW
```

Тому один і той самий `SecurityMiddleware` бачить запит **першим**, а відповідь — **останньою** (щоб проставити заголовки безпеки на вже готову відповідь).

## Чому порядок у списку важливий

Порядок у списку — не випадковий, він відображає залежності між прошарками:

- `SessionMiddleware` (2) стоїть **вище** за `AuthenticationMiddleware` (5), бо автентифікація читає користувача **із сесії** — сесія має бути готова раніше.
- Якщо переставити їх місцями — `request.user` зламається, бо сесії ще не існує в момент, коли `AuthenticationMiddleware` намагається її прочитати.

> <i class="bi bi-exclamation-triangle"></i> Це часта пастка: додаєш своє middleware «не туди» в списку — і щось перестає працювати. **Порядок = послідовність конвеєра.** Нове middleware зазвичай додають у кінець списку, якщо немає особливих причин інакше.

## Приклад: що бачить view завдяки middleware

Той самий патерн працює в будь-якому домені — прошарки вже підготували `request`:

```python
# blog/views.py — сторінка «мої чернетки»
def my_drafts(request):
    # request.user     ← поклав AuthenticationMiddleware
    # request.session  ← поклав SessionMiddleware
    if request.user.is_authenticated:
        drafts = Post.objects.filter(author=request.user, is_published=False)
        return render(request, 'blog/drafts.html', {'drafts': drafts})
    return redirect('login')
```

```python
# carts/views.py
def cart(request):
    items = request.session.get('cart', [])   # session готовий завдяки middleware
    return render(request, 'shop/cart.html', {'items': items})
```

Сама view нічого не робила, щоб отримати `request.user` чи `request.session` — вони вже там, бо запит пройшов через відповідні прошарки.

## Власне middleware (просто щоб знати)

Своє middleware пишуть рідко, але виглядає воно так — функція, що «обгортає» наступний крок. Наприклад, логер часу відповіді для бібліотеки:

```python
# core/middleware.py
import time


def timing_middleware(get_response):
    def middleware(request):
        start = time.monotonic()               # ДО view
        response = get_response(request)       # викликаємо наступний шар / view
        duration = time.monotonic() - start    # ПІСЛЯ view
        response['X-Response-Time'] = f'{duration:.3f}s'
        return response
    return middleware
```

Видно структуру «до / викликати далі / після» — той самий конвеєр у мініатюрі. Щоб middleware запрацювало, його додають рядком у `MIDDLEWARE`.

## Типові помилки / Нюанси

| Що не так | Наслідок і як правильно |
|---|---|
| `AuthenticationMiddleware` вище за `SessionMiddleware` | `'WSGIRequest' object has no attribute 'user'`: автентифікація читає користувача із сесії, тому сесія має бути готова раніше |
| Прибрано `CsrfViewMiddleware` | Усі POST-форми або віддають 403, або лишаються без захисту від підробки запитів |
| `if request.user:` замість `is_authenticated` | Для гостя це `AnonymousUser` — об'єкт істинний, тому перевірка завжди проходить |
| Власне middleware вставлене в середину списку | Ламає залежності стандартного ланцюга; без вагомої причини його додають у кінець |
| Важка робота в middleware | Виконується на **кожен** запит, зокрема на статику й службові адреси |
| Middleware, що не повертає відповідь | Ланцюг обривається з помилкою: обгортка мусить повернути результат `get_response(request)` |

## Підсумок

- Запит проходить ланцюг: **Middleware → URLconf → View (+Model) → Template → Middleware → Response**; у view він потрапляє не напряму.
- **Middleware** — прошарки, через які проходить кожен запит і кожна відповідь; view про них не знає.
- Стандартні сім прошарків: **security → sessions → common → csrf → auth → messages → clickjacking** — кожен має свою роль (безпека, сесії, CSRF, `request.user`, flash-повідомлення…).
- `request.user` і `request.session` з'являються саме завдяки відповідним middleware.
- **Порядок** у `MIDDLEWARE` важливий: запит — згори вниз, відповідь — знизу вгору; залежності мають стояти раніше (`sessions` перед `auth`).

<div class="dj-docs"><i class="bi bi-book"></i><div><span class="dj-docs-title">Офіційна документація</span><a href="https://docs.djangoproject.com/en/stable/topics/http/middleware/" target="_blank" rel="noopener">Middleware <i class="bi bi-box-arrow-up-right"></i></a></div></div>
