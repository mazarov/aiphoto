# Future Improvements

## Bot Features
- [ ] `/history` — view previously created stickers
- [ ] `/mystickers` — list all user's sticker packs
- [ ] Sticker preview before adding to pack
- [ ] Multiple sticker styles in one session

### Inline Style Buttons
- [ ] Add inline keyboard with preset styles on style selection step
- [ ] Styles: Anime, Cartoon, 3D, Pixel Art, Simpsons, Chibi, etc.

### New Generation Flow
Rework the generation flow — return sticker without immediately adding to pack, show action buttons:

- [ ] **➕ Add to pack** — adds sticker to new sticker pack
- [ ] **🎨 Change style** — go back to style selection for this photo
- [ ] **😊 Change emotion** — select emotion for sticker (see below)
- [ ] **⏭ Skip** — skip current photo, move to next one

### Emotion Selection
- [ ] Show emotion presets as inline buttons:
  - 😄 Feeling happy / Радуюсь!
  - 😊 Warm mood / Тёплое настроение
  - 🤩 Super excited / В восторге
  - ✍️ Custom emotion — user describes emotion in text

## Technical
- [ ] Store original photos in Storage (if Telegram file_id starts expiring)
- [ ] Limit stickers per user with auto-cleanup of old ones
- [ ] Thumbnails for fast history preview
- [ ] Retry logic for failed jobs with exponential backoff

## Localization
- [ ] Add more languages (uk, kk, etc.)
- [ ] Admin panel for managing bot_texts

### New Texts for bot_texts Table

| Key | RU | EN |
|-----|----|----|
| `error.no_stickers_added` | Вы не добавили ни одного стикера 🧩 | You haven't added any stickers 🧩 |
| `error.no_photos_selected` | Вы не выбрали ни одного фото 🖼️ | You haven't selected any photos 🖼️ |
| `state.choose_style` | Выберите стиль, в котором будет создан стикер 🎨 | Choose the style in which the sticker will be created 🎨 |
| `state.new_description` | Пришлите новое описание для стикера ✍️ | Send a new description for the sticker ✍️ |
| `state.choose_emotion` | Выберите эмоцию для стикера 😊 | Choose an emotion for the sticker 😊 |
| `error.image_generation_failed` | Не удалось создать изображение. Попробуйте изменить описание или повторить попытку ⚠️ | Failed to create the image. Try updating the description or retry ⚠️ |
| `error.technical` | Что-то пошло не так. Попробуйте повторить попытку позже ⚠️ | Something went wrong. Please try again later ⚠️ |

#### Emotion Buttons
| Key | RU | EN |
|-----|----|----|
| `emotion.happy` | 😄 Радуюсь! | 😄 Feeling happy |
| `emotion.warm` | 😊 Тёплое настроение | 😊 Warm mood |
| `emotion.excited` | 🤩 В восторге | 🤩 Super excited |
| `emotion.custom` | ✍️ Своя эмоция | ✍️ Custom emotion |

#### Sticker Confirmation Buttons
| Key | RU | EN |
|-----|----|----|
| `btn.add_to_pack` | ➕ Добавить в пак | ➕ Add to pack |
| `btn.skip` | ⏭ Пропустить | ⏭ Skip |
| `btn.change_style` | 🎨 Изменить стиль | 🎨 Change style |
| `btn.change_emotion` | 😊 Изменить эмоцию | 😊 Change emotion |

## Monetization
- [ ] Subscription plans (unlimited stickers)
- [ ] Referral program (bonus credits)
