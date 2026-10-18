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
