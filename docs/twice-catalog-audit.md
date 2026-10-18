# TWICE 資料稽核（截止 2026-10-19）

基準：最新 main `74ad4b5c9494ac713dda78383b72e163cffccccb`，已合併版本獨立封面 PR #4。保留原有 10 張專輯及 19 種版本的 ID／albumId；不更動個人收藏 schema 或儲存鍵。

## 整理前盤點

| 地區 | 現有專輯 | 現有版本 | 核對工作 |
| --- | --- | --- | --- |
| KR | THE STORY BEGINS、PAGE TWO、twicetagram、Feel Special、Eyes wide open、BETWEEN 1&2、READY TO BE（7 張） | 16 種；twicetagram 尚無版本 | 多數來源為非官方整理站；逐筆補官方商品證據，保留 ID |
| JP | Candy Pop、BDZ、Celebrate（3 張） | 各 1 種通常盤 | 核對官方名稱、品番與限定盤 |

## 分階段候選清單（加入正式目錄前須核對）

| 階段 | 應新增／核對的發行 | 待核實版本 |
| --- | --- | --- |
| 1 韓國 | TWICEcoaster : LANE 1、LANE 2、SIGNAL、Merry & Happy、What is Love?、Summer Nights、YES or YES、The year of "YES"、FANCY YOU、MORE & MORE、Taste of Love、Formula of Love: O+T=<3、With YOU-th、STRATEGY、THIS IS FOR、TEN: The Story Goes On | 各張 CD 包裝、限定及成員版本；LANE 1 Christmas edition；twicetagram 不以隨機寫真書推算版本 |
| 1 額外確認 | The Feels、MOONLIGHT SUNRISE、I GOT YOU、CRY FOR ME、THE REMIXES | 必須找到獨立官方實體商品，不能用歌曲收錄於其他專輯作證 |
| 2 日本 | #TWICE 1–5、#BEST 2015-2025、One More Time、Wake Me Up、HAPPY HAPPY、Breakthrough、Fanfare、BETTER、Kura Kura、Doughnut、Hare Hare、&TWICE、Perfect World、DIVE、ENEMY、BDZ -Repackage-、&TWICE -Repackage- | 通常盤、初回限定 A/B、ONCE JAPAN／成員限定；以官方頁與品番區分 |
| 3 版本 | 補齊上述已確認商品版本 | 不把小卡、海報、通路特典、簽名附贈或套裝重複算成版本；黑膠另記，先確保 CD |

## 證據與判定原則

- [JYP 韓國完整分頁](https://twice.jype.com/discography)：逐頁確認名稱、日期、發行介紹；實體性由 JYP SHOP／官方唱片商店補證。
- [日本官方完整分頁](https://www.twicejapan.com/discography/) 與 [Warner Music Japan](https://wmg.jp/twice/discography)：核對日期、類型、品番、版本及後續限定發行。
- 同一作品不同商品版本保留同一 albumId；增加曲目的改版作品另建專輯。相同商品的再壓、通路特典與隨機附贈不另建版本。
- 日期以實體首發為準；數位先行日不同時另外說明。未發行商品不加入 versions.json。
- 本表會隨每階段補上逐張結果、來源、數量及待辦。未完成版本全查的專輯維持 versionsComplete: false。
- 圖片只用既有自製或統一佔位圖；發行資料來源不是圖片授權，不下載官方美術。

## 已知日期邊界

- 日本官方列出 #BEST 2015-2025：2026-08-26，可收錄已確認的當日實體版本。
- Warner 列出 #BEST 2015-2025 LIMITED BOX：2026-12-16，晚於截止日，排除正式目錄。
- SOLO、MISAMO、演唱會影像、非唱片周邊及沒有實體商品證據的純數位發行不納入。

## 第一階段結果

新增 16 張；韓國共 23 張（14 迷你、4 正規、4 改版、1 特別），連同原日本 3 張共 26 張。版本仍維持原 19 種，留待第三階段核實。

| 專輯 ID | 正式名稱 | 發行日 | 類型 | 原目錄 | 官方來源 |
| --- | --- | --- | --- | --- | --- |
| twice-the-story-begins | THE STORY BEGINS | 2015-10-20 | mini | 既有 | [來源 1](https://twice.jype.com/discography?PgIndex=6)、[來源 2](https://m.en.thejypshop.com/product/twice-1st-mini-album-the-story-begins/126/) |
| twice-page-two | PAGE TWO | 2016-04-25 | mini | 既有 | [來源 1](https://twice.jype.com/discography?PgIndex=6)、[來源 2](https://m.en.thejypshop.com/product/twice-2nd-mini-album-page-two/125) |
| twice-twicecoaster-lane-1 | TWICEcoaster : LANE 1 | 2016-10-24 | mini | 新增 | [來源 1](https://twice.jype.com/discography?PgIndex=5)、[來源 2](https://m.en.thejypshop.com/product/twice-3rd-mini-album-twicecoaster-lane-1/120/) |
| twice-twicecoaster-lane-2 | TWICEcoaster : LANE 2 | 2017-02-20 | repackage | 新增 | [來源 1](https://twice.jype.com/discography?PgIndex=5)、[來源 2](https://m.en.thejypshop.com/product/twice-special-album-twicecoaster-lane-2/117/) |
| twice-signal | SIGNAL | 2017-05-15 | mini | 新增 | [來源 1](https://twice.jype.com/discography?PgIndex=5)、[來源 2](https://m.en.thejypshop.com/product/twice-4th-mini-album-signal/116/) |
| twice-twicetagram | twicetagram | 2017-10-30 | studio | 既有 | [來源 1](https://twice.jype.com/discography?PgIndex=5)、[來源 2](https://twice.jype.com/discography/cpzs0rno) |
| twice-merry-and-happy | Merry & Happy | 2017-12-11 | repackage | 新增 | [來源 1](https://twice.jype.com/discography?PgIndex=5)、[來源 2](https://twice.jype.com/discography/hu3q4v3u) |
| twice-what-is-love | What is Love? | 2018-04-09 | mini | 新增 | [來源 1](https://twice.jype.com/discography?PgIndex=5)、[來源 2](https://m.en.thejypshop.com/product/twice-5th-mini-album-what-is-love/108/category/45/display/1/) |
| twice-summer-nights | Summer Nights | 2018-07-09 | repackage | 新增 | [來源 1](https://twice.jype.com/discography?PgIndex=4)、[來源 2](https://m.en.thejypshop.com/product/twice-2nd-summer-special-album-summer-nights/107/) |
| twice-yes-or-yes | YES or YES | 2018-11-05 | mini | 新增 | [來源 1](https://twice.jype.com/discography?PgIndex=4)、[來源 2](https://m.en.thejypshop.com/product/twice-6th-mini-album-yes-or-yes/104/category/45/display/1/) |
| twice-the-year-of-yes | The year of "YES" | 2018-12-12 | repackage | 新增 | [來源 1](https://twice.jype.com/discography?PgIndex=4)、[來源 2](https://m.en.thejypshop.com/product/list_gallery.html?cate_no=45&page=4) |
| twice-fancy-you | FANCY YOU | 2019-04-22 | mini | 新增 | [來源 1](https://twice.jype.com/discography?PgIndex=4)、[來源 2](https://m.en.thejypshop.com/product/list_gallery.html?cate_no=45&page=4) |
| twice-feel-special | Feel Special | 2019-09-23 | mini | 既有 | [來源 1](https://twice.jype.com/discography?PgIndex=4)、[來源 2](https://m.en.thejypshop.com/product/list_gallery.html?cate_no=45&page=4) |
| twice-more-and-more | MORE & MORE | 2020-06-01 | mini | 新增 | [來源 1](https://twice.jype.com/discography?PgIndex=4)、[來源 2](https://m.en.thejypshop.com/product/list_gallery.html?cate_no=45&page=4) |
| twice-eyes-wide-open | Eyes wide open | 2020-10-26 | studio | 既有 | [來源 1](https://twice.jype.com/discography?PgIndex=3)、[來源 2](https://m.en.thejypshop.com/product/list_gallery.html?cate_no=45&page=4) |
| twice-taste-of-love | Taste of Love | 2021-06-09 | mini | 新增 | [來源 1](https://twice.jype.com/discography?PgIndex=3)、[來源 2](https://twiceshop.com/products/taste-of-love-taste-version) |
| twice-formula-of-love | Formula of Love: O+T=<3 | 2021-11-12 | studio | 新增 | [來源 1](https://twice.jype.com/discography?PgIndex=3)、[來源 2](https://twiceshop.com/products/formula-of-love-o-t-3-full-of-love-version) |
| twice-between-1-and-2 | BETWEEN 1&2 | 2022-08-26 | mini | 既有 | [來源 1](https://twice.jype.com/discography?PgIndex=2) |
| twice-ready-to-be | READY TO BE | 2023-03-10 | mini | 既有 | [來源 1](https://twice.jype.com/discography?PgIndex=2)、[來源 2](https://twiceshop.com/products/ready-to-be-ready-ver-not-signed) |
| twice-with-you-th | With YOU-th | 2024-02-23 | mini | 新增 | [來源 1](https://twice.jype.com/discography?PgIndex=2)、[來源 2](https://twiceshop.com/products/with-you-th-forever-ver) |
| twice-strategy | STRATEGY | 2024-12-06 | mini | 新增 | [來源 1](https://twice.jype.com/discography)、[來源 2](https://twiceshop.com/products/strategy-step-3-ver) |
| twice-this-is-for | THIS IS FOR | 2025-07-11 | studio | 新增 | [來源 1](https://twice.jype.com/discography)、[來源 2](https://twiceshop.com/products/this-is-for-this-ver) |
| twice-ten-the-story-goes-on | TEN: The Story Goes On | 2025-10-10 | special | 新增 | [來源 1](https://twice.jype.com/discography)、[來源 2](https://twiceshop.com/products/ten-the-story-goes-on-episode-ver) |

### 韓國尚待完成

- 各張普通版、限定版、成員版的逐項查證於第三階段處理；全部維持 `versionsComplete: false`。
- `I GOT YOU`：官方商店保留 [CD Single 分類](https://twiceshop.com/collections/i-got-you-cd-single)，但沒有商品規格與實體首發日期；暫不加入正式 albums／versions。不可把數位 2024-02-02 自動當實體日期。
- `The Feels`、`MOONLIGHT SUNRISE`、`CRY FOR ME`、`THE REMIXES`：目前未找到可確認的獨立官方實體商品；不因收錄在其他 CD 而另建單曲版本。
- `Taste of Love` 官網列 2021-06-09；沿用官網作品日期，CD 商品發行日須另外核對。
- JYP SHOP 舊商品的月份欄位有錯植（例如 LANE 2 寫 October 2017、YES or YES 寫 August 2018）；作品日以 JYP discography 為準，商品頁只用於規格／版本證據。
