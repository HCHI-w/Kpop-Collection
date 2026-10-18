# My K-pop Collection

繁體中文 K-pop 實體專輯收藏圖鑑 MVP。使用原生 HTML、CSS、JavaScript ES Modules 與獨立 JSON 目錄，無框架、資料庫、建置步驟或正式環境依賴，可直接部署到 GitHub Pages 子路徑。

## 功能

- 團體選擇（第一版 TWICE）、10 張真實專輯的部分示範目錄。
- 沿用第二版的預設深色主題，使用深灰層次、柔粉與杏桃點綴；表單、收藏詳情及備份視窗皆支援深色顯示，無主題切換按鈕。
- 頁首品牌為「專輯圖鑑」，捲動時固定在頂端；錨點與收藏導覽跳轉會預留頁首高度。主內容順序為介紹 → 團體選擇與收藏統計 → 專輯圖鑑；桌面兩區同列、間距 20px，手機上下排列。統計卡片各含邊框及內距最多 150px。
- 年份、韓國／日本發行、專輯類型交叉篩選；名稱搜尋（忽略大小寫，支援全形正規化）。
- 專輯總覽與可直接編輯的版本詳細收藏；獨立的「已擁有」與「想要」清單。
- 每個實體版本只有獨立的「已擁有」與「想要」，可以同時勾選；不再輸入實體張數。
- 收藏統計顯示「已擁有專輯」種數及其版本種數、「想要收藏」版本種數及其專輯種數。
- 舊版待整理資料保留於備份，一次性提醒可選擇保留，或下載備份並確認後移除；日常介面不提供暫存與轉移。
- 即時 localStorage 儲存、同源分頁同步、儲存失敗回復畫面、損壞資料保護與原檔救援下載。
- JSON 備份下載、格式與 schemaVersion 驗證、匯入預覽、合併／覆蓋、覆蓋前確認。
- 手機每排 2 張，桌面 4～6 張；原生模態視窗、鍵盤焦點、Escape 關閉與減少動態效果支援。

## 本機預覽

不需要 `npm install`。請使用 HTTP 伺服器，直接開啟 `file://` 會使 ES Modules 或 JSON fetch 被瀏覽器封鎖。

```sh
cd Kpop-Collection
python3 -m http.server 8000
```

瀏覽 [http://localhost:8000](http://localhost:8000)。也可以執行 `npm run preview`（需 Python 3）。

要重現 GitHub Pages 子路徑，請從儲存庫的上一層執行：

```sh
python3 -m http.server 8000
```

瀏覽 [http://localhost:8000/Kpop-Collection/](http://localhost:8000/Kpop-Collection/)。路徑大小寫須與本機目錄一致。

## 部署到 GitHub Pages

1. 合併程式碼到 `main`。
2. 前往儲存庫 **Settings → Pages → Build and deployment**。
3. Source 選擇 **Deploy from a branch**，Branch 選擇 **main / (root)**，儲存。
4. 等待 GitHub Pages 部署完成，使用 Settings 顯示的網站網址。

網站已部署於 [https://hchi-w.github.io/Kpop-Collection/](https://hchi-w.github.io/Kpop-Collection/)。第三版透過 Pull Request 檢查，合併至 `main` 後沿用既有 Pages 設定部署。`.nojekyll` 可跳過 Jekyll 處理。沒有必要把網站移至 `docs/`、安裝套件或產生 `dist/`。

所有站內 CSS、模組、JSON、圖片與首頁連結皆使用相對路徑。JSON 內圖片路徑相對於網站根目錄（`index.html`），不是 JSON 所在目錄。外部資料來源連結僅供閱讀，網站載入與收藏操作不依賴外站。

## 檔案結構

```text
index.html                  語意化頁面、導覽、篩選與備份視窗
css/style.css               深色主題變數、固定頁首、響應式與互動樣式
js/
  app.js                    UI、事件、視窗、備份流程與儲存錯誤處理
  catalog.js                目錄載入、驗證、名稱搜尋與篩選
  collection.js             收藏模型、統計、合併、匯入驗證與 localStorage
assets/
  favicon.svg               自製網站圖示
  covers/*.svg              自製文字佔位封面，非官方美術
data/
  groups.json               團體與各團體目錄路徑
  twice/albums.json         專輯目錄（名稱、日期、地區、類型、圖片、來源）
  twice/versions.json       實體版本目錄（專輯關聯、名稱、媒介、來源）
tests/
  collection.test.js        Node 內建測試，無第三方依賴
  browser.mjs               Chromium DevTools Protocol 瀏覽器整合測試
.github/workflows/checks.yml  PR／push 時執行核心測試與 JS 語法檢查
.nojekyll                   GitHub Pages 靜態部署標記
```

## 收藏模型與計數

儲存鍵：`my-kpop-collection:v1`。不以陣列索引或顯示名稱作為識別，也不將個人收藏資料存入目錄 JSON。

第三版保留相同儲存鍵、`schemaVersion: 1`、所有既有專輯／版本 ID，以及 `versions`、`pending` 欄位。載入不會自動遷移或改寫原始收藏。

```json
{
  "schemaVersion": 1,
  "versions": {
    "twice-ready-to-be-ready": {
      "albumId": "twice-ready-to-be",
      "quantity": 2,
      "wanted": true
    }
  },
  "pending": {
    "twice-ready-to-be": { "quantity": 1 }
  }
}
```

這份舊資料會顯示 **1 種已擁有專輯、1 種已擁有版本、1 種想要版本**。舊數量 2 原樣保留；`pending` 仍可備份，但不加入收藏清單與統計。

- `quantity > 0` 代表已擁有；新的勾選寫入 1、取消寫入 0。單獨改變想要不會改寫舊數量。各版本互相獨立。
- 統計為目前團體全部收藏，不受搜尋／篩選影響；不顯示實體張數。
- 目錄外 ID 完整保留於儲存與備份，不加入目前圖鑑統計。未來補入相同穩定 ID，即可重新顯示。
- 沒有收錄版本的專輯仍可瀏覽封面與發行資訊。總覽、版本清單、詳情一致提示「尚未收錄實體版本，待資料補齊後即可收藏」，不建立假版本或專輯層級收藏。

### 舊版待整理資料的處理

首次偵測到 `pending` 有大於 0 的紀錄時，會開啟「舊版收藏資料提醒」，列出專輯名稱（未知專輯以 ID 顯示）及原紀錄，提供兩種選擇：

1. **保留舊資料，繼續使用**：收藏完全不變，備份會包含它。相同舊資料不再自動提醒；之後可在「匯入 / 匯出 → 保留的舊資料」重新開啟。
2. **備份後移除**：先按「下載完整 JSON 備份」，確認檔案已保存，再勾選確認並按移除；最後仍有確認視窗。只清除 `pending`，版本收藏不變。備份後若其他分頁改動收藏，必須重新備份。寫入失敗不移除原資料。

網站不會猜測舊紀錄應轉成哪個版本。可以先保留舊資料，再到已收錄的版本勾選；twicetagram 等尚無版本的專輯可繼續保留舊資料，等待目錄補齊。

提醒回條另存於 `my-kpop-collection:legacy-pending-reviewed`，只記錄已看過的舊資料內容，不改動收藏格式。內容改變會重新提醒；完成移除後清除回條，之後還原舊備份時可再次提醒。

## 備份與匯入規則

使用右上角「匯入 / 匯出」。備份包含全部團體的版本收藏、原有數量與 `pending`（包括目錄外紀錄），另帶 `app` 與 `exportedAt` 欄位。舊版 JSON 可直接匯入。

匯入上限 2 MB／10,000 筆紀錄；驗證 JSON、`schemaVersion: 1`、欄位、ID、舊數量（0–9999 整數）、想要布林值及專輯關聯。未知 ID 保留；無效檔案或衝突關聯不會寫入收藏。預覽顯示版本種數；如有舊 `pending` 會明確告知保留、不計入統計。

**合併**：相同版本的舊數量取較大值，想要取聯集；每個專輯的舊 `pending` 也取較大值。重複匯入不累加。不再根據已擁有版本的數量推測並扣除 `pending`，避免靜默刪除舊資料。

例如：舊備份有某專輯的 `pending: 3`，目前有 READY 版本及 `pending: 1`，合併後保留 READY 與 `pending: 3`。統計只計 READY 這 1 種版本；舊資料可由使用者備份後處理。

**覆蓋**：以備份取代全部團體收藏與舊資料，必須再次確認。請先匯出現有資料。匯入前不會先清空 localStorage；寫入失敗保留原狀態。

讀取損壞／不支援的收藏時，保留原始值、暫停修改並提供「下載原始資料」。可用有效備份，選「覆蓋」並確認修復。禁止儲存或空間不足時，會顯示未儲存並回復勾選狀態。

收藏儲存在目前瀏覽器及網站網域。不同裝置、瀏覽器、HTTP／HTTPS 不共用；同一 GitHub Pages 網域會共用 localStorage。沒有雲端同步，請定期匯出；日常維護本網站不要更改儲存鍵或清除網站資料。

## 示範目錄與資料來源

| 專輯 | 發行日 | 地區／類型 | 收錄版本範圍 |
| --- | --- | --- | --- |
| THE STORY BEGINS | 2015-10-20 | 韓國／迷你 | Original |
| PAGE TWO | 2016-04-25 | 韓國／迷你 | Pink、Mint |
| twicetagram | 2017-10-30 | 韓國／正規 | 暫不收錄版本，顯示待補齊提示 |
| Candy Pop | 2018-02-07 | 日本／單曲 | 通常盤 |
| BDZ | 2018-09-12 | 日本／正規 | 通常盤 |
| Feel Special | 2019-09-23 | 韓國／迷你 | A、B、C |
| Eyes wide open | 2020-10-26 | 韓國／正規 | Story、Style、Retro |
| Celebrate | 2022-07-27 | 日本／正規 | 通常盤 |
| BETWEEN 1&2 | 2022-08-26 | 韓國／迷你 | Archive、Cryptography、Pathfinder、Complete |
| READY TO BE | 2023-03-10 | 韓國／迷你 | READY、TO、BE 寫真書版本 |

共 10 張專輯、19 種示範實體版本；是部分目錄，不能用來判斷完整發行數或全部版本集齊率。twicetagram 的包裝、表面處理與版本分類尚未納入，避免把未核實的分類寫成已確認版本。尚未包含 Digipack、黑膠、店鋪限定、簽名、隨機小卡或全部再版。

資料參考：[JYP 官方專輯目錄](https://twice.jype.com/discography)、[PAGE TWO 官方頁](https://twice.jype.com/discography/yw7w9t50)、[Candy Pop 官方專頁](https://www.twicejapan.com/feature/candypop)、[BDZ 官方專頁](https://www.twicejapan.com/feature/bdz)、[Celebrate 官方專頁](https://www.twicejapan.com/feature/Celebrate)、[READY TO BE JYP SHOP](https://m.en.thejypshop.com/product/twice-12th-mini-album-ready-to-be/1234/)、[Once Collector 發行目錄](https://oncecollector.com/discography)。各 JSON 紀錄另有來源連結。此站為非官方個人收藏工具。

### 增加專輯或版本

1. 在 `data/twice/albums.json` 的 `albums` 陣列新增專輯，填寫唯一且永久的 `id`、`groupId`、`name`、`releaseDate`（ISO 日期）、`region`（`KR`／`JP`）、`type`（`mini`／`studio`／`single`）、`cover`、`coverAlt`、`coverIsPlaceholder`、`versionsComplete`、`catalogNote`、`sources`。
2. 在 `data/twice/versions.json` 的 `versions` 陣列新增已核實版本，填寫永久 `id`、對應 `albumId`、`name`、`format`、`source`。沒有把握的版本先不新增；網站會顯示待資料補齊的提示。
3. 圖片放入 `assets/covers/`，`cover` 使用 `./assets/covers/檔名`。確認圖片授權後才替換，填寫來源／授權資訊、更新 `coverAlt` 並設 `coverIsPlaceholder: false`；不用更改專輯或版本 ID。
4. 執行測試；增加專輯時同步更新本頁表格及瀏覽器測試中的目錄／篩選數量預期。核心測試允許替換為實際封面。

新增團體：建立 `data/團體ID/albums.json`、`versions.json`（各自含 `schemaVersion: 1`），再加入 `data/groups.json` 的 `groups` 陣列，包含永久 `id`、`name`、`description`、`albumsPath`、`versionsPath`。UI 會自動產生團體選擇與對應統計／年份。所有目錄 ID 必須跨團體唯一，建議使用 `團體-專輯-版本`。

不要重用、重新命名或刪除已有的穩定 ID。新增資料不需修改收藏 schema，也不應清空 localStorage。若未來改動收藏格式，應新增明確 migration，保留舊鍵直到成功遷移；不要直接提高版本號後丟棄舊資料。

## 自行維護網站內容

以下步驟都可以在 GitHub 網頁完成，不必安裝程式。先打開 [HCHI-w/Kpop-Collection 儲存庫](https://github.com/HCHI-w/Kpop-Collection)，確認目前看的分支與檔案正確。建議用新分支修改、開 Pull Request 檢查，確認後再合併到 `main`。

### 1. 上傳新的專輯圖片

1. 在儲存庫點進 **assets → covers** 資料夾。
2. 選 **Add file → Upload files**，把圖片拖進頁面，或按 **choose your files** 選取。
3. 建議使用正方形 JPG、PNG 或 WebP，檔名使用英文小寫及連字號，例如 `ready-to-be.jpg`。檔名大小寫必須與稍後填入的路徑完全相同；不要只填電腦上的圖片位置。
4. 確認圖片可供網站使用。按 **Commit changes**，寫下例如「新增 READY TO BE 封面」。選擇新分支並建立 PR；若已在自己的修改分支，繼續提交到同一分支。
5. 記住完整檔名，下一步把專輯的 `cover` 指向它。只上傳圖片，網站不會自動更換封面。

### 2. 更換封面與替代文字

在 **data → twice → albums.json**，按鉛筆圖示 **Edit this file**。找到要改的專輯（用名稱或 `id` 搜尋），修改這三個欄位：

```json
"cover": "./assets/covers/ready-to-be.jpg",
"coverAlt": "TWICE READY TO BE 專輯封面",
"coverIsPlaceholder": false
```

- `cover`：網站中的圖片位置，開頭保留 `./assets/covers/`，後面填剛上傳的檔名及副檔名。
- `coverAlt`：圖片無法顯示或使用螢幕閱讀器時讀出的說明。換成正式封面後，移除原本「文字佔位封面」的描述。
- `coverIsPlaceholder`：正式封面填 `false`，仍用文字佔位圖則填 `true`。這兩個值不用雙引號。

只改圖片和文字即可，**不要改專輯的 `id`**。如果逐漸替換了佔位圖，也請把 `index.html` 底部「封面皆為文字佔位圖」改成符合實際情況的說明。

### 3. 修改專輯名稱、日期及說明，或新增專輯

同樣編輯 `data/twice/albums.json`：

| 欄位 | 可以填什麼 |
| --- | --- |
| `name` | 顯示的專輯名稱，例如 `READY TO BE` |
| `releaseDate` | 發行日期，固定用 `年-月-日`，例如 `2023-03-10`；月份、日期各兩位數 |
| `catalogNote` | 專輯詳情中顯示的版本收錄說明 |
| `region` | 韓國發行用 `KR`，日本發行用 `JP` |
| `type` | 迷你專輯 `mini`、正規專輯 `studio`、單曲 `single` |
| `sources` | 可供查證的資料來源網址，用雙引號包住 |

新增 TWICE 專輯時，複製 `albums` 清單中一整段 `{ ... }`，放到同一清單內，再改成新專輯資料。新專輯才需要一個全新、不重複的 `id`，例如 `twice-new-album`；`groupId` 保留 `twice`。新的封面也要按上面步驟上傳。`versionsComplete` 表示版本是否全部收錄，資料不完整時保留 `false`。

JSON 是有固定標點的文字清單：文字使用英文雙引號 `"`；相鄰欄位及兩筆專輯間用逗號分隔；最後一筆後面不加逗號。不要加入註解，也不要改檔案頂端的 `schemaVersion`。送出前可在 **Preview changes** 檢查變更；若測試失敗，先依錯誤訊息修正再合併。

### 4. 網站固定文字在哪裡？

| 檔案 | 適合修改的文字 |
| --- | --- |
| `index.html` | 瀏覽器頁面標題、header 網站名稱「專輯圖鑑」、導覽按鈕、首頁標題及介紹、篩選標籤、檢視切換按鈕、目錄底部提示、footer、備份視窗與舊資料提醒的固定說明 |
| `js/app.js` | 動態統計標籤及說明（`renderStats`）、卡片收藏文字（`card`）、版本勾選文字（`versionRow`）、搜尋結果數量（`render`）、專輯詳情（`renderDetail`）、沒有版本時的提示（`noVersionsMessage`）、匯入結果與儲存通知 |
| `data/twice/albums.json` | 每張專輯的名稱、日期、封面及個別說明 |
| `data/twice/versions.json` | 每個實體版本的名稱及媒介說明 |
| `data/groups.json` | 團體名稱與簡介；按鈕由 `app.js` 讀取這裡的資料產生 |
| `js/catalog.js` | 動態顯示的類型與地區文字：`TYPE_LABELS`、`REGION_LABELS`；若改名稱，記得同步 `index.html` 下拉選單文字 |

修改 `index.html` 或 `app.js` 時只改要顯示的文字。保留 HTML 標籤、`id`、`class`、`data-...`，以及 JavaScript 的引號、反引號與 `${...}`；這些是讓功能正常運作的部分。拿不準時，可先只改 JSON 的內容，再在 PR 中檢查畫面。

### 5. 修改實體版本名稱

打開 **data → twice → versions.json**，按鉛筆編輯。找到對應的版本，只更改 `name`（名稱）或 `format`（例如「CD + 寫真書」）：

```json
{
  "id": "twice-ready-to-be-ready",
  "albumId": "twice-ready-to-be",
  "name": "READY ver.",
  "format": "CD + Photobook",
  "source": "https://m.en.thejypshop.com/product/twice-12th-mini-album-ready-to-be/1234/"
}
```

上例的 `id` 和 `albumId` 必須保留。名稱可改，使用者的收藏會繼續對應同一個版本。

增加全新版本時才新增一筆紀錄：給它唯一的新 `id`，`albumId` 填所屬專輯原本的 `id`，並填寫已查證的名稱、媒介與來源。沒有確定名稱時先不新增，網站會顯示待補齊提示。不要為了開放收藏而建立「預設版」或假設的官方版本。

### 6. 提交 Commit 並等待網站更新

1. 每次編輯後按 **Commit changes**，填簡短說明，例如「更換 PAGE TWO 封面與說明」。Commit 就是保存這次修改的一筆紀錄。
2. 在修改分支上完成圖片與 JSON 的變更，再按 **Compare & pull request** 建立 PR；如果 PR 已存在，同一分支後續的 Commit 會自動加進去。
3. 在 PR 的 **Files changed** 確認只改到預期內容，等待 **Checks** 通過。若有本機環境，可依下方指令執行測試。
4. 確認後合併至 **main**。GitHub Pages 會沿用現有設定自動部署，不必另外上傳網站或清除使用者資料。
5. 到儲存庫 **Actions** 等待 **pages build and deployment** 成功，通常需要幾分鐘；也可到 **Settings → Pages** 查看狀態。之後重新整理 [正式網站](https://hchi-w.github.io/Kpop-Collection/)。若仍看到舊圖，可強制重新整理，不必清除網站資料。
6. 檢查新封面、名稱、搜尋與詳情是否正常。若失敗，先查看 Actions 訊息與圖片路徑；可在 GitHub 修正後再提交一次。

增加專輯會改變測試預期的目錄數量；請同步檢查 `tests/browser.mjs` 的專輯總數及年份篩選預期。只更換封面不需要把核心測試改回全佔位圖。

### 7. 保護既有收藏

- **同一張專輯、同一個版本的 `id` 永遠不要更改或重用**，也不要更改版本的 `albumId`。即使改名、換圖或排序，這些 ID 都保持原樣。
- 新專輯／新版本才新增唯一 ID；不確定時先保留原紀錄，避免使用者收藏無法在目錄顯示。
- 不要更動 `js/collection.js` 的 `STORAGE_KEY`、`SCHEMA_VERSION`，也不要加入 `localStorage.clear()` 或刪除收藏儲存鍵。
- 個人收藏在使用者自己的瀏覽器，不在專輯 JSON 中。修改名稱、日期、說明或圖片並重新部署，不需要資料遷移，也不會清空收藏。
- 操作備份的「覆蓋」或舊資料的「移除」前，先下載並保存完整 JSON。個人備份不要上傳公開儲存庫；不用為了看新圖片去清除網站資料。

## 測試

需 Node.js 22+，不需安裝 npm 依賴：

```sh
npm test
npm run test
node --check js/app.js
node --check js/catalog.js
node --check js/collection.js
```

瀏覽器整合測試需要 Chromium（預設 `/usr/bin/chromium`，可用 `CHROMIUM_BIN` 指定）。先從儲存庫上一層啟動 port 8000 的 HTTP 伺服器，另開終端在本儲存庫執行：

```sh
npm run test:browser
# 不同網址可使用：
TEST_URL=http://localhost:8000/ npm run test:browser
```

`npm test` 與 `npm run test` 執行相同的核心測試；實際 Chromium 測試命令為 `npm run test:browser`。

腳本會使用獨立暫存瀏覽器設定檔與示範收藏，結束後移除，**不讀取你的日常瀏覽器收藏**。輸出到忽略的 `test-results/`：`desktop.png`（1280px）、`mobile.png`（375px）、`sticky-1280.png`／`sticky-375.png`、`detail-1280.png`／`detail-375.png`、`backup-1280.png`／`backup-375.png` 、`legacy-320.png`／`legacy-375.png` 及 `browser-result.json`。不需 Playwright 或瀏覽器擴充套件。

自動化涵蓋：

- 核心測試：穩定 ID、圖片檔案存在、獨立收藏、0／1 操作、舊數量保留、種數統計、舊 pending 合併保留、未知 ID、驗證、篩選、儲存錯誤。
- Chromium 以 `/Kpop-Collection/` 子路徑載入，操作兩種檢視、勾選／取消、同時已擁有與想要、重新整理、無版本專輯提示，以及舊操作介面已移除。
- 舊 localStorage 載入不改寫、一次性提醒、實際備份下載、保留／取消／確認移除、過期備份防護及寫入失敗保護。
- JSON 錯誤格式拒絕、匯出、合併、覆蓋取消／確認、還原舊備份與目錄外紀錄保留。
- 1600／1280／1024／768／375／320px：兩種檢視無水平溢出、團體／統計間距 20px、統計卡片含內距與邊框最多 150px、手機上下排列、深色 dialog、sticky header 及錨點位置。
- 損壞資料救援、儲存失敗回復、Escape 關閉、無未捕捉 JavaScript／console 錯誤及失敗資源請求。

真實 iOS Safari／Firefox、螢幕閱讀器尚需人工驗收。正式環境的第三版驗收須待 PR 合併與 Pages 部署完成。

## 隱私與後續建議

沒有帳號、分析追蹤、API 上傳或伺服器收藏儲存；個人收藏只寫入 localStorage，匯出與救援檔不會自動提交至 Git。`.gitignore` 排除預設備份檔名與測試產物；若自行更名備份，仍請不要放入公開儲存庫。

下一步可補齊並核實 TWICE 全目錄、取得封面授權、加入其他團體，再依需要改善跨裝置備份與資料整理。
